import { embedText } from './embeddings';
import { searchChunksBySimilarity, searchNotesByLexical } from './db/notes';
import type { RetrievedNoteChunk, RetrievedLexicalNote } from './db/notes';
import { isSafeNoteSlug } from '$lib/utils/chat-format';

/** Maximum number of chunk candidates to retrieve from pgvector. */
const CHUNK_CANDIDATES = 20;

/** Maximum lexical note candidates to retrieve per query. */
const LEXICAL_CANDIDATES = 10;

/** Maximum chunks to include per note in the assembled context. */
const MAX_CHUNKS_PER_NOTE = 2;

/** Maximum number of distinct notes to include in the context. */
const MAX_NOTES_IN_CONTEXT = 5;

/**
 * Semantic cosine-distance tiers for retrieval confidence.
 *
 * pgvector's `<=>` returns smaller values for closer matches. These cutoffs
 * keep obviously irrelevant nearest-neighbor chunks away from the LLM while
 * preserving a middle band for limited-coverage handling.
 */
export const SEMANTIC_CONFIDENCE_THRESHOLDS = {
  highMaxDistance: 0.5,
  borderlineMaxDistance: 0.68,
} as const;

export type CitedNote = {
  /** URL-safe slug identifying the note. */
  slug: string;
  /** Human-readable note title. */
  title: string;
};

export type CoverageTier = 'high' | 'borderline' | 'low';

export type RetrievalConfidence = {
  /**
   * Retrieval confidence tier used by the API route to choose normal answer,
   * limited-coverage, or deterministic fallback behavior.
   */
  tier: CoverageTier;
  /** Best semantic chunk cosine distance, when semantic retrieval returned chunks. */
  bestSemanticDistance: number | null;
  /** Number of lexical/topic note matches considered during fusion. */
  lexicalMatchCount: number;
};

export type AssembledContext = {
  /** Formatted context block ready to be injected into the LLM prompt. */
  context: string;
  /**
   * Slugs of all notes whose excerpts were included in the context.
   * Derived from `citedNotes` for convenience.
   */
  citedSlugs: string[];
  /** Notes (slug + title) whose excerpts were included in the context. */
  citedNotes: CitedNote[];
  /** Confidence metadata derived from semantic distance plus lexical support. */
  confidence: RetrievalConfidence;
};

/**
 * Returns `true` when retrieval confidence is high or borderline enough for an
 * LLM path. Low-confidence and empty retrieval short-circuit to fallback.
 *
 * This intentionally does more than check for non-empty context: irrelevant
 * nearest-neighbor chunks can still produce snippets, so semantic distance is
 * the primary gate and lexical matches are supporting evidence only.
 */
export function hasSufficientCoverage(ctx: AssembledContext): boolean {
  return ctx.context.length > 0 && ctx.citedSlugs.length > 0 && ctx.confidence.tier !== 'low';
}

/**
 * Base first-person response returned when retrieval finds no relevant notes.
 * Kept as a stable phrase for tests and UI expectations.
 */
export const INSUFFICIENT_COVERAGE_RESPONSE = "I don't have a note on that yet.";

const COVERAGE_STEER_SUFFIX =
  'Try asking for a specific topic, note title, or project and I can share what I have written.';

/**
 * Builds the fallback response text for insufficient-coverage situations.
 *
 * When `citedNotes` is non-empty, appends an italicized related-notes footer
 * using wiki-link syntax. Only notes with safe slugs are included — slugs that
 * fail the safety check are silently dropped to prevent bad links from
 * appearing in the chat output.
 *
 * When no safe related notes exist, returns a concise no-coverage reply plus
 * a steer toward note-grounded follow-up questions.
 *
 * @param citedNotes - Notes retrieved by the context assembly step.
 * @param query - User message text for minimal tone shaping.
 */
export function buildFallbackResponse(citedNotes: CitedNote[], query = ''): string {
  const safeNotes = citedNotes.filter((n) => isSafeNoteSlug(n.slug));

  const trimmed = query.trim();
  const steerPrefix = trimmed.endsWith('?')
    ? 'I have not documented that exact question yet.'
    : INSUFFICIENT_COVERAGE_RESPONSE;

  if (safeNotes.length === 0) {
    return `${steerPrefix} ${COVERAGE_STEER_SUFFIX}`;
  }

  const links = safeNotes.map((n) => `[[${n.slug}|${n.title}]]`).join(', ');
  return `${steerPrefix} Here are the closest related notes I can talk about. ${COVERAGE_STEER_SUFFIX}\n\n*Related notes: ${links}*`;
}

/**
 * Embeds `query`, then runs semantic (pgvector cosine) and lexical/topic
 * (title/tags/category ILIKE) retrieval in parallel against published notes.
 * Candidate sets are fused: semantic chunks are grouped by note and ranked by
 * best-chunk cosine distance; lexical-only notes (not already in the semantic
 * set) are appended in lexical order. The combined list is capped at
 * MAX_NOTES_IN_CONTEXT distinct notes.
 *
 * Full note bodies are never passed to the LLM — only retrieved chunk excerpts
 * and section headings (where available) are included per semantic note; lexical-
 * only notes contribute only their title and takeaway line.
 */
