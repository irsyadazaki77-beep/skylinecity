import { describe, expect, it } from 'vitest';
import { createEmptyGrid } from './engine';
import { TileType } from './types';
import {
  calculateFramedFocus,
  computeRoadRecommendations,
  computeUtilityRecommendations,
  computeZoningRecommendations,
} from './tutorialPathfinder';

describe('tutorialPathfinder', () => {
  it('calculates framed focus keeping both settlement and target in visual frame', () => {
    const settlement: [number, number] = [35, 25];
    const highwayTarget: [number, number] = [35, 30];
    const framed = calculateFramedFocus(highwayTarget, settlement, 0.6);

    // Midpoint weighted toward target
    expect(framed[0]).toBe(35);
    expect(framed[1]).toBe(28); // between 25 and 30
    expect(framed[1]).toBeGreaterThan(settlement[1]);
    expect(framed[1]).toBeLessThan(highwayTarget[1]);
  });

  it('computes shortest road corridor to connect settlement with highway', () => {
    const grid = createEmptyGrid(60, 60);

    // Place a settlement local road at (30, 26)
    grid[26][30].type = TileType.ROAD;
    grid[26][30].roadClass = 'LOCAL';

    // Place highway row at y = 30
    for (let x = 0; x < 60; x += 1) {
      grid[30][x].type = TileType.ROAD;
      grid[30][x].roadClass = 'HIGHWAY';
    }

    const rec = computeRoadRecommendations(grid, ['1,1']);

    expect(rec.targetHighwayTile).toEqual([30, 30]);
    expect(rec.bestPath.length).toBeGreaterThan(0);
    // Best path should connect (30, 27) -> (30, 28) -> (30, 29)
    expect(rec.bestPath).toContainEqual([30, 27]);
    expect(rec.bestPath).toContainEqual([30, 28]);
    expect(rec.bestPath).toContainEqual([30, 29]);
  });

  it('identifies valid, blocked, and suboptimal candidate tiles near corridor', () => {
    const grid = createEmptyGrid(60, 60);
    grid[26][30].type = TileType.ROAD;
    grid[26][30].roadClass = 'LOCAL';
    grid[30][30].type = TileType.ROAD;
    grid[30][30].roadClass = 'HIGHWAY';

    // Mark water at (29, 28)
    grid[28][29].water = true;

    const rec = computeRoadRecommendations(grid, ['1,1']);
    expect(rec.blockedTiles).toContainEqual([29, 28]);
    expect(rec.validTiles.length).toBeGreaterThan(0);
  });

  it('recommends utility placements adjacent to roads and water', () => {
    const grid = createEmptyGrid(60, 60);
    grid[25][25].type = TileType.ROAD;
    // Water adjacent to road
    grid[25][23].water = true;

    const utils = computeUtilityRecommendations(grid, ['1,1']);
    expect(utils.validCandidates.length).toBeGreaterThan(0);
    expect(utils.powerTile).not.toBeNull();
  });

  it('recommends fronting zoning parcels along active roads', () => {
    const grid = createEmptyGrid(60, 60);
    grid[25][25].type = TileType.ROAD;

    const zones = computeZoningRecommendations(grid, ['1,1']);
    expect(zones.recommendedTiles.length).toBeGreaterThan(0);
    expect(zones.validTiles).toContainEqual([25, 24]);
    expect(zones.validTiles).toContainEqual([25, 26]);
    expect(zones.validTiles).toContainEqual([24, 25]);
    expect(zones.validTiles).toContainEqual([26, 25]);
  });
});
