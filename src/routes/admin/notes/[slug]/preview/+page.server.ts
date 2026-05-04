import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getNoteBySlug, listNotes } from '$lib/server/db/notes';
import { renderMarkdown } from '$lib/server/markdown';
import { deriveRelatedNotes } from '$lib/server/related-notes';

export const load: PageServerLoad = async ({ params }) => {
  const [note, allPublished] = await Promise.all([
    getNoteBySlug(params.slug),
    listNotes({ status: 'published' }),
  ]);

  if (!note) {
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
