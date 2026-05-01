import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamNoteReview, type ReviewInput } from '$lib/server/ai/review';

type ReviewBody = {
  title?: unknown;
  takeaway?: unknown;
  body?: unknown;
};

function parseReviewBody(raw: unknown): ReviewInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const b = raw as ReviewBody;
  if (typeof b.title !== 'string' || b.title.trim() === '') return null;
  if (typeof b.takeaway !== 'string' || b.takeaway.trim() === '') return null;
  if (typeof b.body !== 'string' || b.body.trim() === '') return null;
  return {
    title: b.title,
    takeaway: b.takeaway,
    body: b.body,
  };
}

export const POST: RequestHandler = async ({ locals, request }) => {
  const session = await locals.auth();
  if (!session?.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = parseReviewBody(rawBody);
  if (!input) {
    return json(
      { error: 'Invalid payload. Required: title (string), takeaway (string), body (string)' },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await streamNoteReview(input);
  } catch (error) {
    console.error('[notes/review] Failed to initiate review stream.', error);
    return json({ error: 'Unable to reach review service' }, { status: 503 });
  }

  // Forward 429 and 503 transparently — never remap to generic 500
  if (upstream.status === 429 || upstream.status === 503) {
    const body = upstream.body ?? new ReadableStream();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error(`[notes/review] OpenRouter returned ${upstream.status}: ${detail}`);
    return json({ error: 'Review service error' }, { status: 502 });
  }

  if (!upstream.body) {
    return json({ error: 'Review service returned no body' }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
};
