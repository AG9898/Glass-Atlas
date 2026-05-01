import { describe, test, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock env before module load
// ---------------------------------------------------------------------------
const envMock = vi.hoisted(() => ({
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_BASE_URL: 'https://openrouter.test/api/v1/',
  OPENROUTER_MODEL: 'test-model',
}));

vi.mock('$env/dynamic/private', () => ({ env: envMock }));

// ---------------------------------------------------------------------------
// Mock the review module
// ---------------------------------------------------------------------------
const mockStreamNoteReview = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/ai/review', () => ({
  streamNoteReview: mockStreamNoteReview,
}));

import { POST as _POST } from '../routes/api/admin/notes/review/+server';

// Use a loose event type that matches the handler's actual access pattern
type TestEvent = {
  request: Request;
  locals: { auth: () => Promise<{ user: { name: string } } | null> };
};

// Cast once via unknown — consistent with the pattern used in chat.test.ts
const POST = _POST as unknown as (event: TestEvent) => Promise<Response>;

// ---------------------------------------------------------------------------
// Auth session helpers
// ---------------------------------------------------------------------------
function buildEvent(body: unknown, authenticated = true): TestEvent {
  const request = new Request('http://localhost/api/admin/notes/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return {
    request,
    locals: {
      auth: vi.fn().mockResolvedValue(
        authenticated ? { user: { name: 'Admin' } } : null,
      ),
    },
  };
}

const VALID_PAYLOAD = {
  title: 'My Note',
  takeaway: 'This is the key insight.',
  body: 'This is the full note body with some content.',
};

describe('POST /api/admin/notes/review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.OPENROUTER_API_KEY = 'test-key';
  });

  // -------------------------------------------------------------------------
  // Auth guard
  // -------------------------------------------------------------------------
  test('returns 401 when unauthenticated', async () => {
    const event = buildEvent(VALID_PAYLOAD, false);
    const response = await POST(event);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toMatch(/unauthorized/i);
  });

  // -------------------------------------------------------------------------
  // Payload validation
  // -------------------------------------------------------------------------
  test('returns 400 for non-JSON body', async () => {
    const request = new Request('http://localhost/api/admin/notes/review', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    });
    const event: TestEvent = {
      request,
      locals: { auth: vi.fn().mockResolvedValue({ user: { name: 'Admin' } }) },
    };
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  test('returns 400 when title is missing', async () => {
    const event = buildEvent({ takeaway: 'x', body: 'y' });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  test('returns 400 when takeaway is missing', async () => {
    const event = buildEvent({ title: 'x', body: 'y' });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  test('returns 400 when body is missing', async () => {
    const event = buildEvent({ title: 'x', takeaway: 'y' });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  test('returns 400 when title is an empty string', async () => {
    const event = buildEvent({ title: '', takeaway: 'x', body: 'y' });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  test('returns 400 when fields are non-string types', async () => {
    const event = buildEvent({ title: 123, takeaway: true, body: null });
    const response = await POST(event);
    expect(response.status).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------
  test('streams SSE response on success', async () => {
    const stream = new ReadableStream<Uint8Array>();
    mockStreamNoteReview.mockResolvedValue(new Response(stream, { status: 200 }));

    const event = buildEvent(VALID_PAYLOAD);
    const response = await POST(event);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.body).toBeInstanceOf(ReadableStream);
  });

  test('calls streamNoteReview with validated input', async () => {
    const stream = new ReadableStream<Uint8Array>();
    mockStreamNoteReview.mockResolvedValue(new Response(stream, { status: 200 }));

    const event = buildEvent(VALID_PAYLOAD);
    await POST(event);

    expect(mockStreamNoteReview).toHaveBeenCalledWith({
      title: VALID_PAYLOAD.title,
      takeaway: VALID_PAYLOAD.takeaway,
      body: VALID_PAYLOAD.body,
    });
  });

  // -------------------------------------------------------------------------
  // Upstream 429 / 503 pass-through
  // -------------------------------------------------------------------------
  test('forwards upstream 429 transparently', async () => {
    const body = new ReadableStream<Uint8Array>();
    mockStreamNoteReview.mockResolvedValue(new Response(body, { status: 429 }));

    const event = buildEvent(VALID_PAYLOAD);
    const response = await POST(event);

    expect(response.status).toBe(429);
  });

  test('forwards upstream 503 transparently', async () => {
    const body = new ReadableStream<Uint8Array>();
    mockStreamNoteReview.mockResolvedValue(new Response(body, { status: 503 }));

    const event = buildEvent(VALID_PAYLOAD);
    const response = await POST(event);

    expect(response.status).toBe(503);
  });

  // -------------------------------------------------------------------------
  // Service error handling
  // -------------------------------------------------------------------------
  test('returns 503 when streamNoteReview throws', async () => {
    mockStreamNoteReview.mockRejectedValue(new Error('network failure'));

    const event = buildEvent(VALID_PAYLOAD);
    const response = await POST(event);

    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.error).toBeTruthy();
  });

  test('returns 502 for non-ok, non-429/503 upstream status', async () => {
    mockStreamNoteReview.mockResolvedValue(
      new Response('internal error', { status: 500 }),
    );

    const event = buildEvent(VALID_PAYLOAD);
    const response = await POST(event);

    expect(response.status).toBe(502);
  });

  test('returns 502 when upstream body is null', async () => {
    mockStreamNoteReview.mockResolvedValue(new Response(null, { status: 200 }));

    const event = buildEvent(VALID_PAYLOAD);
    const response = await POST(event);

    expect(response.status).toBe(502);
  });
});
