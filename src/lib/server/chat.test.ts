import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock embeddings module
vi.mock('./embeddings', () => ({
  embedText: vi.fn(),
}));

// Mock DB notes module
vi.mock('./db/notes', () => ({
  searchNotesBySimilarity: vi.fn(),
}));

import { embedText } from './embeddings';
import { searchNotesBySimilarity } from './db/notes';
import { assembleContext } from './chat';

const mockEmbedText = vi.mocked(embedText);
const mockSearchNotes = vi.mocked(searchNotesBySimilarity);

const noteA = {
  id: 1,
  slug: 'vector-search',
  title: 'Vector Search',
  body: 'First paragraph of vector search.\n\nSecond paragraph.',
  takeaway: 'Use pgvector cosine search for RAG.',
  category: 'databases',
  tags: ['postgres', 'rag'],
  image: null,
  publishedAt: new Date('2026-04-03T00:00:00Z'),
  series: null,
  status: 'published' as const,
  embedding: [0.1, 0.2, 0.3],
  createdAt: new Date('2026-04-01T00:00:00Z'),
  updatedAt: new Date('2026-04-02T00:00:00Z'),
};

const noteB = {
  id: 2,
  slug: 'rag-pipeline',
  title: 'RAG Pipeline',
  body: '# RAG Pipeline\n\nRetrieval-augmented generation combines search with LLMs.',
  takeaway: null,
  category: 'ai',
  tags: ['rag', 'llm'],
  image: null,
  publishedAt: new Date('2026-04-04T00:00:00Z'),
  series: null,
  status: 'published' as const,
  embedding: [0.4, 0.5, 0.6],
  createdAt: new Date('2026-04-01T00:00:00Z'),
  updatedAt: new Date('2026-04-02T00:00:00Z'),
};

describe('assembleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
  });

  it('returns context string and cited slugs from top-N notes', async () => {
    mockSearchNotes.mockResolvedValue([noteA, noteB]);

    const result = await assembleContext('how does vector search work?');

    expect(result.citedSlugs).toEqual(['vector-search', 'rag-pipeline']);
    expect(result.context).toContain('vector-search');
    expect(result.context).toContain('rag-pipeline');
  });

  it('embeds the query before searching', async () => {
    mockSearchNotes.mockResolvedValue([noteA]);

    await assembleContext('query text');

    expect(mockEmbedText).toHaveBeenCalledWith('query text');
    expect(mockSearchNotes).toHaveBeenCalledWith([0.1, 0.2, 0.3], 5);
  });

  it('includes the takeaway when present', async () => {
    mockSearchNotes.mockResolvedValue([noteA]);

    const result = await assembleContext('test');

    expect(result.context).toContain('Use pgvector cosine search for RAG.');
  });

  it('falls back to first non-heading line when takeaway is null', async () => {
    mockSearchNotes.mockResolvedValue([noteB]);

    const result = await assembleContext('test');

    // noteB has no takeaway; first non-heading, non-blank line is the paragraph text
    expect(result.context).toContain('Retrieval-augmented generation combines search with LLMs.');
  });

  it('never includes the full body — only takeaway and first paragraph', async () => {
    mockSearchNotes.mockResolvedValue([noteA]);

    const result = await assembleContext('test');

    // Full second paragraph must not appear
    expect(result.context).not.toContain('Second paragraph.');
    // Only first paragraph is allowed
    expect(result.context).toContain('First paragraph of vector search.');
  });

  it('returns empty context and no slugs when no notes match', async () => {
    mockSearchNotes.mockResolvedValue([]);

    const result = await assembleContext('unknown topic');

    expect(result.context).toBe('');
    expect(result.citedSlugs).toEqual([]);
  });
});
