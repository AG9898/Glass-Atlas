import { env } from '$env/dynamic/private';

export const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';
export const DEFAULT_OPENROUTER_FALLBACK_MODEL = 'openrouter/free';
export const DEFAULT_OPENROUTER_TIMEOUT_MS = 20_000;
/**
 * Max gap allowed between successive upstream SSE reads once a chat
 * completion stream is open. Some free-tier providers stall mid-response
 * (observed >60s hangs during the CHAT-07E audit) instead of failing fast, so
 * this bounds how long we wait before treating the stream as stalled and
 * trying the fallback model.
 */
export const DEFAULT_OPENROUTER_STREAM_STALL_TIMEOUT_MS = 15_000;

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

/** Thrown internally when an upstream SSE stream goes quiet for too long. */
class StreamStallError extends Error {
  constructor(ms: number) {
    super(`OpenRouter stream received no data for ${ms}ms.`);
    this.name = 'StreamStallError';
  }
}

type ModelAttemptOutcome =
  | { ok: true; stream: ReadableStream<Uint8Array> }
  | { ok: false; detail: string };

type SseParsedEvent =
  | { type: 'content'; content: string; index: number }
  | { type: 'error'; message: string }
  | { type: 'done' }
  | { type: 'other' };

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

function encodeDataLine(payload: string): Uint8Array {
  return new TextEncoder().encode(`data: ${payload}\n\n`);
}

function encodeDoneLine(): Uint8Array {
  return new TextEncoder().encode('data: [DONE]\n\n');
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

/**
 * Parses a single SSE `data:` payload (already stripped of the `data:`
 * prefix). Distinguishes visible content deltas, in-band `{ "error": ... }`
 * events (OpenRouter can return these on an HTTP 200 stream), the `[DONE]`
 * sentinel, and everything else (reasoning-only deltas, role announcements).
 */
function parseSseData(data: string): SseParsedEvent {
  if (data === '[DONE]') return { type: 'done' };

  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return { type: 'other' };
  }

  if (typeof payload === 'object' && payload !== null && 'error' in payload) {
    const rawError = (payload as { error?: unknown }).error;
    const message =
      typeof rawError === 'object' &&
      rawError !== null &&
      typeof (rawError as { message?: unknown }).message === 'string'
        ? (rawError as { message: string }).message
        : JSON.stringify(rawError);
    return { type: 'error', message };
  }

  const content = extractVisibleContent(payload);
  if (content) {
    const firstChoice = (payload as { choices?: Array<{ index?: unknown }> }).choices?.[0];
    const index = typeof firstChoice?.index === 'number' ? firstChoice.index : 0;
    return { type: 'content', content, index };
  }

  return { type: 'other' };
}

function raceWithStallTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new StreamStallError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Reads raw SSE bytes off `reader` and yields each `data:` payload (with the
 * prefix stripped), applying an inactivity timeout to every individual read
 * so a stalled upstream connection surfaces as a `StreamStallError` instead
 * of hanging indefinitely.
 */
async function* iterateSseDataPayloads(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  stallTimeoutMs: number,
): AsyncGenerator<string, void, void> {
  const decoder = new TextDecoder();
  let buffered = '';

  function drainLines(): string[] {
    const lines: string[] = [];
    while (true) {
      const newlineIndex = buffered.indexOf('\n');
      if (newlineIndex === -1) return lines;
      lines.push(buffered.slice(0, newlineIndex).replace(/\r$/, ''));
      buffered = buffered.slice(newlineIndex + 1);
    }
  }

  while (true) {
    let result: ReadableStreamReadResult<Uint8Array>;
    try {
      result = await raceWithStallTimeout(reader.read(), stallTimeoutMs);
    } catch (error) {
      await reader.cancel(describeError(error)).catch(() => {});
      throw error;
    }

    if (result.done) {
      const tail = buffered.trim();
      buffered = '';
      if (tail.startsWith('data:')) {
        const data = tail.slice(5).trimStart();
        if (data) yield data;
      }
      return;
    }

    buffered += decoder.decode(result.value, { stream: true });
    for (const line of drainLines()) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trimStart();
      if (data) yield data;
    }
  }
}

/**
 * Builds the live pass-through stream once a model attempt has produced at
 * least one visible content chunk. `primedChunks` are the already-encoded
 * SSE bytes discovered while probing for the first content chunk; `events`
 * is the still-open async generator of remaining upstream payloads.
 *
 * Any failure encountered from this point on (in-band error, upstream
 * closing early, or a stall) is logged and closes the stream gracefully with
 * a `[DONE]` sentinel — content has already reached the client, so a
 * fallback retry would duplicate/garble the answer instead of fixing it.
 */
