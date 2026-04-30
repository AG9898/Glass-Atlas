import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// Warns at startup if DATABASE_URL is missing; actual queries will throw at
// that point rather than on import, so the dev server can still start.
if (!env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — database operations will fail. See docs/ENV_VARS.md.');
}

function createMissingDbClient(): ReturnType<typeof drizzle> {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(
          `DATABASE_URL is not set — attempted database access via db.${String(prop)}. See docs/ENV_VARS.md.`,
        );
      },
    },
  ) as ReturnType<typeof drizzle>;
}

export const db = env.DATABASE_URL
  ? drizzle(neon(env.DATABASE_URL), { schema })
  : createMissingDbClient();
