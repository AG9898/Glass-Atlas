import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

function requiredEnv(name: 'AUTH_GITHUB_ID' | 'AUTH_GITHUB_SECRET' | 'AUTH_SECRET'): string {
  const value = env[name];
  if (value) {
    return value;
  }

  // SvelteKit executes server modules during build analysis. Defer strict
  // env validation to runtime so production builds don't require secrets.
  if (!building) {
    throw new Error(`Missing required Auth.js env var: ${name}`);
  }

  return `__MISSING_${name}__`;
}

const AUTH_GITHUB_ID = requiredEnv('AUTH_GITHUB_ID');
const AUTH_GITHUB_SECRET = requiredEnv('AUTH_GITHUB_SECRET');
const AUTH_SECRET = requiredEnv('AUTH_SECRET');

// Using JWT sessions (no DB adapter).
// @auth/sveltekit@1.0.0 can resolve trustHost=false in production on Docker/Railway,
// so keep trustHost explicitly true here.
// To switch to DB-backed sessions, add adapter: DrizzleAdapter(db) here.
export const { handle, signIn, signOut } = SvelteKitAuth({
  providers: [
    GitHub({
      clientId: AUTH_GITHUB_ID,
      clientSecret: AUTH_GITHUB_SECRET,
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  secret: AUTH_SECRET,
  trustHost: true,
});
