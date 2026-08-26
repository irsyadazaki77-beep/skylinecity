import { describe, expect, it } from 'vitest';
import { applyTerrainTool, getTerrainBrushTiles } from './terrain';
import { createTile } from './types';

function terrainGrid(size = 5) {
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => createTile(x, y, { elevation: 2 })),
  );
}

describe('terraforming tools', () => {
  it('raises and lowers a bounded brush while ignoring water', () => {
    const grid = terrainGrid();
    grid[2][2].water = true;
    expect(getTerrainBrushTiles(2, 2, 2, 5, 5)).toHaveLength(9);
    expect(applyTerrainTool(grid, 1, 1, 'RAISE_TERRAIN', 2)).toBe(8);
    expect(grid[1][1].elevation).toBe(3);
    expect(applyTerrainTool(grid, 1, 1, 'LOWER_TERRAIN', 2)).toBe(8);
    expect(grid[1][1].elevation).toBe(2);
  });

  it('levels and smooths from a stable source snapshot', () => {
    const grid = terrainGrid();
    grid[1][1].elevation = 1;
    grid[1][2].elevation = 5;
    grid[2][1].elevation = 5;
    expect(applyTerrainTool(grid, 1, 1, 'LEVEL_TERRAIN', 2)).toBe(8);
    expect(new Set(grid.slice(0, 3).flat().map((tile) => tile.elevation)).size).toBeGreaterThan(1);
    expect(applyTerrainTool(grid, 2, 2, 'SMOOTH_TERRAIN', 1)).toBe(0);
    expect(grid[2][2].elevation).toBe(1);
  });
});
