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
import {
  assembleContext,
  hasSufficientCoverage,
  buildFallbackResponse,
  buildSemanticSearchQuery,
  INSUFFICIENT_COVERAGE_RESPONSE,
  SEMANTIC_CONFIDENCE_THRESHOLDS,
} from './chat';

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
    expect(result.confidence).toMatchObject({
      tier: 'high',
      bestSemanticDistance: 0.05,
      lexicalMatchCount: 0,
    });
  });

  it('embeds the query before searching chunks and calls lexical search in parallel', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1]);

    await assembleContext('query text');

    expect(mockEmbedText).toHaveBeenCalledWith('query text');
    expect(mockSearchChunks).toHaveBeenCalledWith([0.1, 0.2, 0.3], 20);
    // Lexical query called with the original string
    expect(mockSearchLexical).toHaveBeenCalledWith('query text', 10);
  });

  it('expands local aliases for semantic search while preserving lexical query text', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1]);

    await assembleContext("How does the creator employ LLM's?");

    expect(mockEmbedText).toHaveBeenCalledWith(
      "How does the creator author Aden Glass Atlas use employ LLMs large language models AI chatbot?",
    );
    expect(mockSearchLexical).toHaveBeenCalledWith("How does the creator employ LLM's?", 10);
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
    expect(result.confidence).toEqual({
      tier: 'low',
      bestSemanticDistance: null,
      lexicalMatchCount: 0,
    });
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
    expect(result.confidence).toEqual({
      tier: 'borderline',
      bestSemanticDistance: null,
      lexicalMatchCount: 1,
    });
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

describe('assembleContext — confidence tiers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSearchLexical.mockResolvedValue([]);
  });

  it('classifies chunks at or below the high cutoff as high confidence', async () => {
    mockSearchChunks.mockResolvedValue([
      { ...chunkA1, distance: SEMANTIC_CONFIDENCE_THRESHOLDS.highMaxDistance },
    ]);

    const result = await assembleContext('high confidence topic');

    expect(result.confidence.tier).toBe('high');
    expect(result.confidence.bestSemanticDistance).toBe(
      SEMANTIC_CONFIDENCE_THRESHOLDS.highMaxDistance,
    );
  });

  it('classifies chunks between high and low cutoffs as borderline confidence', async () => {
    const borderlineDistance = SEMANTIC_CONFIDENCE_THRESHOLDS.highMaxDistance + 0.01;
    mockSearchChunks.mockResolvedValue([{ ...chunkA1, distance: borderlineDistance }]);

    const result = await assembleContext('adjacent topic');

    expect(result.confidence.tier).toBe('borderline');
    expect(result.confidence.bestSemanticDistance).toBe(borderlineDistance);
  });

  it('classifies clearly distant semantic matches above the low cutoff as low confidence', async () => {
    const lowConfidenceDistance = SEMANTIC_CONFIDENCE_THRESHOLDS.borderlineMaxDistance + 0.01;
    mockSearchChunks.mockResolvedValue([{ ...chunkA1, distance: lowConfidenceDistance }]);
    mockSearchLexical.mockResolvedValue([lexicalNoteC]);

    const result = await assembleContext('irrelevant nearest neighbor');

    expect(result.context).toContain('vector-search');
    expect(result.confidence).toMatchObject({
      tier: 'low',
      bestSemanticDistance: lowConfidenceDistance,
      lexicalMatchCount: 1,
    });
  });

  it('keeps lexical-only retrieval in the borderline tier as supporting evidence', async () => {
    mockSearchChunks.mockResolvedValue([]);
    mockSearchLexical.mockResolvedValue([lexicalNoteC]);

    const result = await assembleContext('llm basics');

    expect(result.confidence).toEqual({
      tier: 'borderline',
      bestSemanticDistance: null,
      lexicalMatchCount: 1,
    });
  });
});

describe('buildSemanticSearchQuery', () => {
  it('adds site-specific aliases for common creator and AI phrasing', () => {
    const result = buildSemanticSearchQuery("How does Aden use RAG and LLM's on this site?");

    expect(result).toContain('Aden author');
    expect(result).toContain('RAG retrieval augmented generation semantic search embeddings');
    expect(result).toContain('LLMs large language models AI chatbot');
    expect(result).toContain('this site Glass Atlas personal website');
  });

  it('leaves unrelated wording unchanged', () => {
    expect(buildSemanticSearchQuery('what is the capital of France')).toBe(
      'what is the capital of France',
    );
  });
});

describe('hasSufficientCoverage', () => {
  it('returns true when context is non-empty and citedSlugs is non-empty', () => {
    expect(hasSufficientCoverage({
      context: 'Retrieved notes:\n\nSlug: foo',
      citedSlugs: ['foo'],
      citedNotes: [{ slug: 'foo', title: 'Foo' }],
      confidence: { tier: 'high', bestSemanticDistance: 0.1, lexicalMatchCount: 0 },
    })).toBe(true);
  });

  it('returns false when context is empty string', () => {
    expect(hasSufficientCoverage({
      context: '',
      citedSlugs: [],
      citedNotes: [],
      confidence: { tier: 'low', bestSemanticDistance: null, lexicalMatchCount: 0 },
    })).toBe(false);
  });

  it('returns false when context is empty but citedSlugs has entries (degenerate state)', () => {
    // Should never happen in practice, but gate is conservative.
    expect(hasSufficientCoverage({
      context: '',
      citedSlugs: ['foo'],
      citedNotes: [{ slug: 'foo', title: 'Foo' }],
      confidence: { tier: 'high', bestSemanticDistance: 0.1, lexicalMatchCount: 0 },
    })).toBe(false);
  });

  it('returns false when context is non-empty but citedSlugs is empty (degenerate state)', () => {
    expect(hasSufficientCoverage({
      context: 'some context',
      citedSlugs: [],
      citedNotes: [],
      confidence: { tier: 'high', bestSemanticDistance: 0.1, lexicalMatchCount: 0 },
    })).toBe(false);
  });

  it('returns true for minimal valid context with a single slug', () => {
    expect(hasSufficientCoverage({
      context: 'x',
      citedSlugs: ['any-slug'],
      citedNotes: [{ slug: 'any-slug', title: 'Any Slug' }],
      confidence: { tier: 'borderline', bestSemanticDistance: 0.4, lexicalMatchCount: 0 },
    })).toBe(true);
  });

  it('returns false for low confidence even when snippets and citations exist', () => {
    expect(hasSufficientCoverage({
      context: 'Retrieved notes:\n\nSlug: maybe-related',
      citedSlugs: ['maybe-related'],
      citedNotes: [{ slug: 'maybe-related', title: 'Maybe Related' }],
      confidence: { tier: 'low', bestSemanticDistance: 0.9, lexicalMatchCount: 0 },
    })).toBe(false);
  });
});

