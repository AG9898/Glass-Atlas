import { and, count, desc, eq, ilike, inArray, isNotNull, notInArray, or, sql } from 'drizzle-orm';
import { db } from './index';
import { chatRateLimits, citationEvents, noteChunks, noteLinks, notes } from './schema';
import { parseWikiLinks } from '$lib/utils/wiki-links';

// ---------------------------------------------------------------------------
// Plain-object types — exported for use in route handlers and form actions.
// Using explicit types rather than re-exporting raw Drizzle inference types
// keeps the public API serializable and decoupled from the ORM.
// ---------------------------------------------------------------------------

export type Note = {
  id: number;
  slug: string;
  title: string;
  body: string;
  takeaway: string | null;
  category: string | null;
  tags: string[] | null;
  image: string | null;
  mediaType: 'image-jpeg' | 'image-png' | 'image-svg' | 'image-gif' | 'video-mp4';
  publishedAt: Date | null;
  series: string | null;
  status: 'draft' | 'published';
  embedding: number[] | null;
  semanticIndexStatus: 'pending' | 'current' | 'failed';
  semanticIndexError: string | null;
  semanticIndexedAt: Date | null;
  semanticIndexSourceUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateNoteInput = {
  slug: string;
  title: string;
  body: string;
  takeaway?: string | null;
  category?: string | null;
  tags?: string[] | null;
  image?: string | null;
  mediaType?: 'image-jpeg' | 'image-png' | 'image-svg' | 'image-gif' | 'video-mp4';
  publishedAt?: Date | null;
  series?: string | null;
  status?: 'draft' | 'published';
  embedding?: number[] | null;
  semanticIndexStatus?: 'pending' | 'current' | 'failed';
  semanticIndexError?: string | null;
  semanticIndexedAt?: Date | null;
  semanticIndexSourceUpdatedAt?: Date | null;
};

export type ReplaceNoteChunkInput = {
  sectionHeading?: string | null;
  sectionIndex: number;
  chunkIndex: number;
  chunkText: string;
  embedding: number[];
};

export type RetrievedNoteChunk = {
  id: number;
  noteSlug: string;
  noteTitle: string;
  sectionHeading: string | null;
  sectionIndex: number;
  chunkIndex: number;
  chunkText: string;
  distance: number;
};

export type ConsumeChatRateLimitInput = {
  sessionHash: string;
  maxMessages: number;
  windowMs: number;
  now?: Date;
};

export type ChatRateLimitResult = {
  allowed: boolean;
  messageCount: number;
  remaining: number;
  limit: number;
  windowStart: Date;
  resetAt: Date;
};

export type UpdateNoteInput = {
  title?: string;
  body?: string;
  takeaway?: string | null;
  category?: string | null;
  tags?: string[] | null;
  image?: string | null;
  mediaType?: 'image-jpeg' | 'image-png' | 'image-svg' | 'image-gif' | 'video-mp4';
  publishedAt?: Date | null;
  series?: string | null;
  status?: 'draft' | 'published';
  embedding?: number[] | null;
  semanticIndexStatus?: 'pending' | 'current' | 'failed';
  semanticIndexError?: string | null;
  semanticIndexedAt?: Date | null;
  semanticIndexSourceUpdatedAt?: Date | null;
  updatedAt?: Date;
};

// ---------------------------------------------------------------------------
// Filter type for listNotes
// ---------------------------------------------------------------------------

export type ListNotesFilter = {
  /** Filter by category (case-sensitive exact match on the `category` column). */
  topic?: string;
  /** Filter by publication status. */
  status?: 'draft' | 'published';
  /**
   * Case-insensitive search string applied to title and each element of tags.
   * Rows match when title ILIKE '%q%' OR any tag ILIKE '%q%'.
   */
  q?: string;
};

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Returns all notes sorted by published date (falling back to createdAt) descending. */
export async function listNotes(filter?: ListNotesFilter): Promise<Note[]> {
  const conditions = [];

  if (filter?.status) {
    conditions.push(eq(notes.status, filter.status));
  }

  if (filter?.topic) {
    conditions.push(eq(notes.category, filter.topic));
  }

  if (filter?.q) {
    const pattern = `%${filter.q}%`;
    // Match on title OR any element of the tags array (using Postgres ANY operator)
    conditions.push(
      or(
        ilike(notes.title, pattern),
        sql`EXISTS (SELECT 1 FROM unnest(${notes.tags}) AS t(tag) WHERE t.tag ILIKE ${pattern})`,
      ),
    );
  }

  const rows = await db
    .select()
    .from(notes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sql`coalesce(${notes.publishedAt}, ${notes.createdAt})`));

  return rows.map(toNote);
}

