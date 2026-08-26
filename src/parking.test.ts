import { describe, expect, it } from 'vitest';
import { createTile, TileType } from './types';
import { hasNearbyParking, simulateParking } from './parking';

describe('parking supply and curb pressure', () => {
  it('matches finite parking lots to nearby activity demand', () => {
    const grid = Array.from({ length: 5 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => createTile(x, y)),
    );
    grid[2][2] = createTile(2, 2, { type: TileType.COMMERCIAL, jobs: 40 });
    grid[2][3] = createTile(3, 2, { type: TileType.PARKING });

    const metrics = simulateParking(grid);

    expect(metrics.demand).toBe(16.8);
    expect(metrics.supply).toBe(24);
    expect(metrics.coverage).toBe(100);
    expect(metrics.pressure).toBe(0.7);
    expect(hasNearbyParking(grid, 2, 2)).toBe(true);
  });

  it('reports unmet pressure when activity has no parking within the walk catchment', () => {
    const grid = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => createTile(x, y)),
    );
    grid[1][1] = createTile(1, 1, { type: TileType.RESIDENTIAL, population: 100 });

    const metrics = simulateParking(grid);

    expect(metrics.supply).toBe(0);
    expect(metrics.coverage).toBe(0);
    expect(metrics.pressure).toBe(2);
    expect(hasNearbyParking(grid, 1, 1)).toBe(false);
  });
});
