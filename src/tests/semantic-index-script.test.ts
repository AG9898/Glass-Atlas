import { describe, expect, it, vi } from 'vitest';

import {
  auditPublishedSemanticIndexes,
  buildAuditEntry,
  parseArgs,
  validateRequiredEnv,
} from '../../scripts/semantic-index.js';

type SemanticIndexNote = Parameters<typeof buildAuditEntry>[0];

const updatedAt = new Date('2026-07-07T12:00:00.000Z');
const currentIndexedAt = new Date('2026-07-07T12:01:00.000Z');

const currentNote = {
  slug: 'current-note',
  title: 'Current Note',
  body: 'Body.',
  category: 'chat',
  tags: ['rag'],
  series: null,
  embedding: [0.1, 0.2, 0.3],
  semanticIndexStatus: 'current' as const,
  semanticIndexedAt: currentIndexedAt,
  semanticIndexSourceUpdatedAt: updatedAt,
  updatedAt,
};

const staleNote = {
  ...currentNote,
  slug: 'stale-note',
  title: 'Stale Note',
  semanticIndexSourceUpdatedAt: new Date('2026-07-07T11:59:59.000Z'),
};

const refreshedNote = {
  ...currentNote,
  slug: 'stale-note',
  title: 'Stale Note',
};

describe('scripts/semantic-index.js', () => {
  it('parses audit and refresh modes', () => {
    expect(parseArgs([])).toEqual({ refresh: false, help: false });
    expect(parseArgs(['--refresh'])).toEqual({ refresh: true, help: false });
    expect(parseArgs(['--help'])).toEqual({ refresh: false, help: true });
  });

  it('validates required environment keys', () => {
    expect(() => validateRequiredEnv(['DATABASE_URL'], { DATABASE_URL: 'postgres://example' })).not.toThrow();
    expect(() => validateRequiredEnv(['DATABASE_URL', 'OPENROUTER_API_KEY'], { DATABASE_URL: 'postgres://example' }))
      .toThrow('Missing required environment variable(s): OPENROUTER_API_KEY');
  });

  it('reports missing and stale index issues', () => {
    expect(buildAuditEntry(staleNote, 0, false)).toEqual({
      slug: 'stale-note',
      title: 'Stale Note',
      ok: false,
      chunkCount: 0,
      issues: ['stale-source-updated-at', 'missing-chunks'],
      refreshStatus: 'skipped',
      refreshError: null,
    });
  });

  it('refreshes non-current published notes through reindexNoteAfterSave', async () => {
    const listNotes = vi.fn(async () => [staleNote]);
    const getNoteBySlug = vi.fn(async () => refreshedNote);
    const getNoteChunkCount = vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    const hasCurrentSemanticIndex = vi.fn((note: SemanticIndexNote) => {
      return note.semanticIndexSourceUpdatedAt !== null && note.semanticIndexSourceUpdatedAt >= note.updatedAt;
    });
    const reindexNoteAfterSave = vi.fn(async () => ({
      status: 'current' as const,
      indexedAt: currentIndexedAt,
    }));

    await expect(
      auditPublishedSemanticIndexes(
        {
          listNotes,
          getNoteBySlug,
          getNoteChunkCount,
          hasCurrentSemanticIndex,
          reindexNoteAfterSave,
        },
        { refresh: true },
      ),
    ).resolves.toMatchObject({
      mode: 'refresh',
      totalPublished: 1,
      currentCount: 1,
      needsMaintenanceCount: 0,
      refreshedCount: 1,
      failedRefreshCount: 0,
    });

    expect(reindexNoteAfterSave).toHaveBeenCalledWith('stale-note', 'Body.', {
      title: 'Stale Note',
      category: 'chat',
      tags: ['rag'],
      series: null,
      contentUpdatedAt: updatedAt,
    });
    expect(getNoteBySlug).toHaveBeenCalledWith('stale-note');
  });
});