function makeLiveStream(
  primedChunks: Uint8Array[],
  events: AsyncGenerator<string, void, void>,
): ReadableStream<Uint8Array> {
  let primedIndex = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (primedIndex < primedChunks.length) {
        controller.enqueue(primedChunks[primedIndex]);
        primedIndex += 1;
        return;
      }

      while (true) {
        let next: IteratorResult<string, void>;
        try {
          next = await events.next();
        } catch (error) {
          console.error(
            '[openrouter] Stream interrupted after visible content had already started:',
            describeError(error),
          );
          controller.enqueue(encodeDoneLine());
          controller.close();
          return;
        }

        if (next.done) {
          controller.enqueue(encodeDoneLine());
          controller.close();
          return;
        }

        const parsed = parseSseData(next.value);

        if (parsed.type === 'error') {
          console.error(
            '[openrouter] In-band error after visible content had already started:',
            parsed.message,
          );
          controller.enqueue(encodeDoneLine());
          controller.close();
          return;
        }

        if (parsed.type === 'done') {
          controller.enqueue(encodeDoneLine());
          controller.close();
          return;
        }

        if (parsed.type === 'content') {
          controller.enqueue(encodeDataLine(makeVisibleContentChunk(parsed.content, parsed.index)));
          return;
        }

        // 'other' (e.g. a reasoning-only delta) — keep pumping without
        // enqueueing so the consumer's read() doesn't resolve with nothing.
      }
    },
    async cancel() {
      try {
        await events.return?.(undefined);
      } catch {
        // Best-effort cleanup — the consumer is already gone.
      }
    },
  });
}

async function performHttpFetch({ apiKey, baseUrl, model, messages }: ChatCompletionRequest): Promise<Response> {
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

  return response;
}

/**
 * Attempts a single model's chat completion stream and classifies the
 * outcome:
 *  - `ok: true` once at least one visible content chunk has been seen (the
 *    returned stream continues live from there).
 *  - `ok: false` for HTTP-level retryable failures (network error, timeout,
 *    429/502/503/504), an in-band SSE `error` event arriving before any
 *    content, a stream that completes with zero visible content, or a stall
 *    — all of these are safe to retry with a different model, since nothing
 *    has been forwarded to the client yet.
 *
 * Non-retryable HTTP failures (bad request, missing response body) are
 * thrown directly and propagate without a fallback attempt, matching the
 * pre-existing connect-level behavior.
 */
async function attemptModelStream({
  apiKey,
  baseUrl,
  model,
  messages,
  stallTimeoutMs,
}: ChatCompletionRequest & { stallTimeoutMs: number }): Promise<ModelAttemptOutcome> {
  let response: Response;
  try {
    response = await performHttpFetch({ apiKey, baseUrl, model, messages });
  } catch (error) {
    if (error instanceof RetryableOpenRouterError) {
      return { ok: false, detail: error.message };
    }
    throw error;
  }

  const reader = response.body!.getReader();
  const events = iterateSseDataPayloads(reader, stallTimeoutMs);
  const primedChunks: Uint8Array[] = [];

  while (true) {
    let next: IteratorResult<string, void>;
    try {
      next = await events.next();
    } catch (error) {
      const detail =
        error instanceof StreamStallError
          ? error.message
          : `OpenRouter stream read failed: ${describeError(error)}`;
      return { ok: false, detail };
    }

    if (next.done) {
      return { ok: false, detail: 'OpenRouter stream completed with no visible content.' };
    }

    const parsed = parseSseData(next.value);

    if (parsed.type === 'error') {
      return { ok: false, detail: `OpenRouter in-band error: ${parsed.message}` };
    }

    if (parsed.type === 'done') {
      return { ok: false, detail: 'OpenRouter stream completed with no visible content.' };
    }

    if (parsed.type === 'content') {
      primedChunks.push(encodeDataLine(makeVisibleContentChunk(parsed.content, parsed.index)));
      return { ok: true, stream: makeLiveStream(primedChunks, events) };
    }

    // 'other' (e.g. reasoning-only delta or role announcement) — keep reading.
  }
}

/**
 * Sends a streaming chat completion request to OpenRouter's OpenAI-compatible
 * endpoint and returns a ReadableStream of raw SSE bytes.
 *
 * Uses native fetch — not the OpenAI SDK — to keep the bundle minimal and
 * allow the response body to be piped directly to the caller.
 *
 * Retries once with the fallback model when the primary model: fails at the
 * HTTP/network level with a retryable status, times out, returns an in-band
 * SSE error event before any visible content, completes with zero visible
 * content, or stalls. If both models fail, throws an Error carrying both
 * failure details so the caller's existing error handling (never an empty
 * 200 SSE stream) takes over.
 */
export async function streamChatCompletion(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured.');
  }

  const baseUrl = (env.OPENROUTER_BASE_URL || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, '');
  const primaryModel = env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const fallbackModel = env.OPENROUTER_FALLBACK_MODEL || DEFAULT_OPENROUTER_FALLBACK_MODEL;

  const primaryOutcome = await attemptModelStream({
    apiKey,
    baseUrl,
    model: primaryModel,
    messages,
    stallTimeoutMs: DEFAULT_OPENROUTER_STREAM_STALL_TIMEOUT_MS,
  });
  if (primaryOutcome.ok) return primaryOutcome.stream;

  if (fallbackModel === primaryModel) {
    console.error('[openrouter] Primary model failed with no distinct fallback configured:', primaryOutcome.detail);
    throw new Error(primaryOutcome.detail);
  }

  const fallbackOutcome = await attemptModelStream({
    apiKey,
    baseUrl,
    model: fallbackModel,
    messages,
    stallTimeoutMs: DEFAULT_OPENROUTER_STREAM_STALL_TIMEOUT_MS,
  });
  if (fallbackOutcome.ok) return fallbackOutcome.stream;

  const message = `OpenRouter chat request failed after fallback. Primary: ${primaryOutcome.detail} Fallback: ${fallbackOutcome.detail}`;
  console.error('[openrouter] Both primary and fallback models failed:', message);
  throw new Error(message);
}
