import { describe, expect, it } from 'vitest';
import { deriveBuildingFootprints, getBuildingFrontageRotation } from './urbanForm';
import { createTile, TileType } from './types';

describe('urban building footprints', () => {
  it('groups mature adjacent parcels into one 2x2 render footprint', () => {
    const grid = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => createTile(x, y)),
    );
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < 2; x += 1) {
        grid[y][x] = createTile(x, y, {
          type: TileType.COMMERCIAL,
          level: 3,
          powered: true,
          watered: true,
        });
      }
    }

    const footprints = deriveBuildingFootprints(grid);
    expect(footprints.get('0,0')).toMatchObject({ width: 2, height: 2, centerX: 0.5, centerY: 0.5 });
    expect(footprints.get('1,1')).toEqual(footprints.get('0,0'));
  });

  it('does not merge abandoned or mismatched parcels', () => {
    const grid = Array.from({ length: 2 }, (_, y) =>
      Array.from({ length: 2 }, (_, x) => createTile(x, y, {
        type: TileType.RESIDENTIAL,
        level: 3,
        powered: true,
        watered: true,
        abandoned: x === 1,
      })),
    );
    const footprints = deriveBuildingFootprints(grid);
    expect(footprints.get('0,0')?.width).toBe(1);
    expect(footprints.get('1,0')).toBeUndefined();
  });

  it('creates a mixed-use block from commercial frontage and residential parcels', () => {
    const grid = Array.from({ length: 2 }, (_, y) =>
      Array.from({ length: 2 }, (_, x) => createTile(x, y, {
        type: y === 0 ? TileType.COMMERCIAL : TileType.RESIDENTIAL,
        level: 3,
        powered: true,
        watered: true,
      })),
    );

    const footprints = deriveBuildingFootprints(grid);
    expect(footprints.get('0,0')).toMatchObject({ width: 2, height: 2, mixedUse: true });
    expect(footprints.get('1,1')).toEqual(footprints.get('0,0'));
  });

  it('keeps mixed-use visual massing locked until the zoning tech or policy is active', () => {
    const grid = Array.from({ length: 2 }, (_, y) => Array.from({ length: 2 }, (_, x) => createTile(x, y, {
      type: y === 0 ? TileType.COMMERCIAL : TileType.RESIDENTIAL,
      level: 3,
      powered: true,
      watered: true,
    })));

    const footprints = deriveBuildingFootprints(grid, { allowMixedUse: false });

    expect(footprints.get('0,0')).toMatchObject({ width: 1, height: 1 });
    expect(footprints.get('1,0')).toMatchObject({ width: 1, height: 1 });
  });

  it('respects persistent parcel subdivision boundaries when deriving mature footprints', () => {
    const grid = Array.from({ length: 1 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y, {
      type: TileType.RESIDENTIAL,
      level: 3,
      powered: true,
      watered: true,
      parcelId: 'parcel-row-a',
      parcelWidth: 2,
      parcelHeight: 1,
    })));
    grid[0][2].parcelId = 'parcel-row-b';
    grid[0][2].parcelWidth = 1;
    grid[0][2].parcelHeight = 1;

    const footprints = deriveBuildingFootprints(grid);
    expect(footprints.get('0,0')).toMatchObject({ width: 2, height: 1 });
    expect(footprints.get('1,0')).toEqual(footprints.get('0,0'));
    expect(footprints.get('2,0')).toMatchObject({ width: 1, height: 1 });
  });

  it('orients modern lots toward their adjacent road frontage', () => {
    const grid = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
    grid[1][0] = createTile(0, 1, { type: TileType.ROAD });
    grid[1][2] = createTile(2, 1, { type: TileType.ROAD });

    expect(getBuildingFrontageRotation(grid[1][1], grid)).toBe(-Math.PI / 2);
  });
});
