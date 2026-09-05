import { describe, expect, it } from 'vitest';
import { createTile, TileType } from './types';
import { findTrafficBottlenecks, evaluateRoadJunction } from './trafficInsights';
import { TransitMode, TripPurpose, type Trip } from './citizenSimulation/types';

describe('evaluateRoadJunction', () => {
  it('identifies a busy mixed-class junction and recommends explicit control', () => {
    const grid = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
    const center = createTile(1, 1, { type: TileType.ROAD, traffic: 72, queuePressure: 58, laneUtilization: 84 });
    grid[1][1] = center;
    grid[0][1] = createTile(1, 0, { type: TileType.ROAD, roadClass: 'LOCAL' });
    grid[1][0] = createTile(0, 1, { type: TileType.ROAD, roadClass: 'ARTERIAL' });
    grid[1][2] = createTile(2, 1, { type: TileType.ROAD, roadClass: 'LOCAL' });
    const insight = evaluateRoadJunction(center, grid);
    expect(insight?.isIntersection).toBe(true);
    expect(insight?.status).toBe('BUSY');
    expect(insight?.approachCount).toBe(3);
    expect(insight?.recommendations.some((item) => item.includes('Signal'))).toBe(true);
  });

  it('surfaces maintenance and lane-change pressure on a corridor', () => {
    const grid = Array.from({ length: 1 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
    const center = createTile(1, 0, { type: TileType.ROAD, roadCondition: 45, laneChangePressure: 62, traffic: 20 });
    grid[0][0] = createTile(0, 0, { type: TileType.ROAD });
    grid[0][1] = center;
    grid[0][2] = createTile(2, 0, { type: TileType.ROAD });
    const insight = evaluateRoadJunction(center, grid);
    expect(insight?.isIntersection).toBe(false);
    expect(insight?.recommendations.some((item) => item.includes('maintenance'))).toBe(true);
    expect(insight?.recommendations.some((item) => item.includes('pindah lajur'))).toBe(true);
  });
});

describe('findTrafficBottlenecks', () => {
  it('attributes a bottleneck to actual origin-destination trips instead of nearby guesses', () => {
    const grid = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => createTile(x, y)));
    grid[1][0] = createTile(0, 1, { type: TileType.RESIDENTIAL, population: 12 });
    grid[3][4] = createTile(4, 3, { type: TileType.INDUSTRIAL, jobs: 20 });
    grid[2][2] = createTile(2, 2, { type: TileType.ROAD, roadClass: 'LOCAL', traffic: 92, queuePressure: 65 });
    const dominant = Array.from({ length: 7 }, (_, index): Trip => ({
      id: `work-${index}`,
      citizenId: `citizen-${index}`,
      householdId: `household-${index}`,
      origin: { x: 0, y: 1 },
      destination: { x: 4, y: 3 },
      purpose: TripPurpose.COMMUTE_WORK,
      path: [[1, 2], [2, 2], [3, 2]],
      travelTime: 28,
      mode: TransitMode.CAR,
    }));
    const other = Array.from({ length: 2 }, (_, index): Trip => ({
      id: `shop-${index}`,
      citizenId: `shopper-${index}`,
      householdId: `shopping-household-${index}`,
      origin: { x: 1, y: 1 },
      destination: { x: 3, y: 3 },
      purpose: TripPurpose.SHOPPING,
      path: [[1, 2], [2, 2], [3, 2]],
      travelTime: 18,
      mode: TransitMode.CAR,
    }));

    const [story] = findTrafficBottlenecks(grid, { trips: [...dominant, ...other] }, 1);
    expect(story.originDesc).toBe('Hunian (0, 1)');
    expect(story.destinationDesc).toBe('Industri (4, 3)');
    expect(story.tripCount).toBe(7);
    expect(story.sampleSize).toBe(9);
    expect(story.sharePercent).toBe(78);
    expect(story.confidence).toBe('MEDIUM');
    expect(story.cause).toContain('78% dari 9 perjalanan mobil');
    expect(story.route).toEqual(dominant[0].path);
    expect(story.cohortCounts).toEqual({ privateCars: 9, freight: 0, emergency: 0, transit: 0 });
  });

  it('does not invent an origin or destination when no real trip crosses the road', () => {
    const grid = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
    grid[1][1] = createTile(1, 1, { type: TileType.ROAD, traffic: 99, queuePressure: 90 });
    expect(findTrafficBottlenecks(grid, { trips: [] }, 3)).toEqual([]);
  });

  it('uses deterministic first-observed tie breaking for equal cohorts', () => {
    const grid = Array.from({ length: 3 }, (_, y) => Array.from({ length: 4 }, (_, x) => createTile(x, y)));
    grid[1][1] = createTile(1, 1, { type: TileType.ROAD, traffic: 80 });
    const trips: Trip[] = [
      { id: 'first', citizenId: 'a', householdId: 'a', origin: { x: 0, y: 0 }, destination: { x: 3, y: 0 }, purpose: TripPurpose.SHOPPING, path: [[1, 1]], travelTime: 4, mode: TransitMode.CAR },
      { id: 'second', citizenId: 'b', householdId: 'b', origin: { x: 0, y: 2 }, destination: { x: 3, y: 2 }, purpose: TripPurpose.LEISURE, path: [[1, 1]], travelTime: 4, mode: TransitMode.CAR },
    ];
    expect(findTrafficBottlenecks(grid, { trips }, 1)[0].purpose).toBe(TripPurpose.SHOPPING);
  });
});
