import type { PublishedGraphEdge, PublishedNoteGraph } from '$lib/utils/note-graph';

export const MAX_SEMANTIC_GRAPH_DISTANCE = 0.45;
export const MAX_SEMANTIC_GRAPH_NEIGHBORS = 2;

export type GraphNoteInput = {
  slug: string;
  title: string;
  category: string | null;
  status: 'draft' | 'published';
  embedding: number[] | null;
  semanticIndexCurrent: boolean;
};

export type GraphLinkInput = {
  sourceSlug: string;
  targetSlug: string;
};

type SemanticCandidate = {
  source: string;
  target: string;
  distance: number;
};

function cosineDistance(left: number[], right: number[]): number | null {
  if (left.length === 0 || left.length !== right.length) return null;

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index];
    const rightValue = right[index];
    if (leftValue === undefined || rightValue === undefined) return null;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return null;
  return 1 - dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function canonicalPair(source: string, target: string): [string, string] {
  return source.localeCompare(target) <= 0 ? [source, target] : [target, source];
}

export function buildPublishedNoteGraph(
  noteInputs: GraphNoteInput[],
  linkInputs: GraphLinkInput[],
): PublishedNoteGraph {
  const published = noteInputs
    .filter((note) => note.status === 'published')
    .sort((left, right) => left.title.localeCompare(right.title));
  const publishedSlugs = new Set(published.map((note) => note.slug));

  const wikiPairs = new Set<string>();
  const wikiEdges: PublishedGraphEdge[] = [];
  for (const link of linkInputs) {
    if (
      link.sourceSlug === link.targetSlug ||
      !publishedSlugs.has(link.sourceSlug) ||
      !publishedSlugs.has(link.targetSlug)
    ) {
      continue;
    }

    const [source, target] = canonicalPair(link.sourceSlug, link.targetSlug);
    const key = `${source}\u0000${target}`;
    if (wikiPairs.has(key)) continue;
    wikiPairs.add(key);
    wikiEdges.push({ source, target, type: 'wiki' });
  }

  const semanticNotes = published.filter(
    (note): note is GraphNoteInput & { embedding: number[] } =>
      note.semanticIndexCurrent && note.embedding !== null,
  );
  const candidates: SemanticCandidate[] = [];

  for (let leftIndex = 0; leftIndex < semanticNotes.length; leftIndex += 1) {
    const left = semanticNotes[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < semanticNotes.length; rightIndex += 1) {
      const right = semanticNotes[rightIndex];
      if (!right) continue;
      const distance = cosineDistance(left.embedding, right.embedding);
      if (distance === null || distance > MAX_SEMANTIC_GRAPH_DISTANCE) continue;
      const [source, target] = canonicalPair(left.slug, right.slug);
      candidates.push({ source, target, distance });
    }
  }

  candidates.sort(
    (left, right) =>
      left.distance - right.distance ||
      left.source.localeCompare(right.source) ||
      left.target.localeCompare(right.target),
  );

  const semanticDegree = new Map<string, number>();
  const semanticEdges: PublishedGraphEdge[] = [];
  for (const candidate of candidates) {
    const sourceDegree = semanticDegree.get(candidate.source) ?? 0;
    const targetDegree = semanticDegree.get(candidate.target) ?? 0;
    if (
      sourceDegree >= MAX_SEMANTIC_GRAPH_NEIGHBORS ||
      targetDegree >= MAX_SEMANTIC_GRAPH_NEIGHBORS
    ) {
      continue;
    }

    semanticEdges.push({
      source: candidate.source,
      target: candidate.target,
      type: 'semantic',
    });
    semanticDegree.set(candidate.source, sourceDegree + 1);
    semanticDegree.set(candidate.target, targetDegree + 1);
  }

  return {
    nodes: published.map(({ slug, title, category }) => ({ slug, title, category })),
    edges: [...wikiEdges, ...semanticEdges],
  };
}