describe('INSUFFICIENT_COVERAGE_RESPONSE', () => {
  it('is a non-empty string written in first person', () => {
    expect(typeof INSUFFICIENT_COVERAGE_RESPONSE).toBe('string');
    expect(INSUFFICIENT_COVERAGE_RESPONSE.length).toBeGreaterThan(0);
    // The canned response must use first-person voice ("I")
    expect(INSUFFICIENT_COVERAGE_RESPONSE).toMatch(/\bI\b/);
  });

  it('does not contain speculative or fabricated content markers', () => {
    // Must not claim to know or answer from general knowledge
    const lowerCased = INSUFFICIENT_COVERAGE_RESPONSE.toLowerCase();
    expect(lowerCased).not.toContain('according to');
    expect(lowerCased).not.toContain('based on my knowledge');
  });
});

describe('buildFallbackResponse', () => {
  it('returns no-coverage response with a steer when no cited notes are provided', () => {
    const result = buildFallbackResponse([]);
    expect(result).toContain(INSUFFICIENT_COVERAGE_RESPONSE);
    expect(result).toContain('Try asking for a specific topic');
  });

  it('appends an italicized related-notes footer with wiki-links when notes are provided', () => {
    const result = buildFallbackResponse([
      { slug: 'rag-pipeline', title: 'RAG Pipeline' },
      { slug: 'vector-search', title: 'Vector Search' },
    ]);
    expect(result).toContain(INSUFFICIENT_COVERAGE_RESPONSE);
    expect(result).toContain('*Related notes:');
    expect(result).toContain('[[rag-pipeline|RAG Pipeline]]');
    expect(result).toContain('[[vector-search|Vector Search]]');
  });

  it('wraps the related-notes footer in single asterisks (italic)', () => {
    const result = buildFallbackResponse([{ slug: 'test-note', title: 'Test Note' }]);
    // Footer must start and end with * (not **)
    expect(result).toMatch(/\*Related notes:.*\*$/s);
  });

  it('filters out notes with unsafe slugs', () => {
    const result = buildFallbackResponse([
      { slug: 'valid-note', title: 'Valid Note' },
      { slug: 'BAD_SLUG!', title: 'Bad Slug' },
      { slug: 'also invalid slug', title: 'Also Invalid' },
    ]);
    expect(result).toContain('[[valid-note|Valid Note]]');
    expect(result).not.toContain('BAD_SLUG');
    expect(result).not.toContain('also invalid slug');
  });

  it('returns canned response without footer when all slugs are unsafe', () => {
    const result = buildFallbackResponse([
      { slug: 'BAD SLUG', title: 'Bad' },
      { slug: 'UPPERCASE', title: 'Upper' },
    ]);
    expect(result).toContain(INSUFFICIENT_COVERAGE_RESPONSE);
    expect(result).not.toContain('*Related notes:');
  });

  it('includes slugs that start with a digit (valid slug pattern)', () => {
    const result = buildFallbackResponse([{ slug: '2024-recap', title: '2024 Recap' }]);
    expect(result).toContain('[[2024-recap|2024 Recap]]');
  });

  it('uses question-sensitive wording when the user message is a question', () => {
    const result = buildFallbackResponse([], 'Do you have a note about this?');
    expect(result).toContain('I have not documented that exact question yet.');
  });
});

describe('assembleContext — citedNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3]);
    mockSearchLexical.mockResolvedValue([]);
  });

  it('populates citedNotes with slug and title from semantic chunks', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1, chunkB1]);

    const result = await assembleContext('vector search');

    expect(result.citedNotes).toEqual([
      { slug: 'vector-search', title: 'Vector Search' },
      { slug: 'rag-pipeline', title: 'RAG Pipeline' },
    ]);
  });

  it('citedSlugs mirrors the slug order in citedNotes', async () => {
    mockSearchChunks.mockResolvedValue([chunkA1, chunkB1]);

    const result = await assembleContext('test');

    expect(result.citedSlugs).toEqual(result.citedNotes.map((n) => n.slug));
  });

  it('populates citedNotes from lexical-only notes', async () => {
    mockSearchChunks.mockResolvedValue([]);
    mockSearchLexical.mockResolvedValue([lexicalNoteC]);

    const result = await assembleContext('language models');

    expect(result.citedNotes).toEqual([{ slug: 'llm-basics', title: 'LLM Basics' }]);
  });

  it('returns empty citedNotes when no notes are retrieved', async () => {
    mockSearchChunks.mockResolvedValue([]);
    mockSearchLexical.mockResolvedValue([]);

    const result = await assembleContext('unknown topic');

    expect(result.citedNotes).toEqual([]);
    expect(result.confidence.tier).toBe('low');
  });
});
