import { describe, expect, it } from 'vitest';
import { createTile, TileType, TransitLine } from './types';
import { calculateTransitLineInsights } from './transitInsights';

function line(id: string, stops: [number, number][], active = true): TransitLine {
  return { id, name: id, mode: 'BUS', stops, frequency: 20, peakFrequency: 12, active };
}

describe('calculateTransitLineInsights', () => {
  it('reports catchment, transfer opportunity, and crowding for an active line', () => {
    const grid = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => createTile(x, y)));
    grid[2][1] = createTile(1, 2, { type: TileType.BUS_STOP, powered: true });
    grid[2][3] = createTile(3, 2, { type: TileType.BUS_STOP, powered: true });
    grid[2][2] = createTile(2, 2, { type: TileType.RESIDENTIAL, population: 20 });
    const first = line('bus-1', [[1, 2], [3, 2]]);
    const second = line('bus-2', [[3, 2], [1, 2]]);
    const insight = calculateTransitLineInsights({
      grid,
      lines: [first, second],
      vehicles: [{ id: 'v1', lineId: 'bus-1', mode: 'BUS', path: [[1, 2], [2, 2]], headway: 12, capacity: 20, occupancy: 19, dwellTime: 1.5 }],
      totalPopulation: 20,
      transitRidership: 30,
      transitCapacity: 20,
      timeOfDay: 8,
    })[0];
    expect(insight.catchmentPopulation).toBe(20);
    expect(insight.transferStops).toBe(2);
    expect(insight.occupancyPercent).toBe(95);
    expect(insight.status).toBe('CROWDED');
    expect(insight.recommendations.some((item) => item.includes('tambah kendaraan'))).toBe(true);
  });

  it('reports invalid stops and offline state as actionable conditions', () => {
    const grid = Array.from({ length: 2 }, (_, y) => Array.from({ length: 2 }, (_, x) => createTile(x, y)));
    const insight = calculateTransitLineInsights({
      grid,
      lines: [line('bus-off', [[0, 0], [1, 1]], false)],
      vehicles: [],
      totalPopulation: 0,
      transitRidership: 0,
      transitCapacity: 0,
      timeOfDay: 12,
    })[0];
    expect(insight.status).toBe('OFFLINE');
    expect(insight.validStops).toBe(0);
    expect(insight.recommendations[0]).toContain('nonaktif');
  });
});
