import { describe, expect, it } from 'vitest';
import { createTile, TileType } from './types';
import { evaluateRoadJunction } from './trafficInsights';

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
