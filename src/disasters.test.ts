import { describe, expect, it } from 'vitest';
import { simulateDisasters } from './disasters';
import { createTile, TileType } from './types';

function disasterGrid() {
  const grid = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => createTile(x, y, { resource: x < 3 ? 'forest' : 'none' })),
  );
  for (let y = 0; y < 8; y += 1) grid[y][6].water = true;
  grid[4][4] = createTile(4, 4, { type: TileType.ROAD, roadCondition: 100 });
  return grid;
}

describe('natural disaster simulation', () => {
  it('spawns deterministic disasters and damages/repairs roads', () => {
    const gridA = disasterGrid();
    const gridB = disasterGrid();
    const firstA = simulateDisasters(gridA, [], 10, 42, 100, 1);
    const firstB = simulateDisasters(gridB, [], 10, 42, 100, 1);
    expect(firstA.spawned[0]).toEqual(firstB.spawned[0]);
    expect(firstA.activeDisasters).toBe(1);
    const affected = gridA.flat().filter((tile) => (tile.disasterSeverity ?? 0) > 0);
    expect(affected.length).toBeGreaterThan(0);
  });

  it('resolves active disasters and restores road condition over time', () => {
    const grid = disasterGrid();
    const first = simulateDisasters(grid, [], 10, 42, 20, 1);
    const damagedCondition = grid[4][4].roadCondition ?? 100;
    const second = simulateDisasters(grid, first.disasters.map((d) => ({ ...d, remainingDays: 0.2 })), 11, 100, 100, 0);
    expect(second.activeDisasters).toBe(0);
    expect(second.resolved).toBe(1);
    expect(grid[4][4].roadCondition).toBeGreaterThanOrEqual(damagedCondition);
  });

  it('propagates floods through connected lowland tiles instead of a circular mask', () => {
    const grid = disasterGrid();
    const flood = {
      id: 'flood-lowland',
      type: 'FLOOD' as const,
      centerX: 5,
      centerY: 4,
      radius: 1,
      severity: 3 as const,
      createdDay: 1,
      remainingDays: 2,
      affectedTiles: 0,
    };

    const result = simulateDisasters(grid, [flood], 2, 99, 100, 0);

    expect(result.activeDisasters).toBe(1);
    expect(result.disasters[0]?.affectedTiles).toBeGreaterThan(3);
    expect(grid[4][3].disasterSeverity).toBeGreaterThan(0);
    expect(grid[4][4].roadCondition).toBeLessThan(100);
  });
});
