import { error } from '@sveltejs/kit';
import { getNoteBySlug, listNotes } from '$lib/server/db/notes';
import { renderMarkdown } from '$lib/server/markdown';
import type { Note } from '$lib/server/db/notes';
import type { PageServerLoad } from './$types';

/**
 * Derives up to 3 related notes for a given note.
 * Scores by category match (+2) and shared tags (+1 per tag).
 * Excludes the current note itself.
 */
function deriveRelatedNotes(note: Note, allPublished: Note[]): Note[] {
  const others = allPublished.filter((n) => n.slug !== note.slug);

  const scored = others.map((n) => {
    let score = 0;
    if (note.category && n.category === note.category) score += 2;
    if (note.tags && n.tags) {
      for (const tag of note.tags) {
        if (n.tags.includes(tag)) score += 1;
      }
    }
    return { note: n, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => s.note);
}

export const load: PageServerLoad = async ({ params }) => {
  const { slug } = params;

  const [note, allPublished] = await Promise.all([
    getNoteBySlug(slug),
    listNotes({ status: 'published' }),
  ]);

  if (!note || note.status !== 'published') {
    error(404, 'Note not found');
  }

  const [bodyHtml, relatedNotes] = await Promise.all([
    renderMarkdown(note.body),
    Promise.resolve(deriveRelatedNotes(note, allPublished)),
  ]);

  return {
    note,
    bodyHtml,
    allPublished,
    relatedNotes,
  };
};
