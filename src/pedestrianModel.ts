import { TileData, TileType } from './types';
import { Trip, TransitMode, TripPurpose } from './citizenSimulation/types';
import { RoadGraph } from './traffic';

export type PedestrianState =
  | 'HOME'
  | 'WALKING'
  | 'WAITING'
  | 'CROSSING'
  | 'TRANSIT_WAIT'
  | 'WORK'
  | 'SHOPPING'
  | 'RETURN_HOME';

export interface PedestrianAgent {
  id: string;
  citizenId: string;
  householdId: string;
  state: PedestrianState;
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  currentTile: { x: number; y: number };
  path: [number, number][];
  pathIndex: number;
  segmentProgress: number; // 0..1 along current road tile segment
  sideOffset: number; // -0.28 or +0.28 relative to direction
  worldPos: [number, number, number];
  heading: number; // radians
  speed: number;
  color: string;
  isTransitUser: boolean;
  purpose: 'WORK' | 'SHOPPING' | 'SCHOOL' | 'LEISURE' | 'RETURN';
  crossingWaitTimer: number;
}

const PEDESTRIAN_COLORS = [
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#e11d48', // Rose
  '#3b82f6', // Blue
  '#eab308', // Yellow
  '#a855f7', // Purple
];

/**
 * Returns a rush-hour multiplier based on the simulation time of day (0..24).
 * Peak hours are morning commute (7-9 AM) and evening return (17-19 PM).
 */
export function getRushHourMultiplier(timeOfDay = 12): number {
  if ((timeOfDay >= 7 && timeOfDay <= 9) || (timeOfDay >= 17 && timeOfDay <= 19)) {
    return 1.75;
  }
  if (timeOfDay >= 11 && timeOfDay <= 14) {
    return 1.35; // Lunchtime shopping & errand activity
  }
  if (timeOfDay >= 22 || timeOfDay < 5) {
    return 0.35; // Nighttime calm
  }
  return 1.0;
}

/**
 * Derives sampled representative pedestrians from active trips and city hotspots.
 */
export function sampleRepresentativePedestrians(
  grid: TileData[][],
  trips: Trip[] = [],
  roadGraph: RoadGraph | null,
  timeOfDay = 12,
  population = 0,
  maxAgents = 120,
): PedestrianAgent[] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  if (height === 0 || width === 0) return [];

  const rushMultiplier = getRushHourMultiplier(timeOfDay);
  const targetCount = Math.min(
    maxAgents,
    Math.max(4, Math.round((Math.min(population, 500) * 0.2 + (trips.length * 0.8)) * (rushMultiplier * 0.8))),
  );

  const agents: PedestrianAgent[] = [];
  const walkOrTransitTrips = trips.filter(
    (t) => (t.mode === TransitMode.WALK || t.mode === TransitMode.BIKE || t.mode === TransitMode.TRANSIT) && t.path.length >= 2,
  );

  // 1. Convert active walking and transit trips into representative sidewalk agents
  for (let i = 0; i < walkOrTransitTrips.length && agents.length < targetCount; i++) {
    const trip = walkOrTransitTrips[i];
    const origin = { x: trip.origin[0], y: trip.origin[1] };
    const dest = { x: trip.destination[0], y: trip.destination[1] };
    const path = trip.path;
    const isTransit = trip.mode === TransitMode.TRANSIT;
    const side = (i % 2 === 0 ? 1 : -1) * 0.28;
    const purpose: PedestrianAgent['purpose'] =
      trip.purpose === TripPurpose.COMMUTE_WORK
        ? 'WORK'
        : trip.purpose === TripPurpose.SHOPPING
          ? 'SHOPPING'
          : trip.purpose === TripPurpose.COMMUTE_SCHOOL
            ? 'SCHOOL'
            : 'LEISURE';

    // Initial state based on trip progress
    let state: PedestrianState = 'WALKING';
    if (isTransit && path.length > 2) {
      // If near a transit stop, agent is waiting
      const currentPt = path[0];
      const tile = grid[currentPt[1]]?.[currentPt[0]];
      if (tile && (tile.type === TileType.BUS_STOP || tile.type === TileType.TRAM_STOP)) {
        state = 'TRANSIT_WAIT';
      }
    }

    agents.push({
      id: `ped-${trip.id}`,
      citizenId: trip.citizenId,
      householdId: trip.householdId,
      state,
      origin,
      destination: dest,
      currentTile: { x: path[0][0], y: path[0][1] },
      path,
      pathIndex: 0,
      segmentProgress: ((i * 0.17) % 0.8) + 0.1,
      sideOffset: side,
      worldPos: [0, 0, 0],
      heading: 0,
      speed: trip.mode === TransitMode.BIKE ? 0.08 : 0.038 + (i % 4) * 0.003,
      color: PEDESTRIAN_COLORS[i % PEDESTRIAN_COLORS.length],
      isTransitUser: isTransit,
      purpose,
      crossingWaitTimer: 0,
    });
  }

  // 2. If additional capacity remains, generate commercial and residential sidewalk life
  if (agents.length < targetCount) {
    const commercialTiles: Array<{ x: number; y: number; roadNeighbor: [number, number] }> = [];
    const residentialTiles: Array<{ x: number; y: number; roadNeighbor: [number, number] }> = [];
    const transitStopTiles: Array<{ x: number; y: number }> = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile.type === TileType.BUS_STOP || tile.type === TileType.TRAM_STOP) {
          transitStopTiles.push({ x, y });
        }
        if (tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE) {
          const adjRoad = findAdjacentRoadTile(grid, x, y);
          if (adjRoad) commercialTiles.push({ x, y, roadNeighbor: adjRoad });
        } else if (tile.type === TileType.RESIDENTIAL && tile.population > 0) {
          const adjRoad = findAdjacentRoadTile(grid, x, y);
          if (adjRoad) residentialTiles.push({ x, y, roadNeighbor: adjRoad });
        }
      }
    }

    // Add shopping / errand pedestrians in commercial corridors
    let extraIndex = 0;
    while (agents.length < targetCount && commercialTiles.length > 0) {
      const com = commercialTiles[extraIndex % commercialTiles.length];
      const res = residentialTiles.length > 0 ? residentialTiles[extraIndex % residentialTiles.length] : com;
      extraIndex++;

      const isReturn = extraIndex % 3 === 0;
      const origin = isReturn ? { x: com.x, y: com.y } : { x: res.x, y: res.y };
      const dest = isReturn ? { x: res.x, y: res.y } : { x: com.x, y: com.y };
      const startRoad = isReturn ? com.roadNeighbor : res.roadNeighbor;
      const endRoad = isReturn ? res.roadNeighbor : com.roadNeighbor;

      const path: [number, number][] = [startRoad, endRoad];
      const state: PedestrianState = isReturn ? 'RETURN_HOME' : 'SHOPPING';

      agents.push({
        id: `ped-local-${extraIndex}`,
        citizenId: `cit-${extraIndex}`,
        householdId: `hh-${extraIndex % 20}`,
        state,
        origin,
        destination: dest,
        currentTile: { x: startRoad[0], y: startRoad[1] },
        path,
        pathIndex: 0,
        segmentProgress: (extraIndex * 0.19) % 0.9,
        sideOffset: (extraIndex % 2 === 0 ? 1 : -1) * 0.28,
        worldPos: [0, 0, 0],
        heading: 0,
        speed: 0.035 + (extraIndex % 3) * 0.003,
        color: PEDESTRIAN_COLORS[(agents.length + extraIndex) % PEDESTRIAN_COLORS.length],
        isTransitUser: false,
        purpose: isReturn ? 'RETURN' : 'SHOPPING',
        crossingWaitTimer: 0,
      });

      if (extraIndex > targetCount * 2) break;
    }
  }

  return agents;
}

