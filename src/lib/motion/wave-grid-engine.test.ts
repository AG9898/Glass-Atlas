import { describe, expect, test } from 'vitest';
import { createGridSegments } from './wave-grid-engine';
import { WAVE_GRID_COMPACT_CONFIG, WAVE_GRID_OVERLAY_CONFIG } from './wave-grid';

describe('createGridSegments', () => {
  test('produces one subdivided line per row/column at the requested density', () => {
    const config = WAVE_GRID_OVERLAY_CONFIG;
    const segments = createGridSegments(config, {
      horizontalSubdivisions: config.horizontalSubdivisions,
      verticalSubdivisions: config.verticalSubdivisions,
    });

    const expectedRowSegments = (config.rows + 1) * config.horizontalSubdivisions;
    const expectedColumnSegments = (config.columns + 1) * config.verticalSubdivisions;
    expect(segments).toHaveLength(expectedRowSegments + expectedColumnSegments);
  });

  test('scales down cleanly for the compact (small grid) config', () => {
    const config = WAVE_GRID_COMPACT_CONFIG;
    const segments = createGridSegments(config, {
      horizontalSubdivisions: config.horizontalSubdivisions,
      verticalSubdivisions: config.verticalSubdivisions,
    });

    const expectedRowSegments = (config.rows + 1) * config.horizontalSubdivisions;
    const expectedColumnSegments = (config.columns + 1) * config.verticalSubdivisions;
    expect(segments).toHaveLength(expectedRowSegments + expectedColumnSegments);
  });

  test('respects explicit row/column subsets used by the emphasis/accent layers', () => {
    const config = WAVE_GRID_OVERLAY_CONFIG;
    const segments = createGridSegments(config, {
      rows: [0, 4],
      columns: [],
      horizontalSubdivisions: 3,
      verticalSubdivisions: 3,
    });

    expect(segments).toHaveLength(2 * 3);
  });

  test('keeps every generated point within the configured width/depth bounds', () => {
    const config = WAVE_GRID_COMPACT_CONFIG;
    const segments = createGridSegments(config, {
      horizontalSubdivisions: config.horizontalSubdivisions,
      verticalSubdivisions: config.verticalSubdivisions,
    });

    const halfWidth = config.width / 2;
    const halfDepth = config.depth / 2;

    for (const [fromX, fromZ, toX, toZ] of segments) {
      for (const x of [fromX, toX]) {
        expect(x).toBeGreaterThanOrEqual(-halfWidth - 1e-9);
        expect(x).toBeLessThanOrEqual(halfWidth + 1e-9);
      }
      for (const z of [fromZ, toZ]) {
        expect(z).toBeGreaterThanOrEqual(-halfDepth - 1e-9);
        expect(z).toBeLessThanOrEqual(halfDepth + 1e-9);
      }
    }
  });
});
