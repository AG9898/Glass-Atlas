import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteNote, listNotes } from '$lib/server/db/notes';

export const load: PageServerLoad = async () => {
  const notes = await listNotes();

  return {
    notes,
  };
};

export const actions: Actions = {
  delete: async ({ request }) => {
    const formData = await request.formData();
    const slug = formData.get('slug');

    if (typeof slug !== 'string' || slug.trim() === '') {
      return fail(400, { message: 'A note slug is required before deletion.' });
    }

    await deleteNote(slug);

    return { deleted: slug };
  },
};
