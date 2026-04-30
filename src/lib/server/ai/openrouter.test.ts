import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1/',
  OPENROUTER_MODEL: 'test-model',
}));

vi.mock('$env/dynamic/private', () => ({
  env: envMock,
}));

import { streamChatCompletion } from './openrouter';

describe('streamChatCompletion', () => {
  beforeEach(() => {
    envMock.OPENROUTER_API_KEY = 'test-key';
    envMock.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1/';
    envMock.OPENROUTER_MODEL = 'test-model';
    vi.unstubAllGlobals();
  });

  it('sends a streaming request to the OpenRouter chat completions endpoint', async () => {
    const stream = new ReadableStream<Uint8Array>();
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
    });
  });

  it('rejects when OPENROUTER_API_KEY is missing', async () => {
    envMock.OPENROUTER_API_KEY = '';

    await expect(
      streamChatCompletion([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow('OPENROUTER_API_KEY is not configured.');
  });

  it('rejects on non-OK HTTP responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('rate limited', { status: 429 })),
    );

    await expect(
      streamChatCompletion([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow('OpenRouter chat request failed with 429: rate limited');
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
    const stream = new ReadableStream<Uint8Array>();
    const fetchMock = vi.fn(async () => new Response(stream, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await streamChatCompletion([{ role: 'user', content: 'Hello' }]);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('openrouter.ai/api/v1/chat/completions'),
      expect.anything(),
    );
  });
});
