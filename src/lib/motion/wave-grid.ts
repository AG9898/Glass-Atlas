import { canUseSpatialMotion, type MotionPreferenceWindow } from './preferences';

export type WaveGridPaletteKey =
  | 'bg'
  | 'surface1'
  | 'surface2'
  | 'line1'
  | 'line2'
  | 'line3'
  | 'accent'
  | 'accentSecondary';

export type WaveGridPalette = Record<WaveGridPaletteKey, string>;

export type WaveGridPaletteDocument = {
  documentElement: object;
};

export type WaveGridStyleDeclaration = Pick<CSSStyleDeclaration, 'getPropertyValue'>;

export type WaveGridStyleReader = (
  element: WaveGridPaletteDocument['documentElement'],
) => WaveGridStyleDeclaration;

export const WAVE_GRID_PALETTE_TOKENS = {
  bg: '--color-bg',
  surface1: '--color-surface-1',
  surface2: '--color-surface-2',
  line1: '--color-line-1',
  line2: '--color-line-2',
  line3: '--color-line-3',
  accent: '--color-accent-500',
  accentSecondary: '--color-accent2-500',
} as const satisfies Record<WaveGridPaletteKey, string>;

export const WAVE_GRID_PALETTE_FALLBACKS = {
  bg: '#F5F1EA',
  surface1: '#F5F1EA',
  surface2: '#F5F1EA',
  line1: '#D0CAC0',
  line2: '#9F988D',
  line3: '#2A2824',
  accent: '#93B184',
  accentSecondary: '#BBA079',
} as const satisfies WaveGridPalette;

export const WAVE_GRID_CONFIG = {
  columns: 18,
  rows: 9,
  width: 18,
  depth: 8.4,
  horizontalSubdivisions: 28,
  verticalSubdivisions: 14,
  amplitude: 0.34,
  accentAmplitude: 0.46,
  waveFrequencyX: 0.58,
  waveFrequencyZ: 0.78,
  waveSpeed: 0.00038,
  camera: {
    fov: 42,
    near: 0.1,
    far: 60,
    x: 0,
    y: 5.1,
    z: 9.2,
  },
} as const;

function getDefaultDocument(): WaveGridPaletteDocument | undefined {
  return typeof document === 'undefined' ? undefined : document;
}

function getDefaultStyleReader(): WaveGridStyleReader | undefined {
  if (typeof getComputedStyle === 'undefined') return undefined;

  return (element) => getComputedStyle(element as Element);
}

export function resolveWaveGridPalette(
  targetDocument = getDefaultDocument(),
  readComputedStyle = getDefaultStyleReader(),
): WaveGridPalette {
  let styles: WaveGridStyleDeclaration | undefined;

  if (targetDocument && readComputedStyle) {
    try {
      styles = readComputedStyle(targetDocument.documentElement);
    } catch {
      styles = undefined;
    }
  }

  const readToken = (key: WaveGridPaletteKey) => {
    if (!styles) return WAVE_GRID_PALETTE_FALLBACKS[key];

    const value = styles.getPropertyValue(WAVE_GRID_PALETTE_TOKENS[key]).trim();
    return value || WAVE_GRID_PALETTE_FALLBACKS[key];
  };

  return {
    bg: readToken('bg'),
    surface1: readToken('surface1'),
    surface2: readToken('surface2'),
    line1: readToken('line1'),
    line2: readToken('line2'),
    line3: readToken('line3'),
    accent: readToken('accent'),
    accentSecondary: readToken('accentSecondary'),
  };
}

export function shouldUseWaveGridMotion(targetWindow?: MotionPreferenceWindow): boolean {
  return canUseSpatialMotion(targetWindow);
}
