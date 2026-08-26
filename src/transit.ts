import { TileData, TileType, TransitLine } from './types';
import { RoadGraph, getAdjacentRoadNodeKey, getRoadNodeKey } from './traffic';

export interface TransitNetworkResult {
  busDepots: number;
  tramStations: number;
  transitCapacity: number;
  transitRidership: number;
  transitCoverage: number;
  coveredPopulation: number;
  reachableRoads: Set<string>;
  activeLines: number;
  activeVehicles: number;
  averageWaitTime: number;
  transferOpportunities: number;
  activeLineDetails: TransitLine[];
  vehicleAgents: TransitVehicleAgent[];
  platformCapacity: number;
  averageDwellTime: number;
  fareRevenue: number;
  operatingCost: number;
}

export interface TransitVehicleAgent {
  id: string;
  lineId: string;
  mode: TransitLine['mode'];
  path: [number, number][];
  headway: number;
  capacity: number;
  occupancy: number;
  dwellTime: number;
  /** Normalized position on the closed road path, persisted for telemetry. */
  routeProgress?: number;
  /** Current and next scheduled stop indexes on the line. */
  currentStopIndex?: number;
  nextStopIndex?: number;
  /** Approximate minutes until the next stop on the current loop. */
  etaMinutes?: number;
}

export interface TransitAvailability {
  enabled: boolean;
  bus: boolean;
  tram: boolean;
  coverage: number;
  capacity: number;
  activeVehicles: number;
  averageWaitTime: number;
  transferOpportunities: number;
  lines?: TransitLine[];
  vehicleAgents?: TransitVehicleAgent[];
  platformCapacity?: number;
  averageDwellTime?: number;
}

interface TransitFacilitySpec {
  type: TileType;
  range: number;
  capacity: number;
}

const BUS_SPEC: TransitFacilitySpec = {
  type: TileType.BUS_DEPOT,
  range: 18,
  capacity: 80,
};

const TRAM_SPEC: TransitFacilitySpec = {
  type: TileType.TRAM_STATION,
  range: 28,
  capacity: 150,
};

function isBusFacility(type: TileType): boolean {
  return type === TileType.BUS_DEPOT || type === TileType.BUS_STOP;
}

function isTramFacility(type: TileType): boolean {
  return type === TileType.TRAM_STATION || type === TileType.TRAM_STOP;
}

function collectReachableRoads(
  startKey: string,
  roadGraph: RoadGraph,
  range: number,
  reachableRoads: Set<string>,
): void {
  const distances = new Map<string, number>([[startKey, 0]]);
  const queue: string[] = [startKey];
  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const key = queue[queueIndex++];
    const distance = distances.get(key) ?? 0;
    reachableRoads.add(key);
    if (distance >= range) continue;

    const node = roadGraph.nodes.get(key);
    if (!node) continue;
    for (const neighbor of node.neighbors) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, distance + 1);
        queue.push(neighbor);
      }
    }
  }
}

