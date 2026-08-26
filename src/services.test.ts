import { describe, expect, it } from 'vitest';
import { createTile, TileType } from './types';
import { buildRoadGraph } from './traffic';
import { simulateCityServices } from './services';

describe('service response telemetry', () => {
  it('writes deterministic response minutes for covered buildings', () => {
    const grid = Array.from({ length: 4 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
    grid[0][1] = createTile(1, 0, { type: TileType.ROAD });
    grid[1][1] = createTile(1, 1, { type: TileType.FIRE_STATION, powered: true });
    grid[2][1] = createTile(1, 2, { type: TileType.ROAD });
    grid[3][1] = createTile(1, 3, { type: TileType.RESIDENTIAL, population: 10, powered: true });
    const roadGraph = buildRoadGraph(grid);
    const result = simulateCityServices(grid, roadGraph, 10, 5, 50, 5, 9, []);

    expect(result.fireSafety).toBeGreaterThan(0);
    expect(grid[3][1].fireCovered).toBe(true);
    expect(grid[3][1].serviceResponseTimes?.fire).toBeGreaterThan(0);
    expect(grid[3][1].serviceResponseTimes?.fire).toBeLessThan(10);
  });
});
