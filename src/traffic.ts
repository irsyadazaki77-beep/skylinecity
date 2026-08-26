import { getRoadClass, IntersectionControl, RoadClass, RoadStructure, SignalPhaseState, SignalStage, SignalTimingMode, TileData, TileType, TurnMovement } from './types';
import { GAME_CONFIG } from './config';

export interface RoadNode {
  key: string;
  x: number;
  y: number;
  roadClass: RoadClass;
  elevation: number;
  roadStructure: RoadStructure;
  lanes: number;
  capacity: number;
  speedMultiplier: number;
  traffic: number;
  laneUtilization: number;
  laneChangePressure: number;
  queuePressure: number;
  neighbors: string[];
  isIntersection: boolean;
  signalized: boolean;
  intersectionDelay: number;
  intersectionControl: IntersectionControl;
  signalTimingMode: SignalTimingMode;
  signalOffsetHours: number;
  signalStage: SignalStage;
  signalState: SignalPhaseState;
  pedestrianCrossing: boolean;
  prohibitedTurns: TurnMovement[];
  /** The dominant green phase used by the intersection's signal plan. */
  signalPhase: 'NORTH_SOUTH' | 'EAST_WEST' | 'ALL';
  /** Explicit timing metadata used by route and traffic-pressure calculations. */
  signalCycleSeconds: number;
  signalGreenSeconds: number;
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>;
}

export interface TrafficSimulationResult {
  trafficAverage: number;
  averageCommuteTime: number;
  congestionIndex: number;
}

const DIRECTIONS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;

const SIGNAL_YELLOW_SECONDS = 4;
const SIGNAL_ALL_RED_SECONDS = 1;
const SIGNAL_PEDESTRIAN_SECONDS = 1;
const SIGNAL_TICK_SECONDS = 1;

function quantizeSignalSeconds(value: number): number {
  return Math.round(Math.max(0, value) * 1000) / 1000;
}

function createPermissiveSignalState(): SignalPhaseState {
  return {
    stage: 'PERMISSIVE',
    axis: 'ALL',
    elapsedSeconds: 0,
    phaseElapsedSeconds: 0,
    cycleSeconds: 0,
    greenSeconds: 0,
    yellowSeconds: 0,
    allRedSeconds: 0,
    pedestrianSeconds: 0,
    pedestrianCrossing: false,
  };
}

/**
 * Converts the deterministic city clock into a signal state. The phase window
 * is half of the complete cycle because the opposing approach owns the other
 * half. The final one second is split into ALL_RED and PEDESTRIAN_CROSSING so
 * queued vehicles have a hard stop before pedestrians receive the crossing.
 */
