import { browser } from '$app/environment';
import { canUseSpatialMotion, prefersReducedMotion } from './preferences';

export type PublicGsap = {
  gsap: typeof import('gsap').gsap;
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
  ScrollSmoother: typeof import('gsap/ScrollSmoother').ScrollSmoother;
  prefersReducedMotion: boolean;
  canUseSpatialMotion: boolean;
};

export type PublicGsapContextScope = Parameters<PublicGsap['gsap']['context']>[1];
export type PublicGsapContextSetup = (motion: PublicGsap) => void | (() => void);

let publicGsapPromise: Promise<PublicGsap | null> | null = null;

export async function loadPublicGsap(): Promise<PublicGsap | null> {
  if (!browser) return null;

  publicGsapPromise ??= Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('gsap/ScrollSmoother'),
  ]).then(([gsapModule, scrollTriggerModule, scrollSmootherModule]) => {
      const { gsap } = gsapModule;
      const { ScrollTrigger } = scrollTriggerModule;
      const { ScrollSmoother } = scrollSmootherModule;

      gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

      return {
        gsap,
        ScrollTrigger,
        ScrollSmoother,
        prefersReducedMotion: prefersReducedMotion(),
        canUseSpatialMotion: canUseSpatialMotion(),
      };
    });

  return publicGsapPromise;
}

export async function getLoadedPublicGsap(): Promise<PublicGsap | null> {
  return publicGsapPromise;
}

export async function createPublicGsapContext(
  scope: PublicGsapContextScope,
  setup: PublicGsapContextSetup,
): Promise<() => void> {
  const motion = await loadPublicGsap();
  if (!motion) return () => undefined;

  let cleanup: void | (() => void);
  const context = motion.gsap.context(() => {
    cleanup = setup(motion);

    return () => cleanup?.();
  }, scope);

  return () => context.revert();
}
