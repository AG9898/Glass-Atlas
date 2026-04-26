import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

// Warns at startup if DATABASE_URL is missing; actual queries will throw at
// that point rather than on import, so the dev server can still start.
if (!env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — database operations will fail. See docs/ENV_VARS.md.');
}

export const db = drizzle(
  neon(env.DATABASE_URL ?? 'postgresql://not-configured'),
  { schema },
);
