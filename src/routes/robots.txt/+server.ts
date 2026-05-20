import { env } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

function normalizeSiteUrl(url: string): string {
	return url.endsWith('/') ? url.slice(0, -1) : url;
}

export const GET: RequestHandler = ({ url }) => {
	const siteUrl = normalizeSiteUrl(env.PUBLIC_SITE_URL?.trim() || url.origin);

	const body = [
		'User-agent: *',
		'Allow: /',
		'Disallow: /admin',
		'Disallow: /api/',
		'',
		`Sitemap: ${siteUrl}/sitemap.xml`,
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=86400',
		},
	});
};
