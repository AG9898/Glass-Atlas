import type { Note } from '$lib/server/db/notes';
import {
  getContentQualityWarnings,
  isWeakTitle,
  type QualityWarning,
  type QualityWarningType,
} from '$lib/utils/quality-warnings';
import { getSemanticIndexDisplay } from './semantic-index-display';

export type { QualityWarning, QualityWarningType };
export { isWeakTitle };

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

// Advisory-only quality warnings for the admin note editor. Pure mapping over
// current note/form state — never reads or writes the database, never gates
// save/publish payloads. Reuses getSemanticIndexDisplay() for the index
// warning and the client-safe getContentQualityWarnings() (src/lib/utils/
// quality-warnings.ts) for the remaining checks, so the heuristics are never
// duplicated between this server-only full mapper and the live editor UI.
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

  warnings.push(...getContentQualityWarnings(note));

  return warnings;
}
