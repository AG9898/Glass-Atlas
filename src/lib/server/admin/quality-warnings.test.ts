import { describe, expect, it } from 'vitest';
import { getNoteQualityWarnings, isWeakTitle, type NoteQualityWarningInput } from './quality-warnings';

const indexedAt = new Date('2026-05-04T12:00:00.000Z');
const updatedAt = new Date('2026-05-04T12:00:00.000Z');

function note(overrides: Partial<NoteQualityWarningInput> = {}): NoteQualityWarningInput {
  return {
    title: 'A Properly Descriptive Title',
    body: 'Some body text linking to [[another-note]] for context.',
    takeaway: 'A concise summary of the note.',
    semanticIndexStatus: 'current',
    semanticIndexError: null,
    semanticIndexSourceUpdatedAt: indexedAt,
    updatedAt,
    ...overrides,
  };
}

describe('getNoteQualityWarnings', () => {
  it('returns no warnings for a clean note', () => {
    expect(getNoteQualityWarnings(note())).toEqual([]);
  });

  it('flags a stale semantic index using the shared display mapper', () => {
    const warnings = getNoteQualityWarnings(
      note({ semanticIndexSourceUpdatedAt: new Date('2026-05-04T11:59:59.000Z') }),
    );

    expect(warnings).toContainEqual({
      type: 'semantic-index',
      label: 'Index stale',
      message: 'The note saved, but chat retrieval may still use the previous semantic index.',
    });
  });

  it('flags a failed semantic index with the same label/summary as the display mapper', () => {
    const warnings = getNoteQualityWarnings(
      note({ semanticIndexStatus: 'failed', semanticIndexError: 'OpenRouter quota exceeded' }),
    );

    expect(warnings).toContainEqual({
      type: 'semantic-index',
      label: 'Index failed',
      message: 'The note saved, but chat retrieval may still use the previous semantic index.',
    });
  });

  it('flags a pending semantic index', () => {
    const warnings = getNoteQualityWarnings(note({ semanticIndexStatus: 'pending' }));

    expect(warnings).toContainEqual({
      type: 'semantic-index',
      label: 'Index pending',
      message: 'The note saved, but chat retrieval may not include the latest content yet.',
    });
  });

  it('does not flag a current semantic index', () => {
    const warnings = getNoteQualityWarnings(note());
    expect(warnings.some((w) => w.type === 'semantic-index')).toBe(false);
  });

  it('flags a missing takeaway', () => {
    expect(getNoteQualityWarnings(note({ takeaway: null }))).toContainEqual({
      type: 'missing-takeaway',
      label: 'Missing takeaway',
      message: 'Add a takeaway so readers and chat retrieval get a concise summary of this note.',
    });
  });

  it('flags a blank/whitespace-only takeaway', () => {
    const warnings = getNoteQualityWarnings(note({ takeaway: '   ' }));
    expect(warnings.some((w) => w.type === 'missing-takeaway')).toBe(true);
  });

  it('does not flag a present takeaway', () => {
    const warnings = getNoteQualityWarnings(note());
    expect(warnings.some((w) => w.type === 'missing-takeaway')).toBe(false);
  });

  it('flags a note body with no wiki-links', () => {
    const warnings = getNoteQualityWarnings(note({ body: 'No links here at all.' }));
    expect(warnings).toContainEqual({
      type: 'no-internal-links',
      label: 'No internal links',
      message: 'This note has no [[wiki-links]] to other notes yet.',
    });
  });

  it('does not flag a note body containing at least one wiki-link', () => {
    const warnings = getNoteQualityWarnings(note({ body: 'See [[some-slug|Some Note]] for more.' }));
    expect(warnings.some((w) => w.type === 'no-internal-links')).toBe(false);
  });

  it('flags a weak title', () => {
    const warnings = getNoteQualityWarnings(note({ title: 'Untitled' }));
    expect(warnings).toContainEqual({
      type: 'weak-title',
      label: 'Weak title',
      message: 'This title may be too short or generic to be distinctive.',
    });
  });

  it('does not flag a strong title', () => {
    const warnings = getNoteQualityWarnings(note());
    expect(warnings.some((w) => w.type === 'weak-title')).toBe(false);
  });

  it('returns multiple warnings together, advisory-only and order-stable', () => {
    const warnings = getNoteQualityWarnings(
      note({
        title: 'New Note',
        body: 'No links here.',
        takeaway: null,
        semanticIndexStatus: 'failed',
        semanticIndexError: 'boom',
      }),
    );

    expect(warnings.map((w) => w.type)).toEqual([
      'semantic-index',
      'missing-takeaway',
      'no-internal-links',
      'weak-title',
    ]);
  });
});

describe('isWeakTitle (deterministic heuristic)', () => {
  it('flags an empty title', () => {
    expect(isWeakTitle('')).toBe(true);
  });

  it('flags a whitespace-only title', () => {
    expect(isWeakTitle('   ')).toBe(true);
  });

  it('flags a title shorter than the minimum length', () => {
    expect(isWeakTitle('Short')).toBe(true);
  });

  it('flags a single-word title even if long enough in characters', () => {
    expect(isWeakTitle('Supercalifragilisticexpialidocious')).toBe(true);
  });

  it('flags known placeholder titles regardless of case', () => {
    expect(isWeakTitle('Untitled')).toBe(true);
    expect(isWeakTitle('untitled draft')).toBe(true);
    expect(isWeakTitle('New Note')).toBe(true);
    expect(isWeakTitle('Draft')).toBe(true);
    expect(isWeakTitle('Note')).toBe(true);
    expect(isWeakTitle('Post')).toBe(true);
    expect(isWeakTitle('Test post about caching')).toBe(true);
    expect(isWeakTitle('42')).toBe(true);
  });

  it('does not flag a descriptive multi-word title of sufficient length', () => {
    expect(isWeakTitle('A Properly Descriptive Title')).toBe(false);
    expect(isWeakTitle('Why Neon HTTP Driver Beats TCP in Serverless')).toBe(false);
  });
});
