import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/server/db/notes', () => ({
  getPublishedNoteGraph: vi.fn(),
}));

import { GET } from './+server';
import { getPublishedNoteGraph } from '$lib/server/db/notes';

const mockGetPublishedNoteGraph = vi.mocked(getPublishedNoteGraph);

describe('GET /api/note-graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns the compact published graph with public cache headers', async () => {
    mockGetPublishedNoteGraph.mockResolvedValue({
      nodes: [{ slug: 'alpha', title: 'Alpha', category: 'Systems' }],
      edges: [{ source: 'alpha', target: 'beta', type: 'semantic' }],
    });

    const response = await GET({} as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, stale-while-revalidate=300',
    );
    expect(await response.json()).toEqual({
      nodes: [{ slug: 'alpha', title: 'Alpha', category: 'Systems' }],
      edges: [{ source: 'alpha', target: 'beta', type: 'semantic' }],
    });
  });
});
