import { describe, expect, test, vi } from 'vitest';
import {
  canUseSpatialMotion,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  watchReducedMotionPreference,
  type MotionPreferenceWindow,
} from './preferences';
import { loadPublicGsap } from './gsap';

function createMotionWindow(matches: boolean): MotionPreferenceWindow {
  return {
    matchMedia: (query: string) =>
      ({
        media: query,
        matches,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      }) satisfies MediaQueryList,
  };
}

describe('motion preferences', () => {
  test('defaults to reduced motion when no browser window is available', () => {
    expect(prefersReducedMotion(undefined)).toBe(true);
    expect(canUseSpatialMotion(undefined)).toBe(false);
  });

  test('maps the reduced-motion media query to spatial motion availability', () => {
    expect(prefersReducedMotion(createMotionWindow(true))).toBe(true);
    expect(canUseSpatialMotion(createMotionWindow(true))).toBe(false);
    expect(prefersReducedMotion(createMotionWindow(false))).toBe(false);
    expect(canUseSpatialMotion(createMotionWindow(false))).toBe(true);
  });

  test('announces the initial reduced-motion preference to watchers', () => {
    const onChange = vi.fn();
    const cleanup = watchReducedMotionPreference(onChange, createMotionWindow(true));

    expect(onChange).toHaveBeenCalledWith(true);

    cleanup();
  });

  test('uses the canonical reduced-motion media query', () => {
    const targetWindow = createMotionWindow(false);

    prefersReducedMotion(targetWindow);

    expect(targetWindow.matchMedia(REDUCED_MOTION_QUERY).media).toBe(REDUCED_MOTION_QUERY);
  });

  test('does not import or register GSAP during SSR', async () => {
    await expect(loadPublicGsap()).resolves.toBeNull();
  });
});
