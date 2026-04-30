import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1/',
  EMBEDDING_MODEL: 'test-embedding-model',
}));

vi.mock('$env/dynamic/private', () => ({
  env: envMock,
}));

import { embedText } from './embeddings';

describe('embedText', () => {
  beforeEach(() => {
    envMock.OPENROUTER_API_KEY = 'test-key';
    envMock.OPENROUTER_BASE_URL = 'https://openrouter.test/api/v1/';
    envMock.EMBEDDING_MODEL = 'test-embedding-model';
    vi.unstubAllGlobals();
  });

  it('posts note text to the OpenRouter embeddings endpoint', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(embedText('Body text')).resolves.toEqual([0.1, 0.2, 0.3]);

    expect(fetchMock).toHaveBeenCalledWith('https://openrouter.test/api/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'test-embedding-model',
        input: 'Body text',
      }),
    });
  });

  it('rejects when the API key is missing', async () => {
    envMock.OPENROUTER_API_KEY = '';

    await expect(embedText('Body text')).rejects.toThrow('OPENROUTER_API_KEY is not configured');
  });

  it('rejects failed OpenRouter responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('quota exceeded', { status: 429 })));

    await expect(embedText('Body text')).rejects.toThrow(
      'OpenRouter embeddings request failed with 429: quota exceeded',
    );
  });

  it('rejects malformed embedding payloads', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{}] }), { status: 200 })));

    await expect(embedText('Body text')).rejects.toThrow(
      'OpenRouter embeddings response did not include a numeric embedding',
    );
  });
});
