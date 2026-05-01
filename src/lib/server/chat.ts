import { embedText } from './embeddings';
import { searchChunksBySimilarity, searchNotesByLexical } from './db/notes';
import type { RetrievedNoteChunk, RetrievedLexicalNote } from './db/notes';

/** Maximum number of chunk candidates to retrieve from pgvector. */
const CHUNK_CANDIDATES = 20;

/** Maximum lexical note candidates to retrieve per query. */
const LEXICAL_CANDIDATES = 10;

/** Maximum chunks to include per note in the assembled context. */
const MAX_CHUNKS_PER_NOTE = 2;

/** Maximum number of distinct notes to include in the context. */
const MAX_NOTES_IN_CONTEXT = 5;

export type AssembledContext = {
  /** Formatted context block ready to be injected into the LLM prompt. */
  context: string;
  /** Slugs of all notes whose excerpts were included in the context. */
  citedSlugs: string[];
};

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
  const queryEmbedding = await embedText(query);

  // Run both retrieval branches in parallel for latency efficiency.
  const [chunks, lexicalNotes] = await Promise.all([
    searchChunksBySimilarity(queryEmbedding, CHUNK_CANDIDATES),
    searchNotesByLexical(query, LEXICAL_CANDIDATES),
  ]);

  if (chunks.length === 0 && lexicalNotes.length === 0) {
    return { context: '', citedSlugs: [] };
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
  const citedSlugs: string[] = [];

  // Semantic entries first (ranked by cosine similarity).
  for (const [slug, noteChunks] of chunksBySlug) {
    snippets.push(formatChunkSnippet(slug, noteChunks));
    citedSlugs.push(slug);
  }

  // Lexical-only entries appended after semantic entries.
  for (const note of lexicalOnlyNotes) {
    snippets.push(formatLexicalSnippet(note));
    citedSlugs.push(note.slug);
  }

  const context = `Retrieved notes:\n\n${snippets.join('\n\n---\n\n')}`;
  return { context, citedSlugs };
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
