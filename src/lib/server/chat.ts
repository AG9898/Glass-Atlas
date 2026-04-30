import { embedText } from './embeddings';
import { searchNotesBySimilarity } from './db/notes';
import type { Note } from './db/notes';

const TOP_N = 5;

export type AssembledContext = {
  /** Formatted context block ready to be injected into the LLM prompt. */
  context: string;
  /** Slugs of all notes whose excerpts were included in the context. */
  citedSlugs: string[];
};

/**
 * Embeds `query`, runs pgvector cosine similarity search against published notes,
 * and assembles a compact context block from the top-N results.
 *
 * Each note is represented as:
 *   Takeaway: <takeaway or first line of body>
 *   First paragraph: <first paragraph of body>
 *   Slug: <slug>
 *
 * Full note bodies are never passed to the LLM — only the takeaway and first
 * paragraph are included. This keeps token costs low and latency short.
 */
export async function assembleContext(query: string): Promise<AssembledContext> {
  const queryEmbedding = await embedText(query);
  const notes = await searchNotesBySimilarity(queryEmbedding, TOP_N);

  if (notes.length === 0) {
    return { context: '', citedSlugs: [] };
  }

  const snippets = notes.map(formatNoteSnippet);
  const context = `Retrieved notes:\n\n${snippets.join('\n\n---\n\n')}`;
  const citedSlugs = notes.map((n) => n.slug);

  return { context, citedSlugs };
}

/**
 * Formats a single note as a compact excerpt.
 * Sends only the takeaway (or first line if no takeaway) and the first paragraph.
 * Never sends the full body.
 */
function formatNoteSnippet(note: Note): string {
  const takeaway = note.takeaway?.trim() || extractFirstLine(note.body);
  const firstParagraph = extractFirstParagraph(note.body);

  const lines: string[] = [`Slug: ${note.slug}`, `Title: ${note.title}`];
  if (takeaway) {
    lines.push(`Takeaway: ${takeaway}`);
  }
  if (firstParagraph) {
    lines.push(`First paragraph: ${firstParagraph}`);
  }

  return lines.join('\n');
}

/** Extracts the first non-empty line from a markdown body. */
function extractFirstLine(body: string): string {
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    // Skip markdown headings and blank lines
    if (trimmed && !trimmed.startsWith('#')) {
      return trimmed;
    }
  }
  return '';
}

/**
 * Extracts the first non-empty paragraph from a markdown body.
 * A paragraph is a block of consecutive non-blank lines.
 * Headings (lines starting with #) are skipped.
 */
function extractFirstParagraph(body: string): string {
  const lines = body.split('\n');
  const paragraphLines: string[] = [];
  let inParagraph = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      // Blank line — end the current paragraph if we have one
      if (inParagraph) break;
      continue;
    }

    if (trimmed.startsWith('#')) {
      // Heading — skip and reset
      if (inParagraph) break;
      continue;
    }

    // Content line — start or continue the paragraph
    inParagraph = true;
    paragraphLines.push(trimmed);
  }

  return paragraphLines.join(' ');
}
