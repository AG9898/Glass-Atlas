import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import { env } from '$env/dynamic/private';

// Using JWT sessions (no DB adapter) until DATABASE_URL is configured.
// Once Neon is set up, add DrizzleAdapter(db) to persist sessions.
export const { handle, signIn, signOut } = SvelteKitAuth({
  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }),
  ],
  secret: env.AUTH_SECRET,
  trustHost: Boolean(env.AUTH_TRUST_HOST),
});