/** Returns the note with the given slug, or null if not found. */
export async function getNoteBySlug(slug: string): Promise<Note | null> {
  const [row] = await db.select().from(notes).where(eq(notes.slug, slug));
  return row ? toNote(row) : null;
}

/** Inserts a new note and syncs its wiki-links. Returns the created note. */
export async function createNote(data: CreateNoteInput): Promise<Note> {
  const [row] = await db
    .insert(notes)
    .values({
      slug: data.slug,
      title: data.title,
      body: data.body,
      takeaway: data.takeaway ?? null,
      category: data.category ?? null,
      tags: data.tags ?? null,
      image: data.image ?? null,
      mediaType: data.mediaType ?? 'image-jpeg',
      publishedAt: data.publishedAt ?? null,
      series: data.series ?? null,
      status: data.status ?? 'draft',
      embedding: data.embedding ?? null,
      semanticIndexStatus: data.semanticIndexStatus ?? 'pending',
      semanticIndexError: data.semanticIndexError ?? null,
      semanticIndexedAt: data.semanticIndexedAt ?? null,
      semanticIndexSourceUpdatedAt: data.semanticIndexSourceUpdatedAt ?? null,
    })
    .returning();
  if (row) await syncNoteLinks(row.slug, row.body);
  return toNote(row);
}

/** Patches the specified fields on the note with the given slug and returns the updated note. */
export async function updateNote(slug: string, data: UpdateNoteInput): Promise<Note | null> {
  const [row] = await db
    .update(notes)
    .set({ ...data, updatedAt: data.updatedAt ?? new Date() })
    .where(eq(notes.slug, slug))
    .returning();
  if (!row) return null;
  if (data.body !== undefined) await syncNoteLinks(row.slug, row.body);
  return toNote(row);
}

/** Removes the note row. note_links rows with source_slug cascade-delete automatically. */
export async function deleteNote(slug: string): Promise<void> {
  await db.delete(notes).where(eq(notes.slug, slug));
}

// ---------------------------------------------------------------------------
// Backlinks / outlinks
// ---------------------------------------------------------------------------

/** Returns all notes that contain a wiki-link pointing at the given slug. */
export async function getBacklinks(slug: string): Promise<Note[]> {
  const rows = await db
    .select({ sourceSlug: noteLinks.sourceSlug })
    .from(noteLinks)
    .where(eq(noteLinks.targetSlug, slug));

  const sourceSlugs = rows.map((r) => r.sourceSlug);
  if (sourceSlugs.length === 0) return [];

  const noteRows = await db.select().from(notes).where(inArray(notes.slug, sourceSlugs));
  return noteRows.map(toNote);
}

/** Returns all links from the given note, with their resolved Note objects (or null for forward refs). */
export async function getOutlinks(
  slug: string,
): Promise<{ link: typeof noteLinks.$inferSelect; note: Note | null }[]> {
  const links = await db.select().from(noteLinks).where(eq(noteLinks.sourceSlug, slug));

  const targetSlugs = links.map((l) => l.targetSlug);
  const targetNotes =
    targetSlugs.length > 0
      ? await db.select().from(notes).where(inArray(notes.slug, targetSlugs))
      : [];

  const noteBySlug = new Map(targetNotes.map((n) => [n.slug, toNote(n)]));
  return links.map((link) => ({ link, note: noteBySlug.get(link.targetSlug) ?? null }));
}

// ---------------------------------------------------------------------------
// Similarity search
// ---------------------------------------------------------------------------

/** Cosine similarity search via pgvector. Returns published notes closest to the given embedding. */
export async function searchNotesBySimilarity(embedding: number[], limit: number): Promise<Note[]> {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];

  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.status, 'published'), isNotNull(notes.embedding)))
    .orderBy(sql`${notes.embedding} <=> ${JSON.stringify(embedding)}::vector`)
    .limit(safeLimit);

  return rows.map(toNote);
}