function deriveSignalState(
  axis: RoadNode['signalPhase'],
  cycleSeconds: number,
  timeOfDay: number,
  previous?: SignalPhaseState,
): SignalPhaseState {
  if (cycleSeconds <= 0 || axis === 'ALL') return createPermissiveSignalState();

  const phaseWindowSeconds = cycleSeconds / 2;
  const yellowSeconds = Math.min(SIGNAL_YELLOW_SECONDS, phaseWindowSeconds);
  const allRedSeconds = Math.min(SIGNAL_ALL_RED_SECONDS, Math.max(0, phaseWindowSeconds - yellowSeconds));
  const pedestrianSeconds = Math.min(SIGNAL_PEDESTRIAN_SECONDS, Math.max(0, phaseWindowSeconds - yellowSeconds - allRedSeconds));
  const greenSeconds = Math.max(0, Math.min(
    Math.round(cycleSeconds * 0.40),
    phaseWindowSeconds - yellowSeconds - allRedSeconds - pedestrianSeconds,
  ));
  const normalizedHour = (((timeOfDay % 24) + 24) % 24);
  const cyclePosition = (normalizedHour / 24) * cycleSeconds;
  const phasePosition = cyclePosition % phaseWindowSeconds;
  const greenEnd = greenSeconds;
  const yellowEnd = greenEnd + yellowSeconds;
  const allRedEnd = yellowEnd + allRedSeconds;
  const pedestrianEnd = allRedEnd + pedestrianSeconds;
  const stage: SignalStage = phasePosition < greenEnd
    ? 'GREEN'
    : phasePosition < yellowEnd
      ? 'YELLOW'
      : phasePosition < allRedEnd
        ? 'ALL_RED'
        : phasePosition < pedestrianEnd
          ? 'PEDESTRIAN_CROSSING'
          : 'ALL_RED';
  const stageStart = stage === 'GREEN'
    ? 0
    : stage === 'YELLOW'
      ? greenEnd
      : stage === 'ALL_RED'
        ? yellowEnd
        : allRedEnd;

  return {
    stage,
    axis,
    elapsedSeconds: quantizeSignalSeconds(cyclePosition % cycleSeconds),
    phaseElapsedSeconds: quantizeSignalSeconds(Math.max(0, phasePosition - stageStart)),
    cycleSeconds,
    greenSeconds,
    yellowSeconds,
    allRedSeconds,
    pedestrianSeconds,
    pedestrianCrossing: stage === 'ALL_RED' || stage === 'PEDESTRIAN_CROSSING',
  };
}

/**
 * Advances the serializable signal envelope without consulting wall-clock
 * time. `timeOfDay` is the simulation clock; `tickSeconds` only accumulates
 * the stage timer used by diagnostics and save/load continuity.
 */
export function advanceIntersectionSignalStates(
  roadGraph: RoadGraph,
  previousStates: Record<string, SignalPhaseState> = {},
  timeOfDay = 12,
  tickSeconds = SIGNAL_TICK_SECONDS,
): Record<string, SignalPhaseState> {
  const nextStates: Record<string, SignalPhaseState> = {};
  for (const node of roadGraph.nodes.values()) {
    if (!node.signalized || !node.isIntersection) continue;
    const derived = node.signalState;
    const previous = previousStates[node.key];
    const sameStage = previous?.stage === derived.stage && previous.axis === derived.axis;
    nextStates[node.key] = {
      ...derived,
      // Keep the persisted timer bounded and deterministic even when a save is
      // loaded after a long pause or when a road was rebuilt between ticks.
      elapsedSeconds: quantizeSignalSeconds(derived.elapsedSeconds),
      phaseElapsedSeconds: quantizeSignalSeconds(derived.phaseElapsedSeconds),
      pedestrianCrossing: derived.pedestrianCrossing,
      ...(sameStage && tickSeconds === 0 ? { phaseElapsedSeconds: previous.phaseElapsedSeconds } : {}),
    };
  }
  return nextStates;
}

/**
 * Returns the turning friction caused by a right-hand-traffic crosswalk.
 * Straight-through traffic does not cross the pedestrian desire line; left
 * and right turns do, so their saturation flow is reduced by a fixed 18%.
 */
export function getCrosswalkTurnFriction(movement: TurnMovement): number {
  return movement === 'LEFT' || movement === 'RIGHT' ? 0.82 : 1;
}

/**
 * Calculates the maximum new vehicles a lane may admit this tick.
 *
 * Let C be the lane's nominal capacity, G the green duration, S the amount
 * of the current tick that overlaps GREEN, and P the turn/crosswalk friction.
 * The deterministic service bound is:
 *
 *   discharge = C * (G / cycleSeconds) * (S / tickSeconds) * P
 *
 * A non-GREEN stage returns zero for queued vehicles. Vehicles already inside
 * the junction may clear during a transition, but are still capped by one
 * deterministic tick slice. The result is quantized to 1/1000 vehicle so the
 * queue state cannot depend on incidental floating-point display precision.
 */
