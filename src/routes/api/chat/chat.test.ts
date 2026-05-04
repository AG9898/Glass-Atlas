/**
 * Unit tests for POST /api/chat
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/chat', () => ({
  assembleContext: vi.fn(),
  hasSufficientCoverage: vi.fn(),
  buildFallbackResponse: vi.fn(),
  INSUFFICIENT_COVERAGE_RESPONSE: "I don't have a note on that yet.",
}));

vi.mock('$lib/server/ai/openrouter', () => ({
  streamChatCompletion: vi.fn(),
}));

vi.mock('$lib/server/personality', () => ({
  SYSTEM_PROMPT: 'Test system prompt.',
}));

vi.mock('$lib/server/db/notes', () => ({
  consumeChatRateLimit: vi.fn(),
  recordCitations: vi.fn(),
}));

import { POST } from './+server';
import { assembleContext, hasSufficientCoverage, buildFallbackResponse } from '$lib/server/chat';
import { streamChatCompletion } from '$lib/server/ai/openrouter';
import { consumeChatRateLimit, recordCitations } from '$lib/server/db/notes';

const mockAssembleContext = vi.mocked(assembleContext);
const mockHasSufficientCoverage = vi.mocked(hasSufficientCoverage);
const mockBuildFallbackResponse = vi.mocked(buildFallbackResponse);
const mockStreamChatCompletion = vi.mocked(streamChatCompletion);
const mockConsumeChatRateLimit = vi.mocked(consumeChatRateLimit);
const mockRecordCitations = vi.mocked(recordCitations);

type CookieSetOptions = {
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
};

type CookieStub = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

function createCookies(initial: Record<string, string> = {}): CookieStub {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: vi.fn((name: string) => store.get(name)),
    set: vi.fn((name: string, value: string) => {
      store.set(name, value);
    }),
  };
}

function makeEvent(body: unknown, cookies = createCookies()) {
  return {
    request: new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    cookies,
    url: new URL('http://localhost/api/chat'),
  };
}

type ChatEvent = Parameters<typeof POST>[0];

function callPost(event: ReturnType<typeof makeEvent>): Promise<Response> {
  return Promise.resolve(POST(event as unknown as ChatEvent));
}

async function readStreamBody(res: Response): Promise<string> {
  expect(res.body).toBeInstanceOf(ReadableStream);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let raw = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  return raw;
}

beforeEach(() => {
  vi.clearAllMocks();

  mockAssembleContext.mockResolvedValue({
    context: 'some context',
    citedSlugs: ['note-a'],
    citedNotes: [{ slug: 'note-a', title: 'Note A' }],
    confidence: { tier: 'high', bestSemanticDistance: 0.1, lexicalMatchCount: 0 },
  });
  // Default: sufficient coverage — normal LLM path
  mockHasSufficientCoverage.mockReturnValue(true);
  // Default: fallback builder returns the canned response
  mockBuildFallbackResponse.mockReturnValue("I don't have a note on that yet.");
  mockStreamChatCompletion.mockResolvedValue(new ReadableStream());
  mockConsumeChatRateLimit.mockResolvedValue({
    allowed: true,
    messageCount: 1,
    remaining: 9,
    limit: 10,
    windowStart: new Date('2026-05-01T00:00:00.000Z'),
    resetAt: new Date('2026-05-01T01:00:00.000Z'),
  });
  mockRecordCitations.mockResolvedValue(undefined);
});

describe('POST /api/chat', () => {
  it('returns a text/event-stream response on a valid request', async () => {
    const res = await callPost(makeEvent({ message: 'Hello' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns 400 when message field is missing', async () => {
    const res = await callPost(makeEvent({ notMessage: 'oops' }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when body is not valid JSON', async () => {
    const res = await callPost({
      request: new Request('http://localhost/api/chat', { method: 'POST', body: 'not-json' }),
      cookies: createCookies(),
      url: new URL('http://localhost/api/chat'),
    });

    expect(res.status).toBe(400);
  });

  it('issues a new anonymous cookie on first request when missing', async () => {
    const cookies = createCookies();
    const res = await callPost(makeEvent({ message: 'First request' }, cookies));

    expect(res.status).toBe(200);
    expect(cookies.set).toHaveBeenCalledTimes(1);

    const [name, value, options] = cookies.set.mock.calls[0] as [string, string, CookieSetOptions];
    expect(name).toBe('chat_session');
    expect(value.length).toBeGreaterThan(20);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
  });

  it('reuses the same session cookie bucket across requests', async () => {
    await callPost(makeEvent({ message: 'one' }, createCookies({ chat_session: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })));
    await callPost(makeEvent({ message: 'two' }, createCookies({ chat_session: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })));

    expect(mockConsumeChatRateLimit).toHaveBeenCalledTimes(2);

    const firstHash = mockConsumeChatRateLimit.mock.calls[0][0].sessionHash;
    const secondHash = mockConsumeChatRateLimit.mock.calls[1][0].sessionHash;
    expect(firstHash).toBe(secondHash);
  });

  it('uses independent quota buckets for different session cookies', async () => {
    await callPost(makeEvent({ message: 'one' }, createCookies({ chat_session: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' })));
    await callPost(makeEvent({ message: 'two' }, createCookies({ chat_session: 'cccccccccccccccccccccccccccccccc' })));

    expect(mockConsumeChatRateLimit).toHaveBeenCalledTimes(2);
    const firstHash = mockConsumeChatRateLimit.mock.calls[0][0].sessionHash;
    const secondHash = mockConsumeChatRateLimit.mock.calls[1][0].sessionHash;
    expect(firstHash).not.toBe(secondHash);
  });

  it('falls back to a new cookie when an existing cookie is malformed', async () => {
    const cookies = createCookies({ chat_session: 'not-a-valid-session-token' });

    const res = await callPost(makeEvent({ message: 'hello' }, cookies));

    expect(res.status).toBe(200);
    expect(cookies.set).toHaveBeenCalledTimes(1);

    const [name, value] = cookies.set.mock.calls[0] as [string, string, CookieSetOptions];
    expect(name).toBe('chat_session');
    expect(value).toMatch(/^[a-f0-9]{32}$/i);
    expect(value).not.toBe('not-a-valid-session-token');
  });

  it('returns 429 on request limit+1 for the same session', async () => {
    for (let i = 1; i <= 10; i += 1) {
      mockConsumeChatRateLimit.mockResolvedValueOnce({
        allowed: true,
        messageCount: i,
        remaining: 10 - i,
        limit: 10,
        windowStart: new Date('2026-05-01T00:00:00.000Z'),
        resetAt: new Date('2026-05-01T01:00:00.000Z'),
      });
    }
    mockConsumeChatRateLimit.mockResolvedValueOnce({
      allowed: false,
      messageCount: 11,
      remaining: 0,
      limit: 10,
      windowStart: new Date('2026-05-01T00:00:00.000Z'),
      resetAt: new Date('2026-05-01T01:00:00.000Z'),
    });

    let lastResponse: Response | null = null;
    for (let i = 0; i < 11; i += 1) {
      lastResponse = await callPost(
        makeEvent({ message: `message-${i}` }, createCookies({ chat_session: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' })),
      );
    }

    expect(lastResponse).not.toBeNull();
    expect(lastResponse?.status).toBe(429);
    expect(mockAssembleContext).toHaveBeenCalledTimes(10);
    expect(mockStreamChatCompletion).toHaveBeenCalledTimes(10);
  });

  it('returns 429 before retrieval/LLM work when over quota', async () => {
    mockConsumeChatRateLimit.mockResolvedValueOnce({
      allowed: false,
      messageCount: 11,
      remaining: 0,
      limit: 10,
      windowStart: new Date('2026-05-01T00:00:00.000Z'),
      resetAt: new Date('2026-05-01T01:00:00.000Z'),
    });

    const res = await callPost(makeEvent({ message: 'blocked' }, createCookies({ chat_session: 'dddddddddddddddddddddddddddddddd' })));

    expect(res.status).toBe(429);
    expect(mockAssembleContext).not.toHaveBeenCalled();
    expect(mockStreamChatCompletion).not.toHaveBeenCalled();

    const body = await res.json();
    expect(body.error).toBe('Rate limit exceeded');
  });

  it('calls assembleContext with the user message', async () => {
    await callPost(makeEvent({ message: 'What is RAG?' }));

    expect(mockAssembleContext).toHaveBeenCalledWith('What is RAG?');
  });

  it('records citations for cited slugs (fire-and-forget)', async () => {
    await callPost(makeEvent({ message: 'Tell me about embeddings' }));

    await Promise.resolve();

    expect(mockRecordCitations).toHaveBeenCalledWith(['note-a']);
  });

  it('does NOT call recordCitations when citedSlugs is empty', async () => {
    mockAssembleContext.mockResolvedValueOnce({
      context: '',
      citedSlugs: [],
      citedNotes: [],
      confidence: { tier: 'low', bestSemanticDistance: null, lexicalMatchCount: 0 },
    });

    await callPost(makeEvent({ message: 'unknown topic' }));
    await Promise.resolve();

    expect(mockRecordCitations).not.toHaveBeenCalled();
  });

  it('returns 503 when streamChatCompletion throws', async () => {
    mockStreamChatCompletion.mockRejectedValueOnce(new Error('OpenRouter down'));

    const res = await callPost(makeEvent({ message: 'Tell me about retrieval.' }));

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe('LLM request failed');
  });

  it('handles greeting small-talk without retrieval or LLM calls', async () => {
    const res = await callPost(makeEvent({ message: 'hello' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(mockAssembleContext).not.toHaveBeenCalled();
    expect(mockStreamChatCompletion).not.toHaveBeenCalled();
    expect(mockRecordCitations).not.toHaveBeenCalled();

    const raw = await readStreamBody(res);
    expect(raw).toContain('I can chat');
    expect(raw).toContain('published notes');
  });

  it('handles capability questions with social lane reply', async () => {
    const res = await callPost(makeEvent({ message: 'What does this chat do?' }));

    expect(res.status).toBe(200);
    expect(mockAssembleContext).not.toHaveBeenCalled();
    expect(mockStreamChatCompletion).not.toHaveBeenCalled();

    const raw = await readStreamBody(res);
    expect(raw).toContain('published notes');
    expect(raw).toContain('actually written');
  });

  it('keeps social-intent replies templated and outside factual QA', async () => {
    const res = await callPost(makeEvent({ message: 'who are you?' }));

    expect(res.status).toBe(200);
    expect(mockAssembleContext).not.toHaveBeenCalled();
    expect(mockStreamChatCompletion).not.toHaveBeenCalled();

    const raw = await readStreamBody(res);
    expect(raw).toContain('published notes');
    expect(raw).not.toContain('Related notes:');
  });

  it('the response uses new Response(stream), not json()', async () => {
    const res = await callPost(makeEvent({ message: 'test' }));

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(ReadableStream);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  // ----- Confidence-gate / insufficient-coverage fallback -----

  it('returns a 200 SSE stream on low-confidence retrieval without calling the LLM', async () => {
    mockAssembleContext.mockResolvedValueOnce({
      context: '',
      citedSlugs: [],
      citedNotes: [],
      confidence: { tier: 'low', bestSemanticDistance: null, lexicalMatchCount: 0 },
    });
    mockHasSufficientCoverage.mockReturnValueOnce(false);

    const res = await callPost(makeEvent({ message: 'unknown topic' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    // LLM must not be called on the low-confidence path
    expect(mockStreamChatCompletion).not.toHaveBeenCalled();
  });

  it('passes low-confidence metadata into the confidence gate', async () => {
    const lowConfidenceContext = {
      context: 'Retrieved notes:\n\nSlug: distant-note',
      citedSlugs: ['distant-note'],
      citedNotes: [{ slug: 'distant-note', title: 'Distant Note' }],
      confidence: { tier: 'low' as const, bestSemanticDistance: 0.8, lexicalMatchCount: 0 },
    };
    mockAssembleContext.mockResolvedValueOnce(lowConfidenceContext);
    mockHasSufficientCoverage.mockReturnValueOnce(false);

    await callPost(makeEvent({ message: 'unrelated query' }));

    expect(mockHasSufficientCoverage).toHaveBeenCalledWith(lowConfidenceContext);
    expect(mockStreamChatCompletion).not.toHaveBeenCalled();
  });

  it('fallback SSE stream contains the canned insufficient-coverage message', async () => {
    mockAssembleContext.mockResolvedValueOnce({
      context: '',
      citedSlugs: [],
      citedNotes: [],
      confidence: { tier: 'low', bestSemanticDistance: null, lexicalMatchCount: 0 },
    });
    mockHasSufficientCoverage.mockReturnValueOnce(false);

    const res = await callPost(makeEvent({ message: 'unknown topic' }));
    const raw = await readStreamBody(res);

    // Must contain the canned response text somewhere in the SSE payload
    expect(raw).toContain("I don't have a note on that yet.");
  });

  it('fallback path passes citedNotes to buildFallbackResponse', async () => {
    const relatedNotes = [{ slug: 'rag-pipeline', title: 'RAG Pipeline' }];
    mockAssembleContext.mockResolvedValueOnce({
      context: '',
      citedSlugs: [],
      citedNotes: relatedNotes,
      confidence: { tier: 'low', bestSemanticDistance: null, lexicalMatchCount: 0 },
    });
    mockHasSufficientCoverage.mockReturnValueOnce(false);

    await callPost(makeEvent({ message: 'unknown topic' }));

    expect(mockBuildFallbackResponse).toHaveBeenCalledWith(relatedNotes, 'unknown topic');
  });

  it('fallback path does not call recordCitations', async () => {
    mockAssembleContext.mockResolvedValueOnce({
      context: '',
      citedSlugs: [],
      citedNotes: [],
      confidence: { tier: 'low', bestSemanticDistance: null, lexicalMatchCount: 0 },
    });
    mockHasSufficientCoverage.mockReturnValueOnce(false);

    await callPost(makeEvent({ message: 'unknown topic' }));
    await Promise.resolve();

    expect(mockRecordCitations).not.toHaveBeenCalled();
  });

  it('high-confidence path still calls the LLM', async () => {
    // Default mocks: assembleContext returns context + slug, hasSufficientCoverage returns true
    await callPost(makeEvent({ message: 'What is RAG?' }));

    expect(mockStreamChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('borderline-confidence path remains distinguishable and still calls the LLM', async () => {
    const borderlineContext = {
      context: 'Retrieved notes:\n\nSlug: adjacent-note',
      citedSlugs: ['adjacent-note'],
      citedNotes: [{ slug: 'adjacent-note', title: 'Adjacent Note' }],
      confidence: { tier: 'borderline' as const, bestSemanticDistance: 0.38, lexicalMatchCount: 1 },
    };
    mockAssembleContext.mockResolvedValueOnce(borderlineContext);
    mockHasSufficientCoverage.mockReturnValueOnce(true);

    await callPost(makeEvent({ message: 'adjacent question' }));

    expect(mockHasSufficientCoverage).toHaveBeenCalledWith(borderlineContext);
    expect(mockStreamChatCompletion).toHaveBeenCalledTimes(1);
  });

  it('borderline-confidence path adds a limited-coverage instruction to the LLM prompt', async () => {
    mockAssembleContext.mockResolvedValueOnce({
      context: 'Retrieved notes:\n\nSlug: adjacent-note',
      citedSlugs: ['adjacent-note'],
      citedNotes: [{ slug: 'adjacent-note', title: 'Adjacent Note' }],
      confidence: { tier: 'borderline', bestSemanticDistance: 0.38, lexicalMatchCount: 1 },
    });
    mockHasSufficientCoverage.mockReturnValueOnce(true);

    await callPost(makeEvent({ message: 'adjacent question' }));

    const [messages] = mockStreamChatCompletion.mock.calls[0];
    const userMsg = messages.find((m) => m.role === 'user');
    expect(userMsg?.content).toContain('Limited coverage:');
    expect(userMsg?.content).toContain('adjacent or partial evidence');
    expect(userMsg?.content).toContain('Retrieved notes:');
  });

  it('high-confidence path includes context in the LLM user message', async () => {
    mockAssembleContext.mockResolvedValueOnce({
      context: 'Retrieved notes:\n\nSlug: rag-basics',
      citedSlugs: ['rag-basics'],
      citedNotes: [{ slug: 'rag-basics', title: 'RAG Basics' }],
      confidence: { tier: 'high', bestSemanticDistance: 0.12, lexicalMatchCount: 0 },
    });
    mockHasSufficientCoverage.mockReturnValueOnce(true);

    await callPost(makeEvent({ message: 'explain RAG' }));

    const [messages] = mockStreamChatCompletion.mock.calls[0];
    const userMsg = messages.find((m) => m.role === 'user');
    expect(userMsg?.content).toContain('Retrieved notes:');
    expect(userMsg?.content).toContain('explain RAG');
    expect(userMsg?.content).not.toContain('Limited coverage:');
  });
});
