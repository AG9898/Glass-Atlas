import { env } from '$env/dynamic/private';

const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const SECTION_HEADING_PATTERN = /^#{1,6}\s+(.+?)\s*#*$/;

type EmbeddingApiResponse = {
  data?: Array<{
    embedding?: unknown;
  }>;
};

type ChunkDraft = {
  sectionHeading: string | null;
  sectionIndex: number;
  chunkIndex: number;
  chunkText: string;
};

export type ChunkEmbeddingMetadata = {
  title: string;
  category: string | null;
  tags: string[] | null;
  series: string | null;
};

export type EmbeddedChunk = ChunkDraft & {
  embedding: number[];
};

export async function embedText(text: string): Promise<number[]> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const baseUrl = (env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, '');
  const model = env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenRouter embeddings request failed with ${response.status}: ${detail}`);
  }

  const payload = (await response.json()) as EmbeddingApiResponse;
  const embedding = payload.data?.[0]?.embedding;
  if (!isNumberArray(embedding)) {
    throw new Error('OpenRouter embeddings response did not include a numeric embedding.');
  }

  return embedding;
}

export function chunkBodyBySectionAndParagraph(body: string): ChunkDraft[] {
  const sections = splitSections(body);
  const chunks: ChunkDraft[] = [];
  let chunkIndex = 0;

  sections.forEach((section, sectionIndex) => {
    for (const paragraph of splitParagraphs(section.contentLines)) {
      chunks.push({
        sectionHeading: section.heading,
        sectionIndex,
        chunkIndex,
        chunkText: paragraph,
      });
      chunkIndex += 1;
    }
  });

  return chunks;
}

export function buildChunkEmbeddingPayload(
  metadata: ChunkEmbeddingMetadata,
  chunk: Pick<ChunkDraft, 'sectionHeading' | 'chunkText'>,
): string {
  const normalizedTitle = normalizeWhitespace(metadata.title) || 'Untitled';
  const normalizedCategory = normalizeWhitespace(metadata.category ?? '') || 'none';
  const normalizedTags =
    metadata.tags?.map((tag) => normalizeWhitespace(tag)).filter((tag) => tag.length > 0).join(', ') || 'none';
  const normalizedSeries = normalizeWhitespace(metadata.series ?? '') || 'none';
  const normalizedSection = normalizeWhitespace(chunk.sectionHeading ?? '') || 'none';
  const normalizedChunkText = normalizeWhitespace(chunk.chunkText);

  return [
    'Glass Atlas note chunk',
    `Title: ${normalizedTitle}`,
    `Category: ${normalizedCategory}`,
    `Tags: ${normalizedTags}`,
    `Series: ${normalizedSeries}`,
    `Section: ${normalizedSection}`,
    `Chunk: ${normalizedChunkText}`,
  ].join('\n');
}

export async function embedNoteBodyChunks(
  body: string,
  metadata: ChunkEmbeddingMetadata,
): Promise<EmbeddedChunk[]> {
  const chunks = chunkBodyBySectionAndParagraph(body);
  if (chunks.length === 0) return [];

  const embeddedChunks: EmbeddedChunk[] = [];
  for (const chunk of chunks) {
    const payload = buildChunkEmbeddingPayload(metadata, chunk);
    const embedding = await embedText(payload);
    embeddedChunks.push({
      ...chunk,
      embedding,
    });
  }

  return embeddedChunks;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function splitSections(body: string): Array<{ heading: string | null; contentLines: string[] }> {
  const lines = body.split(/\r?\n/);
  const sections: Array<{ heading: string | null; contentLines: string[] }> = [{ heading: null, contentLines: [] }];

  for (const line of lines) {
    const heading = extractHeading(line);
    if (heading) {
      sections.push({ heading, contentLines: [] });
      continue;
    }

    sections[sections.length - 1]?.contentLines.push(line);
  }

  return sections.filter((section) => section.heading !== null || section.contentLines.some((line) => line.trim() !== ''));
}

function splitParagraphs(lines: string[]): string[] {
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      pushParagraph(paragraphs, current);
      current = [];
      continue;
    }

    current.push(trimmed);
  }

  pushParagraph(paragraphs, current);
  return paragraphs;
}

function pushParagraph(target: string[], lines: string[]): void {
  if (lines.length === 0) return;
  const text = normalizeWhitespace(lines.join(' '));
  if (text !== '') target.push(text);
}

function extractHeading(line: string): string | null {
  const match = line.trim().match(SECTION_HEADING_PATTERN);
  if (!match) return null;

  const heading = normalizeWhitespace(match[1] ?? '');
  return heading || null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
