import { describe, expect, test, vi } from 'vitest';
import {
  canUseSpatialMotion,
  prefersReducedMotion,
  REDUCED_MOTION_QUERY,
  type MotionPreferenceWindow,
} from './preferences';
import {
  resolveWaveGridPalette,
  shouldUseWaveGridMotion,
  WAVE_GRID_PALETTE_FALLBACKS,
  WAVE_GRID_PALETTE_TOKENS,
  type WaveGridPaletteDocument,
  type WaveGridStyleDeclaration,
} from './wave-grid';

function createMotionWindow(matches: boolean): MotionPreferenceWindow {
  return {
    matchMedia: (query: string) =>
      ({
        media: query,
        matches,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      }) satisfies MediaQueryList,
  };
}

function createPaletteDocument(): WaveGridPaletteDocument {
  return {
    documentElement: {},
  };
}

function createStyleDeclaration(values: Record<string, string>): WaveGridStyleDeclaration {
  return {
    getPropertyValue: (name: string) => values[name] ?? '',
  };
}

describe('wave grid motion config', () => {
  test('uses the shared reduced-motion gate for motion availability', () => {
    expect(prefersReducedMotion(undefined)).toBe(true);
    expect(canUseSpatialMotion(undefined)).toBe(false);
    expect(shouldUseWaveGridMotion(undefined)).toBe(false);

    const reducedWindow = createMotionWindow(true);
    expect(prefersReducedMotion(reducedWindow)).toBe(true);
    expect(canUseSpatialMotion(reducedWindow)).toBe(false);
    expect(shouldUseWaveGridMotion(reducedWindow)).toBe(false);

    const motionWindow = createMotionWindow(false);
    expect(prefersReducedMotion(motionWindow)).toBe(false);
    expect(canUseSpatialMotion(motionWindow)).toBe(true);
    expect(shouldUseWaveGridMotion(motionWindow)).toBe(true);
  });

  test('keeps the canonical reduced-motion query in the gating path', () => {
    const targetWindow = createMotionWindow(false);

    shouldUseWaveGridMotion(targetWindow);

    expect(targetWindow.matchMedia(REDUCED_MOTION_QUERY).media).toBe(REDUCED_MOTION_QUERY);
  });

  test('falls back to the light-mode palette without a browser document', () => {
    expect(resolveWaveGridPalette(undefined, undefined)).toEqual(WAVE_GRID_PALETTE_FALLBACKS);
  });

  test('reads and trims CSS custom properties from an injected document', () => {
    const targetDocument = createPaletteDocument();
    const readComputedStyle = vi.fn(() =>
      createStyleDeclaration({
        [WAVE_GRID_PALETTE_TOKENS.bg]: ' #fffaf1 ',
        [WAVE_GRID_PALETTE_TOKENS.surface1]: ' #f6f0e8 ',
        [WAVE_GRID_PALETTE_TOKENS.surface2]: ' #ece3d8 ',
        [WAVE_GRID_PALETTE_TOKENS.line1]: ' #ddd5ca ',
        [WAVE_GRID_PALETTE_TOKENS.line2]: ' #aaa196 ',
        [WAVE_GRID_PALETTE_TOKENS.line3]: ' #2f2c28 ',
        [WAVE_GRID_PALETTE_TOKENS.accent]: ' #93b184 ',
        [WAVE_GRID_PALETTE_TOKENS.accentSecondary]: ' #bba079 ',
      }),
    );

    expect(resolveWaveGridPalette(targetDocument, readComputedStyle)).toEqual({
      bg: '#fffaf1',
      surface1: '#f6f0e8',
      surface2: '#ece3d8',
      line1: '#ddd5ca',
      line2: '#aaa196',
      line3: '#2f2c28',
      accent: '#93b184',
      accentSecondary: '#bba079',
    });
    expect(readComputedStyle).toHaveBeenCalledWith(targetDocument.documentElement);
  });

  test('falls back per token when a CSS custom property is empty', () => {
    const targetDocument = createPaletteDocument();
    const readComputedStyle = () =>
      createStyleDeclaration({
        [WAVE_GRID_PALETTE_TOKENS.bg]: '#faf7ef',
        [WAVE_GRID_PALETTE_TOKENS.line2]: '   ',
      });

    expect(resolveWaveGridPalette(targetDocument, readComputedStyle)).toEqual({
      ...WAVE_GRID_PALETTE_FALLBACKS,
      bg: '#faf7ef',
    });
  });
});