// ---------------------------------------------------------------------------
// Citation tracking
// ---------------------------------------------------------------------------

/** Bulk-inserts one citation_events row per slug. Fire-and-forget; does not block streaming. */
export async function recordCitations(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return;

  await db.insert(citationEvents).values(slugs.map((slug) => ({ noteSlug: slug })));
}

/** Returns the total COUNT(*) from citation_events. */
export async function getTotalCitations(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(citationEvents);
  return row?.value ?? 0;
}

/**
 * Atomically consumes one chat request against an anonymous session hash quota window.
 * The DB row is keyed by session hash only; raw session tokens are never stored.
 */
export async function consumeChatRateLimit({
  sessionHash,
  maxMessages,
  windowMs,
  now = new Date(),
}: ConsumeChatRateLimitInput): Promise<ChatRateLimitResult> {
  if (maxMessages <= 0) {
    throw new Error('maxMessages must be greater than 0');
  }
  if (windowMs <= 0) {
    throw new Error('windowMs must be greater than 0');
  }

  const windowCutoff = new Date(now.getTime() - windowMs);

  const [row] = await db
    .insert(chatRateLimits)
    .values({
      sessionHash,
      messageCount: 1,
      windowStart: now,
    })
    .onConflictDoUpdate({
      target: [chatRateLimits.sessionHash],
      set: {
        messageCount: sql`CASE
          WHEN ${chatRateLimits.windowStart} <= ${windowCutoff} THEN 1
          ELSE ${chatRateLimits.messageCount} + 1
        END`,
        windowStart: sql`CASE
          WHEN ${chatRateLimits.windowStart} <= ${windowCutoff} THEN ${now}
          ELSE ${chatRateLimits.windowStart}
        END`,
      },
    })
    .returning({
      messageCount: chatRateLimits.messageCount,
      windowStart: chatRateLimits.windowStart,
    });

  const allowed = row.messageCount <= maxMessages;
  const remaining = Math.max(0, maxMessages - row.messageCount);
  const resetAt = new Date(row.windowStart.getTime() + windowMs);

  return {
    allowed,
    messageCount: row.messageCount,
    remaining,
    limit: maxMessages,
    windowStart: row.windowStart,
    resetAt,
  };
}

/** @deprecated Use searchNotesBySimilarity instead (ADMIN-01b). */
export async function findSimilarNotes(embedding: number[], limit = 5): Promise<Note[]> {
  return searchNotesBySimilarity(embedding, limit);
}

// ---------------------------------------------------------------------------
// Lexical / topic retrieval
// ---------------------------------------------------------------------------

/**
 * A published note matched by lexical/topic search (title, tags, or category).
 * Returned by `searchNotesByLexical` and used for candidate fusion in chat retrieval.
 */
export type RetrievedLexicalNote = {
  slug: string;
  title: string;
  category: string | null;
  tags: string[] | null;
  takeaway: string | null;
};

/**
 * Searches published notes by lexical/topic match on title, tags, and category.
 * All three fields are checked with case-insensitive substring matching.
 * Results are returned in descending publication-date order (most recent first).
 * Only published notes are returned.
 */
export async function searchNotesByLexical(
  query: string,
  limit: number,
): Promise<RetrievedLexicalNote[]> {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0 || !query.trim()) return [];

  const pattern = `%${query}%`;

  const rows = await db
    .select({
      slug: notes.slug,
      title: notes.title,
      category: notes.category,
      tags: notes.tags,
      takeaway: notes.takeaway,
    })
    .from(notes)
    .where(
      and(
        eq(notes.status, 'published'),
        or(
          ilike(notes.title, pattern),
          ilike(notes.category, pattern),
          sql`EXISTS (SELECT 1 FROM unnest(${notes.tags}) AS t(tag) WHERE t.tag ILIKE ${pattern})`,
        ),
      ),
    )
    .orderBy(desc(sql`coalesce(${notes.publishedAt}, ${notes.createdAt})`))
    .limit(safeLimit);

  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    category: row.category,
    tags: row.tags,
    takeaway: row.takeaway,
  }));
}

