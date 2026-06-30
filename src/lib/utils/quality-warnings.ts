import { parseWikiLinks } from './wiki-links.js';

// Client-safe, content-only quality warning logic. Operates purely on current
// editor form state (title/takeaway/body) -- never reads/writes the database
// and never imports from $lib/server, so it can be used directly inside
// /admin/notes/new and /admin/notes/[slug]/edit for live warnings as the
// author types. Semantic-index warning state stays server-derived (see
// src/lib/server/admin/quality-warnings.ts), since it depends on saved
// timestamps that don't change between saves.

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

export type NoteContentForWarnings = {
  title: string;
  takeaway: string | null;
  body: string;
};

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

// Deterministic, local heuristic -- no LLM call. A title is "weak" when it is
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

// Advisory-only content warnings for the admin note editor. Pure mapping over
// current form state -- never gates save/publish payloads. Excludes
// semantic-index state; combine with that separately for the full warning set.
export function getContentQualityWarnings(note: NoteContentForWarnings): QualityWarning[] {
  const warnings: QualityWarning[] = [];

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
