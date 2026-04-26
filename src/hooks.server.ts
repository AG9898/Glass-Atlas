import { handle as authHandle } from './auth';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

const adminGuard: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/admin')) {
    const session = await event.locals.auth();
    if (!session?.user) {
      redirect(303, '/auth/signin');
    }
  }
  return resolve(event);
};

export const handle = sequence(authHandle, adminGuard);
