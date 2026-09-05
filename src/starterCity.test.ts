import { describe, expect, it } from 'vitest';
import { buildRoadGraph, getAdjacentRoadNodeKey } from './traffic';
import { createStarterGrid } from './starterCity';
import { createBenchmarkState } from './metropolisBenchmarks';
import { simulateTick } from './engine';
import { TileType } from './types';
import { computeRoadRecommendations } from './tutorialPathfinder';
import { hasLocalHighwayConnection } from './tutorialFlow';

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

  it('leaves exactly one clear first-action gap to the regional highway', () => {
    const grid = createStarterGrid();
    const recommendation = computeRoadRecommendations(grid, ['1,1']);
    expect(hasLocalHighwayConnection(grid)).toBe(false);
    expect(recommendation.bestPath).toHaveLength(1);
    const [x, y] = recommendation.bestPath[0];
    expect(grid[y][x].type).toBe(TileType.EMPTY);
    expect(grid[y][x].water).toBe(false);
  });

  it('maintains economic stability and survival at 10, 30, 60, and 90 days', async () => {
    const { runBalanceScenario } = await import('./balanceScenarioRunner');
    const report = runBalanceScenario('SMALL_TOWN', 90);

    const sampleDay10 = report.samples.find((s) => s.day === 10);
    const sampleDay30 = report.samples.find((s) => s.day === 30);
    const sampleDay60 = report.samples.find((s) => s.day === 60);
    const sampleDay90 = report.samples.find((s) => s.day === 90);

    expect(sampleDay10).toBeDefined();
    expect(sampleDay10!.population).toBeGreaterThanOrEqual(15);
    expect(sampleDay10!.money).toBeGreaterThan(7000);
    expect(sampleDay10!.happiness).toBeGreaterThan(45);

    expect(sampleDay30).toBeDefined();
    expect(sampleDay30!.population).toBeGreaterThanOrEqual(15);
    expect(sampleDay30!.money).toBeGreaterThan(6000);
    expect(sampleDay30!.happiness).toBeGreaterThan(45);

    expect(sampleDay60).toBeDefined();
    expect(sampleDay60!.population).toBeGreaterThanOrEqual(15);
    expect(sampleDay60!.money).toBeGreaterThan(4000);
    expect(sampleDay60!.happiness).toBeGreaterThan(45);

    expect(sampleDay90).toBeDefined();
    expect(sampleDay90!.population).toBeGreaterThanOrEqual(15);
    expect(sampleDay90!.money).toBeGreaterThan(3000);
    expect(sampleDay90!.happiness).toBeGreaterThan(45);

    expect(report.bankruptcyDays).toBe(0);
    expect(report.minMoney).toBeGreaterThan(3000);
  }, 15000);

  it('has explicit starter acceptance checkpoints at days 1, 5, 10, 15, 30, and 90', () => {
    let state = createBenchmarkState('SMALL_TOWN', 2088);
    const checkpoints = new Map<number, typeof state>();
    for (let index = 0; index < 90; index += 1) {
      if ([1, 5, 10, 15, 30, 90].includes(state.day)) checkpoints.set(state.day, state);
      state = simulateTick(state);
    }
    if ([1, 5, 10, 15, 30, 90].includes(state.day)) checkpoints.set(state.day, state);

    for (const day of [1, 5, 10, 15, 30, 90]) {
      const sample = checkpoints.get(day);
      expect(sample, `missing starter checkpoint day ${day}`).toBeDefined();
      expect(sample!.money).toBeGreaterThan(0);
      expect(sample!.happiness).toBeGreaterThan(40);
    }
    expect(checkpoints.get(1)!.money).toBe(8000);
    expect(checkpoints.get(5)!.population).toBeGreaterThanOrEqual(5);
    expect(checkpoints.get(10)!.population).toBeGreaterThanOrEqual(15);
    expect(checkpoints.get(15)!.population).toBeGreaterThanOrEqual(15);
    expect(checkpoints.get(30)!.money).toBeGreaterThan(6000);
    expect(checkpoints.get(90)!.money).toBeGreaterThan(3000);
  }, 15000);
});
