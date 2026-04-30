import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from './index';
import { citationEvents, noteLinks, notes } from './schema';
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
  status: 'draft' | 'published';
  embedding: number[] | null;
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
  status?: 'draft' | 'published';
  embedding?: number[] | null;
};

export type UpdateNoteInput = {
  title?: string;
  body?: string;
  takeaway?: string | null;
  category?: string | null;
  tags?: string[] | null;
  status?: 'draft' | 'published';
  embedding?: number[] | null;
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

/** Returns all notes sorted by publishedAt (createdAt) descending, with optional filtering. */
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
    .orderBy(desc(notes.createdAt));

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
      status: data.status ?? 'draft',
      embedding: data.embedding ?? null,
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
// Similarity search — stub (implemented in ADMIN-01b)
// ---------------------------------------------------------------------------

/** Cosine similarity search via pgvector. Returns published notes closest to the given embedding. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function searchNotesBySimilarity(embedding: number[], limit: number): Promise<Note[]> {
  throw new Error('searchNotesBySimilarity: not yet implemented (see ADMIN-01b)');
}

// ---------------------------------------------------------------------------
// Citation tracking — stubs (implemented in ADMIN-01b)
// ---------------------------------------------------------------------------

/** Bulk-inserts one citation_events row per slug. Fire-and-forget; does not block streaming. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function recordCitations(slugs: string[]): Promise<void> {
  throw new Error('recordCitations: not yet implemented (see ADMIN-01b)');
}

/** Returns the total COUNT(*) from citation_events. */
export async function getTotalCitations(): Promise<number> {
  throw new Error('getTotalCitations: not yet implemented (see ADMIN-01b)');
}

// Keep findSimilarNotes for now — callers that existed before ADMIN-01b will migrate to searchNotesBySimilarity.
/** @deprecated Use searchNotesBySimilarity instead (ADMIN-01b). */
export async function findSimilarNotes(embedding: number[], limit = 5): Promise<Note[]> {
  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.status, 'published'))
    .orderBy(sql`embedding <=> ${JSON.stringify(embedding)}::vector`)
    .limit(limit);
  return rows.map(toNote);
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
    status: row.status as 'draft' | 'published',
    embedding: row.embedding,
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

// Silence the unused-import warning for citationEvents — it will be used in ADMIN-01b.
void citationEvents;
