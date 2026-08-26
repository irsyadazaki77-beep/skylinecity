import { describe, expect, it } from 'vitest';
import { mixedUseJobCapacityMultiplier, mixedUseRevenueMultiplier, reconcileMixedUsePrograms } from './mixedUse';
import { createTile, TileType } from './types';

function mixedUseGrid() {
  return [
    [
      createTile(0, 0, { type: TileType.COMMERCIAL, level: 3, powered: true, watered: true, parcelSeed: 13 }),
      createTile(1, 0, { type: TileType.COMMERCIAL, level: 3, powered: true, watered: true }),
    ],
    [
      createTile(0, 1, { type: TileType.RESIDENTIAL, level: 3, powered: true, watered: true }),
      createTile(1, 1, { type: TileType.RESIDENTIAL, level: 3, powered: true, watered: true }),
    ],
  ];
}

describe('mixed-use floor programs', () => {
  it('assigns a deterministic program and floor mix to an eligible block', () => {
    const grid = mixedUseGrid();
    const result = reconcileMixedUsePrograms(grid, { enabled: true });

    expect(result.mixedUseBlocks).toBe(1);
    expect(result.mixedUseFloorArea).toBeGreaterThan(0);
    expect(grid[0][0].mixedUseProgram).toBe('CREATIVE_OFFICE');
    expect(grid[0][0].mixedUseOfficeFloors).toBe(2);
    expect(grid[0][0].mixedUseResidentialFloors).toBeGreaterThan(0);
    expect(mixedUseJobCapacityMultiplier(grid[0][0])).toBeGreaterThan(1);
    expect(mixedUseRevenueMultiplier(grid[0][0])).toBeGreaterThan(1);
  });

  it('clears programs when a district/policy no longer permits mixed use', () => {
    const grid = mixedUseGrid();
    reconcileMixedUsePrograms(grid, { enabled: true });
    const result = reconcileMixedUsePrograms(grid, { enabled: false });

    expect(result.mixedUseBlocks).toBe(0);
    expect(grid.flat().every((tile) => tile.mixedUseProgram === undefined)).toBe(true);
  });
});
