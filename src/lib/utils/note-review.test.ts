import { describe, expect, test, vi } from 'vitest';

import { streamNoteReview } from './note-review';

function buildSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
}

describe('streamNoteReview', () => {
  test('posts title/takeaway/body payload to review endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        buildSseStream([
          'data: {"choices":[{"delta":{"content":"CLARITY: clear."}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      ),
    );

    const result = await streamNoteReview(
      {
        title: 'Draft title',
        takeaway: 'Draft takeaway',
        body: 'Draft body',
      },
      {},
      fetchMock,
    );

    expect(result).toContain('CLARITY: clear.');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/notes/review',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Draft title',
          takeaway: 'Draft takeaway',
          body: 'Draft body',
        }),
      }),
    );
  });

  test('emits stream state callbacks in order while tokens arrive', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        buildSseStream([
          'data: {"choices":[{"delta":{"content":"CLARITY: tighter."}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"\\nVERDICT: revise."}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      ),
    );

    const events: string[] = [];
    const chunks: string[] = [];

    const result = await streamNoteReview(
      {
        title: 'Title',
        takeaway: 'Takeaway',
        body: 'Body',
      },
      {
        onStart: () => {
          events.push('start');
        },
        onChunk: (token, aggregate) => {
          events.push(`chunk:${token}`);
          chunks.push(aggregate);
        },
        onComplete: (aggregate) => {
          events.push(`complete:${aggregate}`);
        },
      },
      fetchMock,
    );

    expect(events[0]).toBe('start');
    expect(events).toEqual([
      'start',
      'chunk:CLARITY: tighter.',
      'chunk:\nVERDICT: revise.',
      'complete:CLARITY: tighter.\nVERDICT: revise.',
    ]);
    expect(chunks).toEqual(['CLARITY: tighter.', 'CLARITY: tighter.\nVERDICT: revise.']);
    expect(result).toBe('CLARITY: tighter.\nVERDICT: revise.');
  });

  test('throws NoteReviewError with upstream 429 details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Model is busy right now.', {
        status: 429,
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    await expect(
      streamNoteReview(
        {
          title: 'Title',
          takeaway: 'Takeaway',
          body: 'Body',
        },
        {},
        fetchMock,
      ),
    ).rejects.toMatchObject({
      name: 'NoteReviewError',
      status: 429,
      message: 'Model is busy right now.',
    });
  });

  test('throws NoteReviewError with upstream 503 details', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      streamNoteReview(
        {
          title: 'Title',
          takeaway: 'Takeaway',
          body: 'Body',
        },
        {},
        fetchMock,
      ),
    ).rejects.toMatchObject({
      name: 'NoteReviewError',
      status: 503,
      message: 'Service unavailable',
    });
  });
});
