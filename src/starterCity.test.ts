import { describe, expect, it } from 'vitest';
import { buildRoadGraph, getAdjacentRoadNodeKey } from './traffic';
import { createStarterGrid } from './starterCity';
import { TileType } from './types';

describe('starter city layout', () => {
  it('places all required starter infrastructure on land', () => {
    const grid = createStarterGrid();
    const tiles = grid.flat();

    expect(tiles.filter((tile) => tile.type === TileType.POWER_PLANT)).toHaveLength(1);
    expect(tiles.filter((tile) => tile.type === TileType.WATER_PUMP)).toHaveLength(1);
    expect(tiles.filter((tile) => tile.type === TileType.RESIDENTIAL)).toHaveLength(2);
    expect(tiles.filter((tile) => tile.type === TileType.COMMERCIAL)).toHaveLength(1);
    expect(tiles.filter((tile) => tile.type === TileType.INDUSTRIAL)).toHaveLength(1);

    for (const tile of tiles.filter((candidate) => [
      TileType.POWER_PLANT,
      TileType.WATER_PUMP,
      TileType.RESIDENTIAL,
      TileType.COMMERCIAL,
      TileType.INDUSTRIAL,
    ].includes(candidate.type))) {
      expect(tile.water).toBe(false);
    }
  });

  it('connects starter buildings to the road network and water pump to water', () => {
    const grid = createStarterGrid();
    const roadGraph = buildRoadGraph(grid);
    const tiles = grid.flat();

    for (const tile of tiles.filter((candidate) => candidate.type !== TileType.EMPTY && candidate.type !== TileType.ROAD && !candidate.water)) {
      expect(getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph)).not.toBeNull();
    }

    const pump = tiles.find((tile) => tile.type === TileType.WATER_PUMP)!;
    const touchesWater = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => grid[pump.y + dy]?.[pump.x + dx]?.water);
    expect(touchesWater).toBe(true);
  });
});
