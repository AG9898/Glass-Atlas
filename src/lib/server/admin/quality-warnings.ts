import type { Note } from '$lib/server/db/notes';
import { parseWikiLinks } from '$lib/utils/wiki-links';
import { getSemanticIndexDisplay } from './semantic-index-display';

export type QualityWarningType =
  | 'semantic-index'
  | 'missing-takeaway'
  | 'no-internal-links'
  | 'weak-title';

export type QualityWarning = {
  type: QualityWarningType;
  label: string;
  message: string;
};

export type NoteQualityWarningInput = Pick<
  Note,
  | 'title'
  | 'body'
  | 'takeaway'
  | 'semanticIndexStatus'
  | 'semanticIndexError'
  | 'semanticIndexSourceUpdatedAt'
  | 'updatedAt'
>;

// Generic/placeholder titles that should always be flagged regardless of length.
const WEAK_TITLE_PATTERNS: RegExp[] = [
  /^untitled/i,
  /^new note$/i,
  /^draft$/i,
  /^note$/i,
  /^post$/i,
  /^test(\s|$)/i,
  /^\d+$/,
];

const MIN_TITLE_LENGTH = 12;
const MIN_TITLE_WORD_COUNT = 2;

// Deterministic, local heuristic — no LLM call. A title is "weak" when it is
// blank, too short, fewer than two words, or matches a known placeholder
// pattern (e.g. "Untitled", "Draft", "Note 3").
export function isWeakTitle(title: string): boolean {
  const trimmed = title.trim();

  if (trimmed.length === 0) return true;
  if (trimmed.length < MIN_TITLE_LENGTH) return true;

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_TITLE_WORD_COUNT) return true;

  return WEAK_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// Advisory-only quality warnings for the admin note editor. Pure mapping over
// current note/form state — never reads or writes the database, never gates
// save/publish payloads. Reuses getSemanticIndexDisplay() rather than
// duplicating semantic-index timestamp/status rules.
export function getNoteQualityWarnings(note: NoteQualityWarningInput): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  const semanticIndexDisplay = getSemanticIndexDisplay(note);
  if (semanticIndexDisplay.showWarning) {
    warnings.push({
      type: 'semantic-index',
      label: semanticIndexDisplay.label,
      message: semanticIndexDisplay.summary,
    });
  }

  if (!note.takeaway || note.takeaway.trim().length === 0) {
    warnings.push({
      type: 'missing-takeaway',
      label: 'Missing takeaway',
      message: 'Add a takeaway so readers and chat retrieval get a concise summary of this note.',
    });
  }

  if (parseWikiLinks(note.body).length === 0) {
    warnings.push({
      type: 'no-internal-links',
      label: 'No internal links',
      message: 'This note has no [[wiki-links]] to other notes yet.',
    });
  }

  if (isWeakTitle(note.title)) {
    warnings.push({
      type: 'weak-title',
      label: 'Weak title',
      message: 'This title may be too short or generic to be distinctive.',
    });
  }

  return warnings;
}
