import { CityIncident, CityIncidentType, TileData, TileType } from './types';
import { RoadGraph, getAdjacentRoadNodeKey } from './traffic';
import { SeededRandom } from './citizenSimulation/prng';
import { findRoadPath } from './citizenSimulation/trips';

export interface IncidentServiceCapacity {
  fire: number;
  police: number;
  healthcare: number;
}

export interface IncidentSimulationResult {
  incidents: CityIncident[];
  spawned: CityIncident[];
  resolved: number;
  responseLoad: number;
  happinessPenalty: number;
  dispatchedUnits: number;
  queuedUnits: number;
}

interface IncidentCandidate {
  x: number;
  y: number;
  type: CityIncidentType;
  risk: number;
  severity: 1 | 2 | 3;
  chainFrom?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function serviceCapacityFor(type: CityIncidentType, capacity: IncidentServiceCapacity): number {
  if (type === 'FIRE') return capacity.fire;
  if (type === 'CRIME') return capacity.police;
  if (type === 'MEDICAL') return capacity.healthcare;
  return capacity.fire + capacity.police;
}

function requiredUnitsFor(incident: Pick<CityIncident, 'type' | 'severity'>): number {
  return incident.type === 'TRAFFIC' ? 1 : incident.severity;
}

function assignDispatchUnits(
  incident: CityIncident,
  capacity: IncidentServiceCapacity,
  availableUnits?: number,
): CityIncident {
  const serviceCapacity = serviceCapacityFor(incident.type, capacity);
  const requiredUnits = incident.requiredUnits ?? requiredUnitsFor(incident);
  const dispatchableUnits = availableUnits ?? Math.floor(serviceCapacity / 75);
  return {
    ...incident,
    requiredUnits,
    dispatchedUnits: incident.assignedFacility ? Math.min(requiredUnits, Math.max(0, dispatchableUnits)) : 0,
    responseProgress: incident.responseProgress ?? 0,
  };
}

function incidentPriority(incident: CityIncident): number {
  // Higher severity wins first; calls closest to expiry break ties so a city
  // cannot starve a low-severity incident indefinitely.
  return incident.severity * 100 + Math.max(0, 20 - incident.remainingDays) * 4;
}

function responseFactor(
  incident: CityIncident,
  quality: number,
  capacity: IncidentServiceCapacity,
): number {
  const serviceCapacity = serviceCapacityFor(incident.type, capacity);
  const capacityFactor = serviceCapacity > 0 ? Math.min(1, serviceCapacity / 150) : 0.25;
  const accessFactor = incident.roadConnected ? 1 : 0.45;
  const requiredUnits = incident.requiredUnits ?? requiredUnitsFor(incident);
  const dispatchRatio = Math.min(1, (incident.dispatchedUnits ?? 0) / Math.max(1, requiredUnits));
  return clamp((quality / 100) * (0.25 + capacityFactor * 0.45 + dispatchRatio * 0.30) * accessFactor, 0.1, 1.1);
}

function incidentKey(x: number, y: number): string {
  return `${x},${y}`;
}

function facilityTypesFor(type: CityIncidentType): TileType[] {
  if (type === 'FIRE') return [TileType.FIRE_STATION];
  if (type === 'MEDICAL') return [TileType.CLINIC];
  if (type === 'CRIME') return [TileType.POLICE_STATION];
  return [TileType.FIRE_STATION, TileType.POLICE_STATION];
}

function attachDispatchPath(
  incident: CityIncident,
  grid: TileData[][],
  roadGraph: RoadGraph,
): CityIncident {
  const incidentRoadKey = getAdjacentRoadNodeKey(incident.x, incident.y, roadGraph);
  if (!incidentRoadKey) return { ...incident, roadConnected: false };

  let best: { x: number; y: number; path: [number, number][] } | null = null;
  const allowedTypes = facilityTypesFor(incident.type);
  for (const row of grid) {
    for (const tile of row) {
      if (!allowedTypes.includes(tile.type) || !tile.powered) continue;
      const facilityRoadKey = getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph);
      if (!facilityRoadKey) continue;
      const path = findRoadPath(facilityRoadKey, incidentRoadKey, roadGraph);
      if (path.length < 1 || (best && path.length >= best.path.length)) continue;
      best = { x: tile.x, y: tile.y, path };
    }
  }

