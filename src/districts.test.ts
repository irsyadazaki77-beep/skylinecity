import { describe, expect, it } from 'vitest';
import { applyDistrictEffects, createDistrict, getDistrictAt, getDistrictTileSet } from './districts';
import { createTile, TileType } from './types';

function makeGrid() {
  return Array.from({ length: 9 }, (_, y) => Array.from({ length: 9 }, (_, x) => createTile(x, y)));
}

describe('spatial district gameplay', () => {
  it('creates a bounded non-water district around a chosen center', () => {
    const grid = makeGrid();
    grid[4][5] = createTile(5, 4, { water: true });
    const district = createDistrict(grid, [4, 4], {
      id: 'district-1',
      name: 'Riverside Quarter',
      policy: 'GREEN',
      radius: 3,
      createdDay: 2,
    });

    expect(district.tiles.length).toBe(24);
    expect(getDistrictAt([district], 4, 4)?.name).toBe('Riverside Quarter');
    expect(getDistrictAt([district], 5, 4)).toBeUndefined();
  });

  it('applies local policy effects to buildings and exposes policy bonuses', () => {
    const grid = makeGrid();
    grid[4][4] = createTile(4, 4, {
      type: TileType.RESIDENTIAL,
      pollution: 50,
      noise: 40,
      landValue: 30,
      powered: true,
      watered: true,
    });
    const district = createDistrict(grid, [4, 4], {
      id: 'district-green',
      name: 'Green Quarter',
      policy: 'GREEN',
      radius: 2,
      createdDay: 1,
    });
    const effects = applyDistrictEffects(grid, [district]);

    expect(grid[4][4].pollution).toBeLessThan(50);
    expect(grid[4][4].noise).toBeLessThan(40);
    expect(grid[4][4].landValue).toBeGreaterThan(30);
    expect(effects.greenDistrictCount).toBe(1);
    expect(effects.residentialDemandBonus).toBeGreaterThan(0);
  });

  it('keeps mixed-use policy spatially scoped', () => {
    const grid = makeGrid();
    const district = createDistrict(grid, [2, 2], {
      id: 'district-mixed',
      name: 'Civic Core',
      policy: 'MIXED_USE',
      radius: 2,
      createdDay: 1,
    });
    const tiles = getDistrictTileSet([district], 'MIXED_USE');

    expect(tiles.has('2,2')).toBe(true);
    expect(tiles.has('8,8')).toBe(false);
  });
});