// ---------------------------------------------------------------------------
// Chunk retrieval
// ---------------------------------------------------------------------------

/**
 * Replaces the current chunk set for a note.
 * Existing rows with matching (note_slug, chunk_index) are upserted; stale chunk indexes are deleted.
 */
export async function replaceNoteChunks(
  noteSlug: string,
  chunks: ReplaceNoteChunkInput[],
): Promise<void> {
  const normalized = Array.from(
    new Map(chunks.map((chunk) => [chunk.chunkIndex, chunk] as const)).values(),
  ).sort((a, b) => a.chunkIndex - b.chunkIndex);

  if (normalized.length === 0) {
    await db.delete(noteChunks).where(eq(noteChunks.noteSlug, noteSlug));
    return;
  }

  await db
    .insert(noteChunks)
    .values(
      normalized.map((chunk) => ({
        noteSlug,
        sectionHeading: chunk.sectionHeading ?? null,
        sectionIndex: chunk.sectionIndex,
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        embedding: chunk.embedding,
      })),
    )
    .onConflictDoUpdate({
      target: [noteChunks.noteSlug, noteChunks.chunkIndex],
      set: {
        sectionHeading: sql`excluded.section_heading`,
        sectionIndex: sql`excluded.section_index`,
        chunkText: sql`excluded.chunk_text`,
        embedding: sql`excluded.embedding`,
      },
    });

  await db
    .delete(noteChunks)
    .where(
      and(
        eq(noteChunks.noteSlug, noteSlug),
        notInArray(
          noteChunks.chunkIndex,
          normalized.map((chunk) => chunk.chunkIndex),
        ),
      ),
    );
}

/** Cosine similarity search over published note chunks. */
export async function searchChunksBySimilarity(
  embedding: number[],
  limit: number,
): Promise<RetrievedNoteChunk[]> {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];

  const vectorLiteral = JSON.stringify(embedding);
  const rows = await db
    .select({
      id: noteChunks.id,
      noteSlug: noteChunks.noteSlug,
      noteTitle: notes.title,
      sectionHeading: noteChunks.sectionHeading,
      sectionIndex: noteChunks.sectionIndex,
      chunkIndex: noteChunks.chunkIndex,
      chunkText: noteChunks.chunkText,
      distance: sql<number>`${noteChunks.embedding} <=> ${vectorLiteral}::vector`,
    })
    .from(noteChunks)
    .innerJoin(notes, eq(noteChunks.noteSlug, notes.slug))
    .where(eq(notes.status, 'published'))
    .orderBy(sql`${noteChunks.embedding} <=> ${vectorLiteral}::vector`)
    .limit(safeLimit);

  return rows.map((row) => ({
    ...row,
    distance: Number(row.distance),
  }));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Maps a raw Drizzle row to a typed plain Note object. */
function toNote(row: typeof notes.$inferSelect): Note {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body,
    takeaway: row.takeaway,
    category: row.category,
    tags: row.tags,
    image: row.image,
    mediaType: row.mediaType as
      | 'image-jpeg'
      | 'image-png'
      | 'image-svg'
      | 'image-gif'
      | 'video-mp4',
    publishedAt: row.publishedAt,
    series: row.series,
    status: row.status as 'draft' | 'published',
    embedding: row.embedding,
    semanticIndexStatus: row.semanticIndexStatus as 'pending' | 'current' | 'failed',
    semanticIndexError: row.semanticIndexError,
    semanticIndexedAt: row.semanticIndexedAt,
    semanticIndexSourceUpdatedAt: row.semanticIndexSourceUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Rebuilds the note_links rows for a note from its current body. */
async function syncNoteLinks(slug: string, body: string): Promise<void> {
  const parsed = parseWikiLinks(body);
  await db.delete(noteLinks).where(eq(noteLinks.sourceSlug, slug));
  if (parsed.length === 0) return;
  await db
    .insert(noteLinks)
    .values(
      parsed.map((l) => ({
        sourceSlug: slug,
        targetSlug: l.slug,
        linkText: l.text !== l.slug ? l.text : null,
      })),
    )
    .onConflictDoNothing();
}
