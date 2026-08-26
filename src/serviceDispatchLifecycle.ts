import { CityIncident, ServiceVehicleAgent } from './types';

export type DispatchLifecycleStage = 'QUEUED' | 'DISPATCHING' | 'ON_SCENE';

export interface IncidentDispatchLifecycle {
  incidentId: string;
  type: CityIncident['type'];
  severity: CityIncident['severity'];
  location: { x: number; y: number };
  requiredUnits: number;
  dispatchedUnits: number;
  queuedUnits: number;
  dispatchCompletionPercent: number;
  responseProgress: number;
  routeTiles: number;
  etaMinutes: number;
  dispatchingUnits: number;
  onSceneUnits: number;
  stage: DispatchLifecycleStage;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function requiredUnitsFor(incident: CityIncident): number {
  return Math.max(1, incident.requiredUnits ?? (incident.type === 'TRAFFIC' ? 1 : incident.severity));
}

/**
 * Builds a stable, read-only incident lifecycle from authoritative incident
 * rows and persistent service agents. This deliberately stays outside
 * CityState so diagnostics do not affect simulation or save determinism.
 */
export function deriveIncidentDispatchLifecycle(
  incidents: CityIncident[],
  vehicles: ServiceVehicleAgent[] = [],
  responseQuality = 100,
): IncidentDispatchLifecycle[] {
  const qualityFactor = Math.max(0.45, Math.min(1.2, responseQuality / 100));

  return incidents.map((incident) => {
    const requiredUnits = requiredUnitsFor(incident);
    const dispatchedUnits = Math.max(0, incident.dispatchedUnits ?? 0);
    const queuedUnits = Math.max(0, requiredUnits - dispatchedUnits);
    const incidentVehicles = vehicles.filter((vehicle) => vehicle.incidentId === incident.id);
    const dispatchingUnits = incidentVehicles.filter((vehicle) => vehicle.status === 'DISPATCHING').length;
    const onSceneUnits = incidentVehicles.filter((vehicle) => vehicle.status === 'ON_SCENE').length;
    const routeTiles = incident.dispatchPath?.length ?? 0;
    const maxProgress = incidentVehicles.length > 0
      ? Math.max(...incidentVehicles.map((vehicle) => clamp(vehicle.routeProgress, 0, 1)))
      : clamp((incident.responseProgress ?? 0) / 100, 0, 1);
    const responseProgress = clamp(incident.responseProgress ?? maxProgress * 100, 0, 100);
    const stage: DispatchLifecycleStage = onSceneUnits > 0 || responseProgress >= 100
      ? 'ON_SCENE'
      : dispatchingUnits > 0 || dispatchedUnits > 0
        ? 'DISPATCHING'
        : 'QUEUED';
    const remainingRoute = stage === 'ON_SCENE' ? 0 : routeTiles * Math.max(0, 1 - maxProgress);

    return {
      incidentId: incident.id,
      type: incident.type,
      severity: incident.severity,
      location: { x: incident.x, y: incident.y },
      requiredUnits,
      dispatchedUnits,
      queuedUnits,
      dispatchCompletionPercent: round(Math.min(100, dispatchedUnits / requiredUnits * 100)),
      responseProgress: round(responseProgress),
      routeTiles,
      etaMinutes: round(remainingRoute * 1.2 / qualityFactor + (queuedUnits > 0 ? 3 + queuedUnits * 2 : 0)),
      dispatchingUnits,
      onSceneUnits,
      stage,
    };
  });
}

export function getReturningServiceVehicles(vehicles: ServiceVehicleAgent[] = []): ServiceVehicleAgent[] {
  return vehicles.filter((vehicle) => vehicle.status === 'RETURNING');
}
