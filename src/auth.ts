import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import { AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, AUTH_SECRET } from '$env/static/private';

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
  secret: AUTH_SECRET,
  trustHost: true,
});
