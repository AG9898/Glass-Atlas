import { type RequestHandler } from '@sveltejs/kit';
import { assembleContext } from '$lib/server/chat';
import { streamChatCompletion } from '$lib/server/ai/openrouter';
import { SYSTEM_PROMPT } from '$lib/server/personality';
import { recordCitations } from '$lib/server/db/notes';

// ---------------------------------------------------------------------------
// In-memory rate limiter: 10 requests per IP per hour.
// Keys are SHA-256 hashes of the requester's IP address.
// State survives between requests on the same persistent server process.
// ---------------------------------------------------------------------------

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in ms

const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Returns a SHA-256 hex digest of `input`.
 * Uses the Web Crypto API (available in Bun and all modern runtimes).
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks the rate limit for the given IP address string.
 * Returns `true` when the request should be allowed, `false` when it should be blocked.
 * Increments the counter on every allowed request.
 */
async function checkRateLimit(ip: string): Promise<boolean> {
  const key = await sha256Hex(ip);
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // No entry or window expired — start a fresh window
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  // --- 1. Parse and validate request body ---
  let message: string;
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).message !== 'string'
    ) {
      throw new Error('Missing required field: message');
    }
    message = (body as Record<string, unknown>).message as string;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- 2. Determine requester IP ---
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : getClientAddress();

  // --- 3. Enforce rate limit ---
  const allowed = await checkRateLimit(ip);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- 4. Build RAG context ---
  const { context, citedSlugs } = await assembleContext(message);

  // --- 5. Record citations (fire-and-forget — does not block the stream) ---
  if (citedSlugs.length > 0) {
    recordCitations(citedSlugs).catch((err: unknown) => {
      console.error('[chat] Failed to record citations:', err);
    });
  }

  // --- 6. Assemble messages for LLM ---
  const userContent = context
    ? `${context}\n\nUser question: ${message}`
    : `User question: ${message}`;

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: userContent },
  ];

  // --- 7. Stream the LLM response ---
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await streamChatCompletion(messages);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[chat] OpenRouter error:', detail);
    return new Response(JSON.stringify({ error: 'LLM request failed' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
