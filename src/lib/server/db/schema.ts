import {
  customType,
  integer,
  pgSchema,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from '@auth/core/adapters';

// All Glass Atlas tables live in the glass_atlas Postgres schema (not public).
// The Techy project owns the public schema on the same Neon database.
const glassAtlas = pgSchema('glass_atlas');

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

export const notes = glassAtlas.table('notes', {
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
  // Optional cover media URL. Media type dispatch is added in ADMIN-06a.
  image: text('image'),
  // Constrained cover media type for render-time dispatch in UI surfaces.
  mediaType: text('media_type', {
    enum: ['image-jpeg', 'image-png', 'image-svg', 'image-gif', 'video-mp4'],
  })
    .default('image-jpeg')
    .notNull(),
  // Optional publication metadata shown in admin/public note surfaces.
  publishedAt: timestamp('published_at', { withTimezone: true }),
  series: text('series'),
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

export const noteLinks = glassAtlas.table(
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
// Citation events
// ---------------------------------------------------------------------------
// One row per note retrieved by the chat RAG pipeline. Powers the landing page
// "total citations served" stat. Written as fire-and-forget before streaming starts.

export const citationEvents = glassAtlas.table('citation_events', {
  id: serial('id').primaryKey(),
  noteSlug: text('note_slug').notNull(),
  citedAt: timestamp('cited_at', { withTimezone: true }).defaultNow().notNull(),
});

export type CitationEvent = typeof citationEvents.$inferSelect;

// ---------------------------------------------------------------------------
// Auth.js — session / account tables (used by DrizzleAdapter when enabled)
// ---------------------------------------------------------------------------

export const users = glassAtlas.table('user', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
});

export const accounts = glassAtlas.table(
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

export const sessions = glassAtlas.table('session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = glassAtlas.table(
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

export const chatRateLimits = glassAtlas.table('chat_rate_limits', {
  id: serial('id').primaryKey(),
  ipHash: text('ip_hash').unique().notNull(),
  messageCount: integer('message_count').default(0).notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).defaultNow().notNull(),
});
