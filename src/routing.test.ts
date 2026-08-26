import { describe, expect, it } from 'vitest';
import { findRoadPath } from './citizenSimulation/trips';
import { buildRoadGraph } from './traffic';
import { createTile, TileType } from './types';

describe('weighted citizen routing', () => {
  it('chooses a slightly longer high-speed route over a slower local shortcut', () => {
    const grid = Array.from({ length: 2 }, (_, y) =>
      Array.from({ length: 9 }, (_, x) => createTile(x, y)),
    );
    for (let x = 0; x < 9; x += 1) {
      grid[1][x] = createTile(x, 1, { type: TileType.ROAD, roadClass: 'LOCAL' });
      grid[0][x] = createTile(x, 0, { type: TileType.ROAD, roadClass: 'HIGHWAY' });
    }

    const path = findRoadPath('0,1', '8,1', buildRoadGraph(grid));

    expect(path.some(([, y]) => y === 0)).toBe(true);
    expect(path[0]).toEqual([0, 1]);
    expect(path[path.length - 1]).toEqual([8, 1]);
  });

  it('avoids a congested highway corridor when the local route becomes faster', () => {
    const grid = Array.from({ length: 2 }, (_, y) =>
      Array.from({ length: 9 }, (_, x) => createTile(x, y)),
    );
    for (let x = 0; x < 9; x += 1) {
      grid[1][x] = createTile(x, 1, { type: TileType.ROAD, roadClass: 'LOCAL' });
      grid[0][x] = createTile(x, 0, { type: TileType.ROAD, roadClass: 'HIGHWAY', traffic: 100 });
    }

    const path = findRoadPath('0,1', '8,1', buildRoadGraph(grid));

    expect(path.every(([, y]) => y === 1)).toBe(true);
  });

  it('uses accumulated assignment demand to spread cars across parallel corridors', () => {
    const grid = Array.from({ length: 2 }, (_, y) =>
      Array.from({ length: 9 }, (_, x) => createTile(x, y)),
    );
    for (let x = 0; x < 9; x += 1) {
      grid[1][x] = createTile(x, 1, { type: TileType.ROAD, roadClass: 'LOCAL' });
      grid[0][x] = createTile(x, 0, { type: TileType.ROAD, roadClass: 'HIGHWAY' });
    }
    const assignmentLoads = new Map<string, number>();
    for (let x = 0; x < 9; x += 1) assignmentLoads.set(`${x},0`, 160);

    const path = findRoadPath('0,1', '8,1', buildRoadGraph(grid), assignmentLoads);

    expect(path.every(([, y]) => y === 1)).toBe(true);
  });

  it('accounts for steep elevation changes while keeping bridge transitions usable', () => {
    const grid = Array.from({ length: 2 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => createTile(x, y)),
    );
    for (let x = 0; x < 5; x += 1) {
      grid[0][x] = createTile(x, 0, { type: TileType.ROAD, roadClass: 'LOCAL', elevation: x === 2 ? 8 : 1 });
      grid[1][x] = createTile(x, 1, { type: TileType.ROAD, roadClass: 'HIGHWAY', elevation: 1 });
    }
    const path = findRoadPath('0,0', '4,0', buildRoadGraph(grid));
    expect(path.some(([, y]) => y === 1)).toBe(true);
  });
});