function areStopsOnOneRoadNetwork(
  stops: [number, number][],
  roadGraph: RoadGraph,
): boolean {
  const stopRoadKeys = stops.map(([x, y]) => getAdjacentRoadNodeKey(x, y, roadGraph));
  if (stopRoadKeys.some((key) => !key)) return false;

  const targets = new Set(stopRoadKeys as string[]);
  const start = stopRoadKeys[0] as string;
  const visited = new Set<string>([start]);
  const queue = [start];
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const key = queue[queueIndex++];
    const node = roadGraph.nodes.get(key);
    if (!node) continue;
    for (const neighbor of node.neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return [...targets].every((key) => visited.has(key));
}

export function isTransitLineOperating(line: TransitLine, timeOfDay: number): boolean {
  const start = Math.max(0, Math.min(23, line.serviceStartHour ?? 5));
  const end = Math.max(start + 1, Math.min(24, line.serviceEndHour ?? 24));
  return timeOfDay >= start && timeOfDay < end;
}

function getLineHeadway(line: TransitLine, timeOfDay: number): number {
  const peakStart = Math.max(0, Math.min(23, line.peakStartHour ?? 7));
  const peakEnd = Math.max(peakStart + 1, Math.min(24, line.peakEndHour ?? 9));
  const isPeak = timeOfDay >= peakStart && timeOfDay < peakEnd;
  return Math.max(1, isPeak ? (line.peakFrequency ?? Math.max(1, Math.round(line.frequency * 0.65))) : line.frequency);
}

function calculateFleetMetrics(validLines: TransitLine[], fallbackVehicles: number, timeOfDay: number): {
  activeVehicles: number;
  averageWaitTime: number;
  transferOpportunities: number;
} {
  if (validLines.length === 0) {
    return {
      activeVehicles: fallbackVehicles,
      averageWaitTime: fallbackVehicles > 0 ? 12 : 0,
      transferOpportunities: 0,
    };
  }

  let activeVehicles = 0;
  let weightedWait = 0;
  let totalFrequencyWeight = 0;
  const stopLines = new Map<string, Set<string>>();

  for (const line of validLines) {
    // A longer line needs more vehicles to maintain the requested headway.
    // This is an aggregate fleet model until individual vehicle agents exist.
    const frequency = getLineHeadway(line, timeOfDay);
    activeVehicles += getLineFleetSize(line, timeOfDay);
    weightedWait += (frequency / 2) * frequency;
    totalFrequencyWeight += frequency;

    for (const [x, y] of line.stops) {
      const key = `${x},${y}`;
      const linesAtStop = stopLines.get(key) ?? new Set<string>();
      linesAtStop.add(line.id);
      stopLines.set(key, linesAtStop);
    }
  }

  const transferOpportunities = [...stopLines.values()]
    .filter((lineIds) => lineIds.size >= 2)
    .length;
  const averageWaitTime = totalFrequencyWeight > 0
    ? Math.round((weightedWait / totalFrequencyWeight) * 10) / 10
    : 0;

  return { activeVehicles, averageWaitTime, transferOpportunities };
}

function getLineFleetSize(line: TransitLine, timeOfDay: number): number {
  const cycleTime = Math.max(8, line.stops.length * 3 + 5);
  return Math.max(1, Math.ceil(cycleTime / getLineHeadway(line, timeOfDay)));
}

function findRoadPathKeys(startKey: string, endKey: string, roadGraph: RoadGraph): string[] {
  if (startKey === endKey) return [startKey];
  const queue = [startKey];
  const parent = new Map<string, string>();
  const visited = new Set<string>([startKey]);
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const key = queue[queueIndex++];
    const node = roadGraph.nodes.get(key);
    if (!node) continue;
    for (const neighbor of node.neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, key);
      if (neighbor === endKey) {
        const path = [endKey];
        let current = endKey;
        while (current !== startKey) {
          current = parent.get(current)!;
          path.unshift(current);
        }
        return path;
      }
      queue.push(neighbor);
    }
  }
  return [];
}

function buildVehicleAgents(validLines: TransitLine[], roadGraph: RoadGraph, timeOfDay: number, day: number): {
  agents: TransitVehicleAgent[];
  platformCapacity: number;
  averageDwellTime: number;
} {
  const agents: TransitVehicleAgent[] = [];
  let platformCapacity = 0;
  let dwellTotal = 0;

  for (const line of validLines) {
    const stopRoadKeys = line.stops.map(([x, y]) => getAdjacentRoadNodeKey(x, y, roadGraph));
    if (stopRoadKeys.some((key) => !key)) continue;
    const cycleKeys = [...stopRoadKeys, stopRoadKeys[0]] as string[];
    const pathKeys: string[] = [];
    const stopPathIndices: number[] = [];
    for (let index = 0; index < cycleKeys.length - 1; index += 1) {
      const segment = findRoadPathKeys(cycleKeys[index], cycleKeys[index + 1], roadGraph);
      if (segment.length === 0) {
        pathKeys.length = 0;
        stopPathIndices.length = 0;
        break;
      }
      if (index === 0) {
        stopPathIndices.push(0);
        pathKeys.push(...segment);
      } else {
        pathKeys.push(...segment.slice(1));
        stopPathIndices.push(Math.max(0, pathKeys.length - segment.length));
      }
    }
    if (pathKeys.length < 2) continue;

    const capacity = line.mode === 'TRAM' ? TRAM_SPEC.capacity : BUS_SPEC.capacity;
    const dwellTime = line.mode === 'TRAM' ? 2.5 : 1.5;
    platformCapacity += line.stops.length * Math.round(capacity * 0.5);
    const path = pathKeys.map((key) => {
      const node = roadGraph.nodes.get(key)!;
      return [node.x, node.y] as [number, number];
    });
    const headway = getLineHeadway(line, timeOfDay);
    const fleetSize = getLineFleetSize(line, timeOfDay);
    const cycleMinutes = Math.max(8, line.stops.length * 3 + 5);
    const absoluteServiceMinutes = Math.max(0, day - 1) * 24 * 60 + Math.max(0, timeOfDay) * 60;
    const pathSegments = Math.max(1, path.length - 1);
    for (let vehicleIndex = 0; vehicleIndex < fleetSize; vehicleIndex += 1) {
      const routeProgress = ((absoluteServiceMinutes / cycleMinutes + vehicleIndex / fleetSize) % 1 + 1) % 1;
      const pathPosition = routeProgress * pathSegments;
      let currentStopIndex = 0;
      for (let stopIndex = 0; stopIndex < stopPathIndices.length; stopIndex += 1) {
        if (stopPathIndices[stopIndex] <= pathPosition) currentStopIndex = stopIndex;
      }
      const nextStopIndex = (currentStopIndex + 1) % Math.max(1, line.stops.length);
      const nextPathPosition = nextStopIndex === 0 ? pathSegments : (stopPathIndices[nextStopIndex] ?? pathSegments);
      const distanceToNextStop = Math.max(0, nextPathPosition - pathPosition);
      const etaMinutes = Math.round((distanceToNextStop / pathSegments * cycleMinutes) * 10) / 10;
      agents.push({
        id: `vehicle-${line.id}-${vehicleIndex + 1}`,
        lineId: line.id,
        mode: line.mode,
        path,
        headway,
        capacity,
        occupancy: 0,
        dwellTime,
        routeProgress,
        currentStopIndex,
        nextStopIndex,
        etaMinutes,
      });
      dwellTotal += dwellTime;
    }
  }

  return {
    agents,
    platformCapacity,
    averageDwellTime: agents.length > 0 ? Math.round((dwellTotal / agents.length) * 10) / 10 : 0,
  };
}

