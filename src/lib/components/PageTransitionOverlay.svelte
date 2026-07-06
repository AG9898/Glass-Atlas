<script lang="ts">
  import { afterNavigate, beforeNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import { createPublicGsapContext, type PublicGsap } from '$lib/motion';
  import {
    PAGE_TRANSITION_COVER_DURATION,
    PAGE_TRANSITION_COVER_EASE,
    PAGE_TRANSITION_COVERED_CLIP_PATH,
    PAGE_TRANSITION_IDLE_CLIP_PATH,
    PAGE_TRANSITION_REVEAL_DURATION,
    PAGE_TRANSITION_REVEAL_EASE,
    PAGE_TRANSITION_REVEALED_CLIP_PATH,
    shouldSkipPageTransition,
  } from '$lib/motion/page-transition';

  // Fast branded wipe overlay for public route changes (GSAP.md section 4: "Public page
  // transitions: use a fast line/grid wipe or editorial plate between route changes").
  //
  // Mounted as a sibling of the smooth-scroll wrapper in +layout.svelte (never inside
  // #smooth-content) so this element's `position: fixed` stays anchored to the real
  // viewport instead of the transformed ScrollSmoother content container.
  let root: HTMLElement | null = $state(null);
  let motion: PublicGsap | null = null;
  let cleanupContext: (() => void) | null = null;

  onMount(() => {
    if (!root) return;

    const setup = createPublicGsapContext(root, (loaded) => {
      motion = loaded;
    });

    void setup.then((cleanup) => {
      cleanupContext = cleanup;
    });

    return () => {
      cleanupContext?.();
    };
  });

  beforeNavigate((navigation) => {
    if (!root || !motion?.canUseSpatialMotion) return;

    const fromPathname = navigation.from?.url.pathname ?? null;
    if (fromPathname === null) return;

    const toPathname = navigation.to?.url.pathname ?? null;
    if (shouldSkipPageTransition(fromPathname, toPathname)) return;

    motion.gsap.fromTo(
      root,
      { clipPath: PAGE_TRANSITION_IDLE_CLIP_PATH },
      {
        clipPath: PAGE_TRANSITION_COVERED_CLIP_PATH,
        duration: PAGE_TRANSITION_COVER_DURATION,
        ease: PAGE_TRANSITION_COVER_EASE,
        overwrite: true,
      },
    );
  });

  afterNavigate(() => {
    if (!root || !motion?.canUseSpatialMotion) return;

    motion.gsap.fromTo(
      root,
      { clipPath: PAGE_TRANSITION_COVERED_CLIP_PATH },
      {
        clipPath: PAGE_TRANSITION_REVEALED_CLIP_PATH,
        duration: PAGE_TRANSITION_REVEAL_DURATION,
        ease: PAGE_TRANSITION_REVEAL_EASE,
        overwrite: true,
        onComplete: () => {
          motion?.gsap.set(root, { clipPath: PAGE_TRANSITION_IDLE_CLIP_PATH });
        },
      },
    );
  });
</script>

<div class="page-transition-overlay" bind:this={root} aria-hidden="true"></div>

<style>
  .page-transition-overlay {
    position: fixed;
    inset: 0;
    z-index: 90;
    pointer-events: none;
    clip-path: inset(0 100% 0 0);
    background-color: var(--color-bg);
    background-image: repeating-linear-gradient(
      to right,
      var(--color-line-1) 0,
      var(--color-line-1) 1px,
      transparent 1px,
      transparent 64px
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .page-transition-overlay {
      clip-path: inset(0 100% 0 0) !important;
    }
  }
</style>