export async function assembleContext(query: string): Promise<AssembledContext> {
  const semanticQuery = buildSemanticSearchQuery(query);
  const queryEmbedding = await embedText(semanticQuery);

  // Run both retrieval branches in parallel for latency efficiency.
  const [chunks, lexicalNotes] = await Promise.all([
    searchChunksBySimilarity(queryEmbedding, CHUNK_CANDIDATES),
    searchNotesByLexical(query, LEXICAL_CANDIDATES),
  ]);

  if (chunks.length === 0 && lexicalNotes.length === 0) {
    return {
      context: '',
      citedSlugs: [],
      citedNotes: [],
      confidence: {
        tier: 'low',
        bestSemanticDistance: null,
        lexicalMatchCount: 0,
      },
    };
  }

  // ----- Semantic candidate set -----
  // Group chunks by note slug in cosine-distance order (best first).
  const chunksBySlug = new Map<string, RetrievedNoteChunk[]>();
  for (const chunk of chunks) {
    const existing = chunksBySlug.get(chunk.noteSlug);
    if (!existing) {
      chunksBySlug.set(chunk.noteSlug, [chunk]);
    } else if (existing.length < MAX_CHUNKS_PER_NOTE) {
      existing.push(chunk);
    }
    if (chunksBySlug.size >= MAX_NOTES_IN_CONTEXT) break;
  }

  // ----- Lexical-only fill -----
  // Append lexical notes not already present in the semantic set, until the
  // combined slate reaches MAX_NOTES_IN_CONTEXT. This is deterministic because
  // lexicalNotes is already sorted (most-recently published first).
  const lexicalOnlyNotes: RetrievedLexicalNote[] = [];
  for (const note of lexicalNotes) {
    if (chunksBySlug.size + lexicalOnlyNotes.length >= MAX_NOTES_IN_CONTEXT) break;
    if (!chunksBySlug.has(note.slug)) {
      lexicalOnlyNotes.push(note);
    }
  }

  // ----- Assemble context -----
  const snippets: string[] = [];
  const citedNotes: CitedNote[] = [];

  // Semantic entries first (ranked by cosine similarity).
  for (const [slug, noteChunks] of chunksBySlug) {
    snippets.push(formatChunkSnippet(slug, noteChunks));
    citedNotes.push({ slug, title: noteChunks[0].noteTitle });
  }

  // Lexical-only entries appended after semantic entries.
  for (const note of lexicalOnlyNotes) {
    snippets.push(formatLexicalSnippet(note));
    citedNotes.push({ slug: note.slug, title: note.title });
  }

  const context = `Retrieved notes:\n\n${snippets.join('\n\n---\n\n')}`;
  const citedSlugs = citedNotes.map((n) => n.slug);
  return {
    context,
    citedSlugs,
    citedNotes,
    confidence: classifyRetrievalConfidence(chunks, lexicalNotes.length),
  };
}

/**
 * Expands site-specific aliases before semantic embedding.
 *
 * The note chunks are embedded with metadata terms such as the site name,
 * technical vocabulary, and author framing. User questions often use shorter
 * aliases ("creator", "RAG", "LLMs"), so this adds those local synonyms to
 * improve recall without changing the original lexical query or prompt.
 */
export function buildSemanticSearchQuery(query: string): string {
  return query
    .replace(/\bAden\b/g, 'Aden author')
    .replace(/\bcreator\b/gi, 'creator author Aden Glass Atlas')
    .replace(/\bthis site\b/gi, 'this site Glass Atlas personal website')
    .replace(/\bRAG\b/gi, 'RAG retrieval augmented generation semantic search embeddings')
    .replace(/\bLLM'?s\b/gi, 'LLMs large language models AI chatbot')
    .replace(/\bemploy\b/gi, 'use employ');
}

function classifyRetrievalConfidence(
  chunks: RetrievedNoteChunk[],
  lexicalMatchCount: number,
): RetrievalConfidence {
  const bestSemanticDistance = chunks[0]?.distance ?? null;

  if (bestSemanticDistance === null) {
    return {
      tier: lexicalMatchCount > 0 ? 'borderline' : 'low',
      bestSemanticDistance,
      lexicalMatchCount,
    };
  }

  if (bestSemanticDistance <= SEMANTIC_CONFIDENCE_THRESHOLDS.highMaxDistance) {
    return { tier: 'high', bestSemanticDistance, lexicalMatchCount };
  }

  if (bestSemanticDistance <= SEMANTIC_CONFIDENCE_THRESHOLDS.borderlineMaxDistance) {
    return { tier: 'borderline', bestSemanticDistance, lexicalMatchCount };
  }

  return { tier: 'low', bestSemanticDistance, lexicalMatchCount };
}

/**
 * Formats the retrieved chunks for a single note as a compact excerpt block.
 * Includes the note slug, title, and one or more chunk excerpts with their
 * section headings. Never sends the full body.
 */
function formatChunkSnippet(slug: string, chunks: RetrievedNoteChunk[]): string {
  const { noteTitle } = chunks[0];
  const lines: string[] = [`Slug: ${slug}`, `Title: ${noteTitle}`];

  for (const chunk of chunks) {
    if (chunk.sectionHeading) {
      lines.push(`Section: ${chunk.sectionHeading}`);
    }
    lines.push(`Excerpt: ${chunk.chunkText.trim()}`);
  }

  return lines.join('\n');
}

/**
 * Formats a lexical-only note match (title + optional takeaway).
 * Used when a note matches lexical/topic search but has no semantic chunks in
 * the top-k cosine results. Never sends the full body.
 */
function formatLexicalSnippet(note: RetrievedLexicalNote): string {
  const lines: string[] = [`Slug: ${note.slug}`, `Title: ${note.title}`];
  if (note.takeaway) {
    lines.push(`Takeaway: ${note.takeaway}`);
  }
  return lines.join('\n');
}
