import { describe, expect, it } from 'vitest';
import { getContentQualityWarnings, isWeakTitle, type NoteContentForWarnings } from './quality-warnings';

function note(overrides: Partial<NoteContentForWarnings> = {}): NoteContentForWarnings {
  return {
    title: 'A Properly Descriptive Title',
    body: 'Some body text linking to [[another-note]] for context.',
    takeaway: 'A concise summary of the note.',
    ...overrides,
  };
}

describe('getContentQualityWarnings', () => {
  it('returns no warnings for clean content', () => {
    expect(getContentQualityWarnings(note())).toEqual([]);
  });

  it('flags a missing takeaway', () => {
    expect(getContentQualityWarnings(note({ takeaway: null }))).toContainEqual({
      type: 'missing-takeaway',
      label: 'Missing takeaway',
      message: 'Add a takeaway so readers and chat retrieval get a concise summary of this note.',
    });
  });

  it('flags a blank/whitespace-only takeaway', () => {
    const warnings = getContentQualityWarnings(note({ takeaway: '   ' }));
    expect(warnings.some((w) => w.type === 'missing-takeaway')).toBe(true);
  });

  it('flags a note body with no wiki-links', () => {
    const warnings = getContentQualityWarnings(note({ body: 'No links here at all.' }));
    expect(warnings).toContainEqual({
      type: 'no-internal-links',
      label: 'No internal links',
      message: 'This note has no [[wiki-links]] to other notes yet.',
    });
  });

  it('does not flag a note body containing at least one wiki-link', () => {
    const warnings = getContentQualityWarnings(note({ body: 'See [[some-slug|Some Note]] for more.' }));
    expect(warnings.some((w) => w.type === 'no-internal-links')).toBe(false);
  });

  it('flags a weak title', () => {
    const warnings = getContentQualityWarnings(note({ title: 'Untitled' }));
    expect(warnings).toContainEqual({
      type: 'weak-title',
      label: 'Weak title',
      message: 'This title may be too short or generic to be distinctive.',
    });
  });

  it('returns warnings together, advisory-only and order-stable (takeaway, links, title)', () => {
    const warnings = getContentQualityWarnings(
      note({ title: 'New Note', body: 'No links here.', takeaway: null }),
    );

    expect(warnings.map((w) => w.type)).toEqual(['missing-takeaway', 'no-internal-links', 'weak-title']);
  });

  it('reacts to live (unsaved) form state, e.g. a freshly blank new-note form', () => {
    const warnings = getContentQualityWarnings(note({ title: '', body: '', takeaway: '' }));
    expect(warnings.map((w) => w.type)).toEqual(['missing-takeaway', 'no-internal-links', 'weak-title']);
  });
});

describe('isWeakTitle (deterministic heuristic, client-safe copy)', () => {
  it('flags an empty title', () => {
    expect(isWeakTitle('')).toBe(true);
  });

  it('flags a title shorter than the minimum length', () => {
    expect(isWeakTitle('Short')).toBe(true);
  });

  it('flags known placeholder titles regardless of case', () => {
    expect(isWeakTitle('Untitled')).toBe(true);
    expect(isWeakTitle('Draft')).toBe(true);
  });

  it('does not flag a descriptive multi-word title of sufficient length', () => {
    expect(isWeakTitle('A Properly Descriptive Title')).toBe(false);
    expect(isWeakTitle('Why Neon HTTP Driver Beats TCP in Serverless')).toBe(false);
  });
});
