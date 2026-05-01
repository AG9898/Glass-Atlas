import { embedText } from './embeddings';
import { searchChunksBySimilarity } from './db/notes';
import type { RetrievedNoteChunk } from './db/notes';

/** Maximum number of chunk candidates to retrieve from pgvector. */
const CHUNK_CANDIDATES = 20;

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
 * Embeds `query`, runs pgvector cosine similarity search against published
 * note_chunks, groups and caps results per note, and assembles a compact
 * context block combining the note title, takeaway-or-heading summary, and
 * the top retrieved chunk excerpt(s).
 *
 * Full note bodies are never passed to the LLM — only the retrieved chunk
 * text and section heading (where available) are included per note.
 * This keeps token costs low and retrieval precision high.
 */
export async function assembleContext(query: string): Promise<AssembledContext> {
  const queryEmbedding = await embedText(query);
  const chunks = await searchChunksBySimilarity(queryEmbedding, CHUNK_CANDIDATES);

  if (chunks.length === 0) {
    return { context: '', citedSlugs: [] };
  }

  // Group chunks by note slug, preserving the order chunks were returned
  // (already sorted by ascending cosine distance = best match first).
  const chunksBySlug = new Map<string, RetrievedNoteChunk[]>();
  for (const chunk of chunks) {
    const existing = chunksBySlug.get(chunk.noteSlug);
    if (!existing) {
      chunksBySlug.set(chunk.noteSlug, [chunk]);
    } else if (existing.length < MAX_CHUNKS_PER_NOTE) {
      existing.push(chunk);
    }
    // Stop once we have enough distinct notes
    if (chunksBySlug.size >= MAX_NOTES_IN_CONTEXT) break;
  }

  const snippets: string[] = [];
  const citedSlugs: string[] = [];

  for (const [slug, noteChunks] of chunksBySlug) {
    snippets.push(formatChunkSnippet(slug, noteChunks));
    citedSlugs.push(slug);
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
