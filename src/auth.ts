import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import { AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, AUTH_SECRET } from '$env/static/private';

// Using JWT sessions (no DB adapter). Auth_TRUST_HOST must NOT be set on Railway —
// the SvelteKit Auth.js adapter sets trustHost appropriately via its own defaults.
// To switch to DB-backed sessions, add adapter: DrizzleAdapter(db) here.
export const { handle, signIn, signOut } = SvelteKitAuth({
  providers: [
    GitHub({
      clientId: AUTH_GITHUB_ID,
      clientSecret: AUTH_GITHUB_SECRET,
    }),
  ],
  secret: AUTH_SECRET,
});
