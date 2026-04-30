import { listNotes } from '$lib/server/db/notes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const topic = url.searchParams.get('topic') ?? undefined;
  const q = url.searchParams.get('q')?.trim() ?? '';
  const sort = url.searchParams.get('sort') ?? 'newest';

  const notes = await listNotes({
    status: 'published',
    topic,
    q: q.length > 0 ? q : undefined,
  });

  // listNotes already returns notes in reverse-chronological order.
  // Honour an explicit ?sort=oldest param for ascending order.
  const sorted = sort === 'oldest' ? [...notes].reverse() : notes;

  return {
    notes: sorted,
    topic: topic ?? '',
    q,
    sort,
  };
};
