<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  import {
    resolveWaveGridPalette,
    shouldUseWaveGridMotion,
    WAVE_GRID_CONFIG,
  } from '$lib/motion';
  import type * as ThreeRuntime from 'three';

  type ThreeModule = typeof import('three');
  type GridSegment = readonly [number, number, number, number];

  type GridLayer = {
    geometry: ThreeRuntime.BufferGeometry;
    material: ThreeRuntime.LineBasicMaterial;
    lines: ThreeRuntime.LineSegments;
    positions: Float32Array;
    seeds: Float32Array;
    amplitude: number;
    phase: number;
  };

  type StaticPath = {
    d: string;
    emphasis?: boolean;
    accent?: 'sage' | 'taupe';
  };

  let fieldEl: HTMLDivElement | null = $state(null);
  let canvasEl: HTMLCanvasElement | null = $state(null);
  let shouldRenderCanvas = $state(false);
  let canvasReady = $state(false);

  const staticHorizontalPaths: StaticPath[] = Array.from({ length: 8 }, (_, index) => {
    const y = 34 + index * 29;
    const inset = index * 36;
    return {
      d: `M${74 + inset} ${y} L${1126 - inset} ${y}`,
      emphasis: index === 2 || index === 5,
    };
  });

  const staticVerticalPaths: StaticPath[] = Array.from({ length: 11 }, (_, index) => {
    const x = 74 + index * 105;
    const tilt = (index - 5) * 13;
    return {
      d: `M${x + tilt} 28 L${x - tilt * 0.72} 236`,
      emphasis: index === 2 || index === 8,
    };
  });

  const staticAccentPaths: StaticPath[] = [
    { d: 'M130 148 C330 126 515 176 704 151 S1016 129 1110 155', accent: 'sage' },
    { d: 'M805 38 C770 94 794 145 746 222', accent: 'taupe' },
  ];

  function lerp(start: number, end: number, amount: number) {
    return start + (end - start) * amount;
  }

  function createSubdividedSegment(
    segments: GridSegment[],
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    divisions: number,
  ) {
    for (let index = 0; index < divisions; index += 1) {
      const start = index / divisions;
      const end = (index + 1) / divisions;
      segments.push([
        lerp(fromX, toX, start),
        lerp(fromZ, toZ, start),
        lerp(fromX, toX, end),
        lerp(fromZ, toZ, end),
      ]);
    }
  }

  function createGridSegments(options: {
    rows?: number[];
    columns?: number[];
    horizontalSubdivisions: number;
    verticalSubdivisions: number;
  }) {
    const segments: GridSegment[] = [];
    const halfWidth = WAVE_GRID_CONFIG.width / 2;
    const halfDepth = WAVE_GRID_CONFIG.depth / 2;
    const rows = options.rows ?? Array.from({ length: WAVE_GRID_CONFIG.rows + 1 }, (_, i) => i);
    const columns =
      options.columns ?? Array.from({ length: WAVE_GRID_CONFIG.columns + 1 }, (_, i) => i);

    for (const row of rows) {
      const z = lerp(-halfDepth, halfDepth, row / WAVE_GRID_CONFIG.rows);
      createSubdividedSegment(
        segments,
        -halfWidth,
        z,
        halfWidth,
        z,
        options.horizontalSubdivisions,
      );
    }

    for (const column of columns) {
      const x = lerp(-halfWidth, halfWidth, column / WAVE_GRID_CONFIG.columns);
      createSubdividedSegment(
        segments,
        x,
        -halfDepth,
        x,
        halfDepth,
        options.verticalSubdivisions,
      );
    }

    return segments;
  }

  function createLayer(
    THREE: ThreeModule,
    segments: GridSegment[],
    color: string,
    opacity: number,
    amplitude: number,
    phase: number,
  ): GridLayer {
    const positions = new Float32Array(segments.length * 6);
    const seeds = new Float32Array(segments.length * 4);
    let vertexIndex = 0;

    for (const [fromX, fromZ, toX, toZ] of segments) {
      positions[vertexIndex * 3] = fromX;
      positions[vertexIndex * 3 + 1] = 0;
      positions[vertexIndex * 3 + 2] = fromZ;
      seeds[vertexIndex * 2] = fromX;
      seeds[vertexIndex * 2 + 1] = fromZ;
      vertexIndex += 1;

      positions[vertexIndex * 3] = toX;
      positions[vertexIndex * 3 + 1] = 0;
      positions[vertexIndex * 3 + 2] = toZ;
      seeds[vertexIndex * 2] = toX;
      seeds[vertexIndex * 2 + 1] = toZ;
      vertexIndex += 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(geometry, material);
    return { geometry, material, lines, positions, seeds, amplitude, phase };
  }

  function updateLayer(layer: GridLayer, elapsed: number) {
    const vertexCount = layer.seeds.length / 2;

    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
      const x = layer.seeds[vertexIndex * 2];
      const z = layer.seeds[vertexIndex * 2 + 1];
      const wave =
        Math.sin(
          x * WAVE_GRID_CONFIG.waveFrequencyX +
            z * WAVE_GRID_CONFIG.waveFrequencyZ +
            elapsed * WAVE_GRID_CONFIG.waveSpeed +
            layer.phase,
        ) * layer.amplitude;
      layer.positions[vertexIndex * 3 + 1] = wave;
    }

    const position = layer.geometry.getAttribute('position');
    position.needsUpdate = true;
  }

  function setupThreeScene(THREE: ThreeModule, canvas: HTMLCanvasElement, field: HTMLDivElement) {
    const palette = resolveWaveGridPalette(document);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      WAVE_GRID_CONFIG.camera.fov,
      1,
      WAVE_GRID_CONFIG.camera.near,
      WAVE_GRID_CONFIG.camera.far,
    );
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });

    renderer.setClearColor(new THREE.Color(palette.bg), 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    camera.position.set(
      WAVE_GRID_CONFIG.camera.x,
      WAVE_GRID_CONFIG.camera.y,
      WAVE_GRID_CONFIG.camera.z,
    );
    camera.lookAt(0, 0, 0);

    const baseLayer = createLayer(
      THREE,
      createGridSegments({
        horizontalSubdivisions: WAVE_GRID_CONFIG.horizontalSubdivisions,
        verticalSubdivisions: WAVE_GRID_CONFIG.verticalSubdivisions,
      }),
      palette.line2,
      0.46,
      WAVE_GRID_CONFIG.amplitude,
      0,
    );
    const emphasisLayer = createLayer(
      THREE,
      createGridSegments({
        rows: [0, 4, 9],
        columns: [0, 9, 18],
        horizontalSubdivisions: WAVE_GRID_CONFIG.horizontalSubdivisions,
        verticalSubdivisions: WAVE_GRID_CONFIG.verticalSubdivisions,
      }),
      palette.line3,
      0.34,
      WAVE_GRID_CONFIG.amplitude * 0.72,
      0.4,
    );
    const sageLayer = createLayer(
      THREE,
      createGridSegments({
        rows: [6],
        columns: [],
        horizontalSubdivisions: WAVE_GRID_CONFIG.horizontalSubdivisions,
        verticalSubdivisions: WAVE_GRID_CONFIG.verticalSubdivisions,
      }),
      palette.accent,
      0.58,
      WAVE_GRID_CONFIG.accentAmplitude,
      1.2,
    );
    const taupeLayer = createLayer(
      THREE,
      createGridSegments({
        rows: [],
        columns: [13],
        horizontalSubdivisions: WAVE_GRID_CONFIG.horizontalSubdivisions,
        verticalSubdivisions: WAVE_GRID_CONFIG.verticalSubdivisions,
      }),
      palette.accentSecondary,
      0.5,
      WAVE_GRID_CONFIG.accentAmplitude * 0.82,
      2.5,
    );
    const layers = [baseLayer, emphasisLayer, sageLayer, taupeLayer];

    for (const layer of layers) scene.add(layer.lines);

    const resize = () => {
      const width = Math.max(1, field.clientWidth);
      const height = Math.max(1, field.clientHeight);

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(field);
    resize();

    let animationFrame = 0;
    const render = (now: number) => {
      for (const layer of layers) updateLayer(layer, now);
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();

      for (const layer of layers) {
        scene.remove(layer.lines);
        layer.geometry.dispose();
        layer.material.dispose();
      }

      renderer.dispose();
      renderer.forceContextLoss();
    };
  }

  onMount(() => {
    if (!browser || !shouldUseWaveGridMotion(window)) return;

    let cancelled = false;
    let cleanupScene: (() => void) | undefined;
    shouldRenderCanvas = true;

    void (async () => {
      await tick();
      if (cancelled || !canvasEl || !fieldEl) return;

      try {
        const THREE = await import('three');
        if (cancelled || !canvasEl || !fieldEl) return;

        cleanupScene = setupThreeScene(THREE, canvasEl, fieldEl);
        canvasReady = true;
      } catch {
        canvasReady = false;
        shouldRenderCanvas = false;
      }
    })();

    return () => {
      cancelled = true;
      canvasReady = false;
      cleanupScene?.();
    };
  });
</script>

<div class="wave-grid-field" bind:this={fieldEl} aria-hidden="true">
  <svg class="wave-grid-static" viewBox="0 0 1200 260" preserveAspectRatio="none">
    <rect class="static-surface" x="0" y="0" width="1200" height="260" />
    <g class="static-grid">
      {#each staticHorizontalPaths as path}
        <path class:static-emphasis={path.emphasis} d={path.d} />
      {/each}
      {#each staticVerticalPaths as path}
        <path class:static-emphasis={path.emphasis} d={path.d} />
      {/each}
    </g>
    <g class="static-accent">
      {#each staticAccentPaths as path}
        <path class:static-sage={path.accent === 'sage'} class:static-taupe={path.accent === 'taupe'} d={path.d} />
      {/each}
    </g>
  </svg>

  {#if shouldRenderCanvas}
    <canvas class:canvas-ready={canvasReady} bind:this={canvasEl}></canvas>
  {/if}
</div>

<style>
  .wave-grid-field {
    position: relative;
    inline-size: 100%;
    block-size: clamp(11.25rem, 22vw, 20rem);
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
  }

  .static-surface {
    fill: var(--color-bg);
  }

  .static-grid path,
  .static-accent path {
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .static-grid path {
    stroke: var(--color-line-2);
    stroke-width: 1;
    opacity: 0.36;
  }

  .static-grid path.static-emphasis {
    stroke: var(--color-line-3);
    opacity: 0.26;
  }

  .static-accent path {
    stroke-width: 1.2;
    opacity: 0.5;
  }

  .static-accent path.static-sage {
    stroke: var(--color-accent-500);
  }

  .static-accent path.static-taupe {
    stroke: var(--color-accent2-500, #bba079);
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
