import { getPublishedNoteGraph } from '$lib/server/db/notes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
  graph: await getPublishedNoteGraph(),
});
