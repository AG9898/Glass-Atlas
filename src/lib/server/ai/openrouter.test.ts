import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1/',
  OPENROUTER_MODEL: 'test-model',
  OPENROUTER_FALLBACK_MODEL: 'fallback-model',
}));

vi.mock('$env/dynamic/private', () => ({
  env: envMock,
}));

import {
  DEFAULT_OPENROUTER_STREAM_STALL_TIMEOUT_MS,
  DEFAULT_OPENROUTER_TIMEOUT_MS,
  streamChatCompletion,
} from './openrouter';

/** A stream whose reads never resolve — simulates a stalled upstream connection. */
function makeHangingStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    pull() {
      return new Promise(() => {
        // never resolves
      });
    },
  });
}

function makeSseStream(dataLines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of dataLines) {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      }
      controller.close();
    },
  });
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let raw = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }

  return raw;
}

function getRequestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number): unknown {
  const init = fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  if (typeof init?.body !== 'string') return null;
  return JSON.parse(init.body) as unknown;
}

describe('streamChatCompletion', () => {
  beforeEach(() => {
    envMock.OPENROUTER_API_KEY = 'test-key';
    envMock.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1/';
    envMock.OPENROUTER_MODEL = 'test-model';
    envMock.OPENROUTER_FALLBACK_MODEL = 'fallback-model';
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a streaming request to the OpenRouter chat completions endpoint', async () => {
    const stream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'hi' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi.fn(async () => new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const messages = [
      { role: 'system' as const, content: 'You are helpful.' },
      { role: 'user' as const, content: 'Hello' },
    ];

    const result = await streamChatCompletion(messages);

    expect(result).toBeInstanceOf(ReadableStream);
    expect(fetchMock).toHaveBeenCalledWith('https://openrouter.test/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'test-model',
        messages,
        stream: true,
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('rejects when OPENROUTER_API_KEY is missing', async () => {
    envMock.OPENROUTER_API_KEY = '';

    await expect(
      streamChatCompletion([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow('OPENROUTER_API_KEY is not configured.');
  });

  it('rejects on non-retryable non-OK HTTP responses without fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad request', { status: 400 })),
    );

    await expect(
      streamChatCompletion([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow('OpenRouter chat request failed with 400: bad request');
  });

  it('rejects when the response body is null', async () => {
    const mockResponse = new Response(null, { status: 200 });
    vi.stubGlobal('fetch', vi.fn(async () => mockResponse));

    await expect(
      streamChatCompletion([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow('OpenRouter chat response has no body.');
  });

  it('falls back to default base URL when OPENROUTER_BASE_URL is not set', async () => {
    envMock.OPENROUTER_BASE_URL = '';
    const stream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'hi' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi.fn(async () => new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await streamChatCompletion([{ role: 'user', content: 'Hello' }]);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('openrouter.ai/api/v1/chat/completions'),
      expect.anything(),
    );
  });

  it('defaults to the Nemotron primary model and openrouter/free fallback model', async () => {
    envMock.OPENROUTER_MODEL = '';
    envMock.OPENROUTER_FALLBACK_MODEL = '';
    const stream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'fallback answer' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await streamChatCompletion([{ role: 'user', content: 'Hello' }]);
    await readStream(result);

    expect(getRequestBody(fetchMock, 0)).toMatchObject({
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    });
    expect(getRequestBody(fetchMock, 1)).toMatchObject({ model: 'openrouter/free' });
  });

  it('uses the fallback model after a primary rate-limit response', async () => {
    const stream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'fallback answer' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await streamChatCompletion([{ role: 'user', content: 'Hello' }]);
    const raw = await readStream(result);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestBody(fetchMock, 0)).toMatchObject({ model: 'test-model' });
    expect(getRequestBody(fetchMock, 1)).toMatchObject({ model: 'fallback-model' });
    expect(raw).toContain('fallback answer');
  });

  it('uses the fallback model after a primary temporary provider failure', async () => {
    const stream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'fallback answer' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('provider unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await streamChatCompletion([{ role: 'user', content: 'Hello' }]);
    const raw = await readStream(result);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(raw).toContain('fallback answer');
  });

  it('rejects with primary and fallback details when fallback also fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('primary down', { status: 502 }))
        .mockResolvedValueOnce(new Response('fallback down', { status: 503 })),
    );

    await expect(
      streamChatCompletion([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow(
      'OpenRouter chat request failed after fallback. Primary: OpenRouter chat request failed with 502: primary down Fallback: OpenRouter chat request failed with 503: fallback down',
    );
  });

  it('uses the fallback model after the primary request times out', async () => {
    vi.useFakeTimers();
    const stream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'fallback answer' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi.fn((_: string, initArg: RequestInit | undefined) => {
      if (fetchMock.mock.calls.length === 1) {
        return new Promise<Response>((_, reject) => {
          initArg?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }

      return Promise.resolve(new Response(stream, { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = streamChatCompletion([{ role: 'user', content: 'Hello' }]);
    await vi.advanceTimersByTimeAsync(DEFAULT_OPENROUTER_TIMEOUT_MS);
    const result = await resultPromise;
    const raw = await readStream(result);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestBody(fetchMock, 1)).toMatchObject({ model: 'fallback-model' });
    expect(raw).toContain('fallback answer');
  });

  it('filters reasoning-only deltas while preserving visible delta.content text', async () => {
    const stream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { reasoning: 'hidden reasoning' }, index: 0 }] }),
      JSON.stringify({ choices: [{ delta: { content: 'visible answer' }, index: 0 }] }),
      JSON.stringify({
        choices: [{ delta: { reasoning: 'more hidden reasoning', content: ' still visible' }, index: 0 }],
      }),
      '[DONE]',
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 200 })));

    const result = await streamChatCompletion([{ role: 'user', content: 'Hello' }]);
    const raw = await readStream(result);

    expect(raw).toContain('visible answer');
    expect(raw).toContain(' still visible');
    expect(raw).toContain('[DONE]');
    expect(raw).not.toContain('hidden reasoning');
    expect(raw).not.toContain('more hidden reasoning');
  });

  it('retries with the fallback model when the primary stream returns an in-band SSE error event', async () => {
    const errorStream = makeSseStream([
      JSON.stringify({ error: { code: 502, message: 'Upstream error from Nvidia: ResourceExhausted' } }),
    ]);
    const fallbackStream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'fallback answer' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(errorStream, { status: 200 }))
      .mockResolvedValueOnce(new Response(fallbackStream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await streamChatCompletion([{ role: 'user', content: 'Hello' }]);
    const raw = await readStream(result);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestBody(fetchMock, 1)).toMatchObject({ model: 'fallback-model' });
    expect(raw).toContain('fallback answer');
    errorSpy.mockRestore();
  });

  it('retries with the fallback model when the primary stream completes with zero visible content', async () => {
    const emptyStream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { reasoning: 'thinking only' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fallbackStream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'fallback answer' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(emptyStream, { status: 200 }))
      .mockResolvedValueOnce(new Response(fallbackStream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await streamChatCompletion([{ role: 'user', content: 'Hello' }]);
    const raw = await readStream(result);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestBody(fetchMock, 1)).toMatchObject({ model: 'fallback-model' });
    expect(raw).toContain('fallback answer');
  });

  it('aborts a stalled primary stream and retries with the fallback model', async () => {
    vi.useFakeTimers();
    const fallbackStream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'fallback answer' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(makeHangingStream(), { status: 200 }))
      .mockResolvedValueOnce(new Response(fallbackStream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = streamChatCompletion([{ role: 'user', content: 'Hello' }]);
    await vi.advanceTimersByTimeAsync(DEFAULT_OPENROUTER_STREAM_STALL_TIMEOUT_MS);
    const result = await resultPromise;
    const raw = await readStream(result);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestBody(fetchMock, 1)).toMatchObject({ model: 'fallback-model' });
    expect(raw).toContain('fallback answer');
  });

  it('closes the stream gracefully instead of retrying when an in-band error arrives after content already streamed', async () => {
    const stream = makeSseStream([
      JSON.stringify({ choices: [{ delta: { content: 'partial answer' }, index: 0 }] }),
      JSON.stringify({ error: { code: 502, message: 'Upstream error from Nvidia: ResourceExhausted' } }),
    ]);
    const fetchMock = vi.fn(async () => new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await streamChatCompletion([{ role: 'user', content: 'Hello' }]);
    const raw = await readStream(result);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(raw).toContain('partial answer');
    expect(raw).toContain('[DONE]');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('logs provider detail and rejects when both primary and fallback streams fail', async () => {
    const primaryError = makeSseStream([
      JSON.stringify({ error: { code: 502, message: 'Upstream error from Nvidia: ResourceExhausted' } }),
    ]);
    const fallbackError = makeSseStream([
      JSON.stringify({ choices: [{ delta: { reasoning: 'thinking only' }, index: 0 }] }),
      '[DONE]',
    ]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(primaryError, { status: 200 }))
      .mockResolvedValueOnce(new Response(fallbackError, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(streamChatCompletion([{ role: 'user', content: 'Hello' }])).rejects.toThrow(
      /OpenRouter chat request failed after fallback\. Primary: OpenRouter in-band error: .*Fallback: OpenRouter stream completed with no visible content\./,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      '[openrouter] Both primary and fallback models failed:',
      expect.stringContaining('OpenRouter in-band error'),
    );
    errorSpy.mockRestore();
  });
});
