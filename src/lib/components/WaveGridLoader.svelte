<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  import {
    createWaveGridScene,
    getWaveGridConfig,
    resolveWaveGridPalette,
    shouldUseWaveGridMotion,
    type WaveGridScene,
    type WaveGridVariant,
  } from '$lib/motion';

  let { variant = 'overlay' as WaveGridVariant }: { variant?: WaveGridVariant } = $props();

  let fieldEl: HTMLDivElement | null = $state(null);
  let canvasEl: HTMLCanvasElement | null = $state(null);
  let shouldRenderCanvas = $state(false);
  let canvasReady = $state(false);

  onMount(() => {
    if (!browser || !shouldUseWaveGridMotion(window)) return;

    let cancelled = false;
    let scene: WaveGridScene | undefined;
    shouldRenderCanvas = true;

    void (async () => {
      await tick();
      if (cancelled || !canvasEl || !fieldEl) return;

      try {
        const THREE = await import('three');
        if (cancelled || !canvasEl || !fieldEl) return;

        const config = getWaveGridConfig(variant);
        const palette = resolveWaveGridPalette(document);
        scene = createWaveGridScene(THREE, canvasEl, fieldEl, config, palette);
        canvasReady = true;
      } catch {
        canvasReady = false;
        shouldRenderCanvas = false;
      }
    })();

    return () => {
      cancelled = true;
      canvasReady = false;
      scene?.dispose();
    };
  });
</script>

<div
  class="wave-grid-loader"
  class:wave-grid-loader--compact={variant === 'compact'}
  bind:this={fieldEl}
  aria-hidden="true"
>
  <div class="wave-grid-static"></div>

  {#if shouldRenderCanvas}
    <canvas class:canvas-ready={canvasReady} bind:this={canvasEl}></canvas>
  {/if}
</div>

<style>
  .wave-grid-loader {
    position: relative;
    inline-size: 100%;
    block-size: 100%;
    overflow: hidden;
    pointer-events: none;
    background: var(--color-bg);
    contain: layout paint;
  }

  .wave-grid-static,
  canvas {
    position: absolute;
    inset: 0;
    display: block;
    inline-size: 100%;
    block-size: 100%;
  }

  .wave-grid-static {
    z-index: 1;
    background-color: var(--color-bg);
    background-image:
      repeating-linear-gradient(
        to right,
        var(--color-line-1) 0,
        var(--color-line-1) 1px,
        transparent 1px,
        transparent 64px
      ),
      repeating-linear-gradient(
        to bottom,
        var(--color-line-1) 0,
        var(--color-line-1) 1px,
        transparent 1px,
        transparent 64px
      );
  }

  .wave-grid-loader--compact .wave-grid-static {
    background-image:
      repeating-linear-gradient(
        to right,
        var(--color-line-1) 0,
        var(--color-line-1) 1px,
        transparent 1px,
        transparent 10px
      ),
      repeating-linear-gradient(
        to bottom,
        var(--color-line-1) 0,
        var(--color-line-1) 1px,
        transparent 1px,
        transparent 10px
      );
  }

  canvas {
    z-index: 2;
    opacity: 0;
    transition: opacity 220ms ease;
  }

  canvas.canvas-ready {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    canvas {
      display: none;
    }
  }
</style>
