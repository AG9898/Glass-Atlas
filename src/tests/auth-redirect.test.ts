/**
 * Tests for post-sign-in redirect behavior (ADMIN-08A).
 *
 * Covers:
 * - buildSigninRedirectUrl: pure helper that constructs the /auth/signin?callbackUrl=... redirect
 * - /auth/signin load function: reads callbackUrl from URL, defaults to /admin
 *
 * Manual verification steps for the full OAuth flow (cannot be automated in unit tests):
 *   1. Start dev server, clear all cookies, visit http://localhost:5173/admin
 *   2. Should be redirected to /auth/signin?callbackUrl=%2Fadmin
 *   3. Clicking "Sign in with GitHub" should complete OAuth and land on /admin
 *   4. Visiting /auth/signin directly (no callbackUrl) and signing in should also land on /admin
 *   5. Visiting /auth/signin?callbackUrl=%2Fadmin%2Fnotes%2Fnew and signing in
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
    expect(url).toBe('/auth/signin?callbackUrl=%2Fadmin');
  });

  it('includes search params in the encoded callbackUrl', async () => {
    const { buildSigninRedirectUrl } = await import('../hooks.server');
    const url = buildSigninRedirectUrl('/admin/notes/new', '?draft=true');
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('/admin/notes/new');
    expect(decoded).toContain('draft=true');
  });

  it('always prefixes with /auth/signin', async () => {
    const { buildSigninRedirectUrl } = await import('../hooks.server');
    const url = buildSigninRedirectUrl('/admin', '');
    expect(url.startsWith('/auth/signin?callbackUrl=')).toBe(true);
  });

  it('handles nested admin paths correctly', async () => {
    const { buildSigninRedirectUrl } = await import('../hooks.server');
    const url = buildSigninRedirectUrl('/admin/notes/my-slug/edit', '');
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('/admin/notes/my-slug/edit');
  });
});

// ---------------------------------------------------------------------------
// Tests for /auth/signin load function
// ---------------------------------------------------------------------------

describe('/auth/signin load function', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the callbackUrl from the query string', async () => {
    const { load } = await import('../routes/auth/signin/+page.server');

    const url = new URL('http://localhost/auth/signin?callbackUrl=%2Fadmin%2Fnotes%2Fnew');
    const result = (await load({ url } as Parameters<typeof load>[0])) as { callbackUrl: string };

    expect(result.callbackUrl).toBe('/admin/notes/new');
  });

  it('defaults callbackUrl to /admin when the query param is absent', async () => {
    const { load } = await import('../routes/auth/signin/+page.server');

    const url = new URL('http://localhost/auth/signin');
    const result = (await load({ url } as Parameters<typeof load>[0])) as { callbackUrl: string };

    expect(result.callbackUrl).toBe('/admin');
  });

  it('defaults callbackUrl to /admin when callbackUrl param is an empty string', async () => {
    const { load } = await import('../routes/auth/signin/+page.server');

    const url = new URL('http://localhost/auth/signin?callbackUrl=');
    // URL.searchParams.get returns '' for empty param — treated as absent
    const result = (await load({ url } as Parameters<typeof load>[0])) as { callbackUrl: string };

    // An empty string is falsy with ||, so we expect the default
    expect(result.callbackUrl).toBe('/admin');
  });

  it('returns an explicit callbackUrl for a specific admin sub-path', async () => {
    const { load } = await import('../routes/auth/signin/+page.server');

    const url = new URL('http://localhost/auth/signin?callbackUrl=%2Fadmin%2Fnotes%2Fnew');
    const result = (await load({ url } as Parameters<typeof load>[0])) as { callbackUrl: string };

    expect(result.callbackUrl).toBe('/admin/notes/new');
  });
});