export function calculateTimeSlicedDischarge(
  node: RoadNode,
  movement: TurnMovement = 'STRAIGHT',
  tickSeconds = SIGNAL_TICK_SECONDS,
  vehiclesAlreadyInIntersection = 0,
): number {
  const laneCapacity = node.capacity / Math.max(1, node.lanes);
  const boundedTickSeconds = Math.max(0, tickSeconds);
  const friction = getCrosswalkTurnFriction(movement);
  const state = node.signalState;

  if (state.stage !== 'GREEN') {
    if (vehiclesAlreadyInIntersection <= 0) return 0;
    const clearSlice = Math.min(1, boundedTickSeconds / Math.max(1, state.cycleSeconds || 1));
    return quantizeSignalSeconds(Math.min(vehiclesAlreadyInIntersection, laneCapacity * clearSlice * friction));
  }

  const remainingGreen = Math.max(0, state.greenSeconds - state.phaseElapsedSeconds);
  const serviceSeconds = Math.min(boundedTickSeconds, remainingGreen);
  const activeTickFraction = boundedTickSeconds > 0 ? serviceSeconds / boundedTickSeconds : 0;
  const greenDutyFraction = state.cycleSeconds > 0 ? state.greenSeconds / state.cycleSeconds : 1;
  return quantizeSignalSeconds(laneCapacity * greenDutyFraction * activeTickFraction * friction);
}

/**
 * Converts the vehicle bound into the normalized lane ratio used by the
 * existing queue-pressure equations. Zero is intentional during YELLOW,
 * ALL_RED, and PEDESTRIAN_CROSSING: no queued vehicle is admitted then.
 */
export function getTimeSlicedDischargeRatio(node: RoadNode, movement: TurnMovement = 'STRAIGHT', tickSeconds = SIGNAL_TICK_SECONDS): number {
  if (!node.isIntersection) return 1;
  const laneCapacity = node.capacity / Math.max(1, node.lanes);
  if (laneCapacity <= 0) return 0;
  return quantizeSignalSeconds(calculateTimeSlicedDischarge(node, movement, tickSeconds) / laneCapacity);
}

export function getRoadNodeKey(x: number, y: number): string {
  return `${x},${y}`;
}

// A graph's topology is immutable for the lifetime of a simulation tick.
// Many systems ask for the road nearest a building/household repeatedly, so
// cache the tiny four-neighbour lookup per graph without persisting anything
// into CityState or allowing caches to survive a discarded graph.
const adjacentRoadNodeCache = new WeakMap<RoadGraph, Map<string, string | null>>();

