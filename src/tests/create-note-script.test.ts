import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizePayload, parseArgs, persistDraft, validateRequiredEnv } from '../../scripts/create-note.js';

describe('scripts/create-note.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses a payload and hard-forces draft status', () => {
    expect(
      normalizePayload({
        title: '  A New Note  ',
        body: '  Body text.  ',
        takeaway: '  Keep the save path unified. ',
        category: ' authoring ',
        tags: [' draft ', '', 'agent'],
        series: ' tools ',
        status: 'published',
      }),
    ).toEqual({
      title: 'A New Note',
      body: 'Body text.',
      takeaway: 'Keep the save path unified.',
      category: 'authoring',
      tags: ['draft', 'agent'],
      series: 'tools',
      status: 'draft',
    });
  });

  it('generates the slug and persists through createNote plus reindexNoteAfterSave', async () => {
    const updatedAt = new Date('2026-06-08T12:00:00.000Z');
    const createNote = vi.fn(async (input) => ({
      id: 10,
      ...input,
      updatedAt,
    }));
    const getNoteBySlug = vi.fn(async () => null);
    const reindexNoteAfterSave = vi.fn(async () => ({
      status: 'current' as const,
      indexedAt: new Date('2026-06-08T12:01:00.000Z'),
    }));
    const slugify = vi.fn(() => 'a-new-note');

    await expect(
      persistDraft(
        {
          title: 'A New Note',
          body: 'Body text.',
          takeaway: 'Save through helpers.',
          category: 'authoring',
          tags: ['draft'],
          series: null,
          status: 'draft',
        },
        { createNote, getNoteBySlug, reindexNoteAfterSave, slugify },
      ),
    ).resolves.toEqual({
      slug: 'a-new-note',
      note: expect.objectContaining({ slug: 'a-new-note', status: 'draft' }),
      indexStatus: 'current',
      indexError: null,
    });

    expect(slugify).toHaveBeenCalledWith('A New Note');
    expect(getNoteBySlug).toHaveBeenCalledWith('a-new-note');
    expect(createNote).toHaveBeenCalledWith({
      slug: 'a-new-note',
      title: 'A New Note',
      body: 'Body text.',
      takeaway: 'Save through helpers.',
      category: 'authoring',
      tags: ['draft'],
      series: null,
      status: 'draft',
    });
    expect(reindexNoteAfterSave).toHaveBeenCalledWith('a-new-note', 'Body text.', {
      title: 'A New Note',
      category: 'authoring',
      tags: ['draft'],
      series: null,
      contentUpdatedAt: updatedAt,
    });
  });

  it('does not create a note when slug collision is detected', async () => {
    const createNote = vi.fn();
    const getNoteBySlug = vi.fn(async () => ({
      id: 10,
      slug: 'existing-note',
      title: 'Existing Note',
      body: 'Body text.',
      takeaway: null,
      category: null,
      tags: null,
      series: null,
      status: 'draft' as const,
      updatedAt: new Date('2026-06-08T12:00:00.000Z'),
    }));
    const reindexNoteAfterSave = vi.fn();

    await expect(
      persistDraft(
        {
          title: 'Existing Note',
          body: 'Body text.',
          takeaway: null,
          category: null,
          tags: null,
          series: null,
          status: 'draft',
        },
        {
          createNote,
          getNoteBySlug,
          reindexNoteAfterSave,
          slugify: () => 'existing-note',
        },
      ),
    ).rejects.toThrow('A note with slug "existing-note" already exists');

    expect(createNote).not.toHaveBeenCalled();
    expect(reindexNoteAfterSave).not.toHaveBeenCalled();
  });

  it('requires DATABASE_URL and OPENROUTER_API_KEY before writing', () => {
    expect(() =>
      validateRequiredEnv({
        DATABASE_URL: 'postgresql://example',
        OPENROUTER_API_KEY: 'sk-or-test',
      }),
    ).not.toThrow();

    expect(() => validateRequiredEnv({ DATABASE_URL: 'postgresql://example' })).toThrow(
      'Missing required environment variable(s): OPENROUTER_API_KEY',
    );
  });

  it('accepts a --file argument for file-backed payloads', () => {
    expect(parseArgs(['--file', 'draft.json'])).toEqual({ filePath: 'draft.json', help: false });
    expect(parseArgs(['--file=draft.json'])).toEqual({ filePath: 'draft.json', help: false });
  });
});
