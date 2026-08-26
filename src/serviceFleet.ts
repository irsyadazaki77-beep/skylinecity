import {
  CityIncident,
  ServiceVehicleAgent,
  ServiceVehicleRole,
  ServiceVehicleStatus,
  TileData,
  TileType,
} from './types';
import { getAdjacentRoadNodeKey, RoadGraph } from './traffic';

export interface ServiceFleetResult {
  agents: ServiceVehicleAgent[];
  totalUnits: number;
  activeUnits: number;
  availableUnits: number;
  onSceneUnits: number;
  averageCondition: number;
  operatingCost: number;
  depotCondition: Record<string, number>;
  maintenanceCost: number;
  bayQueues: Record<string, number>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roleForIncident(type: CityIncident['type']): ServiceVehicleRole {
  if (type === 'FIRE') return 'FIRE_ENGINE';
  if (type === 'MEDICAL') return 'AMBULANCE';
  if (type === 'CRIME') return 'POLICE_CAR';
  return 'TRAFFIC_UNIT';
}

function facilityFleetUnits(type: TileType): number {
  if (type === TileType.FIRE_STATION) return 3;
  if (type === TileType.POLICE_STATION) return 3;
  if (type === TileType.CLINIC) return 2;
  return 0;
}

function countOperationalFleet(grid: TileData[][], roadGraph: RoadGraph, depotCondition: Record<string, number>): number {
  let total = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (!tile.powered || !getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph)) continue;
      const baseUnits = facilityFleetUnits(tile.type) + (tile.type === TileType.FIRE_STATION || tile.type === TileType.POLICE_STATION ? 1 : 0);
      if (baseUnits <= 0) continue;
      const condition = clamp(depotCondition[`${tile.x},${tile.y}`] ?? 100, 0, 100);
      total += Math.max(0, Math.round(baseUnits * clamp((condition - 20) / 80, 0, 1)));
    }
  }
  return total;
}

function nextStatus(progress: number): ServiceVehicleStatus {
  if (progress >= 1) return 'ON_SCENE';
  return 'DISPATCHING';
}

/**
 * Keeps emergency units as persistent, bounded agents instead of recreating
 * anonymous vehicles from incident rows every render. Units travel out to an
 * incident, remain on scene while it is active, then return to their depot.
 */