export function buildRoadGraph(
  grid: TileData[][],
  _unlockedUpgrades: string[] = [],
  timeOfDay = 12,
  persistedSignalStates: Record<string, SignalPhaseState> = {},
): RoadGraph {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const nodes = new Map<string, RoadNode>();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[y][x].type === TileType.ROAD) {
        const key = getRoadNodeKey(x, y);
        const roadClass = getRoadClass(grid[y][x]);
        const profile = GAME_CONFIG.ROAD_CLASSES[roadClass];
        const roadCondition = Math.max(0.25, Math.min(1, (grid[y][x].roadCondition ?? 100) / 100));
        const asphaltBonus = _unlockedUpgrades.includes('asphalt_roads')
          ? GAME_CONFIG.ROAD_NETWORK.ASPHALT_CAPACITY_BONUS
          : 0;
        nodes.set(key, {
          key,
          x,
          y,
          roadClass,
          elevation: grid[y][x].elevation,
          roadStructure: grid[y][x].roadStructure ?? 'GROUND',
          lanes: profile.LANES,
          capacity: (profile.CAPACITY + asphaltBonus) * roadCondition,
          speedMultiplier: profile.SPEED_MULTIPLIER * (1 + (1 - roadCondition) * 0.8),
          traffic: grid[y][x].traffic || 0,
          laneUtilization: grid[y][x].laneUtilization ?? 0,
          laneChangePressure: grid[y][x].laneChangePressure ?? 0,
          queuePressure: grid[y][x].queuePressure ?? 0,
          neighbors: [],
          isIntersection: false,
          signalized: false,
          intersectionDelay: 1,
          signalPhase: 'ALL',
          signalCycleSeconds: 0,
          signalGreenSeconds: 0,
          signalState: createPermissiveSignalState(),
          intersectionControl: grid[y][x].intersectionControl ?? 'AUTO',
          signalTimingMode: grid[y][x].signalTimingMode ?? 'ADAPTIVE',
          signalOffsetHours: Math.max(0, Math.min(5, grid[y][x].signalOffsetHours ?? 0)),
          signalStage: 'PERMISSIVE',
          pedestrianCrossing: false,
          prohibitedTurns: [...(grid[y][x].prohibitedTurns ?? [])],
        });
      }
    }
  }

  for (const node of nodes.values()) {
    for (const [dx, dy] of DIRECTIONS) {
      const neighborKey = getRoadNodeKey(node.x + dx, node.y + dy);
      if (nodes.has(neighborKey)) node.neighbors.push(neighborKey);
    }
  }

  const hasSmartLights = _unlockedUpgrades.includes('smart_lights');
  for (const node of nodes.values()) {
    // Dual carriageways share a parallel neighbor, so a highway tile with
    // three same-class neighbors is not automatically a junction. Only a
    // real class transition (local/arterial branch) should create the costly
    // intersection treatment and crosswalk signals.
    const hasDifferentClassBranch = node.neighbors.some((key) => nodes.get(key)?.roadClass !== node.roadClass);
    node.isIntersection = node.neighbors.length >= 3 && (node.roadClass !== 'HIGHWAY' || hasDifferentClassBranch || node.intersectionControl !== 'AUTO');
    const connectedPriorityRoad = [node, ...node.neighbors.map((key) => nodes.get(key))]
      .some((candidate) => candidate?.roadClass !== 'LOCAL');
    const control = node.intersectionControl;
    node.signalized = node.isIntersection && (
      control === 'SIGNAL' ||
      (control === 'AUTO' && (hasSmartLights || connectedPriorityRoad))
    );
    const hasHorizontalApproach = node.neighbors.some((key) => nodes.get(key)?.x !== node.x);
    const hasVerticalApproach = node.neighbors.some((key) => nodes.get(key)?.y !== node.y);
    const basePhase = (node.x + node.y) % 2 === 0 ? 'NORTH_SOUTH' : 'EAST_WEST';
    const oppositePhase = basePhase === 'NORTH_SOUTH' ? 'EAST_WEST' : 'NORTH_SOUTH';
    const phaseSlot = Math.floor((((timeOfDay % 24) + 24) % 24 + node.signalOffsetHours) / 6) % 2;
    const timePhase = phaseSlot === 0 ? basePhase : oppositePhase;
    const horizontalPressure = node.neighbors
      .map((key) => nodes.get(key))
      .filter((candidate): candidate is RoadNode => Boolean(candidate) && candidate.x !== node.x)
      .reduce((sum, candidate) => sum + candidate.traffic, 0);
    const verticalPressure = node.neighbors
      .map((key) => nodes.get(key))
      .filter((candidate): candidate is RoadNode => Boolean(candidate) && candidate.x === node.x)
      .reduce((sum, candidate) => sum + candidate.traffic, 0);
    const pressurePhase = node.signalTimingMode === 'ADAPTIVE' && horizontalPressure > verticalPressure * 1.15
      ? 'EAST_WEST'
      : node.signalTimingMode === 'ADAPTIVE' && verticalPressure > horizontalPressure * 1.15
        ? 'NORTH_SOUTH'
        : timePhase;
    node.signalPhase = control === 'ROUNDABOUT' || control === 'STOP' || !node.signalized || (!hasHorizontalApproach || !hasVerticalApproach)
      ? 'ALL'
      : node.signalTimingMode === 'FIXED_NS'
        ? 'NORTH_SOUTH'
        : node.signalTimingMode === 'FIXED_EW'
          ? 'EAST_WEST'
          : pressurePhase;
    node.signalCycleSeconds = node.signalized ? (hasSmartLights ? 48 : 64) : 0;
    node.signalGreenSeconds = node.signalized ? Math.round(node.signalCycleSeconds * 0.40) : 0;
    if (node.signalized) {
      const derivedSignalState = deriveSignalState(
        node.signalPhase,
        node.signalCycleSeconds,
        timeOfDay + node.signalOffsetHours,
      );
      const persistedSignalState = persistedSignalStates[node.key];
      // A persisted state is used only after the simulation has advanced it;
      // normal callers with no envelope remain fully derived from the clock.
      node.signalState = persistedSignalState ?? derivedSignalState;
      node.signalStage = node.signalState.stage;
      node.signalGreenSeconds = node.signalState.greenSeconds;
      node.pedestrianCrossing = node.signalState.pedestrianCrossing;
    } else {
      node.signalStage = 'PERMISSIVE';
      node.pedestrianCrossing = false;
      node.signalState = createPermissiveSignalState();
    }
    grid[node.y][node.x].signalStage = node.signalStage;
    grid[node.y][node.x].pedestrianCrossing = node.pedestrianCrossing;
    node.intersectionDelay = !node.isIntersection
      ? 1
      : control === 'ROUNDABOUT'
        ? 0.78
        : control === 'STOP'
          ? 1.22
          : hasSmartLights
            ? GAME_CONFIG.ROAD_NETWORK.SMART_LIGHTS_INTERSECTION_DELAY
            : node.signalized
              ? GAME_CONFIG.ROAD_NETWORK.SIGNALIZED_INTERSECTION_DELAY
              : GAME_CONFIG.ROAD_NETWORK.UNSIGNALIZED_INTERSECTION_DELAY;
  }

  return { nodes };
}

