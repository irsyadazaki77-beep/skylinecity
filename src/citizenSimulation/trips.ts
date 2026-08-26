import { RoadLaneState, TileData, TileType, TransitLine, TurnMovement } from '../types';
import { RoadGraph, getAdjacentRoadNodeKey, getCrosswalkTurnFriction, getRoadNodeKey, getTimeSlicedDischargeRatio, getTurnMovement, getTurnPenalty } from '../traffic';
import { SeededRandom } from './prng';
import { TransitAvailability } from '../transit';
import type { FreightTrip } from '../logistics';
import { hasNearbyParking } from '../parking';
import { 
  Citizen, 
  Household, 
  Trip, 
  TripPurpose, 
  TransitMode, 
  AgeStage 
} from './types';

/**
 * Finds the fastest road path between two road nodes using weighted Dijkstra.
 */
export function findRoadPath(
  startKey: string,
  endKey: string,
  roadGraph: RoadGraph,
  assignmentLoads?: Map<string, number>,
): [number, number][] {
  if (startKey === endKey) {
    const node = roadGraph.nodes.get(startKey);
    return node ? [[node.x, node.y]] : [];
  }

  type SearchState = { id: string; previousKey?: string; currentKey: string; cost: number };
  const startState: SearchState = { id: `START>${startKey}`, currentKey: startKey, cost: 0 };
  const queue: SearchState[] = [startState];
  const distances = new Map<string, number>([[startState.id, 0]]);
  const states = new Map<string, SearchState>([[startState.id, startState]]);
  const parent = new Map<string, string>();

  // Small binary min-heap keeps weighted routing fast without pulling in a
  // general-purpose graph dependency for the 60x60 simulation grid.
  const push = (entry: SearchState) => {
    queue.push(entry);
    let index = queue.length - 1;
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (queue[parentIndex].cost <= queue[index].cost) break;
      [queue[parentIndex], queue[index]] = [queue[index], queue[parentIndex]];
      index = parentIndex;
    }
  };
  const pop = (): SearchState | undefined => {
    if (queue.length === 0) return undefined;
    const result = queue[0];
    const last = queue.pop()!;
    if (queue.length > 0) {
      queue[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < queue.length && queue[left].cost < queue[smallest].cost) smallest = left;
        if (right < queue.length && queue[right].cost < queue[smallest].cost) smallest = right;
        if (smallest === index) break;
        [queue[index], queue[smallest]] = [queue[smallest], queue[index]];
        index = smallest;
      }
    }
    return result;
  };

  let foundStateId: string | undefined;
  while (queue.length > 0) {
    const current = pop()!;
    if (current.cost > (distances.get(current.id) ?? Infinity)) continue;
    const currentKey = current.currentKey;
    if (currentKey === endKey) {
      foundStateId = current.id;
      break;
    }

    const node = roadGraph.nodes.get(currentKey);
    if (!node) continue;

    for (const neighborKey of node.neighbors) {
      const neighbor = roadGraph.nodes.get(neighborKey);
      const congestionPenalty = 1 + ((neighbor?.traffic ?? 0) / 100) * 0.8;
      const laneAssignmentPenalty = 1
        + ((neighbor?.laneUtilization ?? 0) / 100) * 0.24
        + ((neighbor?.laneChangePressure ?? 0) / 100) * 0.16
        + ((neighbor?.queuePressure ?? 0) / 100) * 0.32;
      // During trip generation, previously assigned demand becomes a soft
      // toll. This is a lightweight stochastic/user-equilibrium assignment:
      // corridors that are already absorbing cars become less attractive,
      // while the persisted telemetry still dominates once the city is live.
      const assignedLoad = assignmentLoads?.get(neighborKey) ?? 0;
      const assignmentPenalty = assignmentLoads
        ? 1 + Math.min(1.4, assignedLoad / Math.max(1, neighbor?.capacity ?? 20) * 0.65)
        : 1;
      const intersectionDelay = neighbor?.intersectionDelay ?? 1;
      const turnPenalty = getTurnPenalty(roadGraph, current.previousKey, currentKey, neighborKey);
      const gradePenalty = neighbor && node.roadStructure !== 'BRIDGE' && neighbor.roadStructure !== 'BRIDGE'
        ? 1 + Math.abs(neighbor.elevation - node.elevation) * 0.18
        : 1;
      const nextCost = current.cost
        + (neighbor?.speedMultiplier ?? 1)
        * congestionPenalty
        * laneAssignmentPenalty
        * assignmentPenalty
        * intersectionDelay
        * gradePenalty
        * turnPenalty;
      const nextState: SearchState = {
        id: `${currentKey}>${neighborKey}`,
        previousKey: currentKey,
        currentKey: neighborKey,
        cost: nextCost,
      };
      if (nextCost < (distances.get(nextState.id) ?? Infinity)) {
        distances.set(nextState.id, nextCost);
        states.set(nextState.id, nextState);
        parent.set(nextState.id, current.id);
        push(nextState);
      }
    }
  }

  if (!foundStateId) return [];

  // Reconstruct path
  const pathKeys: string[] = [];
  let curr: string | undefined = foundStateId;
  while (curr) {
    const state = states.get(curr);
    if (!state) break;
    pathKeys.unshift(state.currentKey);
    curr = parent.get(curr);
  }

  return pathKeys.filter((key, index) => index === 0 || key !== pathKeys[index - 1]).map((key) => {
    const node = roadGraph.nodes.get(key)!;
    return [node.x, node.y];
  });
}