function findAdjacentRoadTile(grid: TileData[][], x: number, y: number): [number, number] | null {
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (grid[ny]?.[nx]?.type === TileType.ROAD) {
      return [nx, ny];
    }
  }
  return null;
}

/**
 * Updates pedestrian position, sidewalk trajectory, and signal crossing state for one frame.
 */
export function updatePedestrianAgent(
  agent: PedestrianAgent,
  deltaSeconds: number,
  grid: TileData[][],
  gridWidth: number,
  gridHeight: number,
  gridToWorldFn: (x: number, y: number, gw: number, gh: number) => [number, number, number],
): void {
  if (agent.path.length < 2) return;

  const currentIdx = Math.min(agent.pathIndex, agent.path.length - 2);
  const from = agent.path[currentIdx];
  const to = agent.path[currentIdx + 1];

  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const heading = Math.atan2(dx, dy);
  agent.heading = heading;

  // Perpendicular vector for sidewalk offset
  const perpX = -dy * agent.sideOffset;
  const perpZ = dx * agent.sideOffset;

  // Check if approaching intersection and needs to cross or wait
  const targetTile = grid[to[1]]?.[to[0]];
  const isIntersection = Boolean(targetTile && targetTile.type === TileType.ROAD && (targetTile.traffic || 0) > 0);

  if (isIntersection && agent.segmentProgress > 0.8 && agent.segmentProgress < 0.95) {
    const signalAllows = targetTile.pedestrianCrossing === true;
    if (!signalAllows && targetTile.signalStage && targetTile.signalStage !== 'PERMISSIVE') {
      // Must wait at curb
      agent.state = 'WAITING';
      agent.crossingWaitTimer += deltaSeconds;
      return;
    } else {
      // Can cross
      agent.state = 'CROSSING';
    }
  } else if (agent.state === 'WAITING') {
    agent.state = 'CROSSING';
  }

  // Advance along segment
  const step = (agent.speed * deltaSeconds * 60) / Math.max(0.5, Math.hypot(dx, dy));
  agent.segmentProgress += step;

  if (agent.segmentProgress >= 1.0) {
    agent.segmentProgress = 0;
    agent.pathIndex += 1;
    if (agent.pathIndex >= agent.path.length - 1) {
      // Reached destination, turn around or transition state
      agent.pathIndex = 0;
      agent.path = [...agent.path].reverse();
      agent.state = agent.state === 'SHOPPING' ? 'RETURN_HOME' : agent.state === 'WORK' ? 'HOME' : 'WALKING';
    }
  }

  // Calculate 3D position
  const currFrom = agent.path[agent.pathIndex] || from;
  const currTo = agent.path[agent.pathIndex + 1] || to;
  const cdx = currTo[0] - currFrom[0];
  const cdy = currTo[1] - currFrom[1];

  const tileX = currFrom[0] + cdx * agent.segmentProgress;
  const tileY = currFrom[1] + cdy * agent.segmentProgress;

  const [wx, wy, wz] = gridToWorldFn(tileX, tileY, gridWidth, gridHeight);
  const elevation = (grid[Math.round(tileY)]?.[Math.round(tileX)]?.elevation ?? 0) * 0.5;

  agent.worldPos = [wx + perpX, wy + elevation + 0.04, wz + perpZ];
}
