import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock embeddings module
vi.mock('./embeddings', () => ({
  embedText: vi.fn(),
}));

// Mock DB notes module
vi.mock('./db/notes', () => ({
  searchChunksBySimilarity: vi.fn(),
  searchNotesByLexical: vi.fn(),
}));

import { embedText } from './embeddings';
import { searchChunksBySimilarity, searchNotesByLexical } from './db/notes';
import { assembleContext } from './chat';

const mockEmbedText = vi.mocked(embedText);
const mockSearchChunks = vi.mocked(searchChunksBySimilarity);
const mockSearchLexical = vi.mocked(searchNotesByLexical);

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

const lexicalNoteC = {
  slug: 'llm-basics',
  title: 'LLM Basics',
  category: 'ai',
  tags: ['llm', 'gpt'],
  takeaway: 'Language models predict the next token.',
};

const lexicalNoteD = {
  slug: 'embeddings-intro',
  title: 'Embeddings Intro',
  category: 'ml',
  tags: ['embeddings'],
  takeaway: 'Embeddings map text to dense vectors.',
};

describe('assembleContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    // By default, lexical returns nothing (semantic-only path)
    mockSearchLexical.mockResolvedValue([]);
  });

  // ----- semantic-only behaviour (existing coverage) -----

  it('returns context string and cited slugs from retrieved chunks', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1, chunkB1]);

    const result = await assembleContext('how does vector search work?');

    expect(result.citedSlugs).toEqual(['vector-search', 'rag-pipeline']);
    expect(result.context).toContain('vector-search');
    expect(result.context).toContain('rag-pipeline');
  });

  it('embeds the query before searching chunks and calls lexical search in parallel', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1]);

    await assembleContext('query text');

    expect(mockEmbedText).toHaveBeenCalledWith('query text');
    expect(mockSearchChunks).toHaveBeenCalledWith([0.1, 0.2, 0.3], 20);
    // Lexical query called with the original string
    expect(mockSearchLexical).toHaveBeenCalledWith('query text', 10);
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

  it('returns empty context and no slugs when no chunks and no lexical matches', async () => {
    mockSearchChunks.mockResolvedValue([]);
    mockSearchLexical.mockResolvedValue([]);

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

  // ----- lexical retrieval behaviour -----

  it('appends lexical-only notes not already in semantic set', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1]);
    mockSearchLexical.mockResolvedValue([lexicalNoteC]);

    const result = await assembleContext('vector llm query');

    expect(result.citedSlugs).toContain('vector-search');
    expect(result.citedSlugs).toContain('llm-basics');
  });

  it('does not duplicate a note already present in the semantic set', async () => {
    // semantic returns vector-search; lexical also returns vector-search
    const lexicalOverlap = {
      slug: 'vector-search',
      title: 'Vector Search',
      category: 'databases',
      tags: ['rag'],
      takeaway: 'Semantic search with pgvector.',
    };
    mockSearchChunks.mockResolvedValue([chunkA1]);
    mockSearchLexical.mockResolvedValue([lexicalOverlap, lexicalNoteC]);

    const result = await assembleContext('vector');

    // vector-search should appear exactly once
    expect(result.citedSlugs.filter((s) => s === 'vector-search')).toHaveLength(1);
    expect(result.citedSlugs).toContain('llm-basics');
  });

  it('lexical-only note includes slug, title, and takeaway', async () => {
    mockSearchChunks.mockResolvedValue([]);
    mockSearchLexical.mockResolvedValue([lexicalNoteC]);

    const result = await assembleContext('language models');

    expect(result.context).toContain('Slug: llm-basics');
    expect(result.context).toContain('Title: LLM Basics');
    expect(result.context).toContain('Takeaway: Language models predict the next token.');
  });

  it('lexical-only note without takeaway omits the takeaway line', async () => {
    const noTakeaway = { ...lexicalNoteC, takeaway: null };
    mockSearchChunks.mockResolvedValue([]);
    mockSearchLexical.mockResolvedValue([noTakeaway]);

    const result = await assembleContext('language models');

    expect(result.context).not.toContain('Takeaway:');
    expect(result.context).toContain('Slug: llm-basics');
  });

  it('returns non-empty context when only lexical matches exist (no semantic chunks)', async () => {
    mockSearchChunks.mockResolvedValue([]);
    mockSearchLexical.mockResolvedValue([lexicalNoteC]);

    const result = await assembleContext('language model basics');

    expect(result.context).not.toBe('');
    expect(result.citedSlugs).toEqual(['llm-basics']);
  });

  it('semantic notes appear before lexical-only notes in the context', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1]);
    mockSearchLexical.mockResolvedValue([lexicalNoteC]);

    const result = await assembleContext('vector llm');

    const semanticIdx = result.citedSlugs.indexOf('vector-search');
    const lexicalIdx = result.citedSlugs.indexOf('llm-basics');
    expect(semanticIdx).toBeLessThan(lexicalIdx);
  });

  it('fused candidate list is capped at MAX_NOTES_IN_CONTEXT (5) across both sources', async () => {
    // 4 semantic notes
    const semanticChunks = Array.from({ length: 4 }, (_, i) => ({
      id: i,
      noteSlug: `semantic-note-${i}`,
      noteTitle: `Semantic Note ${i}`,
      sectionHeading: null,
      sectionIndex: 0,
      chunkIndex: 0,
      chunkText: `Semantic content ${i}.`,
      distance: 0.1 * (i + 1),
    }));
    // 4 lexical notes (different slugs)
    const lexicalNotes = Array.from({ length: 4 }, (_, i) => ({
      slug: `lexical-note-${i}`,
      title: `Lexical Note ${i}`,
      category: 'topic',
      tags: null,
      takeaway: null,
    }));

    mockSearchChunks.mockResolvedValue(semanticChunks);
    mockSearchLexical.mockResolvedValue(lexicalNotes);

    const result = await assembleContext('mixed query');

    expect(result.citedSlugs).toHaveLength(5);
    // First 4 are semantic, 1 lexical fills the slot
    expect(result.citedSlugs.filter((s) => s.startsWith('semantic-'))).toHaveLength(4);
    expect(result.citedSlugs.filter((s) => s.startsWith('lexical-'))).toHaveLength(1);
  });

  it('lexical retrieval appends multiple non-overlapping notes up to remaining slots', async () => {
    // Semantic returns 2 notes
    mockSearchChunks.mockResolvedValue([chunkA1, chunkB1]);
    // Lexical returns 4 non-overlapping notes; only 3 should fill remaining slots
    mockSearchLexical.mockResolvedValue([
      lexicalNoteC,
      lexicalNoteD,
      { slug: 'note-e', title: 'Note E', category: null, tags: null, takeaway: null },
      { slug: 'note-f', title: 'Note F', category: null, tags: null, takeaway: null },
    ]);

    const result = await assembleContext('broad query');

    expect(result.citedSlugs).toHaveLength(5);
    expect(result.citedSlugs).toContain('vector-search');
    expect(result.citedSlugs).toContain('rag-pipeline');
    expect(result.citedSlugs).toContain('llm-basics');
    expect(result.citedSlugs).toContain('embeddings-intro');
    expect(result.citedSlugs).toContain('note-e');
    // note-f is the 6th candidate and must be excluded
    expect(result.citedSlugs).not.toContain('note-f');
  });
});
