import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./index', () => ({
  db: dbMock,
}));

import {
  consumeChatRateLimit,
  getTotalCitations,
  recordCitations,
  replaceNoteChunks,
  searchChunksBySimilarity,
  searchNotesBySimilarity,
} from './notes';

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

type SelectChunkChain = {
  from: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function createSelectChunkChain(rows: unknown[]): SelectChunkChain {
  const chain = {} as SelectChunkChain;
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
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

  it('consumeChatRateLimit inserts/updates by session hash and returns quota state', async () => {
    const now = new Date('2026-05-01T00:00:00.000Z');
    const returning = vi.fn(async () => [{ messageCount: 1, windowStart: now }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    dbMock.insert.mockReturnValue({ values });

    const result = await consumeChatRateLimit({
      sessionHash: 'sha256-session-hash',
      maxMessages: 10,
      windowMs: 60 * 60 * 1000,
      now,
    });

    expect(values).toHaveBeenCalledWith({
      sessionHash: 'sha256-session-hash',
      messageCount: 1,
      windowStart: now,
    });
    expect(onConflictDoUpdate).toHaveBeenCalledOnce();
    expect(returning).toHaveBeenCalledOnce();
    expect(result).toEqual({
      allowed: true,
      messageCount: 1,
      remaining: 9,
      limit: 10,
      windowStart: now,
      resetAt: new Date('2026-05-01T01:00:00.000Z'),
    });
  });

  it('consumeChatRateLimit blocks when incremented count exceeds limit', async () => {
    const now = new Date('2026-05-01T00:00:00.000Z');
    const returning = vi.fn(async () => [{ messageCount: 11, windowStart: now }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    dbMock.insert.mockReturnValue({ values });

    const result = await consumeChatRateLimit({
      sessionHash: 'sha256-session-hash',
      maxMessages: 10,
      windowMs: 60 * 60 * 1000,
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.messageCount).toBe(11);
    expect(result.remaining).toBe(0);
  });

  it('consumeChatRateLimit returns a reset window when quota rolls over', async () => {
    const now = new Date('2026-05-01T02:00:00.000Z');
    const resetWindowStart = new Date('2026-05-01T02:00:00.000Z');
    const returning = vi.fn(async () => [{ messageCount: 1, windowStart: resetWindowStart }]);
    const onConflictDoUpdate = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    dbMock.insert.mockReturnValue({ values });

    const result = await consumeChatRateLimit({
      sessionHash: 'sha256-session-hash',
      maxMessages: 10,
      windowMs: 60 * 60 * 1000,
      now,
    });

    expect(result.allowed).toBe(true);
    expect(result.messageCount).toBe(1);
    expect(result.remaining).toBe(9);
    expect(result.windowStart).toEqual(resetWindowStart);
    expect(result.resetAt).toEqual(new Date('2026-05-01T03:00:00.000Z'));
  });

  it('consumeChatRateLimit validates maxMessages and windowMs', async () => {
    await expect(
      consumeChatRateLimit({
        sessionHash: 'sha256-session-hash',
        maxMessages: 0,
        windowMs: 60 * 60 * 1000,
      }),
    ).rejects.toThrow('maxMessages must be greater than 0');

    await expect(
      consumeChatRateLimit({
        sessionHash: 'sha256-session-hash',
        maxMessages: 10,
        windowMs: 0,
      }),
    ).rejects.toThrow('windowMs must be greater than 0');
  });

  it('replaceNoteChunks upserts current chunks and deletes stale chunk indexes', async () => {
    const onConflictDoUpdate = vi.fn(async () => undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const where = vi.fn(async () => undefined);

    dbMock.insert.mockReturnValue({ values });
    dbMock.delete.mockReturnValue({ where });

    await replaceNoteChunks('vector-search', [
      {
        sectionHeading: 'Intro',
        sectionIndex: 0,
        chunkIndex: 0,
        chunkText: 'First chunk',
        embedding: [0.1, 0.2, 0.3],
      },
      {
        sectionHeading: 'Deep Dive',
        sectionIndex: 1,
        chunkIndex: 1,
        chunkText: 'Second chunk',
        embedding: [0.3, 0.2, 0.1],
      },
    ]);

    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ noteSlug: 'vector-search', chunkIndex: 0 }),
      expect.objectContaining({ noteSlug: 'vector-search', chunkIndex: 1 }),
    ]);
    expect(onConflictDoUpdate).toHaveBeenCalledOnce();
    expect(dbMock.delete).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledOnce();
  });

  it('replaceNoteChunks deletes all rows when chunk list is empty', async () => {
    const where = vi.fn(async () => undefined);
    dbMock.delete.mockReturnValue({ where });

    await replaceNoteChunks('vector-search', []);

    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.delete).toHaveBeenCalledOnce();
    expect(where).toHaveBeenCalledOnce();
  });

  it('searchChunksBySimilarity returns published chunks ordered by cosine distance', async () => {
    const chain = createSelectChunkChain([
      {
        id: 7,
        noteSlug: 'vector-search',
        noteTitle: 'Vector Search',
        sectionHeading: 'Intro',
        sectionIndex: 0,
        chunkIndex: 0,
        chunkText: 'First chunk',
        distance: '0.019',
      },
    ]);
    dbMock.select.mockReturnValue(chain);

    const result = await searchChunksBySimilarity([0.1, 0.2, 0.3], 4);

    expect(result).toEqual([
      expect.objectContaining({
        noteSlug: 'vector-search',
        noteTitle: 'Vector Search',
        distance: 0.019,
      }),
    ]);
    expect(chain.limit).toHaveBeenCalledWith(4);

    const [orderExpression] = chain.orderBy.mock.calls[0];
    const queryChunks = (orderExpression as { queryChunks: unknown[] }).queryChunks;
    expect(queryChunks.some((chunk) => chunkContains(chunk, '<=>'))).toBe(true);
    expect(queryChunks).toContain('[0.1,0.2,0.3]');
    expect(queryChunks.some((chunk) => chunkContains(chunk, '::vector'))).toBe(true);
  });

  it('searchChunksBySimilarity skips the database when limit is zero', async () => {
    await expect(searchChunksBySimilarity([0.1, 0.2, 0.3], 0)).resolves.toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
  });
});
