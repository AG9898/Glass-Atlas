/**
 * migrate.js — Applies pending Drizzle migrations using the Neon HTTP driver.
 *
 * drizzle-kit migrate uses websockets (@neondatabase/serverless) which fail in
 * WSL2 and some CI environments. This script reads the drizzle/_journal.json,
 * applies any SQL files not yet recorded in public.__drizzle_migrations, and
 * updates the tracking table — producing the same outcome as drizzle-kit migrate.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/migrate.js
 *
 * In package.json this is wired to:
 *   npm run db:migrate:http
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(dbUrl);

// Ensure the Drizzle migrations tracking table exists.
await sql([`
  CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`]);

// Load the journal.
const journalPath = join(root, 'drizzle', 'meta', '_journal.json');
if (!existsSync(journalPath)) {
  console.log('No drizzle/meta/_journal.json found — nothing to migrate.');
  process.exit(0);
}

const journal = JSON.parse(readFileSync(journalPath, 'utf-8'));

// Find which entries have already been applied.
const applied = await sql`SELECT hash FROM public.__drizzle_migrations`;
const appliedSet = new Set(applied.map((r) => r.hash));

let count = 0;
for (const entry of journal.entries) {
  if (appliedSet.has(entry.tag)) {
    console.log(`[skip] ${entry.tag} (already applied)`);
    continue;
  }

  const sqlPath = join(root, 'drizzle', `${entry.tag}.sql`);
  if (!existsSync(sqlPath)) {
    console.error(`ERROR: Migration file not found: ${sqlPath}`);
    process.exit(1);
  }

  const migrationSql = readFileSync(sqlPath, 'utf-8');
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`[apply] ${entry.tag} (${statements.length} statements)`);

  for (let i = 0; i < statements.length; i++) {
    try {
      await sql([statements[i]]);
      process.stdout.write(`  [${i + 1}/${statements.length}] OK\n`);
    } catch (/** @type {unknown} */ err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [${i + 1}/${statements.length}] FAILED: ${message}`);
      process.exit(1);
    }
  }

  await sql`INSERT INTO public.__drizzle_migrations (hash, created_at) VALUES (${entry.tag}, ${Date.now()})`;
  console.log(`  Recorded in __drizzle_migrations`);
  count++;
}

if (count === 0) {
  console.log('No pending migrations.');
} else {
  console.log(`\nApplied ${count} migration(s) successfully.`);
}
