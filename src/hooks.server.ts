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

/**
 * Builds the sign-in redirect URL, preserving the current path and query
 * string as the callbackUrl so the user lands back where they intended
 * after a successful OAuth sign-in.
 *
 * Exported for unit testing only — not part of the public API.
 */
export function buildSigninRedirectUrl(pathname: string, search: string): string {
  const callbackUrl = pathname + search;
  return `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

const localAuthBypass: Handle = async ({ event, resolve }) => {
  if (isAuthBypassEnabled(event.url.hostname)) {
    event.locals.auth = async () => AUTH_BYPASS_SESSION;
  }

  return resolve(event);
};

// /api/admin/media/access-url is intentionally public — it serves presigned GET
// URLs so bucket-hosted note media renders on public note pages without auth.
const PUBLIC_API_PATHS = new Set(['/api/admin/media/access-url']);

const adminGuard: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  if (pathname.startsWith('/api/admin') && !PUBLIC_API_PATHS.has(pathname)) {
    const session = await event.locals.auth();
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else if (pathname.startsWith('/admin')) {
    const session = await event.locals.auth();
    if (!session?.user) {
      redirect(303, buildSigninRedirectUrl(pathname, event.url.search));
    }
  }

  return resolve(event);
};

const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set(
		'Content-Security-Policy',
		"frame-ancestors 'self' https://adenguo.com https://my-portfolio-sepia-xi-89.vercel.app",
	);
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	if (env.NODE_ENV !== 'development') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};

export const handle = sequence(authHandle, localAuthBypass, adminGuard, securityHeaders);
