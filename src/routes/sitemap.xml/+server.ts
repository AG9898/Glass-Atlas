import { PUBLIC_SITE_URL } from '$env/static/public';
import { listNotes } from '$lib/server/db/notes';
import type { RequestHandler } from './$types';

function normalizeSiteUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc: string): string {
  return `<url><loc>${escapeXml(loc)}</loc></url>`;
}

export const GET: RequestHandler = async () => {
  const siteUrl = normalizeSiteUrl(PUBLIC_SITE_URL);
  const publishedNotes = await listNotes({ status: 'published' });

  const entries = [
    urlEntry(`${siteUrl}/`),
    urlEntry(`${siteUrl}/notes`),
    ...publishedNotes.map((note) => urlEntry(`${siteUrl}/notes/${note.slug}`)),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
  ].join('');

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
    },
  });
};
