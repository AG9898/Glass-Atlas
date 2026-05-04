import { describe, expect, it } from 'vitest';
import { getSemanticIndexDisplay } from './semantic-index-display';

const indexedAt = new Date('2026-05-04T12:00:00.000Z');
const updatedAt = new Date('2026-05-04T12:00:00.000Z');

function note(overrides: Partial<Parameters<typeof getSemanticIndexDisplay>[0]> = {}) {
  return {
    semanticIndexStatus: 'current' as const,
    semanticIndexError: null,
    semanticIndexSourceUpdatedAt: indexedAt,
    updatedAt,
    ...overrides,
  };
}

describe('semantic index display mapping', () => {
  it('keeps current indexes quiet', () => {
    const display = getSemanticIndexDisplay(note());

    expect(display).toEqual({
      state: 'current',
      label: 'Index current',
      summary: 'Chat retrieval is using this saved version.',
      detail: null,
      showWarning: false,
    });
  });

  it('marks older source timestamps as stale', () => {
    const display = getSemanticIndexDisplay(
      note({
        semanticIndexSourceUpdatedAt: new Date('2026-05-04T11:59:59.000Z'),
      }),
    );

    expect(display).toMatchObject({
      state: 'stale',
      label: 'Index stale',
      showWarning: true,
    });
    expect(display.summary).toContain('chat retrieval may still use the previous semantic index');
  });

  it('marks missing source timestamps as pending for current-looking rows', () => {
    const display = getSemanticIndexDisplay(note({ semanticIndexSourceUpdatedAt: null }));

    expect(display).toMatchObject({
      state: 'stale',
      label: 'Index stale',
      showWarning: true,
    });
  });

  it('passes through failed status and error detail', () => {
    const display = getSemanticIndexDisplay(
      note({
        semanticIndexStatus: 'failed',
        semanticIndexError: 'OpenRouter quota exceeded',
      }),
    );

    expect(display).toMatchObject({
      state: 'failed',
      label: 'Index failed',
      detail: 'OpenRouter quota exceeded',
      showWarning: true,
    });
  });

  it('shows pending indexes before first successful index', () => {
    const display = getSemanticIndexDisplay(note({ semanticIndexStatus: 'pending' }));

    expect(display).toMatchObject({
      state: 'pending',
      label: 'Index pending',
      showWarning: true,
    });
  });
});
