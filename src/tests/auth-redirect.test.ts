/**
 * Tests for post-sign-in redirect behavior (ADMIN-08A).
 *
 * Covers:
 * - buildSigninRedirectUrl: pure helper that constructs the /signin?callbackUrl=... redirect
 * - buildCanonicalRedirectUrl: www-to-apex production canonicalization
 * - /signin load function: reads callbackUrl from URL, defaults to /admin
 *
 * Manual verification steps for the full OAuth flow (cannot be automated in unit tests):
 *   1. Start dev server, clear all cookies, visit http://localhost:5173/admin
 *   2. Should be redirected to /signin?callbackUrl=%2Fadmin
 *   3. Clicking "Sign in with GitHub" should complete OAuth and land on /admin
 *   4. Visiting /signin directly (no callbackUrl) and signing in should also land on /admin
 *   5. Visiting /signin?callbackUrl=%2Fadmin%2Fnotes%2Fnew and signing in
 *      should land on /admin/notes/new (explicit callbackUrl is honoured)
 *   6. Visiting /admin while already authenticated should render the dashboard without redirect
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies before any imports that touch them
// ---------------------------------------------------------------------------

vi.mock('$env/static/private', () => ({
  AUTH_GITHUB_ID: 'test-github-id',
  AUTH_GITHUB_SECRET: 'test-github-secret',
  AUTH_SECRET: 'test-auth-secret-32-chars-minimum!!',
}));

vi.mock('$env/dynamic/private', () => ({
  env: {
    AUTH_BYPASS: '',
    NODE_ENV: 'test',
  },
}));

vi.mock('../auth', () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  handle: vi.fn(async ({ resolve, event }: { event: unknown; resolve: (e: unknown) => Promise<Response> }) =>
    resolve(event),
  ),
}));

// ---------------------------------------------------------------------------
// Tests for buildSigninRedirectUrl (pure helper — no mocking required)
// ---------------------------------------------------------------------------

describe('buildSigninRedirectUrl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('encodes the path as callbackUrl in the redirect URL', async () => {
    const { buildSigninRedirectUrl } = await import('../hooks.server');
    const url = buildSigninRedirectUrl('/admin', '');
    expect(url).toBe('/signin?callbackUrl=%2Fadmin');
  });

  it('includes search params in the encoded callbackUrl', async () => {
    const { buildSigninRedirectUrl } = await import('../hooks.server');
    const url = buildSigninRedirectUrl('/admin/notes/new', '?draft=true');
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('/admin/notes/new');
    expect(decoded).toContain('draft=true');
  });

  it('always prefixes with /signin', async () => {
    const { buildSigninRedirectUrl } = await import('../hooks.server');
    const url = buildSigninRedirectUrl('/admin', '');
    expect(url.startsWith('/signin?callbackUrl=')).toBe(true);
  });

  it('handles nested admin paths correctly', async () => {
    const { buildSigninRedirectUrl } = await import('../hooks.server');
    const url = buildSigninRedirectUrl('/admin/notes/my-slug/edit', '');
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('/admin/notes/my-slug/edit');
  });
});

describe('buildCanonicalRedirectUrl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('redirects www to the HTTPS apex while preserving path and query', async () => {
    const { buildCanonicalRedirectUrl } = await import('../hooks.server');
    const url = new URL('http://www.glassatlas.dev/notes/example?ref=legacy');

    expect(buildCanonicalRedirectUrl(url)).toBe(
      'https://glassatlas.dev/notes/example?ref=legacy',
    );
  });

  it('does not redirect the canonical apex', async () => {
    const { buildCanonicalRedirectUrl } = await import('../hooks.server');

    expect(buildCanonicalRedirectUrl(new URL('https://glassatlas.dev/notes'))).toBeNull();
  });

  it('keeps the Railway service domain available as a rollback path', async () => {
    const { buildCanonicalRedirectUrl } = await import('../hooks.server');

    expect(
      buildCanonicalRedirectUrl(
        new URL('https://glass-atlas-production.up.railway.app/admin'),
      ),
    ).toBeNull();
  });

  it('does not affect local development hosts', async () => {
    const { buildCanonicalRedirectUrl } = await import('../hooks.server');

    expect(buildCanonicalRedirectUrl(new URL('http://localhost:5173/'))).toBeNull();
  });

  it.each([
    'https://www.glassatlas.dev//evil.com/x?a=1',
    'https://www.glassatlas.dev/\\\\evil.com/y',
    'https://www.glassatlas.dev//user@evil.com/',
  ])('never redirects off the canonical origin for %s', async (rawUrl) => {
    const { buildCanonicalRedirectUrl } = await import('../hooks.server');

    const target = buildCanonicalRedirectUrl(new URL(rawUrl));

    expect(target).not.toBeNull();
    expect(new URL(target as string).origin).toBe('https://glassatlas.dev');
  });
});

describe('canonical redirect response', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('carries the shared security headers on the 308', async () => {
    const { canonicalHostRedirect, securityHeaders } = await import('../hooks.server');

    const event = {
      url: new URL('https://www.glassatlas.dev/notes?ref=legacy'),
      locals: {},
    } as unknown as Parameters<typeof securityHeaders>[0]['event'];

    const response = await securityHeaders({
      event,
      resolve: (async () =>
        canonicalHostRedirect({
          event,
          resolve: async () => new Response('should not be reached'),
        } as unknown as Parameters<typeof canonicalHostRedirect>[0])) as never,
    } as unknown as Parameters<typeof securityHeaders>[0]);

    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('https://glassatlas.dev/notes?ref=legacy');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});

// ---------------------------------------------------------------------------
// Tests for /signin load function
// ---------------------------------------------------------------------------

describe('/signin load function', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the callbackUrl from the query string', async () => {
    const { load } = await import('../routes/signin/+page.server');

    const url = new URL('http://localhost/signin?callbackUrl=%2Fadmin%2Fnotes%2Fnew');
    const result = (await load({ url } as Parameters<typeof load>[0])) as { callbackUrl: string };

    expect(result.callbackUrl).toBe('/admin/notes/new');
  });

  it('defaults callbackUrl to /admin when the query param is absent', async () => {
    const { load } = await import('../routes/signin/+page.server');

    const url = new URL('http://localhost/signin');
    const result = (await load({ url } as Parameters<typeof load>[0])) as { callbackUrl: string };

    expect(result.callbackUrl).toBe('/admin');
  });

  it('defaults callbackUrl to /admin when callbackUrl param is an empty string', async () => {
    const { load } = await import('../routes/signin/+page.server');

    const url = new URL('http://localhost/signin?callbackUrl=');
    // URL.searchParams.get returns '' for empty param — treated as absent
    const result = (await load({ url } as Parameters<typeof load>[0])) as { callbackUrl: string };

    // An empty string is falsy with ||, so we expect the default
    expect(result.callbackUrl).toBe('/admin');
  });

  it('returns an explicit callbackUrl for a specific admin sub-path', async () => {
    const { load } = await import('../routes/signin/+page.server');

    const url = new URL('http://localhost/signin?callbackUrl=%2Fadmin%2Fnotes%2Fnew');
    const result = (await load({ url } as Parameters<typeof load>[0])) as { callbackUrl: string };

    expect(result.callbackUrl).toBe('/admin/notes/new');
  });
});
