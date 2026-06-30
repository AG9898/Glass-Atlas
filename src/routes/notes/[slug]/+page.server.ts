import { error } from '@sveltejs/kit';
import {
  getNoteBySlug,
  listNotes,
  getOutlinks,
  getBacklinks,
  getRelatedNotes,
} from '$lib/server/db/notes';
import type { Note } from '$lib/server/db/notes';
import { renderMarkdown } from '$lib/server/markdown';
import type { PageServerLoad } from './$types';

// Semantic "next read" suggestions shown alongside the explicit wiki-link
// reader paths (backlinks/outlinks). Kept small so it stays a secondary,
// line-led module rather than competing with the article body.
const RELATED_NOTES_LIMIT = 3;

export type NoteGraphData = {
  nodes: { slug: string; title: string; isCurrent: boolean }[];
  edges: { source: string; target: string }[];
};

export const load: PageServerLoad = async ({ params }) => {
  const { slug } = params;

  const [note, allPublished] = await Promise.all([
    getNoteBySlug(slug),
    listNotes({ status: 'published' }),
  ]);

  if (!note || note.status !== 'published') {
    error(404, 'Note not found');
  }

  const [bodyHtml, relatedNotes, outlinksRaw, backlinksRaw] = await Promise.all([
    renderMarkdown(note.body),
    getRelatedNotes(slug, RELATED_NOTES_LIMIT),
    getOutlinks(slug),
    getBacklinks(slug),
  ]);

  // Explicit wiki-link reader paths: public pages only ever link to
  // resolved, published notes — never forward references or drafts.
  const outlinks: Note[] = outlinksRaw
    .map((link) => link.note)
    .filter((target): target is Note => target !== null && target.status === 'published');

  const backlinks: Note[] = backlinksRaw.filter((source) => source.status === 'published');

  // Build 1-hop graph from the same published-only connections.
  const nodes: NoteGraphData['nodes'] = [{ slug, title: note.title, isCurrent: true }];
  const edges: NoteGraphData['edges'] = [];
  const seen = new Set<string>([slug]);

  for (const target of outlinks) {
    if (!seen.has(target.slug)) {
      nodes.push({ slug: target.slug, title: target.title, isCurrent: false });
      seen.add(target.slug);
    }
    edges.push({ source: slug, target: target.slug });
  }

  for (const source of backlinks) {
    if (!seen.has(source.slug)) {
      nodes.push({ slug: source.slug, title: source.title, isCurrent: false });
      seen.add(source.slug);
    }
    edges.push({ source: source.slug, target: slug });
  }

  return {
    note,
    bodyHtml,
    allPublished,
    relatedNotes,
    backlinks,
    outlinks,
    graph: { nodes, edges } satisfies NoteGraphData,
  };
};
