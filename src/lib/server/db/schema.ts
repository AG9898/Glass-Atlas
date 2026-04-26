import {
  customType,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from '@auth/core/adapters';

// pgvector column — requires `CREATE EXTENSION IF NOT EXISTS vector;` on the Neon project.
// Embeddings are generated at note save time (see src/lib/server/embeddings.ts).
const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(',').map(Number);
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
});

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  // Markdown body — wiki-links use [[slug]] or [[slug|display text]] syntax.
  body: text('body').notNull(),
  // One-liner summary sent to the LLM instead of the full body (cost/token control).
  takeaway: text('takeaway'),
  category: text('category'),
  // Comma-separated tags stored as a text array.
  tags: text('tags').array(),
  status: text('status', { enum: ['draft', 'published'] }).default('draft').notNull(),
  // 1536 dimensions matches OpenAI text-embedding-3-small / ada-002.
  // Regenerated on every body save (see src/lib/server/embeddings.ts).
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

// ---------------------------------------------------------------------------
// Wiki-link graph
// ---------------------------------------------------------------------------
//
// Populated by parsing [[slug]] and [[slug|text]] in note bodies on save.
// source_slug FK-cascades on note delete; target_slug is a soft reference
// (the target note may not exist yet — forward references are valid).

export const noteLinks = pgTable(
  'note_links',
  {
    id: serial('id').primaryKey(),
    sourceSlug: text('source_slug')
      .notNull()
      .references(() => notes.slug, { onDelete: 'cascade' }),
    // Soft reference — no FK so forward links don't fail on insert.
    targetSlug: text('target_slug').notNull(),
    // Display text from [[slug|text]]; null means the slug itself is the display text.
    linkText: text('link_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('note_links_source_target_unique').on(table.sourceSlug, table.targetSlug)],
);

export type NoteLink = typeof noteLinks.$inferSelect;

// ---------------------------------------------------------------------------
// Auth.js — session / account tables (used by DrizzleAdapter when enabled)
// ---------------------------------------------------------------------------

export const users = pgTable('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ---------------------------------------------------------------------------
// Chat rate limiting
// ---------------------------------------------------------------------------
// Keyed by hashed IP. Window resets each hour; 10 messages max (see PRD).

export const chatRateLimits = pgTable('chat_rate_limits', {
  id: serial('id').primaryKey(),
  ipHash: text('ip_hash').unique().notNull(),
  messageCount: integer('message_count').default(0).notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).defaultNow().notNull(),
});
