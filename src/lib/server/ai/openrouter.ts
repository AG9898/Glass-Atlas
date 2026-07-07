import { env } from '$env/dynamic/private';

const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
const DEFAULT_OPENROUTER_FALLBACK_MODEL = 'openrouter/free';
export const DEFAULT_OPENROUTER_TIMEOUT_MS = 20_000;

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionRequest = {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
};

class RetryableOpenRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableOpenRouterError';
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function makeVisibleContentChunk(content: string, index: number): string {
  return JSON.stringify({
    choices: [{ delta: { content }, finish_reason: null, index }],
  });
}

function extractVisibleContent(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) return '';

  const firstChoice = (payload as { choices?: unknown[] }).choices?.[0];
  if (typeof firstChoice !== 'object' || firstChoice === null) return '';

  const delta = (firstChoice as { delta?: unknown }).delta;
  if (typeof delta !== 'object' || delta === null) return '';

  const content = (delta as { content?: unknown }).content;
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part !== 'object' || part === null) return '';
        return typeof (part as { text?: unknown }).text === 'string'
          ? (part as { text: string }).text
          : '';
      })
      .join('');
  }

  return '';
}

function filterVisibleSseContent(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = '';

  function emitVisibleLine(line: string, controller: ReadableStreamDefaultController<Uint8Array>): boolean {
    if (!line.startsWith('data:')) return false;

    const data = line.slice(5).trimStart();
    if (!data) return false;

    if (data === '[DONE]') {
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      return true;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return false;
    }

    const content = extractVisibleContent(payload);
    if (!content) return false;

    const firstChoice = (payload as { choices?: Array<{ index?: unknown }> }).choices?.[0];
    const index = typeof firstChoice?.index === 'number' ? firstChoice.index : 0;
    controller.enqueue(encoder.encode(`data: ${makeVisibleContentChunk(content, index)}\n\n`));
    return true;
  }

  function drainBufferedLines(controller: ReadableStreamDefaultController<Uint8Array>): boolean {
    let emitted = false;
    while (true) {
      const newlineIndex = buffered.indexOf('\n');
      if (newlineIndex === -1) return emitted;

      const rawLine = buffered.slice(0, newlineIndex);
      buffered = buffered.slice(newlineIndex + 1);
      emitted = emitVisibleLine(rawLine.replace(/\r$/, ''), controller) || emitted;
    }
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (drainBufferedLines(controller)) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const tail = buffered.trim();
          buffered = '';
          if (tail) {
            emitVisibleLine(tail, controller);
          }
          controller.close();
          return;
        }

        buffered += decoder.decode(value, { stream: true });
        if (drainBufferedLines(controller)) return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

async function fetchChatCompletion({
  apiKey,
  baseUrl,
  model,
  messages,
}: ChatCompletionRequest): Promise<ReadableStream<Uint8Array>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_OPENROUTER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
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
      signal: controller.signal,
    });
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      throw new RetryableOpenRouterError(
        `OpenRouter chat request timed out after ${DEFAULT_OPENROUTER_TIMEOUT_MS}ms.`,
      );
    }
    throw new RetryableOpenRouterError(`OpenRouter chat request failed: ${describeError(error)}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const message = `OpenRouter chat request failed with ${response.status}: ${detail}`;
    if (isRetryableStatus(response.status)) {
      throw new RetryableOpenRouterError(message);
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error('OpenRouter chat response has no body.');
  }

  return filterVisibleSseContent(response.body);
}

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
  const primaryModel = env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const fallbackModel = env.OPENROUTER_FALLBACK_MODEL || DEFAULT_OPENROUTER_FALLBACK_MODEL;

  try {
    return await fetchChatCompletion({ apiKey, baseUrl, model: primaryModel, messages });
  } catch (error: unknown) {
    if (!(error instanceof RetryableOpenRouterError) || fallbackModel === primaryModel) {
      throw error;
    }

    try {
      return await fetchChatCompletion({ apiKey, baseUrl, model: fallbackModel, messages });
    } catch (fallbackError: unknown) {
      throw new Error(
        `OpenRouter chat request failed after fallback. Primary: ${error.message} Fallback: ${describeError(
          fallbackError,
        )}`,
      );
    }
  }
}
