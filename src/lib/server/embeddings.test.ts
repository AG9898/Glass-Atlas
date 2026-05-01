import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1/',
  EMBEDDING_MODEL: 'test-embedding-model',
}));

vi.mock('$env/dynamic/private', () => ({
  env: envMock,
}));

import {
  buildChunkEmbeddingPayload,
  chunkBodyBySectionAndParagraph,
  embedNoteBodyChunks,
  embedText,
} from './embeddings';

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

describe('chunkBodyBySectionAndParagraph', () => {
  it('splits markdown by heading sections and paragraph boundaries in stable order', () => {
    const body = [
      'Preamble line one.',
      'Preamble line two.',
      '',
      '## First Section',
      'Paragraph one line one.',
      'Paragraph one line two.',
      '',
      'Paragraph two.',
      '',
      '### Deep Dive',
      'Nested section paragraph.',
    ].join('\n');

    expect(chunkBodyBySectionAndParagraph(body)).toEqual([
      {
        sectionHeading: null,
        sectionIndex: 0,
        chunkIndex: 0,
        chunkText: 'Preamble line one. Preamble line two.',
      },
      {
        sectionHeading: 'First Section',
        sectionIndex: 1,
        chunkIndex: 1,
        chunkText: 'Paragraph one line one. Paragraph one line two.',
      },
      {
        sectionHeading: 'First Section',
        sectionIndex: 1,
        chunkIndex: 2,
        chunkText: 'Paragraph two.',
      },
      {
        sectionHeading: 'Deep Dive',
        sectionIndex: 2,
        chunkIndex: 3,
        chunkText: 'Nested section paragraph.',
      },
    ]);
  });
});

describe('buildChunkEmbeddingPayload', () => {
  it('renders a canonical metadata + chunk payload', () => {
    const payload = buildChunkEmbeddingPayload(
      {
        title: '  Vector Search  ',
        category: ' databases ',
        tags: ['rag', '  pgvector  '],
        series: ' retrieval ',
      },
      {
        sectionHeading: ' Intro ',
        chunkText: '  Use focused chunk context.  ',
      },
    );

    expect(payload).toBe(
      [
        'Glass Atlas note chunk',
        'Title: Vector Search',
        'Category: databases',
        'Tags: rag, pgvector',
        'Series: retrieval',
        'Section: Intro',
        'Chunk: Use focused chunk context.',
      ].join('\n'),
    );
  });
});

describe('embedNoteBodyChunks', () => {
  it('embeds each chunk using metadata-enriched payloads', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ embedding: [0.4, 0.5, 0.6] }] }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await embedNoteBodyChunks('One.\n\n## Topic\nTwo.', {
      title: 'Chunked Note',
      category: 'search',
      tags: ['rag'],
      series: null,
    });

    expect(result).toEqual([
      expect.objectContaining({
        sectionHeading: null,
        sectionIndex: 0,
        chunkIndex: 0,
        chunkText: 'One.',
        embedding: [0.1, 0.2, 0.3],
      }),
      expect.objectContaining({
        sectionHeading: 'Topic',
        sectionIndex: 1,
        chunkIndex: 1,
        chunkText: 'Two.',
        embedding: [0.4, 0.5, 0.6],
      }),
    ]);

    const firstPayload = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      input: string;
    };
    const secondPayload = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string) as {
      input: string;
    };
    expect(firstPayload.input).toContain('Title: Chunked Note');
    expect(firstPayload.input).toContain('Chunk: One.');
    expect(secondPayload.input).toContain('Section: Topic');
    expect(secondPayload.input).toContain('Chunk: Two.');
  });
});
