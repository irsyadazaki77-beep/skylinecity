import { describe, expect, it } from 'vitest';
import { simulateCityDepthAndEnvironment } from './depthSimulation';
import { buildRoadGraph } from './traffic';
import { createTile, TileType } from './types';

function residentialFrontage(roadClass: 'LOCAL' | 'HIGHWAY') {
  const grid = Array.from({ length: 3 }, (_, y) =>
    Array.from({ length: 3 }, (_, x) => createTile(x, y)),
  );
  grid[1][1] = createTile(1, 1, { type: TileType.ROAD, roadClass });
  grid[1][0] = createTile(0, 1, { type: TileType.RESIDENTIAL, powered: true, watered: true });
  return grid;
}

describe('land-use suitability', () => {
  it('prefers quiet local frontage for residential land over highway frontage', () => {
    const localGrid = residentialFrontage('LOCAL');
    const highwayGrid = residentialFrontage('HIGHWAY');

    simulateCityDepthAndEnvironment(localGrid, buildRoadGraph(localGrid), []);
    simulateCityDepthAndEnvironment(highwayGrid, buildRoadGraph(highwayGrid), []);

    expect(localGrid[1][0].suitability).toBeGreaterThan(highwayGrid[1][0].suitability!);
  });

  it('publishes a finite city suitability average', () => {
    const grid = residentialFrontage('LOCAL');
    const result = simulateCityDepthAndEnvironment(grid, buildRoadGraph(grid), []);
    expect(Number.isFinite(result.suitabilityAverage)).toBe(true);
    expect(result.suitabilityAverage).toBeGreaterThanOrEqual(0);
    expect(result.suitabilityAverage).toBeLessThanOrEqual(100);
  });
});
