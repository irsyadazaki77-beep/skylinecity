import { describe, expect, it } from 'vitest';
import { createTile, TileType } from './types';
import { evaluateBuildingEvolution } from './buildingEvolution';

function context(grid: ReturnType<typeof createTile>[][]) {
  return {
    grid,
    unlockedUpgrades: ['high_dens_res'],
    residentialDemand: 25,
    commercialDemand: 10,
    officeDemand: 10,
    industrialDemand: 10,
  };
}

describe('evaluateBuildingEvolution', () => {
  it('reports a level-up-ready residential lot from the actual requirements', () => {
    const grid = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
    grid[1][1] = createTile(1, 1, {
      type: TileType.RESIDENTIAL,
      population: 4,
      powered: true,
      watered: true,
      landValue: 40,
      suitability: 60,
      fireCovered: true,
    });
    grid[1][2] = createTile(2, 1, { type: TileType.ROAD });

    const summary = evaluateBuildingEvolution(grid[1][1], context(grid));
    expect(summary?.nextLevel).toBe(2);
    expect(summary?.status).toBe('READY');
    expect(summary?.blockers).toEqual([]);
    expect(summary?.occupancyPercent).toBe(100);
  });

  it('prioritizes missing access and reports demand/occupancy blockers', () => {
    const grid = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
    grid[1][1] = createTile(1, 1, { type: TileType.COMMERCIAL, powered: true, watered: true });
    const summary = evaluateBuildingEvolution(grid[1][1], { ...context(grid), commercialDemand: -20 });
    expect(summary?.status).toBe('INACTIVE');
    expect(summary?.blockers[0]).toContain('frontage');
    expect(summary?.blockers.some((reason) => reason.includes('Occupancy'))).toBe(true);
    expect(summary?.blockers.some((reason) => reason.includes('Demand sektor'))).toBe(true);
  });

  it('distinguishes a locked maximum from the true level-5 maximum', () => {
    const grid = Array.from({ length: 1 }, (_, y) => Array.from({ length: 2 }, (_, x) => createTile(x, y)));
    grid[0][0] = createTile(0, 0, { type: TileType.INDUSTRIAL, level: 2, powered: true, watered: true });
    grid[0][1] = createTile(1, 0, { type: TileType.ROAD });

    const locked = evaluateBuildingEvolution(grid[0][0], context(grid));
    expect(locked?.status).toBe('MAX_LEVEL');
    expect(locked?.nextLevel).toBeNull();
    expect(locked?.blockers[0]).toContain('upgrade');

    const unlocked = evaluateBuildingEvolution(grid[0][0], { ...context(grid), unlockedUpgrades: ['sky_permits'] });
    expect(unlocked?.nextLevel).toBe(3);
  });
});
