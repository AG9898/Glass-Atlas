import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { embedText } from '$lib/server/embeddings';
import { getNoteBySlug, updateNote } from '$lib/server/db/notes';

type NoteStatus = 'draft' | 'published';
type NoteMediaType = 'image-jpeg' | 'image-png' | 'image-svg' | 'image-gif' | 'video-mp4';

type EditFormValues = {
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

const MEDIA_TYPE_VALUES = new Set<NoteMediaType>(['image-jpeg', 'image-png', 'image-svg', 'image-gif', 'video-mp4']);

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag, index, tags) => tag.length > 0 && tags.indexOf(tag) === index);
}

function parseMediaType(value: string): NoteMediaType {
  return MEDIA_TYPE_VALUES.has(value as NoteMediaType) ? (value as NoteMediaType) : 'image-jpeg';
}

function parsePublishedAt(value: string): Date | null {
  if (value === '') return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

function readValues(formData: FormData, status: NoteStatus): EditFormValues {
  return {
    title: readString(formData, 'title'),
    takeaway: readString(formData, 'takeaway'),
    body: readString(formData, 'body'),
    tags: parseTags(readString(formData, 'tags')),
    category: readString(formData, 'category'),
    status,
    publishedAt: readString(formData, 'publishedAt'),
    series: readString(formData, 'series'),
    image: readString(formData, 'image'),
    mediaType: parseMediaType(readString(formData, 'mediaType')),
  };
}

async function requireNote(slug: string) {
  const note = await getNoteBySlug(slug);
  if (!note) error(404, 'Note not found');
  return note;
}

function validate(values: EditFormValues): string | null {
  if (values.title === '') return 'A title is required before saving a note.';
  if (values.body === '') return 'A markdown body is required before saving a note.';
  return null;
}

async function updateEmbeddingAfterSave(slug: string, body: string): Promise<void> {
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
}

export const load: PageServerLoad = async ({ params }) => {
  const note = await requireNote(params.slug);

  return {
    note: {
      ...note,
      publishedAtInput: toDateInputValue(note.publishedAt),
    },
  };
};

export const actions: Actions = {
  update: async ({ params, request }) => {
    const existingNote = await requireNote(params.slug);
    const values = readValues(await request.formData(), existingNote.status);
    const validationMessage = validate(values);

    if (validationMessage) {
      return fail(400, { message: validationMessage, values });
    }

    const note = await updateNote(params.slug, {
      title: values.title,
      body: values.body,
      takeaway: values.takeaway || null,
      category: values.category || null,
      tags: values.tags.length > 0 ? values.tags : null,
      image: values.image || null,
      mediaType: values.mediaType,
      publishedAt: parsePublishedAt(values.publishedAt),
      series: values.series || null,
      status: existingNote.status,
    });

    if (!note) error(404, 'Note not found');

    await updateEmbeddingAfterSave(note.slug, values.body);

    return { message: 'Draft saved.', saved: true };
  },

  publish: async ({ params, request }) => {
    await requireNote(params.slug);
    const values = readValues(await request.formData(), 'published');
    const validationMessage = validate(values);

    if (validationMessage) {
      return fail(400, { message: validationMessage, values });
    }

    const note = await updateNote(params.slug, {
      title: values.title,
      body: values.body,
      takeaway: values.takeaway || null,
      category: values.category || null,
      tags: values.tags.length > 0 ? values.tags : null,
      image: values.image || null,
      mediaType: values.mediaType,
      publishedAt: parsePublishedAt(values.publishedAt) ?? new Date(),
      series: values.series || null,
      status: 'published',
    });

    if (!note) error(404, 'Note not found');

    await updateEmbeddingAfterSave(note.slug, values.body);

    throw redirect(303, `/admin/notes/${note.slug}/edit`);
  },
};
