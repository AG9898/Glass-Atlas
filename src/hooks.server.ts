import { handle as authHandle } from './auth';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { Session } from '@auth/core/types';
import { env } from '$env/dynamic/private';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

const AUTH_BYPASS_SESSION: Session = {
  user: {
    name: 'Local Admin',
    email: 'local-admin@glass-atlas.dev',
    image: null,
  },
  expires: '2999-12-31T23:59:59.999Z',
};

function isAuthBypassEnabled(hostname: string): boolean {
  return (
    env.AUTH_BYPASS?.trim().toUpperCase() === 'TRUE' &&
    env.NODE_ENV === 'development' &&
    LOCAL_HOSTNAMES.has(hostname)
  );
}

const localAuthBypass: Handle = async ({ event, resolve }) => {
  if (isAuthBypassEnabled(event.url.hostname)) {
    event.locals.auth = async () => AUTH_BYPASS_SESSION;
  }

  return resolve(event);
};

const adminGuard: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/admin')) {
    const session = await event.locals.auth();
    if (!session?.user) {
      redirect(303, '/auth/signin');
    }
  }
  return resolve(event);
};

export const handle = sequence(authHandle, localAuthBypass, adminGuard);
