import { describe, expect, it } from 'vitest';
import { createEmptyGrid } from './engine';
import { simulateHydrology } from './hydrology';
import { TileType } from './types';

describe('surface hydrology', () => {
  it('propagates water into connected lowland cells and records flood metrics', () => {
    const grid = createEmptyGrid(8, 8);
    grid[3][3].water = true;
    grid[3][3].elevation = 2;
    grid[3][4].elevation = 1;
    grid[3][5].elevation = 0;
    grid[3][4].type = TileType.ROAD;

    const result = simulateHydrology(grid);

    expect(result.floodedTiles).toBeGreaterThan(0);
    expect(result.flowingTiles).toBeGreaterThan(0);
    expect(result.peakDepth).toBeGreaterThanOrEqual(0.48);
    expect(grid[3][4].waterDepth).toBeGreaterThanOrEqual(0.48);
    expect(Number.isFinite(result.averageDepth)).toBe(true);
  });

  it('does not cross a steep elevation barrier', () => {
    const grid = createEmptyGrid(8, 8);
    for (const row of grid) {
      for (const tile of row) tile.elevation = 3;
    }
    grid[3][3].water = true;
    grid[3][3].elevation = 1;

    const result = simulateHydrology(grid);

    expect(grid[3][4].waterDepth).toBe(0);
    expect(grid[3][5].waterDepth).toBe(0);
    expect(result.peakDepth).toBe(0);
  });

  it('lets parks absorb more runoff than an otherwise identical paved parcel', () => {
    const base = createEmptyGrid(8, 8);
    const green = createEmptyGrid(8, 8);
    for (const candidate of [base, green]) {
      candidate[3][3].water = true;
      candidate[3][3].elevation = 2;
      candidate[3][4].elevation = 1;
      candidate[3][5].elevation = 0;
    }
    green[3][4].type = TileType.PARK;

    const baseResult = simulateHydrology(base);
    const greenResult = simulateHydrology(green);

    expect(green[3][4].waterDepth ?? 0).toBeLessThan(base[3][4].waterDepth ?? 0);
    expect(greenResult.floodedTiles).toBeLessThanOrEqual(baseResult.floodedTiles);
  });

  it('uses flood barriers to block a flow corridor', () => {
    const grid = createEmptyGrid(8, 8);
    const unblocked = createEmptyGrid(8, 8);
    grid[3][3].water = true;
    grid[3][3].elevation = 2;
    grid[3][4].elevation = 1;
    grid[3][5].elevation = 0;
    grid[3][4].type = TileType.FLOOD_BARRIER;
    unblocked[3][3].water = true;
    unblocked[3][3].elevation = 2;
    unblocked[3][4].elevation = 1;
    unblocked[3][5].elevation = 0;

    const result = simulateHydrology(grid);
    const unblockedResult = simulateHydrology(unblocked);
    expect(result.floodBarrierCount).toBe(1);
    expect(grid[3][5].waterDepth).toBeLessThan(unblocked[3][5].waterDepth ?? 1);
    expect(result.floodedTiles).toBeLessThan(unblockedResult.floodedTiles);
  });

  it('stores incoming floodwater in a reservoir instead of propagating it downstream', () => {
    const grid = createEmptyGrid(8, 8);
    const unblocked = createEmptyGrid(8, 8);
    grid[3][3].water = true;
    grid[3][3].elevation = 2;
    grid[3][4].elevation = 1;
    grid[3][5].elevation = 0;
    grid[3][4].type = TileType.WATER_RESERVOIR;
    unblocked[3][3].water = true;
    unblocked[3][3].elevation = 2;
    unblocked[3][4].elevation = 1;
    unblocked[3][5].elevation = 0;

    const result = simulateHydrology(grid);
    simulateHydrology(unblocked);
    expect(result.reservoirStorage).toBeGreaterThan(0);
    expect(grid[3][4].reservoirLevel).toBeGreaterThan(0);
    expect(grid[3][5].waterDepth).toBeLessThan(unblocked[3][5].waterDepth ?? 1);
  });
});