export interface TransitRouteAccess {
  available: boolean;
  lineIds: string[];
  transfers: number;
}

/**
 * Resolves whether an origin and destination can use the configured transit
 * lines. Citizens get a small walking catchment around each stop; a direct
 * line uses zero transfers, while lines sharing stops form a transfer graph.
 * The shortest line chain is selected, so a regional trip may use more than
 * one transfer. An empty line list preserves the automatic-facility fallback
 * model.
 */
export function findTransitLineAccess(
  origin: { x: number; y: number },
  destination: { x: number; y: number },
  lines: TransitLine[],
  catchment = 5,
): TransitRouteAccess {
  const activeLines = lines.filter((line) => line.active && line.stops.length >= 2);
  if (activeLines.length === 0) return { available: true, lineIds: [], transfers: 0 };

  const nearbyLineIds = (point: { x: number; y: number }) => activeLines
    .filter((line) => line.stops.some(([x, y]) => Math.abs(x - point.x) + Math.abs(y - point.y) <= catchment))
    .map((line) => line.id);
  const originLineIds = nearbyLineIds(origin);
  const destinationLineIds = nearbyLineIds(destination);

  for (const lineId of originLineIds) {
    if (destinationLineIds.includes(lineId)) return { available: true, lineIds: [lineId], transfers: 0 };
  }

  const lineIdsByStop = new Map<string, string[]>();
  for (const line of activeLines) {
    for (const [x, y] of line.stops) {
      const key = `${x},${y}`;
      const lineIds = lineIdsByStop.get(key) ?? [];
      if (!lineIds.includes(line.id)) lineIds.push(line.id);
      lineIdsByStop.set(key, lineIds);
    }
  }

  const neighbors = new Map<string, Set<string>>();
  for (const line of activeLines) neighbors.set(line.id, new Set<string>());
  for (const lineIds of lineIdsByStop.values()) {
    for (const lineId of lineIds) {
      const lineNeighbors = neighbors.get(lineId)!;
      for (const otherLineId of lineIds) {
        if (otherLineId !== lineId) lineNeighbors.add(otherLineId);
      }
    }
  }

  const destinationSet = new Set(destinationLineIds);
  const queue = [...originLineIds];
  const parent = new Map<string, string | null>(originLineIds.map((lineId) => [lineId, null]));
  let queueIndex = 0;
  let found: string | null = null;
  while (queueIndex < queue.length) {
    const lineId = queue[queueIndex++];
    if (destinationSet.has(lineId)) {
      found = lineId;
      break;
    }
    for (const neighbor of neighbors.get(lineId) ?? []) {
      if (parent.has(neighbor)) continue;
      parent.set(neighbor, lineId);
      queue.push(neighbor);
    }
  }

  if (found) {
    const lineIds: string[] = [];
    let current: string | null = found;
    while (current) {
      lineIds.unshift(current);
      current = parent.get(current) ?? null;
    }
    return { available: true, lineIds, transfers: Math.max(0, lineIds.length - 1) };
  }

  return { available: false, lineIds: [], transfers: 0 };
}

