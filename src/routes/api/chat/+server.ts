import { type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { assembleContext, hasSufficientCoverage, buildFallbackResponse } from '$lib/server/chat';
import { streamChatCompletion } from '$lib/server/ai/openrouter';
import { SYSTEM_PROMPT } from '$lib/server/personality';
import { consumeChatRateLimit, recordCitations } from '$lib/server/db/notes';

const RATE_LIMIT_MAX_DEFAULT = 10;
const RATE_LIMIT_WINDOW_MINUTES_DEFAULT = 60;
const CHAT_SESSION_COOKIE_NAME_DEFAULT = 'chat_session';
const CHAT_SESSION_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 365;
const LIMITED_COVERAGE_INSTRUCTION =
  'Limited coverage: the retrieved notes are adjacent or partial evidence, not a direct hit. Say that plainly, answer only what the notes support, avoid filling gaps, and steer toward the closest documented angle.';

const RATE_LIMIT_MAX = parsePositiveInt(env.CHAT_RATE_LIMIT_MAX, RATE_LIMIT_MAX_DEFAULT);
const RATE_LIMIT_WINDOW_MINUTES = parsePositiveInt(
  env.CHAT_RATE_LIMIT_WINDOW_MINUTES,
  RATE_LIMIT_WINDOW_MINUTES_DEFAULT,
);
const RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
const CHAT_SESSION_COOKIE_NAME = env.CHAT_SESSION_COOKIE_NAME ?? CHAT_SESSION_COOKIE_NAME_DEFAULT;

type SocialIntent = 'greeting' | 'thanks' | 'howItWorks' | 'capabilities' | 'identity';

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

function detectSocialIntent(message: string): SocialIntent | null {
  const normalized = normalizeMessage(message);
  if (!normalized) return null;

  if (
    /^(hi|hello|hey|yo|good morning|good afternoon|good evening)([!.?]+)?$/.test(normalized)
  ) {
    return 'greeting';
  }

  if (/^(thanks|thank you|thx|ty)([!.?]+)?$/.test(normalized)) {
    return 'thanks';
  }

  if (
    normalized.includes('what does this site do') ||
    normalized.includes('what does this chat do') ||
    normalized.includes('what is this site') ||
    normalized.includes('what is this chat')
  ) {
    return 'howItWorks';
  }

  if (
    normalized.includes('what can you do') ||
    normalized.includes('how can you help') ||
    normalized.includes('what should i ask')
  ) {
    return 'capabilities';
  }

  if (normalized.includes('who are you') || normalized.includes('what are you')) {
    return 'identity';
  }

  return null;
}

function buildSocialReply(intent: SocialIntent): string {
  switch (intent) {
    case 'greeting':
      return "Hey. I can chat from my published notes. Ask for a topic or a specific note and I will pull from what I have written.";
    case 'thanks':
      return 'Anytime. If you want to keep going, give me a topic or ask for a specific note and I will share the relevant writing.';
    case 'howItWorks':
      return 'I use this chat as a guide to my published notes. Give me a topic and I will stick to what I have actually written.';
    case 'capabilities':
      return 'I can summarize my published notes, answer questions I have already documented, and point you to related posts. Ask for a topic, project, or a specific note title.';
    case 'identity':
      return 'I am the Glass Atlas assistant, speaking from my published notes. Ask me about a topic and I will answer from what I have documented.';
    default:
      return "I don't have a note on that yet.";
  }
}

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

/**
 * Wraps a plain-text `message` in an SSE stream that uses the same
 * OpenAI streaming chunk format as the real LLM path.
 *
 * The client's `extractToken` function reads `choices[0].delta.content`, so
 * we emit one `data:` line with that structure followed by a `[DONE]`
 * sentinel, then close the stream. This ensures the confidence-gate fallback
 * response is indistinguishable from a normal LLM stream at the transport
 * layer.
 */
function makeFallbackStream(message: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunk = JSON.stringify({
    choices: [{ delta: { content: message }, finish_reason: null, index: 0 }],
  });
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
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

  // --- 4. Short social-chat lane (safe, no factual claims) ---
  const socialIntent = detectSocialIntent(message);
  if (socialIntent) {
    return new Response(makeFallbackStream(buildSocialReply(socialIntent)), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // --- 5. Build RAG context ---
  const assembledCtx = await assembleContext(message);
  const { context, citedSlugs, citedNotes } = assembledCtx;

  // --- 6. Confidence gate: short-circuit to fallback when retrieval is low-confidence or empty ---
  if (!hasSufficientCoverage(assembledCtx)) {
    const fallbackText = buildFallbackResponse(citedNotes, message);
    return new Response(makeFallbackStream(fallbackText), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // --- 7. Record citations (fire-and-forget — does not block the stream) ---
  if (citedSlugs.length > 0) {
    recordCitations(citedSlugs).catch((err: unknown) => {
      console.error('[chat] Failed to record citations:', err);
    });
  }

  // --- 8. Assemble messages for LLM ---
  const limitedCoveragePrefix =
    assembledCtx.confidence.tier === 'borderline' ? `${LIMITED_COVERAGE_INSTRUCTION}\n\n` : '';
  const userContent = `${limitedCoveragePrefix}${context}\n\nUser question: ${message}`;

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: userContent },
  ];

  // --- 9. Stream the LLM response ---
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
