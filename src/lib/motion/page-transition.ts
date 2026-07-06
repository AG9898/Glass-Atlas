import { isPublicSmoothScrollPath } from './smooth-scroll';

/**
 * Public route transitions reuse the same public/admin/auth/API gating rule as the
 * smooth-scroll layer: the overlay only plays on navigations that touch a public
 * editorial route, never admin, auth, sign-in, or API paths.
 */
export function isPublicRouteTransitionPath(pathname: string): boolean {
  return isPublicSmoothScrollPath(pathname);
}

/**
 * Decide whether the wipe overlay should play for a given navigation.
 *
 * Skips when:
 * - the destination pathname is identical to the origin (hash/query-only navigation,
 *   or a no-op link click) — nothing structural is changing on screen.
 * - neither the origin nor the destination is a public route (e.g. admin -> admin).
 */
export function shouldSkipPageTransition(fromPathname: string, toPathname: string | null): boolean {
  if (toPathname !== null && toPathname === fromPathname) return true;

  const fromPublic = isPublicRouteTransitionPath(fromPathname);
  const toPublic = toPathname === null ? fromPublic : isPublicRouteTransitionPath(toPathname);

  return !fromPublic && !toPublic;
}

/** Clip-path states for the wipe overlay, expressed as CSS `inset()` masks. */
export const PAGE_TRANSITION_IDLE_CLIP_PATH = 'inset(0 100% 0 0)';
export const PAGE_TRANSITION_COVERED_CLIP_PATH = 'inset(0 0% 0 0)';
export const PAGE_TRANSITION_REVEALED_CLIP_PATH = 'inset(0 0 0 100%)';

/** Timing follows the GSAP.md "Page transition overlay: 300ms-600ms" budget, split
 * across the cover (before navigation settles) and reveal (after) phases. */
export const PAGE_TRANSITION_COVER_DURATION = 0.18;
export const PAGE_TRANSITION_REVEAL_DURATION = 0.22;
export const PAGE_TRANSITION_COVER_EASE = 'power2.out';
export const PAGE_TRANSITION_REVEAL_EASE = 'power2.inOut';
