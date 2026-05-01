import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock embeddings module
vi.mock('./embeddings', () => ({
  embedText: vi.fn(),
}));

// Mock DB notes module
vi.mock('./db/notes', () => ({
  searchChunksBySimilarity: vi.fn(),
}));

import { embedText } from './embeddings';
import { searchChunksBySimilarity } from './db/notes';
import { assembleContext } from './chat';

const mockEmbedText = vi.mocked(embedText);
const mockSearchChunks = vi.mocked(searchChunksBySimilarity);

const chunkA1 = {
  id: 1,
  noteSlug: 'vector-search',
  noteTitle: 'Vector Search',
  sectionHeading: 'Overview',
  sectionIndex: 0,
  chunkIndex: 0,
  chunkText: 'Use pgvector cosine search for RAG retrieval.',
  distance: 0.05,
};

const chunkA2 = {
  id: 2,
  noteSlug: 'vector-search',
  noteTitle: 'Vector Search',
  sectionHeading: 'Implementation',
  sectionIndex: 1,
  chunkIndex: 1,
  chunkText: 'Index your embeddings with an HNSW index for fast ANN queries.',
  distance: 0.12,
};

const chunkB1 = {
  id: 3,
  noteSlug: 'rag-pipeline',
  noteTitle: 'RAG Pipeline',
  sectionHeading: null,
  sectionIndex: 0,
  chunkIndex: 0,
  chunkText: 'Retrieval-augmented generation combines search with LLMs.',
  distance: 0.18,
};

describe('assembleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
  });

  it('returns context string and cited slugs from retrieved chunks', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1, chunkB1]);

    const result = await assembleContext('how does vector search work?');

    expect(result.citedSlugs).toEqual(['vector-search', 'rag-pipeline']);
    expect(result.context).toContain('vector-search');
    expect(result.context).toContain('rag-pipeline');
  });

  it('embeds the query before searching chunks', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1]);

    await assembleContext('query text');

    expect(mockEmbedText).toHaveBeenCalledWith('query text');
    expect(mockSearchChunks).toHaveBeenCalledWith([0.1, 0.2, 0.3], 20);
  });

  it('includes chunk text in context', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1]);

    const result = await assembleContext('test');

    expect(result.context).toContain('Use pgvector cosine search for RAG retrieval.');
  });

  it('includes section heading when present', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1]);

    const result = await assembleContext('test');

    expect(result.context).toContain('Section: Overview');
  });

  it('omits section heading line when sectionHeading is null', async () => {
    mockSearchChunks.mockResolvedValue([chunkB1]);

    const result = await assembleContext('test');

    expect(result.context).not.toContain('Section:');
    expect(result.context).toContain('Retrieval-augmented generation combines search with LLMs.');
  });

  it('groups multiple chunks from the same note under one context block', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1, chunkA2]);

    const result = await assembleContext('vector indexing');

    // Only one slug for the note, but both excerpts should appear
    expect(result.citedSlugs).toEqual(['vector-search']);
    expect(result.context).toContain('Use pgvector cosine search for RAG retrieval.');
    expect(result.context).toContain('Index your embeddings with an HNSW index for fast ANN queries.');
  });

  it('caps chunks per note at MAX_CHUNKS_PER_NOTE (2)', async () => {
    const chunkA3 = {
      id: 4,
      noteSlug: 'vector-search',
      noteTitle: 'Vector Search',
      sectionHeading: 'Advanced',
      sectionIndex: 2,
      chunkIndex: 2,
      chunkText: 'Third chunk that should be excluded.',
      distance: 0.25,
    };
    mockSearchChunks.mockResolvedValue([chunkA1, chunkA2, chunkA3]);

    const result = await assembleContext('test');

    // Third chunk text must not appear
    expect(result.context).not.toContain('Third chunk that should be excluded.');
    // But the first two should
    expect(result.context).toContain('Use pgvector cosine search for RAG retrieval.');
    expect(result.context).toContain('Index your embeddings with an HNSW index for fast ANN queries.');
  });

  it('limits distinct notes to MAX_NOTES_IN_CONTEXT (5)', async () => {
    const manyChunks = Array.from({ length: 10 }, (_, i) => ({
      id: i + 10,
      noteSlug: `note-${i}`,
      noteTitle: `Note ${i}`,
      sectionHeading: null,
      sectionIndex: 0,
      chunkIndex: 0,
      chunkText: `Content of note ${i}.`,
      distance: 0.1 * (i + 1),
    }));
    mockSearchChunks.mockResolvedValue(manyChunks);

    const result = await assembleContext('broad query');

    // Should cite exactly 5 notes, not 10
    expect(result.citedSlugs).toHaveLength(5);
  });

  it('returns empty context and no slugs when no chunks match', async () => {
    mockSearchChunks.mockResolvedValue([]);

    const result = await assembleContext('unknown topic');

    expect(result.context).toBe('');
    expect(result.citedSlugs).toEqual([]);
  });

  it('includes note slug and title in context block', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1]);

    const result = await assembleContext('test');

    expect(result.context).toContain('Slug: vector-search');
    expect(result.context).toContain('Title: Vector Search');
  });

  it('preserves order of notes by chunk similarity rank', async () => {
    // chunkA1 has distance 0.05, chunkB1 has 0.18 — A should be cited first
    mockSearchChunks.mockResolvedValue([chunkA1, chunkB1]);

    const result = await assembleContext('test');

    expect(result.citedSlugs[0]).toBe('vector-search');
    expect(result.citedSlugs[1]).toBe('rag-pipeline');
  });
});
