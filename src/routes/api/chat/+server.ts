import { type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { assembleContext } from '$lib/server/chat';
import { streamChatCompletion } from '$lib/server/ai/openrouter';
import { SYSTEM_PROMPT } from '$lib/server/personality';
import { consumeChatRateLimit, recordCitations } from '$lib/server/db/notes';

const RATE_LIMIT_MAX_DEFAULT = 10;
const RATE_LIMIT_WINDOW_MINUTES_DEFAULT = 60;
const CHAT_SESSION_COOKIE_NAME_DEFAULT = 'chat_session';
const CHAT_SESSION_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365;

const RATE_LIMIT_MAX = parsePositiveInt(env.CHAT_RATE_LIMIT_MAX, RATE_LIMIT_MAX_DEFAULT);
const RATE_LIMIT_WINDOW_MINUTES = parsePositiveInt(
  env.CHAT_RATE_LIMIT_WINDOW_MINUTES,
  RATE_LIMIT_WINDOW_MINUTES_DEFAULT,
);
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
const CHAT_SESSION_COOKIE_NAME = env.CHAT_SESSION_COOKIE_NAME ?? CHAT_SESSION_COOKIE_NAME_DEFAULT;

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

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function generateSessionToken(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function isValidSessionToken(value: string): boolean {
  return /^[a-f0-9]{32}$/i.test(value);
}

function setChatSessionCookie(
  cookies: {
    set: (
      name: string,
      value: string,
      options: {
        httpOnly: boolean;
        sameSite: 'lax';
        secure: boolean;
        path: string;
        maxAge: number;
      },
    ) => void;
  },
  url: URL,
  sessionToken: string,
): void {
  cookies.set(CHAT_SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/',
    maxAge: CHAT_SESSION_COOKIE_TTL_SECONDS,
  });
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

export const POST: RequestHandler = async ({ request, cookies, url }) => {
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

  // --- 2. Read or issue anonymous chat session cookie ---
  let sessionToken = cookies.get(CHAT_SESSION_COOKIE_NAME);
  if (!sessionToken || !isValidSessionToken(sessionToken)) {
    sessionToken = generateSessionToken();
    setChatSessionCookie(cookies, url, sessionToken);
  }

  // --- 3. Enforce per-session quota before retrieval/LLM work ---
  const sessionHash = await sha256Hex(sessionToken);
  let quota: Awaited<ReturnType<typeof consumeChatRateLimit>>;
  try {
    quota = await consumeChatRateLimit({
      sessionHash,
      maxMessages: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[chat] Rate-limit persistence error:', detail);
    return new Response(JSON.stringify({ error: 'Rate limit check failed' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!quota.allowed) {
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
