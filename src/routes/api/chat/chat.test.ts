/**
 * Unit tests for POST /api/chat
 *
 * Tests are structured to exercise:
 * - Rate limiting (10 req/hr per hashed IP)
 * - SSE streaming response
 * - Fire-and-forget citation recording
 * - Error handling for bad bodies and upstream failures
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist mocks before module imports
// ---------------------------------------------------------------------------

vi.mock('$lib/server/chat', () => ({
  assembleContext: vi.fn(),
}));

vi.mock('$lib/server/ai/openrouter', () => ({
  streamChatCompletion: vi.fn(),
}));

vi.mock('$lib/server/personality', () => ({
  SYSTEM_PROMPT: 'Test system prompt.',
}));

vi.mock('$lib/server/db/notes', () => ({
  recordCitations: vi.fn(),
}));

import { assembleContext } from '$lib/server/chat';
import { streamChatCompletion } from '$lib/server/ai/openrouter';
import { recordCitations } from '$lib/server/db/notes';

const mockAssembleContext = vi.mocked(assembleContext);
const mockStreamChatCompletion = vi.mocked(streamChatCompletion);
const mockRecordCitations = vi.mocked(recordCitations);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal SvelteKit-like request event for the route handler. */
function makeEvent(body: unknown, ip = '127.0.0.1') {
  return {
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    getClientAddress: () => ip,
  };
}

/** Builds an event with a custom x-forwarded-for header. */
function makeEventForwarded(body: unknown, forwarded: string) {
  return {
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': forwarded,
      },
      body: JSON.stringify(body),
    }),
    getClientAddress: () => '10.0.0.1',
  };
}

// ---------------------------------------------------------------------------
// Import handler *after* mocks are set up
// ---------------------------------------------------------------------------

// We use a dynamic import so vi.mock() hoisting has fully settled.
// The module is re-imported fresh per test run via vi.resetModules().
let POST: (event: ReturnType<typeof makeEvent>) => Promise<Response>;

beforeEach(async () => {
  vi.clearAllMocks();

  // Default happy-path returns
  mockAssembleContext.mockResolvedValue({ context: 'some context', citedSlugs: ['note-a'] });
  mockStreamChatCompletion.mockResolvedValue(new ReadableStream());
  mockRecordCitations.mockResolvedValue(undefined);

  // Re-import the handler module to get a fresh rate-limit map each test.
  vi.resetModules();

  // Re-apply mocks after module reset
  vi.mock('$lib/server/chat', () => ({
    assembleContext: vi.fn().mockResolvedValue({ context: 'some context', citedSlugs: ['note-a'] }),
  }));
  vi.mock('$lib/server/ai/openrouter', () => ({
    streamChatCompletion: vi.fn().mockResolvedValue(new ReadableStream()),
  }));
  vi.mock('$lib/server/personality', () => ({
    SYSTEM_PROMPT: 'Test system prompt.',
  }));
  vi.mock('$lib/server/db/notes', () => ({
    recordCitations: vi.fn().mockResolvedValue(undefined),
  }));

  const mod = await import('./+server');
  POST = mod.POST as unknown as typeof POST;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/chat', () => {
  it('returns a text/event-stream response on a valid request', async () => {
    const event = makeEvent({ message: 'Hello' });
    const res = await POST(event);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns 400 when message field is missing', async () => {
    const event = makeEvent({ notMessage: 'oops' });
    const res = await POST(event);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when body is not valid JSON', async () => {
    const event = {
      request: new Request('http://localhost/api/chat', {
        method: 'POST',
        body: 'not-json',
      }),
      getClientAddress: () => '127.0.0.1',
    };
    const res = await POST(event);

    expect(res.status).toBe(400);
  });

  it('calls assembleContext with the user message', async () => {
    const event = makeEvent({ message: 'What is RAG?' });
    await POST(event);

    const { assembleContext: ac } = await import('$lib/server/chat');
    expect(vi.mocked(ac)).toHaveBeenCalledWith('What is RAG?');
  });

  it('records citations for cited slugs (fire-and-forget)', async () => {
    const event = makeEvent({ message: 'Tell me about embeddings' });
    await POST(event);

    // Allow the microtask queue to flush so the fire-and-forget runs
    await Promise.resolve();

    const { recordCitations: rc } = await import('$lib/server/db/notes');
    expect(vi.mocked(rc)).toHaveBeenCalledWith(['note-a']);
  });

  it('does NOT call recordCitations when citedSlugs is empty', async () => {
    const { assembleContext: ac } = await import('$lib/server/chat');
    vi.mocked(ac).mockResolvedValue({ context: '', citedSlugs: [] });

    const event = makeEvent({ message: 'unknown topic' });
    await POST(event);

    await Promise.resolve();

    const { recordCitations: rc } = await import('$lib/server/db/notes');
    expect(vi.mocked(rc)).not.toHaveBeenCalled();
  });

  it('returns 429 on the 11th request from the same IP within the window', async () => {
    const ip = 'unique-ip-for-rate-limit-test';

    // Allowed for requests 1–10
    for (let i = 0; i < 10; i++) {
      const res = await POST(makeEvent({ message: 'hi' }, ip));
      expect(res.status).toBe(200);
    }

    // 11th request should be blocked
    const res = await POST(makeEvent({ message: 'hi' }, ip));
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.error).toBe('Rate limit exceeded');
  });

  it('uses the first value from x-forwarded-for to determine the rate-limit key', async () => {
    const ip = '203.0.113.1';

    for (let i = 0; i < 10; i++) {
      const res = await POST(makeEventForwarded({ message: 'hi' }, `${ip}, 10.0.0.2`));
      expect(res.status).toBe(200);
    }

    const res = await POST(makeEventForwarded({ message: 'hi' }, `${ip}, 10.0.0.2`));
    expect(res.status).toBe(429);
  });

  it('different IPs have separate rate-limit counters', async () => {
    // Fill up ip-A (10 requests)
    for (let i = 0; i < 10; i++) {
      await POST(makeEvent({ message: 'hi' }, 'ip-A'));
    }

    // ip-B should still be allowed
    const res = await POST(makeEvent({ message: 'hi' }, 'ip-B'));
    expect(res.status).toBe(200);
  });

  it('returns 503 when streamChatCompletion throws', async () => {
    const { streamChatCompletion: sc } = await import('$lib/server/ai/openrouter');
    vi.mocked(sc).mockRejectedValue(new Error('OpenRouter down'));

    const event = makeEvent({ message: 'hello' });
    const res = await POST(event);

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('LLM request failed');
  });

  it('the response uses new Response(stream), not json()', async () => {
    const event = makeEvent({ message: 'test' });
    const res = await POST(event);

    // Verify it is a streaming response (body must be a ReadableStream)
    expect(res.body).toBeInstanceOf(ReadableStream);
  });
});
