import { describe, expect, it } from 'vitest';
import { reconcileParcels } from './parcels';
import { createTile, TileType } from './types';

function residentialGrid(width = 4, height = 4) {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => createTile(x, y, {
    type: TileType.RESIDENTIAL,
    powered: true,
    watered: true,
  })));
}

describe('persistent parcel ownership and subdivision', () => {
  it('creates deterministic multi-tile subdivisions instead of anonymous cells', () => {
    const grid = residentialGrid();
    const first = reconcileParcels(grid);
    const ids = new Set(grid.flat().map((tile) => tile.parcelId));

    expect(first.parcelCount).toBe(ids.size);
    expect(first.parcelCount).toBeLessThan(16);
    expect(first.averageParcelSize).toBeGreaterThan(1);
    expect(grid.flat().every((tile) => tile.parcelWidth && tile.parcelHeight && tile.parcelSeed !== undefined)).toBe(true);

    const before = grid.map((row) => row.map((tile) => ({ id: tile.parcelId, seed: tile.parcelSeed, width: tile.parcelWidth, height: tile.parcelHeight })));
    const second = reconcileParcels(grid);
    expect(second).toEqual(first);
    expect(grid.map((row) => row.map((tile) => ({ id: tile.parcelId, seed: tile.parcelSeed, width: tile.parcelWidth, height: tile.parcelHeight })))).toEqual(before);
  });

  it('promotes a developed lot to private ownership without reshuffling its subdivision', () => {
    const grid = residentialGrid(2, 2);
    reconcileParcels(grid);
    const parcelId = grid[0][0].parcelId;
    const shape = { width: grid[0][0].parcelWidth, height: grid[0][0].parcelHeight };
    grid[0][0].population = 4;
    grid[0][0].level = 2;

    const result = reconcileParcels(grid);
    expect(result.privateParcelCount).toBeGreaterThan(0);
    expect(grid[0][0].parcelId).toBe(parcelId);
    expect(grid[0][0].parcelOwnership).toBe('PRIVATE');
    expect(grid[0][0].parcelStatus).toBe('ACTIVE');
    expect(grid[0][0].parcelWidth).toBe(shape.width);
    expect(grid[0][0].parcelHeight).toBe(shape.height);
  });
});
