import { describe, expect, it } from 'vitest';
import { createTile, TileType } from './types';
import { buildRoadGraph } from './traffic';
import { simulateIncidents } from './incidents';

function makeGrid() {
  const grid = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => createTile(x, y)),
  );
  for (let x = 0; x < 8; x += 1) grid[4][x] = createTile(x, 4, { type: TileType.ROAD });
  grid[3][3] = createTile(3, 3, { type: TileType.INDUSTRIAL, jobs: 20, pollution: 30 });
  grid[3][6] = createTile(6, 3, { type: TileType.RESIDENTIAL, population: 25, health: 30 });
  grid[3][2] = createTile(2, 3, { type: TileType.FIRE_STATION, powered: true });
  grid[3][5] = createTile(5, 3, { type: TileType.POLICE_STATION, powered: true });
  return grid;
}

describe('city incident dispatch simulation', () => {
  it('resolves an incident faster when service capacity and access are available', () => {
    const grid = makeGrid();
    const roadGraph = buildRoadGraph(grid);
    const previous = [{
      id: 'fire-1',
      type: 'FIRE' as const,
      x: 3,
      y: 3,
      severity: 2 as const,
      createdDay: 1,
      remainingDays: 1,
      roadConnected: true,
    }];

    const result = simulateIncidents(grid, roadGraph, previous, 2, 2088, 100, {
      fire: 150,
      police: 0,
      healthcare: 0,
    });

    expect(result.resolved).toBe(1);
    expect(result.incidents).toHaveLength(0);
  });

  it('keeps a response-starved incident active and deterministic', () => {
    const gridA = makeGrid();
    const gridB = makeGrid();
    const previous = [{
      id: 'crime-1',
      type: 'CRIME' as const,
      x: 6,
      y: 3,
      severity: 3 as const,
      createdDay: 1,
      remainingDays: 2,
      roadConnected: true,
    }];

    const resultA = simulateIncidents(gridA, buildRoadGraph(gridA), previous, 2, 77, 20, {
      fire: 0,
      police: 0,
      healthcare: 0,
    });
    const resultB = simulateIncidents(gridB, buildRoadGraph(gridB), previous, 2, 77, 20, {
      fire: 0,
      police: 0,
      healthcare: 0,
    });

    expect(resultA.incidents[0]?.remainingDays).toBeGreaterThan(0);
    expect(resultA).toEqual(resultB);
    expect(gridA[3][6].incidentSeverity).toBe(3);
    expect(resultA.incidents[0]?.dispatchPath?.length).toBeGreaterThan(0);
  });

  it('dispatches multiple units and reports the unfilled response queue', () => {
    const grid = makeGrid();
    const previous = [{
      id: 'fire-multi-unit',
      type: 'FIRE' as const,
      x: 3,
      y: 3,
      severity: 3 as const,
      createdDay: 1,
      remainingDays: 3,
      roadConnected: true,
    }];

    const result = simulateIncidents(grid, buildRoadGraph(grid), previous, 2, 2088, 100, {
      fire: 150,
      police: 0,
      healthcare: 0,
    });

    expect(result.incidents[0]?.requiredUnits).toBe(3);
    expect(result.incidents[0]?.dispatchedUnits).toBe(2);
    expect(result.dispatchedUnits).toBe(2);
    expect(result.queuedUnits).toBe(1);
    expect(result.incidents[0]?.responseProgress).toBeGreaterThan(0);
  });

  it('shares agency capacity across simultaneous incidents by priority', () => {
    const grid = makeGrid();
    const previous = [
      {
        id: 'fire-high-priority',
        type: 'FIRE' as const,
        x: 3,
        y: 3,
        severity: 2 as const,
        createdDay: 1,
        remainingDays: 3,
        roadConnected: true,
      },
      {
        id: 'fire-queued',
        type: 'FIRE' as const,
        x: 6,
        y: 3,
        severity: 1 as const,
        createdDay: 1,
        remainingDays: 3,
        roadConnected: true,
      },
    ];

    const result = simulateIncidents(grid, buildRoadGraph(grid), previous, 2, 2088, 100, {
      fire: 150,
      police: 0,
      healthcare: 0,
    });

    const priorityIncident = result.incidents.find((incident) => incident.id === 'fire-high-priority');
    const queuedIncident = result.incidents.find((incident) => incident.id === 'fire-queued');
    expect(priorityIncident?.dispatchedUnits).toBe(2);
    expect(queuedIncident?.dispatchedUnits).toBe(0);
    expect(result.queuedUnits).toBeGreaterThanOrEqual(1);
  });

  it('spreads a severe fire to an adjacent built tile when fire capacity is exhausted', () => {
    const grid = makeGrid();
    grid[3][4] = createTile(4, 3, { type: TileType.INDUSTRIAL, jobs: 20, pollution: 30 });
    const previous = [{
      id: 'fire-spread-source',
      type: 'FIRE' as const,
      x: 3,
      y: 3,
      severity: 3 as const,
      createdDay: 1,
      remainingDays: 3,
      roadConnected: true,
    }];

    const result = simulateIncidents(grid, buildRoadGraph(grid), previous, 2, 2088, 20, {
      fire: 0,
      police: 0,
      healthcare: 0,
    });

    expect(result.spawned.some((incident) => incident.type === 'FIRE' && incident.parentIncidentId === 'fire-spread-source')).toBe(true);
  });
});
