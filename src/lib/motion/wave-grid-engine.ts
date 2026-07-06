import type * as ThreeRuntime from 'three';
import type { WaveGridConfig } from './wave-grid';
import type { WaveGridPalette } from './wave-grid';

export type ThreeModule = typeof import('three');
export type GridSegment = readonly [number, number, number, number];

export type WaveGridLayer = {
  geometry: ThreeRuntime.BufferGeometry;
  material: ThreeRuntime.LineBasicMaterial;
  lines: ThreeRuntime.LineSegments;
  positions: Float32Array;
  seeds: Float32Array;
  amplitude: number;
  phase: number;
};

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

/** Rounds a 0-1 fraction of `total` to the nearest integer index, clamped to [0, total]. */
function fractionToIndex(fraction: number, total: number) {
  return Math.min(total, Math.max(0, Math.round(fraction * total)));
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

export function createGridSegments(
  config: WaveGridConfig,
  options: {
    rows?: number[];
    columns?: number[];
    horizontalSubdivisions: number;
    verticalSubdivisions: number;
  },
): GridSegment[] {
  const segments: GridSegment[] = [];
  const halfWidth = config.width / 2;
  const halfDepth = config.depth / 2;
  const rows = options.rows ?? Array.from({ length: config.rows + 1 }, (_, i) => i);
  const columns = options.columns ?? Array.from({ length: config.columns + 1 }, (_, i) => i);

  for (const row of rows) {
    const z = lerp(-halfDepth, halfDepth, row / config.rows);
    createSubdividedSegment(segments, -halfWidth, z, halfWidth, z, options.horizontalSubdivisions);
  }

  for (const column of columns) {
    const x = lerp(-halfWidth, halfWidth, column / config.columns);
    createSubdividedSegment(segments, x, -halfDepth, x, halfDepth, options.verticalSubdivisions);
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
): WaveGridLayer {
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

export function updateWaveGridLayer(layer: WaveGridLayer, config: WaveGridConfig, elapsed: number) {
  const vertexCount = layer.seeds.length / 2;

  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const x = layer.seeds[vertexIndex * 2];
    const z = layer.seeds[vertexIndex * 2 + 1];
    const wave =
      Math.sin(
        x * config.waveFrequencyX +
          z * config.waveFrequencyZ +
          elapsed * config.waveSpeed +
          layer.phase,
      ) * layer.amplitude;
    layer.positions[vertexIndex * 3 + 1] = wave;
  }

  const position = layer.geometry.getAttribute('position');
  position.needsUpdate = true;
}

/** Builds the four-layer grid (base, emphasis, sage accent, taupe accent) for any grid size. */
export function createWaveGridLayers(
  THREE: ThreeModule,
  config: WaveGridConfig,
  palette: WaveGridPalette,
): WaveGridLayer[] {
  const emphasisRows = [0, fractionToIndex(0.5, config.rows), config.rows];
  const emphasisColumns = [0, fractionToIndex(0.5, config.columns), config.columns];
  const sageRow = fractionToIndex(0.66, config.rows);
  const taupeColumn = fractionToIndex(0.72, config.columns);

  const baseLayer = createLayer(
    THREE,
    createGridSegments(config, {
      horizontalSubdivisions: config.horizontalSubdivisions,
      verticalSubdivisions: config.verticalSubdivisions,
    }),
    palette.line2,
    0.46,
    config.amplitude,
    0,
  );
  const emphasisLayer = createLayer(
    THREE,
    createGridSegments(config, {
      rows: emphasisRows,
      columns: emphasisColumns,
      horizontalSubdivisions: config.horizontalSubdivisions,
      verticalSubdivisions: config.verticalSubdivisions,
    }),
    palette.line3,
    0.34,
    config.amplitude * 0.72,
    0.4,
  );
  const sageLayer = createLayer(
    THREE,
    createGridSegments(config, {
      rows: [sageRow],
      columns: [],
      horizontalSubdivisions: config.horizontalSubdivisions,
      verticalSubdivisions: config.verticalSubdivisions,
    }),
    palette.accent,
    0.58,
    config.accentAmplitude,
    1.2,
  );
  const taupeLayer = createLayer(
    THREE,
    createGridSegments(config, {
      rows: [],
      columns: [taupeColumn],
      horizontalSubdivisions: config.horizontalSubdivisions,
      verticalSubdivisions: config.verticalSubdivisions,
    }),
    palette.accentSecondary,
    0.5,
    config.accentAmplitude * 0.82,
    2.5,
  );

  return [baseLayer, emphasisLayer, sageLayer, taupeLayer];
}

export type WaveGridScene = {
  dispose: () => void;
};

/** Sets up a self-contained three.js scene rendering into `canvas`, sized to `container`. */
export function createWaveGridScene(
  THREE: ThreeModule,
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  config: WaveGridConfig,
  palette: WaveGridPalette,
): WaveGridScene {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(config.camera.fov, 1, config.camera.near, config.camera.far);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });

  renderer.setClearColor(new THREE.Color(palette.bg), 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  camera.position.set(config.camera.x, config.camera.y, config.camera.z);
  camera.lookAt(0, 0, 0);

  const layers = createWaveGridLayers(THREE, config, palette);
  for (const layer of layers) scene.add(layer.lines);

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let animationFrame = 0;
  const render = (now: number) => {
    for (const layer of layers) updateWaveGridLayer(layer, config, now);
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  };

  animationFrame = window.requestAnimationFrame(render);

  return {
    dispose: () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();

      for (const layer of layers) {
        scene.remove(layer.lines);
        layer.geometry.dispose();
        layer.material.dispose();
      }

      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
