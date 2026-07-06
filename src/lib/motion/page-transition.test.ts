import { describe, expect, test } from 'vitest';
import {
  isPublicRouteTransitionPath,
  PAGE_TRANSITION_COVER_DURATION,
  PAGE_TRANSITION_REVEAL_DURATION,
  shouldSkipPageTransition,
} from './page-transition';

describe('public route transition gating', () => {
  test('mirrors the public smooth-scroll route set', () => {
    expect(isPublicRouteTransitionPath('/')).toBe(true);
    expect(isPublicRouteTransitionPath('/notes')).toBe(true);
    expect(isPublicRouteTransitionPath('/notes/some-note')).toBe(true);
    expect(isPublicRouteTransitionPath('/how-it-works')).toBe(true);
  });

  test('excludes admin, auth, sign-in, and API surfaces', () => {
    expect(isPublicRouteTransitionPath('/admin')).toBe(false);
    expect(isPublicRouteTransitionPath('/admin/notes/new')).toBe(false);
    expect(isPublicRouteTransitionPath('/signin')).toBe(false);
    expect(isPublicRouteTransitionPath('/auth/signout')).toBe(false);
    expect(isPublicRouteTransitionPath('/api/chat')).toBe(false);
  });
});

describe('shouldSkipPageTransition', () => {
  test('skips when the destination pathname is unchanged (hash/query-only nav)', () => {
    expect(shouldSkipPageTransition('/notes/some-note', '/notes/some-note')).toBe(true);
  });

  test('skips when neither origin nor destination is a public route', () => {
    expect(shouldSkipPageTransition('/admin', '/admin/notes/new')).toBe(true);
    expect(shouldSkipPageTransition('/admin', '/api/chat')).toBe(true);
  });

  test('plays when the origin is public even if the destination is not', () => {
    expect(shouldSkipPageTransition('/notes', '/admin')).toBe(false);
  });

  test('plays when the destination is public even if the origin is not', () => {
    expect(shouldSkipPageTransition('/admin', '/notes')).toBe(false);
  });

  test('plays for a public-to-public navigation to a different pathname', () => {
    expect(shouldSkipPageTransition('/notes', '/notes/some-note')).toBe(false);
  });

  test('treats a null destination (unknown target) using the origin route only', () => {
    expect(shouldSkipPageTransition('/notes', null)).toBe(false);
    expect(shouldSkipPageTransition('/admin', null)).toBe(true);
  });
});

describe('page transition timing budget', () => {
  test('cover and reveal together stay within the GSAP.md 300ms-600ms budget', () => {
    const totalSeconds = PAGE_TRANSITION_COVER_DURATION + PAGE_TRANSITION_REVEAL_DURATION;
    expect(totalSeconds).toBeGreaterThanOrEqual(0.3);
    expect(totalSeconds).toBeLessThanOrEqual(0.6);
  });
});
