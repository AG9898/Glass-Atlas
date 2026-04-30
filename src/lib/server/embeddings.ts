import { env } from '$env/dynamic/private';

const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

type EmbeddingApiResponse = {
  data?: Array<{
    embedding?: unknown;
  }>;
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

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}
