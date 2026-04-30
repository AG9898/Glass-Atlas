import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPresignedUploadUrl, isSupportedMediaMimeType } from '$lib/server/storage/bucket';

type UploadBody = {
  contentType?: unknown;
  filename?: unknown;
};

function parseBody(body: unknown): UploadBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  return body as UploadBody;
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

  const body = parseBody(rawBody);
  if (!body || typeof body.contentType !== 'string') {
    return json({ error: 'contentType is required' }, { status: 400 });
  }

  if (!isSupportedMediaMimeType(body.contentType)) {
    return json(
      {
        error: 'Unsupported media type. Allowed: image/jpeg, image/png, image/svg+xml, image/gif, video/mp4',
      },
      { status: 415 },
    );
  }

  const filename = typeof body.filename === 'string' ? body.filename : undefined;

  try {
    const signed = await createPresignedUploadUrl({
      contentType: body.contentType,
      filename,
    });

    return json(signed);
  } catch (error) {
    console.error('[media/upload-url] Failed to create signed upload URL.', error);
    return json({ error: 'Unable to create upload URL' }, { status: 503 });
  }
};
