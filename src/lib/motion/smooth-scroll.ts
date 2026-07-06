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