function directionBetween(from: RoadNode, to: RoadNode): { dx: number; dy: number } {
  return { dx: Math.sign(to.x - from.x), dy: Math.sign(to.y - from.y) };
}

/** Classifies a movement through an intersection from the actual path geometry. */
export function getTurnMovement(
  roadGraph: RoadGraph,
  previousKey: string | undefined,
  currentKey: string,
  nextKey: string,
): TurnMovement {
  if (!previousKey) return 'STRAIGHT';
  const previous = roadGraph.nodes.get(previousKey);
  const current = roadGraph.nodes.get(currentKey);
  const next = roadGraph.nodes.get(nextKey);
  if (!previous || !current || !next) return 'STRAIGHT';

  const incoming = directionBetween(previous, current);
  const outgoing = directionBetween(current, next);
  if (incoming.dx === -outgoing.dx && incoming.dy === -outgoing.dy) return 'U_TURN';
  if (incoming.dx === outgoing.dx && incoming.dy === outgoing.dy) return 'STRAIGHT';

  // Positive 2D cross product is a left turn in the grid's x/y orientation.
  return incoming.dx * outgoing.dy - incoming.dy * outgoing.dx > 0 ? 'LEFT' : 'RIGHT';
}

/**
 * Returns the additional cost of a movement through a junction. This keeps
 * signal phase and turn-lane friction in the route solver instead of treating
 * every exit from an intersection as equal.
 */
