import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { embedNoteBodyChunks, embedText } from '$lib/server/embeddings';
import { createNote, getNoteBySlug, listNotes, replaceNoteChunks, updateNote } from '$lib/server/db/notes';
import { slugify } from '$lib/utils/slugify';

type NoteStatus = 'draft' | 'published';
type NoteMediaType = 'image-jpeg' | 'image-png' | 'image-svg' | 'image-gif' | 'video-mp4';

type CreateFormValues = {
  title: string;
  takeaway: string;
  body: string;
  tags: string[];
  category: string;
  status: NoteStatus;
  publishedAt: string;
  series: string;
  image: string;
  mediaType: NoteMediaType;
};

const STATUS_VALUES = new Set<NoteStatus>(['draft', 'published']);
const MEDIA_TYPE_VALUES = new Set<NoteMediaType>(['image-jpeg', 'image-png', 'image-svg', 'image-gif', 'video-mp4']);

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function parseStatus(value: string): NoteStatus {
  return STATUS_VALUES.has(value as NoteStatus) ? (value as NoteStatus) : 'draft';
}

function parseMediaType(value: string): NoteMediaType {
  return MEDIA_TYPE_VALUES.has(value as NoteMediaType) ? (value as NoteMediaType) : 'image-jpeg';
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index);
}

function parsePublishedAt(value: string): Date | null {
  if (value === '') return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readValues(formData: FormData): CreateFormValues {
  return {
    title: readString(formData, 'title'),
    takeaway: readString(formData, 'takeaway'),
    body: readString(formData, 'body'),
    tags: parseTags(readString(formData, 'tags')),
    category: readString(formData, 'category'),
    status: parseStatus(readString(formData, 'status')),
    publishedAt: readString(formData, 'publishedAt'),
    series: readString(formData, 'series'),
    image: readString(formData, 'image'),
    mediaType: parseMediaType(readString(formData, 'mediaType')),
  };
}

async function updateEmbeddingAfterSave(
  slug: string,
  body: string,
  metadata: {
    title: string;
    category: string | null;
    tags: string[] | null;
    series: string | null;
  },
): Promise<void> {
  let embedding: number[] | null = null;

  try {
    embedding = await embedText(body);
  } catch (error) {
    console.error(`Failed to generate embedding for note "${slug}".`, error);
  }

  try {
    await updateNote(slug, { embedding });
  } catch (error) {
    console.error(`Failed to store embedding for note "${slug}".`, error);
  }

  try {
    const chunkEmbeddings = await embedNoteBodyChunks(body, metadata);
    await replaceNoteChunks(slug, chunkEmbeddings);
  } catch (error) {
    console.error(`Failed to regenerate chunk embeddings for note "${slug}".`, error);
  }
}

export const load: PageServerLoad = async () => {
  const allNotes = await listNotes();
  return { noteSlugs: allNotes.map((n) => n.slug) };
};

export const actions: Actions = {
  create: async ({ request }) => {
    const values = readValues(await request.formData());

    if (values.title === '') {
      return fail(400, { message: 'A title is required before creating a note.', values });
    }

    if (values.body === '') {
      return fail(400, { message: 'A markdown body is required before creating a note.', values });
    }

    const slug = slugify(values.title);
    if (slug === '') {
      return fail(400, { message: 'The title must include at least one slug-safe character.', values });
    }

    const existingNote = await getNoteBySlug(slug);
    if (existingNote) {
      return fail(409, { message: `A note already exists for slug "${slug}".`, values });
    }

    const note = await createNote({
      slug,
      title: values.title,
      body: values.body,
      takeaway: values.takeaway || null,
      category: values.category || null,
      tags: values.tags.length > 0 ? values.tags : null,
      image: values.image || null,
      mediaType: values.mediaType,
      publishedAt: parsePublishedAt(values.publishedAt),
      series: values.series || null,
      status: values.status,
    });

    await updateEmbeddingAfterSave(note.slug, values.body, {
      title: note.title,
      category: note.category,
      tags: note.tags,
      series: note.series,
    });

    throw redirect(303, `/admin/notes/${note.slug}/edit`);
  },
};