/**
 * Generates trips for all active citizens (work commute, school commute, shopping, leisure).
 */
export function generateCitizenTrips(
  citizens: Map<string, Citizen>,
  households: Map<string, Household>,
  grid: TileData[][],
  roadGraph: RoadGraph,
  unlockedUpgrades: string[] = [],
  prng: SeededRandom,
  samplingFactor = 1,
  transitAvailability?: TransitAvailability,
): {
  trips: Trip[];
  averageCommuteTime: number;
  modeCounts: { car: number; transit: number; bike: number; walk: number };
} {
  const trips: Trip[] = [];
  const has = (id: string) => unlockedUpgrades.includes(id);

  let totalCommuteTime = 0;
  let workCommuteCount = 0;

  const modeCounts = { car: 0, transit: 0, bike: 0, walk: 0 };
  const transitCapacityFactor = transitAvailability?.enabled
    ? Math.min(1, transitAvailability.capacity / Math.max(20, citizens.size * 0.5))
    : 0;
  const transitCoverageFactor = Math.max(0, Math.min(1, (transitAvailability?.coverage ?? 0) / 100));
  const transitWaitFactor = transitAvailability?.averageWaitTime
    ? Math.max(0.45, Math.min(1, 15 / (15 + transitAvailability.averageWaitTime)))
    : 1;
  const transferFactor = transitAvailability?.transferOpportunities
    ? Math.min(1.12, 1 + transitAvailability.transferOpportunities * 0.04)
    : 1;
  const transitEffectiveness = Math.min(1, transitCapacityFactor * transitCoverageFactor * transitWaitFactor * transferFactor);

  // Collect potential commercial and park destinations for errands
  const commercialDestinations: { x: number; y: number }[] = [];
  const parkDestinations: { x: number; y: number }[] = [];

  const height = grid.length;
  const width = grid[0]?.length || 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x].type === TileType.COMMERCIAL && !grid[y][x].abandoned) {
        commercialDestinations.push({ x, y });
      } else if (grid[y][x].type === TileType.PARK) {
        parkDestinations.push({ x, y });
      }
    }
  }

  // Many citizens share the same residence/workplace road pairs. Cache
  // shortest paths within this tick so large cities avoid repeating BFS for
  // every individual commuter.
  const pathCache = new Map<string, [number, number][]>();
  const assignmentLoads = new Map<string, number>();

  for (const citizen of citizens.values()) {
    const household = households.get(citizen.householdId);
    if (!household) continue;

    const origin = household.residence;
    let destination: { x: number; y: number } | null = null;
    let purpose: TripPurpose = TripPurpose.COMMUTE_WORK;

    if (citizen.stage === AgeStage.ADULT || citizen.stage === AgeStage.STUDENT) {
      if (citizen.workplace) {
        destination = citizen.workplace.workplaceTile;
        purpose = TripPurpose.COMMUTE_WORK;
      } else if (citizen.stage === AgeStage.STUDENT && citizen.school) {
        destination = citizen.school;
        purpose = TripPurpose.COMMUTE_SCHOOL;
      } else if (commercialDestinations.length > 0 && prng.chance(0.4)) {
        destination = prng.pick(commercialDestinations) || null;
        purpose = TripPurpose.SHOPPING;
      }
    } else if (citizen.stage === AgeStage.CHILD) {
      if (citizen.school) {
        destination = citizen.school;
        purpose = TripPurpose.COMMUTE_SCHOOL;
      } else if (parkDestinations.length > 0 && prng.chance(0.5)) {
        destination = prng.pick(parkDestinations) || null;
        purpose = TripPurpose.LEISURE;
      }
    } else if (citizen.stage === AgeStage.SENIOR) {
      if (parkDestinations.length > 0 && prng.chance(0.6)) {
        destination = prng.pick(parkDestinations) || null;
        purpose = TripPurpose.LEISURE;
      } else if (commercialDestinations.length > 0 && prng.chance(0.3)) {
        destination = prng.pick(commercialDestinations) || null;
        purpose = TripPurpose.SHOPPING;
      }
    }

    if (!destination) continue;

    const manhattanDist = Math.abs(origin.x - destination.x) + Math.abs(origin.y - destination.y);
    if (manhattanDist === 0) continue;

    // Determine Transit Mode
    let mode: TransitMode = TransitMode.CAR;
    const transitRoute = findTransitLineAccess(origin, destination, transitAvailability?.lines ?? []);
    const routeTransitEffectiveness = transitRoute.available ? transitEffectiveness : 0;
    if (manhattanDist <= 2) {
      mode = TransitMode.WALK;
    } else if (has('bike_lanes') && manhattanDist <= 7 && prng.chance(0.35)) {
      mode = TransitMode.BIKE;
    } else if (
      transitAvailability?.enabled &&
      routeTransitEffectiveness > 0 &&
      ((transitAvailability.tram && has('tram_system') && prng.chance(0.45 * routeTransitEffectiveness)) ||
        (transitAvailability.bus && has('bus_network') && prng.chance(0.3 * routeTransitEffectiveness)))
    ) {
      mode = TransitMode.TRANSIT;
    }

    modeCounts[mode.toLowerCase() as keyof typeof modeCounts]++;

    // Route on Road Graph if vehicular or transit
    let path: [number, number][] = [];
    const originRoad = getAdjacentRoadNodeKey(origin.x, origin.y, roadGraph);
    const destRoad = getAdjacentRoadNodeKey(destination.x, destination.y, roadGraph);

    if (originRoad && destRoad) {
      const cacheKey = `${mode}:${originRoad}->${destRoad}`;
      const cachedPath = pathCache.get(cacheKey);
      if (cachedPath) {
        path = cachedPath;
      } else {
        path = findRoadPath(originRoad, destRoad, roadGraph, assignmentLoads);
        pathCache.set(cacheKey, path);
      }
      if (mode === TransitMode.CAR) {
        for (const [rx, ry] of path) {
          const key = getRoadNodeKey(rx, ry);
          assignmentLoads.set(key, (assignmentLoads.get(key) ?? 0) + samplingFactor);
        }
      }
    }

    const pathLength = path.length > 0 ? path.length : manhattanDist;
    const roadSpeedMultiplier = path.length > 0
      ? path.reduce((sum, [x, y]) => sum + (roadGraph.nodes.get(getRoadNodeKey(x, y))?.speedMultiplier ?? 1), 0) / path.length
      : 1;
    const asphaltMultiplier = has('asphalt_roads') ? 0.8 : 1.0;
    const transitWaitMinutes = mode === TransitMode.TRANSIT
      ? Math.round(transitAvailability?.averageWaitTime ?? 8)
      : 0;
    const transferMinutes = mode === TransitMode.TRANSIT ? transitRoute.transfers * 6 : 0;
    const travelTime = Math.max(1, Math.round(
      pathLength * roadSpeedMultiplier * asphaltMultiplier * (mode === TransitMode.WALK ? 2.5 : 1.2)
      + transitWaitMinutes
      + transferMinutes,
    ));

    if (purpose === TripPurpose.COMMUTE_WORK) {
      citizen.commuteTime = travelTime;
      totalCommuteTime += travelTime;
      workCommuteCount++;
    }

    trips.push({
      id: `trip-${citizen.id}-${purpose}`,
      citizenId: citizen.id,
      householdId: household.id,
      origin,
      destination,
      purpose,
      path,
      travelTime,
      mode,
      transitLineIds: mode === TransitMode.TRANSIT && transitRoute.lineIds.length > 0 ? transitRoute.lineIds : undefined,
      transfers: mode === TransitMode.TRANSIT ? transitRoute.transfers : undefined,
    });
  }

  const averageCommuteTime = workCommuteCount > 0
    ? Math.round((totalCommuteTime / workCommuteCount) * 10) / 10
    : 0;

  return {
    trips,
    averageCommuteTime,
    modeCounts,
  };
}

