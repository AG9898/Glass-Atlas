import { browser } from '$app/environment';
import type { Action } from 'svelte/action';
import { loadPublicGsap, type PublicGsap } from './gsap';
import { watchReducedMotionPreference } from './preferences';
import { schedulePublicScrollTriggerRefresh } from './scroll-trigger';

export const PUBLIC_SMOOTH_SCROLL_CONTENT_SELECTOR = '[data-public-smooth-content]';

export const PUBLIC_SMOOTH_SCROLL_CONFIG = {
  smooth: 0.45,
  effects: false,
  smoothTouch: 0,
  normalizeScroll: false,
} as const;

type PublicScrollSmoother = ReturnType<PublicGsap['ScrollSmoother']['create']>;

export function isPublicSmoothScrollPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/notes') ||
    pathname === '/how-it-works' ||
    (!pathname.startsWith('/admin') &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/auth') &&
      !pathname.startsWith('/signin'))
  );
}

export const publicSmoothScroll: Action<HTMLElement> = (wrapper) => {
  if (!browser) return {};

  let destroyed = false;
  let setupRun = 0;
  let smoother: PublicScrollSmoother | null = null;

  function killSmoother() {
    smoother?.kill();
    smoother = null;
    wrapper.removeAttribute('data-public-smooth-scroll-ready');
    wrapper.removeAttribute('data-public-smooth-fixed');
    schedulePublicScrollTriggerRefresh('layout');
  }

  async function reconcile(prefersReducedMotion: boolean) {
    const currentRun = ++setupRun;

    if (prefersReducedMotion) {
      killSmoother();
      return;
    }

    const content = wrapper.querySelector<HTMLElement>(PUBLIC_SMOOTH_SCROLL_CONTENT_SELECTOR);
    if (!content) return;

    const motion = await loadPublicGsap();
    if (!motion || destroyed || currentRun !== setupRun) return;

    const activeSmoother = motion.ScrollSmoother.get();
    if (activeSmoother && activeSmoother !== smoother) {
      activeSmoother.kill();
    }

    if (!smoother) {
      smoother = motion.ScrollSmoother.create({
        wrapper,
        content,
        ...PUBLIC_SMOOTH_SCROLL_CONFIG,
      });
      wrapper.setAttribute('data-public-smooth-scroll-ready', 'true');

      // ScrollSmoother pins the wrapper to `position: fixed; inset: 0` only
      // when it decides to run in "smooth" mode (matches its own isTouch
      // check: `(hover: none), (pointer: coarse)`), keeping it `position:
      // relative` otherwise (our smoothTouch: 0 means touch-classified
      // pointers never get the fixed wrapper). Content padding that
      // compensates for Nav's height (which the fixed wrapper ignores) must
      // only apply in the fixed branch, or it double-counts Nav's height on
      // top of the wrapper's own normal in-flow offset. See AGENTS.md.
      const isSmoothScrollFixedMode = !window.matchMedia('(hover: none), (pointer: coarse)').matches;
      wrapper.setAttribute('data-public-smooth-fixed', String(isSmoothScrollFixedMode));
    }

    schedulePublicScrollTriggerRefresh('layout');
  }

  const stopWatchingPreference = watchReducedMotionPreference((prefersReduced) => {
    void reconcile(prefersReduced);
  });

  return {
    destroy() {
      destroyed = true;
      setupRun += 1;
      stopWatchingPreference();
      killSmoother();
    },
  };
};
