import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  // All Glass Atlas tables live in the glass_atlas Postgres schema, not public.
  // This ensures drizzle-kit only manages glass_atlas schema objects and does not
  // touch the public schema owned by the Techy project on the same Neon database.
  schemaFilter: ['glass_atlas'],
});
