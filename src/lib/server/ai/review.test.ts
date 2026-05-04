import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1/',
  OPENROUTER_REVIEW_MODEL: '',
}));

vi.mock('$env/dynamic/private', () => ({
  env: envMock,
}));

import { streamNoteReview } from './review';

const REVIEW_INPUT = {
  title: 'A first note',
  takeaway: 'Writing clarifies thinking.',
  body: 'Draft body text.',
};

describe('streamNoteReview', () => {
  beforeEach(() => {
    envMock.OPENROUTER_API_KEY = 'test-key';
    envMock.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1/';
    envMock.OPENROUTER_REVIEW_MODEL = '';
    vi.unstubAllGlobals();
  });

  it('uses the OpenRouter free model router by default', async () => {
    const stream = new ReadableStream<Uint8Array>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(stream, { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await streamNoteReview(REVIEW_INPUT);

    expect(response.body).toBeInstanceOf(ReadableStream);
    expect(fetchMock).toHaveBeenCalledWith('https://openrouter.test/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: expect.any(String),
    });

    const firstCall = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(String(firstCall?.[1]?.body)) as {
      model?: unknown;
      stream?: unknown;
    };
    expect(requestBody.model).toBe('openrouter/free');
    expect(requestBody.stream).toBe(true);
  });

  it('uses OPENROUTER_REVIEW_MODEL when configured', async () => {
    envMock.OPENROUTER_REVIEW_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(new ReadableStream<Uint8Array>(), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await streamNoteReview(REVIEW_INPUT);

    const firstCall = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(String(firstCall?.[1]?.body)) as {
      model?: unknown;
    };
    expect(requestBody.model).toBe('meta-llama/llama-3.2-3b-instruct:free');
  });

  it('rejects when OPENROUTER_API_KEY is missing', async () => {
    envMock.OPENROUTER_API_KEY = '';

    await expect(streamNoteReview(REVIEW_INPUT)).rejects.toThrow(
      'OPENROUTER_API_KEY is not configured.',
    );
  });
});