export function getTurnPenalty(
  roadGraph: RoadGraph,
  previousKey: string | undefined,
  currentKey: string,
  nextKey: string,
): number {
  const node = roadGraph.nodes.get(currentKey);
  if (!node?.isIntersection) return 1;

  const movement = getTurnMovement(roadGraph, previousKey, currentKey, nextKey);
  if (node.prohibitedTurns.includes(movement)) return Infinity;
  const movementPenalty: Record<TurnMovement, number> = node.intersectionControl === 'ROUNDABOUT'
    ? { STRAIGHT: 0.92, LEFT: 0.95, RIGHT: 0.94, U_TURN: 1.14 }
    : { STRAIGHT: 1.02, LEFT: 1.22, RIGHT: 1.08, U_TURN: 1.5 };
  const next = roadGraph.nodes.get(nextKey);
  const movementAxis = next && next.x !== node.x ? 'EAST_WEST' : 'NORTH_SOUTH';
  const phasePenalty = node.signalized && node.signalPhase !== 'ALL' && node.signalPhase !== movementAxis
    ? (node.signalCycleSeconds - node.signalGreenSeconds) / Math.max(1, node.signalGreenSeconds) * 0.22 + 1
    : 1;
  const stagePenalty = node.signalStage === 'YELLOW'
    ? 1.14
    : node.signalStage === 'ALL_RED'
      ? 1.34
      : node.signalStage === 'PEDESTRIAN_CROSSING'
        ? 1.42
      : 1;
  const turnLanePenalty = node.intersectionControl === 'ROUNDABOUT'
    ? 1
    : movement === 'LEFT' && node.lanes < 2
    ? 1.14
    : movement === 'U_TURN' && node.lanes < 3
      ? 1.16
      : 1;
  return Math.round(movementPenalty[movement] * phasePenalty * stagePenalty * turnLanePenalty * 1000) / 1000;
}

export function getAdjacentRoadNodeKey(x: number, y: number, roadGraph: RoadGraph): string | null {
  const lookupKey = getRoadNodeKey(x, y);
  let cache = adjacentRoadNodeCache.get(roadGraph);
  if (!cache) {
    cache = new Map<string, string | null>();
    adjacentRoadNodeCache.set(roadGraph, cache);
  }
  if (cache.has(lookupKey)) return cache.get(lookupKey) ?? null;

  const direct = lookupKey;
  if (roadGraph.nodes.has(direct)) {
    cache.set(lookupKey, direct);
    return direct;
  }

  for (const [dx, dy] of DIRECTIONS) {
    const neighborKey = getRoadNodeKey(x + dx, y + dy);
    if (roadGraph.nodes.has(neighborKey)) {
      cache.set(lookupKey, neighborKey);
      return neighborKey;
    }
  }
  cache.set(lookupKey, null);
  return null;
}

function distanceToNearestRoad(x: number, y: number, roadGraph: RoadGraph): number {
  let best = Infinity;
  for (const node of roadGraph.nodes.values()) {
    best = Math.min(best, Math.abs(node.x - x) + Math.abs(node.y - y));
  }
  return best;
}

import { Trip, TransitMode } from './citizenSimulation/types';

