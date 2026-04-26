import { eq, desc, inArray, sql } from 'drizzle-orm';
import { db } from './index';
import { notes, noteLinks, type Note, type NewNote } from './schema';
import { parseWikiLinks } from '$lib/utils/wiki-links';

export async function getNoteBySlug(slug: string): Promise<Note | undefined> {
  const [note] = await db.select().from(notes).where(eq(notes.slug, slug));
  return note;
}

export async function getPublishedNotes(): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(eq(notes.status, 'published'))
    .orderBy(desc(notes.createdAt));
}

export async function getAllNotes(): Promise<Note[]> {
  return db.select().from(notes).orderBy(desc(notes.createdAt));
}

export async function createNote(data: NewNote): Promise<Note> {
  const [note] = await db.insert(notes).values(data).returning();
  if (note) await syncNoteLinks(note.slug, note.body);
  return note;
}

export async function updateNote(slug: string, data: Partial<NewNote>): Promise<Note | undefined> {
  const [note] = await db.update(notes).set(data).where(eq(notes.slug, slug)).returning();
  if (note && data.body !== undefined) await syncNoteLinks(note.slug, note.body);
  return note;
}

export async function deleteNote(slug: string): Promise<void> {
  // note_links rows with source_slug cascade-delete automatically.
  await db.delete(notes).where(eq(notes.slug, slug));
}

// Returns notes whose slugs appear as link targets pointing at the given slug (backlinks).
export async function getBacklinks(slug: string): Promise<Note[]> {
  const rows = await db
    .select({ sourceSlug: noteLinks.sourceSlug })
    .from(noteLinks)
    .where(eq(noteLinks.targetSlug, slug));

  const sourceSlugs = rows.map((r) => r.sourceSlug);
  if (sourceSlugs.length === 0) return [];

  return db.select().from(notes).where(inArray(notes.slug, sourceSlugs));
}

// Returns notes linked from the given note.
export async function getOutlinks(slug: string): Promise<{ link: typeof noteLinks.$inferSelect; note: Note | null }[]> {
  const links = await db
    .select()
    .from(noteLinks)
    .where(eq(noteLinks.sourceSlug, slug));

  const targetSlugs = links.map((l) => l.targetSlug);
  const targetNotes =
    targetSlugs.length > 0
      ? await db.select().from(notes).where(inArray(notes.slug, targetSlugs))
      : [];

  const noteBySlug = new Map(targetNotes.map((n) => [n.slug, n]));
  return links.map((link) => ({ link, note: noteBySlug.get(link.targetSlug) ?? null }));
}

// Cosine similarity search via pgvector — used by the RAG chat endpoint.
export async function findSimilarNotes(embedding: number[], limit = 5): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(eq(notes.status, 'published'))
    .orderBy(sql`embedding <=> ${JSON.stringify(embedding)}::vector`)
    .limit(limit);
}

// Rebuilds the note_links rows for a note from its current body.
// Deletes all existing outgoing links for the note, then re-inserts from parsed wiki-links.
async function syncNoteLinks(slug: string, body: string): Promise<void> {
  const parsed = parseWikiLinks(body);
  await db.delete(noteLinks).where(eq(noteLinks.sourceSlug, slug));
  if (parsed.length === 0) return;
  await db
    .insert(noteLinks)
    .values(
      parsed.map((l) => ({ sourceSlug: slug, targetSlug: l.slug, linkText: l.text !== l.slug ? l.text : null })),
    )
    .onConflictDoNothing();
}
