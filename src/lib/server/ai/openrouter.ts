import { env } from '$env/dynamic/private';

const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Sends a streaming chat completion request to OpenRouter's OpenAI-compatible
 * endpoint and returns a ReadableStream of raw SSE bytes.
 *
 * Uses native fetch — not the OpenAI SDK — to keep the bundle minimal and
 * allow the response body to be piped directly to the caller.
 */
export async function streamChatCompletion(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const baseUrl = (env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, '');
  const model = env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenRouter chat request failed with ${response.status}: ${detail}`);
  }

  if (!response.body) {
    throw new Error('OpenRouter chat response has no body.');
  }

  return response.body;
}
