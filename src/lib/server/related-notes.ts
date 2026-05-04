import type { Note } from './db/notes';

/**
 * Derives up to 3 related notes for a given note.
 * Scores by category match (+2) and shared tags (+1 per tag).
 * Excludes the current note itself.
 */
export function deriveRelatedNotes(note: Note, allPublished: Note[]): Note[] {
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
