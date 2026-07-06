import { describe, expect, test } from 'vitest';
import { isPublicSmoothScrollPath, PUBLIC_SMOOTH_SCROLL_CONFIG } from './smooth-scroll';

describe('public smooth scroll', () => {
  test('enables the smoother for public editorial routes', () => {
    expect(isPublicSmoothScrollPath('/')).toBe(true);
    expect(isPublicSmoothScrollPath('/notes')).toBe(true);
    expect(isPublicSmoothScrollPath('/notes/some-note')).toBe(true);
    expect(isPublicSmoothScrollPath('/how-it-works')).toBe(true);
    expect(isPublicSmoothScrollPath('/field-notes')).toBe(true);
  });

  test('keeps admin, auth, and API surfaces out of the smoother', () => {
    expect(isPublicSmoothScrollPath('/admin')).toBe(false);
    expect(isPublicSmoothScrollPath('/admin/notes/new')).toBe(false);
    expect(isPublicSmoothScrollPath('/signin')).toBe(false);
    expect(isPublicSmoothScrollPath('/auth/signout')).toBe(false);
    expect(isPublicSmoothScrollPath('/api/chat')).toBe(false);
  });

  test('uses conservative native-scroll-compatible settings', () => {
    expect(PUBLIC_SMOOTH_SCROLL_CONFIG).toMatchObject({
      effects: false,
      normalizeScroll: false,
      smoothTouch: 0,
    });
    expect(PUBLIC_SMOOTH_SCROLL_CONFIG.smooth).toBeGreaterThan(0);
    expect(PUBLIC_SMOOTH_SCROLL_CONFIG.smooth).toBeLessThanOrEqual(0.5);
  });
});