export function simulateServiceFleet(
  previous: ServiceVehicleAgent[] = [],
  incidents: CityIncident[] = [],
  grid: TileData[][],
  roadGraph: RoadGraph,
  day: number,
  responseQuality = 100,
  previousDepotCondition: Record<string, number> = {},
): ServiceFleetResult {
  const previousById = new Map(previous.map((agent) => [agent.id, agent]));
  const agents: ServiceVehicleAgent[] = [];
  const activeAgentIds = new Set<string>();
  const travelGain = 0.28 + clamp(responseQuality, 0, 100) / 100 * 0.16;

  for (const incident of incidents) {
    if (!incident.assignedFacility || (incident.dispatchPath?.length ?? 0) < 2) continue;
    const dispatched = Math.max(0, incident.dispatchedUnits ?? 0);
    const role = roleForIncident(incident.type);
    for (let unitIndex = 0; unitIndex < dispatched; unitIndex += 1) {
      const id = `${incident.id}-unit-${unitIndex}`;
      activeAgentIds.add(id);
      const prior = previousById.get(id);
      const routeProgress = Math.min(1, (prior?.routeProgress ?? 0) + travelGain);
      agents.push({
        id,
        incidentId: incident.id,
        role,
        status: nextStatus(routeProgress),
        facility: { ...incident.assignedFacility },
        path: incident.dispatchPath!.map(([x, y]) => [x, y] as [number, number]),
        routeProgress,
        condition: Math.round(clamp((prior?.condition ?? 100) - (routeProgress < 1 ? 0.7 : 1.1), 0, 100) * 10) / 10,
        fuel: Math.round(clamp((prior?.fuel ?? 100) - (routeProgress < 1 ? 1.8 : 0.7), 0, 100) * 10) / 10,
        createdDay: prior?.createdDay ?? day,
      });
    }
  }

  // Keep resolved units visible for one return leg so dispatch has a real
  // lifecycle and a station can look busy even as the incident clears.
  for (const prior of previous) {
    if (activeAgentIds.has(prior.id) || prior.routeProgress >= 2) continue;
    const routeProgress = Math.min(2, Math.max(1, prior.routeProgress) + 0.55);
    agents.push({
      ...prior,
      status: 'RETURNING',
      routeProgress,
      condition: Math.round(clamp(prior.condition + 0.35, 0, 100) * 10) / 10,
      fuel: Math.round(clamp(prior.fuel + 1.5, 0, 100) * 10) / 10,
      path: prior.path.map(([x, y]) => [x, y] as [number, number]),
    });
  }

  const activeByDepot = new Map<string, number>();
  for (const agent of agents) {
    if (agent.status === 'RETURNING') continue;
    const key = `${agent.facility.x},${agent.facility.y}`;
    activeByDepot.set(key, (activeByDepot.get(key) ?? 0) + 1);
  }

  const bayQueues: Record<string, number> = {};
  for (const [key, activeCount] of activeByDepot.entries()) {
    const [x, y] = key.split(',').map(Number);
    const depot = grid[y]?.[x];
    const bayCapacity = depot ? facilityFleetUnits(depot.type) + (depot.type === TileType.FIRE_STATION || depot.type === TileType.POLICE_STATION ? 1 : 0) : 0;
    bayQueues[key] = Math.max(0, activeCount - bayCapacity);
  }

  const depotCondition: Record<string, number> = {};
  let maintenanceCost = 0;
  const depotConditionSamples: number[] = [];
  for (const row of grid) {
    for (const tile of row) {
      const baseUnits = facilityFleetUnits(tile.type) + (tile.type === TileType.FIRE_STATION || tile.type === TileType.POLICE_STATION ? 1 : 0);
      if (baseUnits <= 0) continue;
      const key = `${tile.x},${tile.y}`;
      const condition = clamp(previousDepotCondition[key] ?? 100, 0, 100);
      if (!tile.powered || !getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph)) {
        depotCondition[key] = condition;
        continue;
      }
      const activeUnits = activeByDepot.get(key) ?? 0;
      const wear = 0.12 + activeUnits * 0.04;
      const scheduledRepair = condition < 96 ? 0.18 : 0.04;
      const nextCondition = Math.round(clamp(condition - wear + scheduledRepair, 0, 100) * 10) / 10;
      depotCondition[key] = nextCondition;
      depotConditionSamples.push(nextCondition);
      maintenanceCost += baseUnits * 0.65 + Math.max(0, 90 - nextCondition) * 0.04;
    }
  }

  const activeUnits = agents.filter((agent) => agent.status !== 'RETURNING').length;
  const onSceneUnits = agents.filter((agent) => agent.status === 'ON_SCENE').length;
  const totalUnits = countOperationalFleet(grid, roadGraph, depotCondition);
  const conditionSamples = [...depotConditionSamples, ...agents.map((agent) => agent.condition)];
  const averageCondition = conditionSamples.length > 0
    ? Math.round(conditionSamples.reduce((sum, condition) => sum + condition, 0) / conditionSamples.length * 10) / 10
    : 100;

  return {
    agents,
    totalUnits,
    activeUnits,
    availableUnits: Math.max(0, totalUnits - activeUnits),
    onSceneUnits,
    averageCondition,
    operatingCost: Math.round((activeUnits * 2.5 + agents.filter((agent) => agent.status === 'RETURNING').length) * 10) / 10,
    depotCondition,
    maintenanceCost: Math.round(maintenanceCost * 10) / 10,
    bayQueues,
  };
}
