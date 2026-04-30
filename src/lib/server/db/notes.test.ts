import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('./index', () => ({
  db: dbMock,
}));

import { getTotalCitations, recordCitations, searchNotesBySimilarity } from './notes';

const noteRow = {
  id: 1,
  slug: 'vector-search',
  title: 'Vector Search',
  body: 'First paragraph.',
  takeaway: 'Use pgvector cosine search.',
  category: 'databases',
  tags: ['postgres', 'rag'],
  image: 'https://example.com/cover.png',
  publishedAt: new Date('2026-04-03T00:00:00Z'),
  series: 'RAG Notes',
  status: 'published',
  embedding: [0.1, 0.2, 0.3],
  createdAt: new Date('2026-04-01T00:00:00Z'),
  updatedAt: new Date('2026-04-02T00:00:00Z'),
};

type SelectLimitChain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function createSelectLimitChain(rows: unknown[]): SelectLimitChain {
  const chain = {} as SelectLimitChain;
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(async () => rows);
  return chain;
}

function chunkContains(chunk: unknown, text: string): boolean {
  if (typeof chunk === 'string') return chunk.includes(text);

  if (typeof chunk === 'object' && chunk !== null && 'value' in chunk) {
    const value = (chunk as { value: unknown }).value;
    return Array.isArray(value) && value.some((part) => typeof part === 'string' && part.includes(text));
  }

  return false;
}

describe('notes DB query helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searchNotesBySimilarity orders published notes by pgvector cosine distance', async () => {
    const chain = createSelectLimitChain([noteRow]);
    dbMock.select.mockReturnValue(chain);

    const result = await searchNotesBySimilarity([0.1, 0.2, 0.3], 3);

    expect(result).toEqual([
      expect.objectContaining({
        slug: 'vector-search',
        title: 'Vector Search',
      }),
    ]);
    expect(chain.limit).toHaveBeenCalledWith(3);

    const [orderExpression] = chain.orderBy.mock.calls[0];
    const queryChunks = (orderExpression as { queryChunks: unknown[] }).queryChunks;
    expect(queryChunks.some((chunk) => chunkContains(chunk, '<=>'))).toBe(true);
    expect(queryChunks).toContain('[0.1,0.2,0.3]');
    expect(queryChunks.some((chunk) => chunkContains(chunk, '::vector'))).toBe(true);
  });

  it('searchNotesBySimilarity skips the database when limit is zero', async () => {
    await expect(searchNotesBySimilarity([0.1, 0.2, 0.3], 0)).resolves.toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('recordCitations bulk-inserts one event per slug', async () => {
    const values = vi.fn(async () => undefined);
    dbMock.insert.mockReturnValue({ values });

    await recordCitations(['first-note', 'second-note']);

    expect(values).toHaveBeenCalledWith([
      { noteSlug: 'first-note' },
      { noteSlug: 'second-note' },
    ]);
  });

  it('recordCitations skips empty citation batches', async () => {
    await recordCitations([]);

    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('getTotalCitations returns the citation_events count', async () => {
    const from = vi.fn(async () => [{ value: 42 }]);
    dbMock.select.mockReturnValue({ from });

    await expect(getTotalCitations()).resolves.toBe(42);
  });
});
