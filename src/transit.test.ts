import { describe, expect, it } from 'vitest';
import { buildRoadGraph } from './traffic';
import { simulateTransitNetwork } from './transit';
import { createTile, TileType } from './types';

function makeGrid(width = 12, height = 12) {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => createTile(x, y)),
  );
}

describe('public transit simulation', () => {
  it('turns a powered, road-connected bus depot into coverage and ridership', () => {
    const grid = makeGrid();
    for (let x = 2; x <= 8; x += 1) {
      grid[5][x] = createTile(x, 5, { type: TileType.ROAD });
    }
    grid[4][3] = createTile(3, 4, { type: TileType.BUS_DEPOT, powered: true });
    grid[4][7] = createTile(7, 4, { type: TileType.RESIDENTIAL, population: 100 });

    const result = simulateTransitNetwork(
      grid,
      buildRoadGraph(grid),
      100,
      ['bus_network'],
    );

    expect(result.busDepots).toBe(1);
    expect(result.transitCapacity).toBe(80);
    expect(result.transitCoverage).toBe(100);
    expect(result.transitRidership).toBe(32);
    expect(result.activeVehicles).toBe(1);
    expect(result.averageWaitTime).toBe(12);
    expect(result.fareRevenue).toBe(48);
    expect(result.operatingCost).toBeGreaterThan(0);
  });

  it('rejects locked or disconnected facilities from the usable network', () => {
    const grid = makeGrid();
    grid[4][3] = createTile(3, 4, { type: TileType.BUS_DEPOT, powered: true });
    const roadGraph = buildRoadGraph(grid);

    expect(simulateTransitNetwork(grid, roadGraph, 0, []).transitCapacity).toBe(0);
    expect(simulateTransitNetwork(grid, roadGraph, 0, ['bus_network']).transitCapacity).toBe(0);
  });

  it('uses configured line stops to schedule capacity instead of treating every depot as an active route', () => {
    const grid = makeGrid();
    for (let x = 2; x <= 8; x += 1) grid[5][x] = createTile(x, 5, { type: TileType.ROAD });
    grid[4][3] = createTile(3, 4, { type: TileType.BUS_DEPOT, powered: true });
    grid[4][5] = createTile(5, 4, { type: TileType.BUS_DEPOT, powered: true });
    grid[4][7] = createTile(7, 4, { type: TileType.RESIDENTIAL, population: 100 });
    const roadGraph = buildRoadGraph(grid);

    const result = simulateTransitNetwork(grid, roadGraph, 100, ['bus_network'], [{
      id: 'line-1',
      name: 'Bus Line 1',
      mode: 'BUS',
      stops: [[3, 4], [5, 4]],
      frequency: 8,
      active: true,
    }]);

    expect(result.activeLines).toBe(1);
    expect(result.transitCapacity).toBe(100);
    expect(result.transitCoverage).toBe(100);
    expect(result.activeVehicles).toBe(2);
    expect(result.averageWaitTime).toBe(4);
    expect(result.vehicleAgents).toHaveLength(2);
    expect(result.vehicleAgents.every((vehicle) => vehicle.path.length >= 2)).toBe(true);
    expect(result.vehicleAgents.every((vehicle) => vehicle.headway === 8)).toBe(true);
    expect(result.vehicleAgents.every((vehicle) => (vehicle.routeProgress ?? -1) >= 0 && (vehicle.routeProgress ?? 2) < 1)).toBe(true);
    expect(result.vehicleAgents.every((vehicle) => (vehicle.nextStopIndex ?? -1) >= 0)).toBe(true);
    const nextDay = simulateTransitNetwork(grid, buildRoadGraph(grid), 100, ['bus_network'], [{
      id: 'line-1', name: 'Bus Line 1', mode: 'BUS', stops: [[3, 4], [5, 4]], frequency: 8, active: true,
    }], 8, 2);
    expect(nextDay.vehicleAgents[0]?.routeProgress).not.toBe(result.vehicleAgents[0]?.routeProgress);
    expect(result.averageDwellTime).toBe(1.5);
    expect(result.platformCapacity).toBeGreaterThan(0);
    expect(result.fareRevenue).toBeGreaterThan(0);
    expect(result.operatingCost).toBeGreaterThan(0);
  });

  it('accepts passenger stops separately from fleet depots', () => {
    const grid = makeGrid();
    for (let x = 2; x <= 8; x += 1) grid[5][x] = createTile(x, 5, { type: TileType.ROAD });
    grid[4][3] = createTile(3, 4, { type: TileType.BUS_DEPOT, powered: true });
    grid[4][5] = createTile(5, 4, { type: TileType.BUS_STOP, powered: true });
    grid[4][7] = createTile(7, 4, { type: TileType.BUS_STOP, powered: true });
    const result = simulateTransitNetwork(grid, buildRoadGraph(grid), 100, ['bus_network'], [{
      id: 'line-stop', name: 'Stop Line', mode: 'BUS', stops: [[3, 4], [5, 4], [7, 4]], frequency: 8, active: true,
    }]);

    expect(result.activeLines).toBe(1);
    expect(result.busDepots).toBe(1);
    expect(result.transitCapacity).toBe(80);
    expect(result.vehicleAgents).toHaveLength(2);
  });

  it('keeps a separate powered depot as fleet capacity for passenger-only stops', () => {
    const grid = makeGrid();
    for (let x = 2; x <= 10; x += 1) grid[5][x] = createTile(x, 5, { type: TileType.ROAD });
    grid[4][3] = createTile(3, 4, { type: TileType.BUS_DEPOT, powered: true });
    grid[4][6] = createTile(6, 4, { type: TileType.BUS_STOP, powered: true });
    grid[4][9] = createTile(9, 4, { type: TileType.BUS_STOP, powered: true });
    const result = simulateTransitNetwork(grid, buildRoadGraph(grid), 100, ['bus_network'], [{
      id: 'line-separate-depot',
      name: 'Separate Depot Line',
      mode: 'BUS',
      stops: [[6, 4], [9, 4]],
      frequency: 8,
      active: true,
    }]);

    expect(result.activeLines).toBe(1);
    expect(result.busDepots).toBe(1);
    expect(result.transitCapacity).toBe(80);
    expect(result.activeVehicles).toBe(2);
  });

  it('ignores a configured line whose stop is not connected to a road', () => {
    const grid = makeGrid();
    grid[4][3] = createTile(3, 4, { type: TileType.BUS_DEPOT, powered: true });
    const roadGraph = buildRoadGraph(grid);

    const result = simulateTransitNetwork(grid, roadGraph, 0, ['bus_network'], [{
      id: 'line-disconnected',
      name: 'Disconnected Line',
      mode: 'BUS',
      stops: [[3, 4], [4, 4]],
      frequency: 8,
      active: true,
    }]);

    expect(result.activeLines).toBe(0);
    expect(result.transitCapacity).toBe(0);
  });

  it('stops scheduled service when every configured line is paused', () => {
    const grid = makeGrid();
    for (let x = 2; x <= 8; x += 1) grid[5][x] = createTile(x, 5, { type: TileType.ROAD });
    grid[4][3] = createTile(3, 4, { type: TileType.BUS_DEPOT, powered: true });
    grid[4][5] = createTile(5, 4, { type: TileType.BUS_DEPOT, powered: true });
    const roadGraph = buildRoadGraph(grid);

    const result = simulateTransitNetwork(grid, roadGraph, 0, ['bus_network'], [{
      id: 'line-paused',
      name: 'Paused Line',
      mode: 'BUS',
      stops: [[3, 4], [5, 4]],
      frequency: 8,
      active: false,
    }]);

    expect(result.activeLines).toBe(0);
    expect(result.transitCapacity).toBe(0);
  });

  it('rejects a line whose stops touch separate disconnected road components', () => {
    const grid = makeGrid();
    for (let x = 1; x <= 2; x += 1) grid[5][x] = createTile(x, 5, { type: TileType.ROAD });
    for (let x = 8; x <= 9; x += 1) grid[5][x] = createTile(x, 5, { type: TileType.ROAD });
    grid[4][2] = createTile(2, 4, { type: TileType.BUS_DEPOT, powered: true });
    grid[4][8] = createTile(8, 4, { type: TileType.BUS_DEPOT, powered: true });
    const roadGraph = buildRoadGraph(grid);

    const result = simulateTransitNetwork(grid, roadGraph, 0, ['bus_network'], [{
      id: 'line-split',
      name: 'Split Line',
      mode: 'BUS',
      stops: [[2, 4], [8, 4]],
      frequency: 8,
      active: true,
    }]);

    expect(result.activeLines).toBe(0);
    expect(result.transitCapacity).toBe(0);
  });

  it('counts shared stops as transfer opportunities across active lines', () => {
    const grid = makeGrid();
    for (let x = 2; x <= 8; x += 1) grid[5][x] = createTile(x, 5, { type: TileType.ROAD });
    for (const x of [3, 5, 7]) grid[4][x] = createTile(x, 4, { type: TileType.BUS_DEPOT, powered: true });
    const roadGraph = buildRoadGraph(grid);

    const result = simulateTransitNetwork(grid, roadGraph, 0, ['bus_network'], [
      { id: 'line-a', name: 'Line A', mode: 'BUS', stops: [[3, 4], [5, 4]], frequency: 8, active: true },
      { id: 'line-b', name: 'Line B', mode: 'BUS', stops: [[5, 4], [7, 4]], frequency: 8, active: true },
    ]);

    expect(result.activeLines).toBe(2);
    expect(result.transferOpportunities).toBe(1);
    expect(result.activeVehicles).toBe(4);
  });

  it('switches fleet headway and service capacity across scheduled hours', () => {
    const grid = makeGrid();
    for (let x = 2; x <= 8; x += 1) grid[5][x] = createTile(x, 5, { type: TileType.ROAD });
    grid[4][3] = createTile(3, 4, { type: TileType.BUS_DEPOT, powered: true });
    grid[4][5] = createTile(5, 4, { type: TileType.BUS_DEPOT, powered: true });
    const line = {
      id: 'line-schedule',
      name: 'Schedule Line',
      mode: 'BUS' as const,
      stops: [[3, 4], [5, 4]] as [number, number][],
      frequency: 8,
      peakFrequency: 4,
      serviceStartHour: 5,
      serviceEndHour: 22,
      peakStartHour: 7,
      peakEndHour: 10,
      active: true,
    };
    const roadGraph = buildRoadGraph(grid);
    const peak = simulateTransitNetwork(grid, roadGraph, 100, ['bus_network'], [line], 8);
    const offHours = simulateTransitNetwork(grid, roadGraph, 100, ['bus_network'], [line], 23);

    expect(peak.activeVehicles).toBeGreaterThan(2);
    expect(peak.activeLines).toBe(1);
    expect(peak.vehicleAgents.every((vehicle) => vehicle.headway === 4)).toBe(true);
    expect(offHours.activeLines).toBe(0);
    expect(offHours.activeVehicles).toBe(0);
    expect(offHours.transitCoverage).toBe(0);
    expect(offHours.transitCapacity).toBe(0);
    expect(offHours.fareRevenue).toBe(0);
  });
});