/**
 * Simulates a connected public-transport network. Depots/stations only count
 * when they touch a road and when the corresponding technology is unlocked.
 * Coverage is population-weighted, so an empty station does not make the
 * entire city appear served.
 */
export function simulateTransitNetwork(
  grid: TileData[][],
  roadGraph: RoadGraph,
  totalPopulation: number,
  unlockedUpgrades: string[] = [],
  transitLines: TransitLine[] = [],
  timeOfDay = 12,
  day = 1,
): TransitNetworkResult {
  const hasBus = unlockedUpgrades.includes('bus_network');
  const hasTram = unlockedUpgrades.includes('tram_system');
  const reachableRoads = new Set<string>();
  let busDepots = 0;
  let tramStations = 0;
  let transitCapacity = 0;

  const configuredLines = transitLines.length > 0;
  const validLines = transitLines.filter((line) => {
    if (!line.active || line.stops.length < 2) return false;
    if (line.mode === 'BUS' && !hasBus) return false;
    if (line.mode === 'TRAM' && !hasTram) return false;
    return line.stops.every(([x, y]) => {
      const tile = grid[y]?.[x];
      if (!tile || !tile.powered) return false;
      const validType = line.mode === 'BUS' ? isBusFacility(tile.type) : isTramFacility(tile.type);
      return validType && Boolean(getAdjacentRoadNodeKey(x, y, roadGraph));
    }) && areStopsOnOneRoadNetwork(line.stops, roadGraph);
  });
  const operatingLines = validLines.filter((line) => isTransitLineOperating(line, timeOfDay));
  const lineStopKeys = new Set(validLines.flatMap((line) => line.stops.map(([x, y]) => `${x},${y}`)));

  for (const row of grid) {
    for (const tile of row) tile.transitCovered = false;
  }

  for (const row of grid) {
    for (const tile of row) {
      const spec = isBusFacility(tile.type) && hasBus
        ? BUS_SPEC
        : isTramFacility(tile.type) && hasTram
          ? TRAM_SPEC
          : null;
      if (!spec || !tile.powered) continue;
      const isFleetDepot = tile.type === TileType.BUS_DEPOT || tile.type === TileType.TRAM_STATION;
      // A configured line restricts passenger coverage to its stops, but a
      // depot/station remains a fleet capacity provider even when vehicles do
      // not board passengers there.
      if (configuredLines && !lineStopKeys.has(`${tile.x},${tile.y}`) && !isFleetDepot) continue;

      const roadKey = getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph);
      if (!roadKey) continue;
      collectReachableRoads(roadKey, roadGraph, spec.range, reachableRoads);
      if (tile.type === TileType.BUS_DEPOT || tile.type === TileType.TRAM_STATION) transitCapacity += spec.capacity;
      if (tile.type === TileType.BUS_DEPOT) busDepots += 1;
      if (tile.type === TileType.TRAM_STATION) tramStations += 1;
    }
  }

  if (configuredLines) {
    if (validLines.length === 0) {
      transitCapacity = 0;
    } else {
      const operatingCapacity = operatingLines.reduce((sum, line) => {
        const base = line.mode === 'TRAM' ? TRAM_SPEC.capacity : BUS_SPEC.capacity;
        const frequencyFactor = Math.max(0.5, Math.min(2, 10 / getLineHeadway(line, timeOfDay)));
        return sum + Math.round(base * frequencyFactor);
      }, 0);
      transitCapacity = Math.min(transitCapacity, operatingCapacity);
    }
  }

  const fleetMetrics = calculateFleetMetrics(operatingLines, configuredLines ? 0 : busDepots + tramStations, timeOfDay);

  let coveredPopulation = 0;
  let cityPopulationOnRoads = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (tile.type !== TileType.RESIDENTIAL || tile.population <= 0) continue;
      cityPopulationOnRoads += tile.population;
      const roadKey = getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph);
      if (roadKey && reachableRoads.has(roadKey)) coveredPopulation += tile.population;
      if (roadKey && reachableRoads.has(roadKey)) tile.transitCovered = true;
    }
  }

  for (const row of grid) {
    for (const tile of row) {
      if (tile.type === TileType.ROAD) tile.transitCovered = reachableRoads.has(`${tile.x},${tile.y}`);
    }
  }

  const coverage = totalPopulation > 0
    ? Math.round(Math.min(100, (coveredPopulation / totalPopulation) * 100))
    : 0;
  const serviceCoverage = configuredLines && operatingLines.length === 0 ? 0 : coverage;
  const potentialDemand = Math.round(coveredPopulation * (tramStations > 0 ? 0.42 : 0.32));
  const waitFactor = fleetMetrics.averageWaitTime > 0
    ? Math.max(0.55, Math.min(1, 15 / (15 + fleetMetrics.averageWaitTime)))
    : 1;
  const transferFactor = fleetMetrics.transferOpportunities > 0 ? 1.08 : 1;
  const scheduledDemand = Math.round(potentialDemand * waitFactor * transferFactor);
  const transitRidership = configuredLines
    ? Math.min(transitCapacity, scheduledDemand)
    : Math.min(transitCapacity, potentialDemand);

  const fleetAgents = buildVehicleAgents(operatingLines, roadGraph, timeOfDay, day);
  const occupancyRatio = transitCapacity > 0 ? Math.min(1, transitRidership / transitCapacity) : 0;
  const vehicleAgents = fleetAgents.agents.map((agent) => ({
    ...agent,
    occupancy: Math.round(agent.capacity * occupancyRatio),
  }));

  // Transit is a city system with a budget trade-off, not a free coverage
  // toggle. Higher ridership funds service, while scheduled fleet and
  // platform capacity create a recurring operating obligation.
  const weightedFare = operatingLines.length > 0
    ? operatingLines.reduce((sum, line) => sum + (line.mode === 'TRAM' ? 2.2 : 1.5), 0) / operatingLines.length
    : tramStations > 0 ? 2.2 : 1.5;
  const scheduledBusVehicles = configuredLines
    ? vehicleAgents.filter((vehicle) => vehicle.mode === 'BUS').length
    : busDepots;
  const scheduledTramVehicles = configuredLines
    ? vehicleAgents.filter((vehicle) => vehicle.mode === 'TRAM').length
    : tramStations;
  const fareRevenue = Math.round(transitRidership * weightedFare);
  const operatingCost = Math.round(
    scheduledBusVehicles * 4
    + scheduledTramVehicles * 8
    + fleetAgents.platformCapacity * 0.015,
  );

  return {
    busDepots,
    tramStations,
    transitCapacity,
    transitRidership,
    transitCoverage: cityPopulationOnRoads > 0 ? serviceCoverage : 0,
    coveredPopulation,
    reachableRoads,
    activeLines: operatingLines.length,
    activeLineDetails: operatingLines,
    vehicleAgents,
    platformCapacity: fleetAgents.platformCapacity,
    averageDwellTime: fleetAgents.averageDwellTime,
    fareRevenue,
    operatingCost,
    ...fleetMetrics,
  };
}
