import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState, simulateTick } from './engine';
import { simulateServiceFleet } from './serviceFleet';
import { buildRoadGraph } from './traffic';
import { CityIncident, TileType } from './types';

describe('service fleet agents', () => {
  it('dispatches a persistent emergency unit and returns it after resolution', () => {
    const grid = createEmptyGrid(10, 6);
    grid[2][1].type = TileType.FIRE_STATION;
    grid[2][1].powered = true;
    for (let x = 2; x <= 6; x += 1) grid[2][x].type = TileType.ROAD;
    const roadGraph = buildRoadGraph(grid, []);
    const incident: CityIncident = {
      id: 'incident-fire-test',
      type: 'FIRE',
      x: 6,
      y: 2,
      severity: 2,
      createdDay: 1,
      remainingDays: 2,
      roadConnected: true,
      assignedFacility: { x: 1, y: 2 },
      dispatchPath: [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2]],
      dispatchedUnits: 1,
      requiredUnits: 2,
    };

    const dispatched = simulateServiceFleet([], [incident], grid, roadGraph, 1, 100);
    expect(dispatched.totalUnits).toBeGreaterThan(0);
    expect(dispatched.activeUnits).toBe(1);
    expect(dispatched.agents[0]?.status).toBe('DISPATCHING');

    const enRoute = simulateServiceFleet(dispatched.agents, [incident], grid, roadGraph, 2, 100);
    const onScene = simulateServiceFleet(enRoute.agents, [incident], grid, roadGraph, 3, 100);
    expect(onScene.agents[0]?.status).toBe('ON_SCENE');

    const returning = simulateServiceFleet(onScene.agents, [], grid, roadGraph, 4, 100);
    expect(returning.agents[0]?.status).toBe('RETURNING');
    expect(returning.agents[0]?.routeProgress).toBeGreaterThan(1);
  });

  it('wears active depots and preserves maintenance condition between ticks', () => {
    const grid = createEmptyGrid(10, 6);
    grid[2][1].type = TileType.FIRE_STATION;
    grid[2][1].powered = true;
    for (let x = 2; x <= 6; x += 1) grid[2][x].type = TileType.ROAD;
    const roadGraph = buildRoadGraph(grid, []);
    const quiet = simulateServiceFleet([], [], grid, roadGraph, 1, 100);
    expect(quiet.depotCondition['1,2']).toBeLessThan(100);
    expect(quiet.maintenanceCost).toBeGreaterThan(0);

    const incident: CityIncident = {
      id: 'incident-maintenance-test',
      type: 'FIRE',
      x: 6,
      y: 2,
      severity: 1,
      createdDay: 1,
      remainingDays: 2,
      roadConnected: true,
      assignedFacility: { x: 1, y: 2 },
      dispatchPath: [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2]],
      dispatchedUnits: 1,
      requiredUnits: 1,
    };
    const busy = simulateServiceFleet([], [incident], grid, roadGraph, 2, 100, quiet.depotCondition);
    expect(busy.depotCondition['1,2']).toBeLessThan(quiet.depotCondition['1,2']);
    expect(busy.averageCondition).toBeLessThan(100);
  });

  it('completes a scheduled depot overhaul after two simulation ticks', () => {
    const grid = createEmptyGrid(12, 12);
    grid[6][6].type = TileType.FIRE_STATION;
    grid[6][6].powered = true;
    grid[6][7].type = TileType.ROAD;
    const state = createInitialCityState(grid);
    state.money = 5000;
    state.serviceDepotCondition = { '6,6': 55 };
    state.serviceMaintenanceOrders = [{
      id: 'maintenance-test',
      facility: { x: 6, y: 6 },
      remainingTicks: 2,
      cost: 180,
      createdDay: 1,
    }];

    const inProgress = simulateTick(state);
    expect(inProgress.serviceMaintenanceOrders?.[0]?.remainingTicks).toBe(1);
    const completed = simulateTick(inProgress);
    expect(completed.serviceMaintenanceOrders).toHaveLength(0);
    expect(completed.serviceDepotCondition?.['6,6']).toBeGreaterThan(95);
  });
});
