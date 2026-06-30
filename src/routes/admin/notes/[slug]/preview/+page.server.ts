import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getNoteBySlug, listNotes, getOutlinks, getBacklinks, getRelatedNotes } from '$lib/server/db/notes';
import type { Note } from '$lib/server/db/notes';
import { renderMarkdown } from '$lib/server/markdown';

// Mirrors the public note detail reader-path limit so draft preview stays
// visually aligned with the published page (see NoteDetail.svelte usage).
const RELATED_NOTES_LIMIT = 3;

export const load: PageServerLoad = async ({ params }) => {
  const [note, allPublished] = await Promise.all([
    getNoteBySlug(params.slug),
    listNotes({ status: 'published' }),
  ]);

  if (!note) {
    error(404, 'Note not found');
  }

  const [bodyHtml, relatedNotes, outlinksRaw, backlinksRaw] = await Promise.all([
    renderMarkdown(note.body),
    getRelatedNotes(note.slug, RELATED_NOTES_LIMIT),
    getOutlinks(note.slug),
    getBacklinks(note.slug),
  ]);

  // Same published-only filtering as the public page: a draft preview
  // should not surface unpublished or unresolved reader paths either.
  const outlinks: Note[] = outlinksRaw
    .map((link) => link.note)
    .filter((target): target is Note => target !== null && target.status === 'published');

  const backlinks: Note[] = backlinksRaw.filter((source) => source.status === 'published');

  return {
    note,
    bodyHtml,
    allPublished,
    relatedNotes,
    backlinks,
    outlinks,
  };
};
