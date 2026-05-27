import { error } from '@sveltejs/kit';
import { getNoteBySlug, listNotes, getOutlinks, getBacklinks } from '$lib/server/db/notes';
import { renderMarkdown } from '$lib/server/markdown';
import { deriveRelatedNotes } from '$lib/server/related-notes';
import type { PageServerLoad } from './$types';

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
    Promise.resolve(deriveRelatedNotes(note, allPublished)),
    getOutlinks(slug),
    getBacklinks(slug),
  ]);

  // Build 1-hop graph: resolved published notes only
  const nodes: NoteGraphData['nodes'] = [{ slug, title: note.title, isCurrent: true }];
  const edges: NoteGraphData['edges'] = [];
  const seen = new Set<string>([slug]);

  for (const { note: target } of outlinksRaw) {
    if (!target || target.status !== 'published') continue;
    if (!seen.has(target.slug)) {
      nodes.push({ slug: target.slug, title: target.title, isCurrent: false });
      seen.add(target.slug);
    }
    edges.push({ source: slug, target: target.slug });
  }

  for (const backlink of backlinksRaw) {
    if (backlink.status !== 'published') continue;
    if (!seen.has(backlink.slug)) {
      nodes.push({ slug: backlink.slug, title: backlink.title, isCurrent: false });
      seen.add(backlink.slug);
    }
    edges.push({ source: backlink.slug, target: slug });
  }

  return {
    note,
    bodyHtml,
    allPublished,
    relatedNotes,
    graph: { nodes, edges } satisfies NoteGraphData,
  };
};
