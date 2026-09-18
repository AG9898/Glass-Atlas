import { describe, expect, test } from 'vitest';
import {
  buildPublishedNoteGraph,
  MAX_SEMANTIC_GRAPH_NEIGHBORS,
  type GraphNoteInput,
} from './note-graph';

function note(
  slug: string,
  embedding: number[] | null,
  overrides: Partial<GraphNoteInput> = {},
): GraphNoteInput {
  return {
    slug,
    title: slug.toUpperCase(),
    category: null,
    status: 'published',
    embedding,
    semanticIndexCurrent: embedding !== null,
    ...overrides,
  };
}

describe('buildPublishedNoteGraph', () => {
  test('keeps isolated published notes and filters private or unresolved wiki-link endpoints', () => {
    const graph = buildPublishedNoteGraph(
      [
        note('alpha', [1, 0]),
        note('beta', [0.98, 0.2]),
        note('isolated', null),
        note('draft', [1, 0], { status: 'draft' }),
      ],
      [
        { sourceSlug: 'alpha', targetSlug: 'beta' },
        { sourceSlug: 'beta', targetSlug: 'alpha' },
        { sourceSlug: 'alpha', targetSlug: 'missing' },
        { sourceSlug: 'draft', targetSlug: 'alpha' },
        { sourceSlug: 'alpha', targetSlug: 'alpha' },
      ],
    );

    expect(graph.nodes.map((entry) => entry.slug)).toEqual(['alpha', 'beta', 'isolated']);
    expect(graph.edges.filter((edge) => edge.type === 'wiki')).toEqual([
      { source: 'alpha', target: 'beta', type: 'wiki' },
    ]);
  });

  test('builds bounded, deduplicated semantic edges only from current embeddings', () => {
    const graph = buildPublishedNoteGraph(
      [
        note('alpha', [1, 0]),
        note('beta', [0.99, 0.1]),
        note('gamma', [0.97, 0.2]),
        note('delta', [0.94, 0.3]),
        note('far', [0, 1]),
        note('stale', [1, 0], { semanticIndexCurrent: false }),
      ],
      [],
    );

    const semanticEdges = graph.edges.filter((edge) => edge.type === 'semantic');
    const degree = new Map<string, number>();
    for (const edge of semanticEdges) {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    }

    expect(semanticEdges.length).toBeGreaterThan(0);
    expect(semanticEdges.some((edge) => edge.source === 'far' || edge.target === 'far')).toBe(false);
    expect(semanticEdges.some((edge) => edge.source === 'stale' || edge.target === 'stale')).toBe(
      false,
    );
    expect(Math.max(...degree.values())).toBeLessThanOrEqual(MAX_SEMANTIC_GRAPH_NEIGHBORS);
    expect(new Set(semanticEdges.map((edge) => `${edge.source}:${edge.target}`)).size).toBe(
      semanticEdges.length,
    );
  });

  test('returns a compact payload without raw embeddings or index details', () => {
    const graph = buildPublishedNoteGraph([note('alpha', [1, 0])], []);

    expect(graph.nodes[0]).toEqual({ slug: 'alpha', title: 'ALPHA', category: null });
    expect(Object.keys(graph.nodes[0] ?? {})).toEqual(['slug', 'title', 'category']);
  });
});
