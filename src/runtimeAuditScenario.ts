import { CityIncident, CityState, TileData, TileType, TransitLine } from './types';

type Point = [number, number];

const CARDINAL_OFFSETS: Point[] = [[1, 0], [0, 1], [-1, 0], [0, -1]];

function pointKey([x, y]: Point): string {
  return `${x},${y}`;
}

function cloneGrid(grid: TileData[][]): TileData[][] {
  return grid.map((row) => row.map((tile) => ({ ...tile, serviceResponseTimes: tile.serviceResponseTimes ? { ...tile.serviceResponseTimes } : undefined })));
}

function isRoad(tile: TileData | undefined): boolean {
  return tile?.type === TileType.ROAD;
}

function findRoadCorridor(grid: TileData[][]): Point[] {
  const width = grid[0]?.length ?? 0;
  const height = grid.length;

  for (let y = 0; y < height; y += 1) {
    let run: Point[] = [];
    for (let x = 0; x < width; x += 1) {
      if (isRoad(grid[y]?.[x])) {
        run.push([x, y]);
        continue;
      }
      if (run.length >= 10) return run;
      run = [];
    }
    if (run.length >= 10) return run;
  }

  for (let x = 0; x < width; x += 1) {
    let run: Point[] = [];
    for (let y = 0; y < height; y += 1) {
      if (isRoad(grid[y]?.[x])) {
        run.push([x, y]);
        continue;
      }
      if (run.length >= 10) return run;
      run = [];
    }
    if (run.length >= 10) return run;
  }

  return [];
}

function adjacentCandidates(grid: TileData[][], road: Point): Point[] {
  const [roadX, roadY] = road;
  return CARDINAL_OFFSETS
    .map(([dx, dy]) => [roadX + dx, roadY + dy] as Point)
    .filter(([x, y]) => {
      const tile = grid[y]?.[x];
      return Boolean(tile && tile.type === TileType.EMPTY && !tile.water);
    });
}

function takeEmptyFrontage(grid: TileData[][], corridor: Point[], used: Set<string>, preferredIndex: number): Point | null {
  const indices = [preferredIndex, ...corridor.map((_, index) => index)];
  for (const index of indices) {
    const road = corridor[index];
    if (!road) continue;
    for (const candidate of adjacentCandidates(grid, road)) {
      if (!used.has(pointKey(candidate))) {
        used.add(pointKey(candidate));
        return candidate;
      }
    }
  }
  return null;
}

function placeFixture(grid: TileData[][], point: Point, type: TileType, overrides: Partial<TileData> = {}): void {
  const [x, y] = point;
  const tile = grid[y]?.[x];
  if (!tile) return;
  grid[y][x] = {
    ...tile,
    type,
    level: 1,
    population: 0,
    jobs: 0,
    abandoned: false,
    powered: false,
    watered: false,
    upgradeProgress: 0,
    ...overrides,
  };
}

function resetRuntimeMetrics(state: CityState): void {
  state.transitCapacity = 0;
  state.transitRidership = 0;
  state.transitCoverage = 0;
  state.transitBusDepots = 0;
  state.transitTramStations = 0;
  state.transitActiveLines = 0;
  state.transitActiveVehicles = 0;
  state.transitAverageWait = 0;
  state.transitTransferOpportunities = 0;
  state.transitPlatformCapacity = 0;
  state.transitAverageDwell = 0;
  state.transitFareRevenue = 0;
  state.transitOperatingCost = 0;
  state.transitVehicles = [];
  state.activeIncidents = 1;
  state.incidentResponseLoad = 0;
  state.incidentsResolved = 0;
  state.incidentHappinessPenalty = 0;
  state.incidentDispatchedUnits = 0;
  state.incidentQueuedUnits = 0;
  state.serviceVehicles = [];
  state.serviceFleetTotal = 0;
  state.serviceFleetActive = 0;
  state.serviceFleetAvailable = 0;
  state.serviceFleetOnScene = 0;
  state.serviceFleetAverageCondition = 100;
  state.serviceBayQueues = {};
}

/**
 * Builds a deterministic, developer-only validation city on top of the current
 * map. It uses the same authoritative state fields as player gameplay: a real
 * bus line, powered facilities, a seeded incident, and the normal simulation
 * tick are required before vehicles/path telemetry appears.
 */
export function createRuntimeAuditScenario(input: CityState): CityState {
  const grid = cloneGrid(input.grid);
  const corridor = findRoadCorridor(grid);
  if (corridor.length < 10) return input;

  const used = new Set<string>();
  const depot = takeEmptyFrontage(grid, corridor, used, 1);
  const firstStop = takeEmptyFrontage(grid, corridor, used, Math.max(2, Math.floor(corridor.length * 0.35)));
  const secondStop = takeEmptyFrontage(grid, corridor, used, Math.max(3, Math.floor(corridor.length * 0.72)));
  const transferStop = takeEmptyFrontage(grid, corridor, used, Math.max(4, Math.floor(corridor.length * 0.9)));
  const fireStation = takeEmptyFrontage(grid, corridor, used, Math.max(4, corridor.length - 2));
  const incidentTarget = takeEmptyFrontage(grid, corridor, used, Math.max(5, Math.floor(corridor.length * 0.55)));

  if (!depot || !firstStop || !secondStop || !transferStop || !fireStation || !incidentTarget) return input;

  placeFixture(grid, depot, TileType.BUS_DEPOT);
  placeFixture(grid, firstStop, TileType.BUS_STOP);
  placeFixture(grid, secondStop, TileType.BUS_STOP);
  placeFixture(grid, transferStop, TileType.BUS_STOP);
  placeFixture(grid, fireStation, TileType.FIRE_STATION);
  placeFixture(grid, incidentTarget, TileType.INDUSTRIAL, { pollution: 75, noise: 35 });

  const line: TransitLine = {
    id: 'runtime-audit-bus-line',
    name: 'Audit Bus Line · Corridor 01',
    mode: 'BUS',
    stops: [firstStop, secondStop],
    frequency: 8,
    peakFrequency: 5,
    active: true,
    serviceStartHour: 5,
    serviceEndHour: 24,
    peakStartHour: 7,
    peakEndHour: 9,
  };
  const transferLine: TransitLine = {
    ...line,
    id: 'runtime-audit-bus-line-02',
    name: 'Audit Bus Line · Feeder 02',
    stops: [firstStop, transferStop],
    frequency: 10,
    peakFrequency: 6,
  };
  const incident: CityIncident = {
    id: 'runtime-audit-fire-call',
    type: 'FIRE',
    x: incidentTarget[0],
    y: incidentTarget[1],
    severity: 3,
    createdDay: Math.max(1, input.day),
    remainingDays: 8,
    roadConnected: true,
    requiredUnits: 3,
    dispatchedUnits: 0,
    responseProgress: 0,
  };

  const state: CityState = {
    ...input,
    grid,
    money: Math.max(input.money, 250_000),
    day: Math.max(1, input.day),
    timeOfDay: 6,
    milestoneLevel: Math.max(input.milestoneLevel ?? 0, 3),
    unlockedUpgrades: [...new Set([...(input.unlockedUpgrades ?? []), 'smart_lights', 'bus_network'])],
    activeScenarioId: 'transit-metropolis',
    scenarioCompleted: false,
    scenarioObjectiveValues: {},
    transitLines: [line, transferLine],
    incidents: [incident],
    commandQueue: [],
    recentSimulationEvents: [],
    causalDiagnostics: [],
  };
  resetRuntimeMetrics(state);
  return state;
}
