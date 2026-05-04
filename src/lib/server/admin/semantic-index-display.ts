import type { Note } from '$lib/server/db/notes';

export type SemanticIndexDisplayState = 'current' | 'pending' | 'stale' | 'failed';

export type SemanticIndexDisplay = {
  state: SemanticIndexDisplayState;
  label: string;
  summary: string;
  detail: string | null;
  showWarning: boolean;
};

export function getSemanticIndexDisplay(note: Pick<
  Note,
  'semanticIndexStatus' | 'semanticIndexError' | 'semanticIndexSourceUpdatedAt' | 'updatedAt'
>): SemanticIndexDisplay {
  if (note.semanticIndexStatus === 'failed') {
    return {
      state: 'failed',
      label: 'Index failed',
      summary: 'The note saved, but chat retrieval may still use the previous semantic index.',
      detail: note.semanticIndexError,
      showWarning: true,
    };
  }

  if (note.semanticIndexStatus === 'pending') {
    return {
      state: 'pending',
      label: 'Index pending',
      summary: 'The note saved, but chat retrieval may not include the latest content yet.',
      detail: null,
      showWarning: true,
    };
  }

  if (isSemanticIndexStale(note.semanticIndexSourceUpdatedAt, note.updatedAt)) {
    return {
      state: 'stale',
      label: 'Index stale',
      summary: 'The note saved, but chat retrieval may still use the previous semantic index.',
      detail: null,
      showWarning: true,
    };
  }

  return {
    state: 'current',
    label: 'Index current',
    summary: 'Chat retrieval is using this saved version.',
    detail: null,
    showWarning: false,
  };
}

function isSemanticIndexStale(sourceUpdatedAt: Date | null, contentUpdatedAt: Date): boolean {
  if (!sourceUpdatedAt) return true;
  return sourceUpdatedAt.getTime() < contentUpdatedAt.getTime();
}