/**
 * Calculates road traffic congestion directly from real active trips traversing road segments.
 */
export function applyTripTrafficToRoads(
  grid: TileData[][],
  roadGraph: RoadGraph,
  trips: Trip[],
  unlockedUpgrades: string[] = [],
  samplingFactor = 1,
  freightTrips: FreightTrip[] = [],
): {
  trafficAverage: number;
  congestionIndex: number;
  averageQueuePressure: number;
  roadLoads: Map<string, number>;
} {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const has = (id: string) => unlockedUpgrades.includes(id);

  const roadLoads = new Map<string, number>();
  const intersectionTurnLoads = new Map<string, Map<TurnMovement, number>>();
  const intersectionAxisLoads = new Map<string, { NORTH_SOUTH: number; EAST_WEST: number }>();
  const laneLoads = new Map<string, number[]>();
  const laneChangeLoads = new Map<string, number>();

  const laneForMovement = (lanes: number, movement: TurnMovement): number => {
    if (lanes <= 1) return 0;
    if (movement === 'RIGHT') return 0;
    if (movement === 'LEFT' || movement === 'U_TURN') return lanes - 1;
    return Math.floor(lanes / 2);
  };

  const upcomingMovement = (trip: Trip, pathIndex: number): TurnMovement => {
    const lookaheadLimit = Math.min(trip.path.length - 2, pathIndex + 4);
    for (let candidateIndex = Math.max(1, pathIndex); candidateIndex <= lookaheadLimit; candidateIndex += 1) {
      const previousKey = getRoadNodeKey(trip.path[candidateIndex - 1][0], trip.path[candidateIndex - 1][1]);
      const currentKey = getRoadNodeKey(trip.path[candidateIndex][0], trip.path[candidateIndex][1]);
      const nextKey = getRoadNodeKey(trip.path[candidateIndex + 1][0], trip.path[candidateIndex + 1][1]);
      if (roadGraph.nodes.get(currentKey)?.isIntersection) {
        return getTurnMovement(roadGraph, previousKey, currentKey, nextKey);
      }
    }
    return 'STRAIGHT';
  };

  const addLaneLoad = (key: string, lane: number, lanes: number, amount: number) => {
    const loads = laneLoads.get(key) ?? Array.from({ length: Math.max(1, lanes) }, () => 0);
    const safeLane = Math.max(0, Math.min(loads.length - 1, lane));
    loads[safeLane] += amount;
    laneLoads.set(key, loads);
  };

  // Reset road loads
  for (const node of roadGraph.nodes.values()) {
    roadLoads.set(node.key, 0);
  }

  // Accumulate vehicle load from CAR trips directly onto traversed road tiles
  for (const trip of trips) {
    if (trip.mode !== TransitMode.CAR) continue;

    const firstNode = trip.path[0]
      ? roadGraph.nodes.get(getRoadNodeKey(trip.path[0][0], trip.path[0][1]))
      : undefined;
    let previousLane = firstNode ? Math.floor(firstNode.lanes / 2) : 0;
    for (let pathIndex = 0; pathIndex < trip.path.length; pathIndex += 1) {
      const [rx, ry] = trip.path[pathIndex];
      const key = getRoadNodeKey(rx, ry);
      const currentLoad = roadLoads.get(key) ?? 0;
      roadLoads.set(key, currentLoad + 1 * samplingFactor);

      const roadNode = roadGraph.nodes.get(key);
      if (roadNode) {
        const normalizedPreviousLane = Math.max(0, Math.min(roadNode.lanes - 1, previousLane));
        const targetLane = laneForMovement(roadNode.lanes, upcomingMovement(trip, pathIndex));
        const laneDelta = Math.abs(targetLane - normalizedPreviousLane);
        if (laneDelta > 0) {
          laneChangeLoads.set(key, (laneChangeLoads.get(key) ?? 0) + laneDelta * samplingFactor);
        }
        addLaneLoad(key, targetLane, roadNode.lanes, samplingFactor);
        previousLane = targetLane;
      }
    }

    // Assign each vehicle to a movement bucket at intersections. This gives
    // turning lanes their own pressure signal instead of hiding all demand in
    // one undifferentiated road-tile load.
    for (let pathIndex = 1; pathIndex < trip.path.length - 1; pathIndex += 1) {
      const previousKey = getRoadNodeKey(trip.path[pathIndex - 1][0], trip.path[pathIndex - 1][1]);
      const currentKey = getRoadNodeKey(trip.path[pathIndex][0], trip.path[pathIndex][1]);
      const nextKey = getRoadNodeKey(trip.path[pathIndex + 1][0], trip.path[pathIndex + 1][1]);
      const intersection = roadGraph.nodes.get(currentKey);
      if (!intersection?.isIntersection) continue;
      const movement = getTurnMovement(roadGraph, previousKey, currentKey, nextKey);
      const movementLoads = intersectionTurnLoads.get(currentKey) ?? new Map<TurnMovement, number>();
      movementLoads.set(movement, (movementLoads.get(movement) ?? 0) + samplingFactor);
      intersectionTurnLoads.set(currentKey, movementLoads);
      const axisLoads = intersectionAxisLoads.get(currentKey) ?? { NORTH_SOUTH: 0, EAST_WEST: 0 };
      if (previousKey.split(',')[0] === currentKey.split(',')[0]) axisLoads.NORTH_SOUTH += samplingFactor;
      else axisLoads.EAST_WEST += samplingFactor;
      intersectionAxisLoads.set(currentKey, axisLoads);
    }

    // A car trip that cannot find a nearby lot adds circling/curb-search
    // traffic to its destination approach. Parking lots can therefore be a
    // real mobility investment instead of a purely decorative asset.
    const destinationTile = grid[trip.destination.y]?.[trip.destination.x];
    const finalPath = trip.path[trip.path.length - 1];
    if (destinationTile && finalPath && !hasNearbyParking(grid, destinationTile.x, destinationTile.y)) {
      const finalKey = getRoadNodeKey(finalPath[0], finalPath[1]);
      roadLoads.set(finalKey, (roadLoads.get(finalKey) ?? 0) + 0.35 * samplingFactor);
    }
  }

  // Freight trucks are heavier and consume more road capacity than a single
  // passenger car. Cargo is intentionally scaled to a vehicle-equivalent load
  // so logistics remain bounded while still changing congestion outcomes.
  for (const trip of freightTrips) {
    const vehicleEquivalent = Math.max(0.5, trip.cargo * 0.08) * samplingFactor;
    for (const [rx, ry] of trip.path) {
      const key = getRoadNodeKey(rx, ry);
      const currentLoad = roadLoads.get(key) ?? 0;
      roadLoads.set(key, currentLoad + vehicleEquivalent);
      const roadNode = roadGraph.nodes.get(key);
      if (roadNode) addLaneLoad(key, Math.floor(roadNode.lanes / 2), roadNode.lanes, vehicleEquivalent);
    }
  }

  const baseCapacity = 18 + (has('asphalt_roads') ? 14 : 0);
  let totalTraffic = 0;
  let roadTileCount = 0;
  let congestionSum = 0;
  let queuePressureSum = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type !== TileType.ROAD) {
        tile.traffic = 0;
        tile.queuePressure = 0;
        continue;
      }

      const key = getRoadNodeKey(x, y);
      const load = roadLoads.get(key) || 0;
      const roadNode = roadGraph.nodes.get(key);
      const intersectionPenalty = roadNode?.isIntersection
        ? (has('smart_lights') ? 0.92 : roadNode.intersectionDelay)
        : 1.0;
      const roadCapacity = roadNode?.capacity ?? baseCapacity;
      const laneVector = laneLoads.get(key) ?? [];
      const peakLaneLoad = laneVector.length > 0 ? Math.max(...laneVector) : 0;
      const laneCount = Math.max(1, roadNode?.lanes ?? 1);
      const totalUtilization = load / Math.max(1, roadCapacity);
      const peakLaneUtilization = peakLaneLoad / Math.max(1, roadCapacity / laneCount);
      const laneSpillback = Math.max(0, peakLaneUtilization - totalUtilization);
      const laneChangePressure = Math.min(1, (laneChangeLoads.get(key) ?? 0) / Math.max(1, load));
      const movementLoads = intersectionTurnLoads.get(key);
      const weightedTurnLoad = movementLoads
        ? (movementLoads.get('STRAIGHT') ?? 0)
          + (movementLoads.get('LEFT') ?? 0) * 1.35
          + (movementLoads.get('RIGHT') ?? 0) * 1.12
          + (movementLoads.get('U_TURN') ?? 0) * 1.65
        : 0;
      const lanePressure = roadNode?.isIntersection && load > 0
        ? 1 + Math.min(0.38, Math.max(0, weightedTurnLoad / Math.max(1, load) - 1) * (roadNode.lanes < 2 ? 0.35 : 0.18))
        : 1;
      const axisLoads = intersectionAxisLoads.get(key);
      const opposingPhasePressure = roadNode?.isIntersection && roadNode.signalized && roadNode.signalPhase !== 'ALL' && axisLoads && load > 0
        ? 1 + Math.min(0.3, (roadNode.signalPhase === 'NORTH_SOUTH' ? axisLoads.EAST_WEST : axisLoads.NORTH_SOUTH) / Math.max(1, load) * 0.3)
        : 1;
      const laneSpillbackPressure = 1 + Math.min(0.35, laneSpillback * 0.35);
      const laneChangePenalty = 1 + Math.min(0.22, laneChangePressure * 0.22);
      const baseDischargeRatio = roadNode?.isIntersection
        ? roadNode.signalized
          ? getTimeSlicedDischargeRatio(roadNode)
          : roadNode.intersectionControl === 'ROUNDABOUT'
            ? 0.88
            : roadNode.intersectionControl === 'STOP'
              ? 0.68
              : 0.76
        : 1;
      const turnLoad = movementLoads
        ? (movementLoads.get('LEFT') ?? 0) + (movementLoads.get('RIGHT') ?? 0)
        : 0;
      const totalMovementLoad = movementLoads
        ? Array.from(movementLoads.values()).reduce((sum, value) => sum + value, 0)
        : 0;
      // Turners cross the pedestrian desire line even while vehicles have a
      // green. Apply the fixed crosswalk friction to only that movement share.
      const pedestrianTurnFriction = totalMovementLoad > 0
        ? 1 - (turnLoad / totalMovementLoad) * (1 - getCrosswalkTurnFriction('LEFT'))
        : 1;
      const dischargeRatio = roadNode?.isIntersection && roadNode.signalized
        ? baseDischargeRatio * pedestrianTurnFriction
        : baseDischargeRatio;
      const instantaneousQueue = dischargeRatio > 0
        ? Math.min(1, Math.max(0, peakLaneUtilization / Math.max(0.1, dischargeRatio) - 1))
        : peakLaneUtilization > 0 ? 1 : 0;
      const previousQueue = Math.max(0, Math.min(1, (tile.queuePressure ?? 0) / 100));
      const queueInflux = instantaneousQueue * (roadNode?.isIntersection ? 0.48 : 0.36);
      const queueRelease = dischargeRatio > 0
        ? Math.min(previousQueue, dischargeRatio * (instantaneousQueue > 0 ? 0.08 : 0.24))
        : 0;
      // Queue pressure is intentionally stateful. A saturated approach keeps
      // a memory of the backlog, while a quiet approach drains it over several
      // ticks instead of teleporting from gridlock to empty.
      const queuePressure = Math.min(1, Math.max(0, previousQueue + queueInflux - queueRelease));

      const congestion = Math.min(100, Math.round(((load / Math.max(1, roadCapacity)) * 100 * intersectionPenalty * lanePressure * opposingPhasePressure * laneSpillbackPressure * laneChangePenalty) * 10) / 10);
      tile.traffic = congestion;
      tile.laneUtilization = Math.round(Math.min(1, peakLaneUtilization) * 1000) / 10;
      tile.laneChangePressure = Math.round(laneChangePressure * 1000) / 10;
      tile.queuePressure = Math.round(queuePressure * 1000) / 10;
      tile.laneStates = (laneVector.length > 0 ? laneVector : Array.from({ length: laneCount }, () => 0)).map((laneLoad, laneIndex): RoadLaneState => ({
        laneIndex,
        load: Math.round(laneLoad * 10) / 10,
        queue: Math.round(Math.max(0, laneLoad - (roadCapacity / laneCount) * dischargeRatio) * 10) / 10,
        dischargeRate: Math.round((roadCapacity / laneCount) * dischargeRatio * 10) / 10,
      }));

      totalTraffic += congestion;
      roadTileCount++;
      congestionSum += Math.max(0, congestion - 50);
      queuePressureSum += tile.queuePressure;
    }
  }

  const trafficAverage = roadTileCount > 0 ? Math.round((totalTraffic / roadTileCount) * 10) / 10 : 0;
  const congestionIndex = roadTileCount > 0
    ? Math.round(Math.min(100, (congestionSum / roadTileCount) * 2) * 10) / 10
    : 0;
  const averageQueuePressure = roadTileCount > 0
    ? Math.round((queuePressureSum / roadTileCount) * 10) / 10
    : 0;

  return {
    trafficAverage,
    congestionIndex,
    averageQueuePressure,
    roadLoads,
  };
}