  return best
    ? { ...incident, roadConnected: true, assignedFacility: { x: best.x, y: best.y }, dispatchPath: best.path }
    : { ...incident, roadConnected: true, assignedFacility: undefined, dispatchPath: undefined };
}

/**
 * Advances active incidents and deterministically spawns a small number of
 * new calls. Incidents are deliberately bounded per tick so a large city
 * cannot turn dispatch simulation into an unbounded O(population) queue.
 */
export function simulateIncidents(
  grid: TileData[][],
  roadGraph: RoadGraph,
  previous: CityIncident[] = [],
  day: number,
  seed: number,
  serviceResponseQuality: number,
  serviceCapacity: IncidentServiceCapacity,
): IncidentSimulationResult {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const prng = new SeededRandom((seed ^ (day * 0x9e3779b9)) >>> 0);
  const incidents: CityIncident[] = [];
  let resolved = 0;
  let dispatchedUnits = 0;
  let queuedUnits = 0;

  const availableUnits: Record<'fire' | 'police' | 'healthcare', number> = {
    fire: Math.max(0, Math.floor(serviceCapacity.fire / 75)),
    police: Math.max(0, Math.floor(serviceCapacity.police / 75)),
    healthcare: Math.max(0, Math.floor(serviceCapacity.healthcare / 75)),
  };

  const agencyForIncident = (type: CityIncidentType): keyof typeof availableUnits | 'traffic' => {
    if (type === 'FIRE') return 'fire';
    if (type === 'CRIME') return 'police';
    if (type === 'MEDICAL') return 'healthcare';
    return 'traffic';
  };

  const availableForAgency = (agency: keyof typeof availableUnits | 'traffic') => agency === 'traffic'
    ? availableUnits.fire + availableUnits.police
    : availableUnits[agency];

  const consumeUnits = (agency: keyof typeof availableUnits | 'traffic', units: number) => {
    if (agency !== 'traffic') {
      availableUnits[agency] = Math.max(0, availableUnits[agency] - units);
      return;
    }
    const fromFire = Math.min(availableUnits.fire, units);
    availableUnits.fire -= fromFire;
    availableUnits.police = Math.max(0, availableUnits.police - (units - fromFire));
  };

  for (const row of grid) {
    for (const tile of row) tile.incidentSeverity = 0;
  }

  const orderedPrevious = [...previous].sort((a, b) => (
    incidentPriority(b) - incidentPriority(a) || a.id.localeCompare(b.id)
  ));
  for (const incident of orderedPrevious) {
    const attached = attachDispatchPath({ ...incident }, grid, roadGraph);
    const agency = agencyForIncident(attached.type);
    const updated = assignDispatchUnits(attached, serviceCapacity, availableForAgency(agency));
    consumeUnits(agency, updated.dispatchedUnits ?? 0);
    const remainingDays = Math.round((incident.remainingDays - responseFactor(updated, serviceResponseQuality, serviceCapacity)) * 10) / 10;
    if (remainingDays <= 0) {
      resolved += 1;
      continue;
    }
    const progressGain = responseFactor(updated, serviceResponseQuality, serviceCapacity) * (0.7 + (updated.dispatchedUnits ?? 0) / Math.max(1, updated.requiredUnits ?? 1) * 0.3);
    const activeIncident = { ...updated, remainingDays, responseProgress: Math.min(100, Math.round(((updated.responseProgress ?? 0) + progressGain * 100) * 10) / 10) };
    incidents.push(activeIncident);
    dispatchedUnits += activeIncident.dispatchedUnits ?? 0;
    queuedUnits += Math.max(0, (activeIncident.requiredUnits ?? 0) - (activeIncident.dispatchedUnits ?? 0));
    const tile = grid[activeIncident.y]?.[activeIncident.x];
    if (tile) tile.incidentSeverity = Math.max(tile.incidentSeverity ?? 0, activeIncident.severity);
  }

  const occupied = new Set(incidents.map((incident) => incidentKey(incident.x, incident.y)));
  const activeFireSources = incidents.filter((incident) => incident.type === 'FIRE' && incident.severity >= 2);
  const candidates: IncidentCandidate[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = grid[y][x];
      let type: CityIncidentType | null = null;
      let risk = 0;
      if (tile.type === TileType.INDUSTRIAL) {
        type = 'FIRE';
        risk = 0.008 + Math.min(0.08, (tile.pollution ?? 0) / 1800) + Math.min(0.04, (tile.traffic ?? 0) / 2500);
      } else if (tile.type === TileType.RESIDENTIAL && tile.population > 0) {
        type = 'MEDICAL';
        risk = 0.004 + Math.min(0.06, tile.population / 15000) + Math.min(0.025, (100 - (tile.health ?? 50)) / 3000);
      } else if (tile.type === TileType.COMMERCIAL && tile.jobs > 0) {
        type = 'CRIME';
        risk = 0.005 + Math.min(0.06, (tile.crime ?? 30) / 1800) + Math.min(0.025, (tile.traffic ?? 0) / 3000);
      } else if (tile.type === TileType.ROAD && tile.traffic > 35) {
        type = 'TRAFFIC';
        risk = 0.004 + Math.min(0.07, tile.traffic / 1500);
      }
      const adjacentFire = activeFireSources.find((source) => (
        Math.abs(source.x - x) + Math.abs(source.y - y) === 1
        && tile.type !== TileType.EMPTY
        && tile.type !== TileType.ROAD
        && !tile.water
      ));
      if (adjacentFire) {
        type = 'FIRE';
        // A severe fire with no available fire capacity spreads immediately;
        // otherwise it remains a bounded probabilistic chain.
        risk = adjacentFire.severity >= 3 && serviceCapacity.fire < 75
          ? 1
          : 0.025 + adjacentFire.severity * 0.018;
      }
      if (!type || occupied.has(incidentKey(x, y))) continue;
      const severity = risk > 0.06 ? 3 : risk > 0.025 ? 2 : 1;
      candidates.push({ x, y, type, risk, severity, chainFrom: adjacentFire?.id });
    }
  }

  // A deterministic jitter prevents a fixed scan-order bias while retaining
  // reproducibility for saves, replays, and tests.
  candidates.sort((a, b) => (b.risk + prng.next() * 0.01) - (a.risk + prng.next() * 0.01));
  const spawned: CityIncident[] = [];
  for (const candidate of candidates.slice(0, 36)) {
    const forcedFireSpread = Boolean(candidate.chainFrom && candidate.risk >= 1);
    if (spawned.length >= 2 || (!forcedFireSpread && !prng.chance(Math.min(0.18, candidate.risk)))) continue;
    const key = incidentKey(candidate.x, candidate.y);
    if (occupied.has(key)) continue;
    const roadConnected = Boolean(getAdjacentRoadNodeKey(candidate.x, candidate.y, roadGraph));
    const attached = attachDispatchPath({
      id: `incident-${day}-${candidate.x}-${candidate.y}-${candidate.type.toLowerCase()}`,
      type: candidate.type,
      x: candidate.x,
      y: candidate.y,
      severity: candidate.severity,
      createdDay: day,
      remainingDays: candidate.type === 'CRIME' ? 4 : candidate.type === 'FIRE' ? 3 : 2,
      roadConnected,
      parentIncidentId: candidate.chainFrom,
    }, grid, roadGraph);
    const agency = agencyForIncident(attached.type);
    const incident = assignDispatchUnits(attached, serviceCapacity, availableForAgency(agency));
    consumeUnits(agency, incident.dispatchedUnits ?? 0);
    occupied.add(key);
    spawned.push(incident);
    incidents.push(incident);
    dispatchedUnits += incident.dispatchedUnits ?? 0;
    queuedUnits += Math.max(0, (incident.requiredUnits ?? 0) - (incident.dispatchedUnits ?? 0));
    const tile = grid[candidate.y]?.[candidate.x];
    if (tile) tile.incidentSeverity = Math.max(tile.incidentSeverity ?? 0, incident.severity);
  }

  const responseLoad = Math.round(incidents.reduce((sum, incident) => sum + incident.severity * incident.remainingDays + Math.max(0, (incident.requiredUnits ?? 0) - (incident.dispatchedUnits ?? 0)) * 0.35, 0) * 10) / 10;
  const happinessPenalty = Math.round(clamp(responseLoad * 0.45 + spawned.length * 0.8, 0, 25) * 10) / 10;
  return { incidents, spawned, resolved, responseLoad, happinessPenalty, dispatchedUnits, queuedUnits };
}
