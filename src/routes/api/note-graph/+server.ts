import { json } from '@sveltejs/kit';
import { getPublishedNoteGraph } from '$lib/server/db/notes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const graph = await getPublishedNoteGraph();
  return json(graph, {
    headers: {
      'cache-control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
};