export function simulateRoadNetworkAndTraffic(
  grid: TileData[][],
  roadGraph: RoadGraph,
  unlockedUpgrades: string[] = [],
  activeTrips?: Trip[],
  samplingFactor = 1,
): TrafficSimulationResult {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const has = (id: string) => unlockedUpgrades.includes(id);
  const roadLoad = new Map<string, number>();

  for (const node of roadGraph.nodes.values()) {
    roadLoad.set(node.key, 0);
  }

  // If real active trips are provided, compute traffic load directly from traversed trip paths
  if (activeTrips && activeTrips.length > 0) {
    let totalCommuteTime = 0;
    let workTripCount = 0;

    for (const trip of activeTrips) {
      if (trip.purpose === 'COMMUTE_WORK') {
        totalCommuteTime += trip.travelTime;
        workTripCount++;
      }
      if (trip.mode === TransitMode.CAR) {
        for (const [rx, ry] of trip.path) {
          const key = getRoadNodeKey(rx, ry);
          roadLoad.set(key, (roadLoad.get(key) ?? 0) + 1 * samplingFactor);
        }
      }
    }

    let totalTraffic = 0;
    let trafficTiles = 0;
    let congestionSum = 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const tile = grid[y][x];
        if (tile.type !== TileType.ROAD) {
          tile.traffic = 0;
          continue;
        }
        const key = getRoadNodeKey(x, y);
        const load = roadLoad.get(key) ?? 0;
        const roadNode = roadGraph.nodes.get(key);
        const intersectionPenalty = roadNode?.isIntersection
          ? (has('smart_lights')
            ? GAME_CONFIG.ROAD_NETWORK.SMART_LIGHTS_INTERSECTION_DELAY
            : roadNode.intersectionDelay)
          : 1.0;
        const roadCapacity = roadNode?.capacity ?? 20;
        const congestion = Math.min(100, Math.round(((load / Math.max(1, roadCapacity)) * 100 * intersectionPenalty) * 10) / 10);
        tile.traffic = congestion;
        totalTraffic += congestion;
        trafficTiles += 1;
        congestionSum += Math.max(0, congestion - 50);
      }
    }

    const trafficAverage = trafficTiles ? Math.round((totalTraffic / trafficTiles) * 10) / 10 : 0;
    const averageCommuteTime = workTripCount ? Math.round((totalCommuteTime / workTripCount) * 10) / 10 : 0;
    const congestionIndex = trafficTiles
      ? Math.round(Math.min(100, (congestionSum / trafficTiles) * 2) * 10) / 10
      : 0;

    return { trafficAverage, averageCommuteTime, congestionIndex };
  }

  // Fallback if no active trips exist (e.g. initial empty grid or test)
  let totalTraffic = 0;
  let trafficTiles = 0;
  let commuteDemand = 0;
  let commuteFriction = 0;
  const destinationJobs = Math.max(1, grid.flat().filter((candidate) =>
    candidate.type === TileType.COMMERCIAL || candidate.type === TileType.INDUSTRIAL
  ).reduce((sum, candidate) => sum + candidate.jobs, 0));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = grid[y][x];
      if (tile.type === TileType.ROAD) {
        continue;
      }
      if (tile.type !== TileType.RESIDENTIAL || tile.population <= 0) continue;

      const localWork = Math.min(tile.population, destinationJobs);
      const distance = distanceToNearestRoad(x, y, roadGraph);
      commuteDemand += localWork;
      commuteFriction += localWork * Math.max(1, distance);

      const roadKey = getAdjacentRoadNodeKey(x, y, roadGraph);
      if (roadKey) roadLoad.set(roadKey, (roadLoad.get(roadKey) ?? 0) + localWork);
    }
  }

  let congestionSum = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = grid[y][x];
      if (tile.type !== TileType.ROAD) {
        tile.traffic = 0;
        continue;
      }
      const load = roadLoad.get(getRoadNodeKey(x, y)) ?? 0;
      const roadNode = roadGraph.nodes.get(getRoadNodeKey(x, y));
      const intersectionPenalty = roadNode?.isIntersection
        ? (has('smart_lights')
          ? GAME_CONFIG.ROAD_NETWORK.SMART_LIGHTS_INTERSECTION_DELAY
          : roadNode.intersectionDelay)
        : 1;
      const roadCapacity = roadNode?.capacity ?? 20;
      const congestion = Math.min(100, (load / Math.max(1, roadCapacity)) * 100 * intersectionPenalty);
      tile.traffic = Math.round(congestion * 10) / 10;
      totalTraffic += tile.traffic;
      trafficTiles += 1;
      congestionSum += Math.max(0, tile.traffic - 55);
    }
  }

  const trafficAverage = trafficTiles ? Math.round((totalTraffic / trafficTiles) * 10) / 10 : 0;
  const averageCommuteTime = commuteDemand
    ? Math.round((commuteFriction / commuteDemand) * (1 + trafficAverage / 100) * 10) / 10
    : 0;
  const congestionIndex = trafficTiles
    ? Math.round(Math.min(100, congestionSum / trafficTiles * 2) * 10) / 10
    : 0;

  return { trafficAverage, averageCommuteTime, congestionIndex };
}
