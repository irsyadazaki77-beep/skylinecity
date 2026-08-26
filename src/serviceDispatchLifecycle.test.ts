import { describe, expect, it } from 'vitest';
import { deriveIncidentDispatchLifecycle, getReturningServiceVehicles } from './serviceDispatchLifecycle';
import { CityIncident, ServiceVehicleAgent } from './types';

const incident: CityIncident = {
  id: 'fire-1',
  type: 'FIRE',
  x: 8,
  y: 4,
  severity: 3,
  createdDay: 1,
  remainingDays: 2.5,
  roadConnected: true,
  assignedFacility: { x: 1, y: 4 },
  dispatchPath: [[1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4]],
  requiredUnits: 3,
  dispatchedUnits: 2,
  responseProgress: 42,
};

const vehicle = (id: string, status: ServiceVehicleAgent['status'], routeProgress: number): ServiceVehicleAgent => ({
  id,
  incidentId: incident.id,
  role: 'FIRE_ENGINE',
  status,
  facility: { x: 1, y: 4 },
  path: incident.dispatchPath!,
  routeProgress,
  condition: 99,
  fuel: 95,
  createdDay: 1,
});

describe('service dispatch lifecycle', () => {
  it('derives dispatching and on-scene units from persistent agents', () => {
    const lifecycle = deriveIncidentDispatchLifecycle( [incident], [
      vehicle('fire-1-unit-0', 'DISPATCHING', 0.42),
      vehicle('fire-1-unit-1', 'ON_SCENE', 1),
    ])[0];

    expect(lifecycle.stage).toBe('ON_SCENE');
    expect(lifecycle.dispatchingUnits).toBe(1);
    expect(lifecycle.onSceneUnits).toBe(1);
    expect(lifecycle.queuedUnits).toBe(1);
    expect(lifecycle.dispatchCompletionPercent).toBeCloseTo(66.7);
    expect(lifecycle.etaMinutes).toBeGreaterThan(0);
  });

  it('marks an incident with no assigned units as queued', () => {
    const queued = deriveIncidentDispatchLifecycle([{ ...incident, dispatchedUnits: 0, responseProgress: 0, dispatchPath: undefined }])[0];
    expect(queued.stage).toBe('QUEUED');
    expect(queued.queuedUnits).toBe(3);
    expect(queued.etaMinutes).toBeGreaterThan(0);
  });

  it('keeps returning agents visible after an incident has cleared', () => {
    const returning = vehicle('fire-1-unit-0', 'RETURNING', 1.4);
    expect(getReturningServiceVehicles([returning, vehicle('fire-1-unit-1', 'ON_SCENE', 1)])).toEqual([returning]);
  });
});
