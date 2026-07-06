<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import WaveGridLoader from '$lib/components/WaveGridLoader.svelte';
  import { shouldUseWaveGridMotion } from '$lib/motion';

  // Branded boot splash shown once per hard page load (never on SPA navigation, since
  // +layout.svelte — where this is mounted — does not remount between client-side routes).
  // Skipped entirely under reduced motion: the page is already server-rendered and usable,
  // so there is nothing worth delaying reduced-motion users behind a pure flourish.
  //
  // Always held for MIN_DISPLAY_MS so the splash reads as a deliberate, persisted moment
  // rather than a flash a fast load blinks past. If real readiness (fonts) takes longer
  // than that floor, the splash simply waits for it instead — no upper cap.
  const MIN_DISPLAY_MS = 1500;
  const FADE_MS = 300;

  let show = $state(false);
  let fading = $state(false);

  onMount(() => {
    if (!browser || !shouldUseWaveGridMotion(window)) return;

    show = true;
    let cancelled = false;
    let fadeTimeout: ReturnType<typeof setTimeout> | undefined;

    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const fontsReady = document.fonts?.ready ?? Promise.resolve();

    void Promise.all([wait(MIN_DISPLAY_MS), fontsReady]).then(() => {
      if (cancelled) return;
      fading = true;
      fadeTimeout = setTimeout(() => {
        if (!cancelled) show = false;
      }, FADE_MS);
    });

    return () => {
      cancelled = true;
      clearTimeout(fadeTimeout);
    };
  });
</script>

{#if show}
  <div class="initial-load-screen" class:is-fading={fading} aria-hidden="true">
    <WaveGridLoader variant="overlay" />
  </div>
{/if}

<style>
  .initial-load-screen {
    position: fixed;
    inset: 0;
    z-index: 95;
    pointer-events: none;
    opacity: 1;
    transition: opacity 300ms ease;
  }

  .initial-load-screen.is-fading {
    opacity: 0;
  }
</style>
