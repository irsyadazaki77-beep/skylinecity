import { describe, expect, it } from 'vitest';
import { createTile, CityIncident, ServiceVehicleAgent, TileType } from './types';
import { calculateServiceDispatchInsights } from './serviceDispatchInsights';

function context(overrides: Partial<Parameters<typeof calculateServiceDispatchInsights>[0]> = {}) {
  const grid = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
  grid[0][0] = createTile(0, 0, { type: TileType.FIRE_STATION, powered: true });
  const incident: CityIncident = {
    id: 'fire-1',
    type: 'FIRE',
    x: 2,
    y: 2,
    severity: 2,
    createdDay: 4,
    remainingDays: 2,
    roadConnected: true,
    assignedFacility: { x: 0, y: 0 },
    dispatchPath: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
    requiredUnits: 2,
    dispatchedUnits: 1,
    responseProgress: 10,
  };
  const vehicle: ServiceVehicleAgent = {
    id: 'fire-1-unit-0',
    incidentId: 'fire-1',
    role: 'FIRE_ENGINE',
    status: 'DISPATCHING',
    facility: { x: 0, y: 0 },
    path: incident.dispatchPath,
    routeProgress: 0.25,
    condition: 90,
    fuel: 80,
    createdDay: 4,
  };
  return {
    grid,
    incidents: [incident],
    vehicles: [vehicle],
    serviceBayQueues: { '0,0': 1 },
    serviceCapacity: { fire: 150, police: 0, healthcare: 0 },
    responseQuality: 100,
    ...overrides,
  };
}

describe('calculateServiceDispatchInsights', () => {
  it('reports queue pressure, ETA band, and actionable fire dispatch advice', () => {
    const fire = calculateServiceDispatchInsights(context()).find((item) => item.agency === 'FIRE')!;
    expect(fire.activeIncidents).toBe(1);
    expect(fire.queuedUnits).toBe(1);
    expect(fire.bayQueue).toBe(1);
    expect(fire.band).toBe('CRITICAL');
    expect(fire.averageRouteTiles).toBe(5);
    expect(fire.recommendations.some((recommendation) => recommendation.includes('antre'))).toBe(true);
  });

  it('keeps clear agencies deterministic when no calls or units exist', () => {
    const insights = calculateServiceDispatchInsights(context({ incidents: [], vehicles: [], serviceBayQueues: {} }));
    const medical = insights.find((item) => item.agency === 'MEDICAL')!;
    expect(medical.band).toBe('CLEAR');
    expect(medical.activeIncidents).toBe(0);
    expect(medical.averageEtaMinutes).toBe(0);
    expect(medical.recommendations[0]).toContain('Tidak ada panggilan');
  });
});
