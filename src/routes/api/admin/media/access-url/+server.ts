import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPresignedAccessUrl, isValidObjectKey } from '$lib/server/storage/bucket';

export const GET: RequestHandler = async ({ url }) => {
  const key = url.searchParams.get('key')?.trim() ?? '';

  if (!isValidObjectKey(key)) {
    error(400, 'Invalid media key');
  }

  let signedUrl: string;
  try {
    signedUrl = await createPresignedAccessUrl(key);
  } catch (err) {
    console.error('[media/access-url] Failed to create signed access URL.', {
      key,
      message: err instanceof Error ? err.message : 'Unknown error',
    });
    error(404, 'Media not found');
  }

  redirect(307, signedUrl);
};
