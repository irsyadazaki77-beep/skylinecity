import { describe, expect, it } from 'vitest';
import { createEmptyGrid } from './engine';
import { TileType } from './types';
import { aggregateHomeSatisfaction, getOverlayColor } from './overlayModel';
import { get2DOverlayColor } from './components/world/City2DCanvas';

describe('Service overlay telemetry', () => {
  it('uses resident-weighted household satisfaction instead of occupancy', () => {
    const values = aggregateHomeSatisfaction([
      { residence: { x: 0, y: 0 }, citizenIds: ['a'], satisfaction: 100 },
      { residence: { x: 0, y: 0 }, citizenIds: ['b', 'c', 'd'], satisfaction: 0 },
    ]);
    expect(values['0,0']).toBe(25);
    const tile = createEmptyGrid(1, 1)[0][0];
    tile.type = TileType.RESIDENTIAL;
    tile.population = 4;
    expect(getOverlayColor(tile, 'HAPPINESS', [], values)).toBe('#ef4444');
    expect(get2DOverlayColor(tile, 'HAPPINESS', values)).toBe('#ef4444');
    expect(getOverlayColor(tile, 'HAPPINESS', [])).toBe('#64748b');
  });
  it.each(['WASTE', 'HEALTH', 'FIRE'] as const)('%s shows actual coverage in both renderers', (overlay) => {
    const tile = createEmptyGrid(1, 1)[0][0];
    tile.type = TileType.RESIDENTIAL;
    expect(getOverlayColor(tile, overlay, [])).toBe('#ef4444');
    tile.wasteCovered = tile.healthCovered = tile.fireCovered = true;
    expect(getOverlayColor(tile, overlay, [])).toBe('#22c55e');
    expect(get2DOverlayColor(tile, overlay)).toBe(getOverlayColor(tile, overlay, []));
    tile.type = TileType.ROAD;
    expect(getOverlayColor(tile, overlay, [])).toBeNull();
  });
  it('distinguishes noise severity and preserves zero land value', () => {
    const tile = createEmptyGrid(1, 1)[0][0];
    tile.type = TileType.RESIDENTIAL;
    tile.noise = 80;
    expect(getOverlayColor(tile, 'NOISE', [])).toBe('#ef4444');
    tile.noise = 40;
    expect(getOverlayColor(tile, 'NOISE', [])).toBe('#eab308');
    tile.landValue = 0;
    expect(getOverlayColor(tile, 'LAND_VALUE', [])).toBe('#64748b');
  });
});
