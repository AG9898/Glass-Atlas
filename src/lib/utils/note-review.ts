export type NoteReviewInput = {
  title: string;
  takeaway: string;
  body: string;
};

export type NoteReviewCallbacks = {
  onStart?: () => void;
  onChunk?: (token: string, aggregate: string) => void;
  onComplete?: (aggregate: string) => void;
};

export class NoteReviewError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'NoteReviewError';
    this.status = status;
  }
}

function parseSseDataLines(chunk: string): string[] {
  return chunk
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .filter((line) => line.length > 0);
}

function extractToken(payload: unknown): string {
  if (typeof payload === 'string') return payload;

  if (typeof payload !== 'object' || payload === null) {
    return '';
  }

  const firstChoice = (payload as { choices?: unknown[] }).choices?.[0];
  if (typeof firstChoice !== 'object' || firstChoice === null) {
    return '';
  }

  const delta = (firstChoice as { delta?: unknown }).delta;
  if (typeof delta === 'object' && delta !== null) {
    const content = (delta as { content?: unknown }).content;

    if (typeof content === 'string') {
      return content;
    }

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
  }

  const text = (firstChoice as { text?: unknown }).text;
  return typeof text === 'string' ? text : '';
}

async function readErrorBody(response: Response): Promise<string> {
  const contentType = response.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    if (payload && typeof payload.error === 'string' && payload.error.trim() !== '') {
      return payload.error;
    }
  }

  const text = await response.text().catch(() => '');
  return text.trim();
}

function fallbackErrorMessage(status: number): string {
  if (status === 429) {
    return 'Review service is rate-limited right now (429). Try again shortly.';
  }

  if (status === 503) {
    return 'Review service is temporarily unavailable (503). Try again shortly.';
  }

  return `Review request failed with status ${status}.`;
}

export async function streamNoteReview(
  input: NoteReviewInput,
  callbacks: NoteReviewCallbacks = {},
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  callbacks.onStart?.();

  const response = await fetchImpl('/api/admin/notes/review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const detail = await readErrorBody(response);
    throw new NoteReviewError(detail || fallbackErrorMessage(response.status), response.status);
  }

  if (!response.body) {
    throw new NoteReviewError('Review service returned an empty stream.', 502);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let aggregate = '';
  let receivedToken = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const dataLines = parseSseDataLines(block);
      for (const line of dataLines) {
        if (line === '[DONE]') continue;

        let token = '';
        try {
          token = extractToken(JSON.parse(line));
        } catch {
          token = line;
        }

        if (!token) continue;

        receivedToken = true;
        aggregate += token;
        callbacks.onChunk?.(token, aggregate);
      }
    }
  }

  const tailLines = parseSseDataLines(buffer);
  for (const line of tailLines) {
    if (line === '[DONE]') continue;

    let token = '';
    try {
      token = extractToken(JSON.parse(line));
    } catch {
      token = line;
    }

    if (!token) continue;

    receivedToken = true;
    aggregate += token;
    callbacks.onChunk?.(token, aggregate);
  }

  if (!receivedToken) {
    throw new NoteReviewError('Review service returned no critique content.', 502);
  }

  callbacks.onComplete?.(aggregate);
  return aggregate;
}
