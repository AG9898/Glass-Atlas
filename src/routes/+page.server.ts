import { getTotalCitations, listNotes } from '$lib/server/db/notes';
import type { PageServerLoad } from './$types';

type LandingStats = {
  publishedNotes: number;
  distinctTopics: number;
  averageWordCount: number;
  totalCitations: number;
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

async function loadLandingData() {
  const publishedNotes = await listNotes({ status: 'published' });
  const totalCitations = await getTotalCitations();

  const distinctTopics = new Set(
    publishedNotes
      .map((note) => note.category?.trim())
      .filter((category): category is string => Boolean(category)),
  ).size;

  const totalWords = publishedNotes.reduce((sum, note) => sum + countWords(note.body), 0);
  const averageWordCount =
    publishedNotes.length === 0 ? 0 : Math.round(totalWords / publishedNotes.length);

  const stats: LandingStats = {
    publishedNotes: publishedNotes.length,
    distinctTopics,
    averageWordCount,
    totalCitations,
  };

  return {
    stats,
    latestNotes: publishedNotes.slice(0, 7),
  };
}

// `landing` is returned unawaited so SvelteKit streams it in once the DB responds
// instead of blocking the initial response on it — a cold Neon compute (see the
// 2026-07-14 AGENTS.md discovery entry) no longer delays the page shell (nav,
// InitialLoadScreen splash, hero) from reaching the browser.
export const load: PageServerLoad = () => {
  return {
    landing: loadLandingData(),
  };
};
