import { createEmptyGrid, createInitialCityState, simulateTick } from './engine';
import { createInitialCitizenSimulationState, serializeCitizenSimulation } from './citizenSimulation/citizenManager';
import { createCitizen, createHousehold } from './citizenSimulation/migration';
import { EducationLevel } from './citizenSimulation/types';
import { SeededRandom } from './citizenSimulation/prng';
import { CityState, TileType, TransitLine } from './types';

export interface TransitReliefMetrics {
  congestionIndex: number;
  averageCommuteTime: number;
  carTrips: number;
  transitTrips: number;
  transitRidership: number;
  transitCoverage: number;
  capacityUtilizationPercent: number;
}

export interface TransitReliefBenchmarkResult {
  baseline: TransitReliefMetrics;
  withTransit: TransitReliefMetrics;
  congestionReduction: number;
  carTripReductionPercent: number;
  ticks: number;
  elapsedMs: number;
}

export interface TransitCapacityStressResult {
  metrics: TransitReliefMetrics;
  ticks: number;
  elapsedMs: number;
}

const RELIEF_LINE: TransitLine = {
  id: 'benchmark-relief-line',
  name: 'Benchmark Relief Corridor',
  mode: 'BUS',
  stops: [[20, 29], [44, 29]],
  frequency: 4,
  peakFrequency: 3,
  active: true,
  serviceStartHour: 5,
  serviceEndHour: 24,
  peakStartHour: 7,
  peakEndHour: 10,
};

const CAPACITY_STOPS: [number, number][] = [[8, 29], [16, 29], [24, 29], [32, 29], [40, 29], [48, 29]];

function createReliefState(withTransit: boolean, seed: number, residentCount = 10, denseStops = false): CityState {
  const grid = createEmptyGrid(60, 60);
  for (let x = 4; x < 56; x += 1) {
    grid[30][x].type = TileType.ROAD;
    grid[30][x].roadClass = 'LOCAL';
    grid[30][x].powered = true;
  }
  grid[29][4].type = TileType.POWER_PLANT;
  grid[31][4].type = TileType.WATER_PUMP;

  for (let x = 6; x < 54; x += 4) {
    const residence = grid[29][x];
    residence.type = TileType.RESIDENTIAL;
    residence.level = 3;
    residence.population = 120;
    residence.powered = true;
    residence.watered = true;
    const workplace = grid[31][x + 1];
    workplace.type = TileType.COMMERCIAL;
    workplace.level = 3;
    workplace.jobs = 100;
    workplace.powered = true;
    workplace.watered = true;
  }

  const state = createInitialCityState(grid, seed, 'normal');
  state.unlockedUpgrades = ['asphalt_roads', 'smart_lights', 'bus_network'];
  state.timeOfDay = 8;

  const citizenState = createInitialCitizenSimulationState(seed);
  const prng = new SeededRandom(seed ^ 0x51f15e);
  for (let x = 6; x < 54; x += 4) {
    const residence = grid[29][x];
    if (residence.type !== TileType.RESIDENTIAL) continue;
    residence.population = residentCount;
    const residencePoint = { x, y: 29 };
    const householdId = `benchmark-household-${citizenState.nextHouseholdId++}`;
    const residents = Array.from({ length: residentCount }, (_, index) => createCitizen(
      `benchmark-citizen-${citizenState.nextCitizenId++}`,
      householdId,
      residencePoint,
      25 + (index % 25),
      index % 3 === 0 ? EducationLevel.UNIVERSITY : EducationLevel.HIGH_SCHOOL,
      prng,
    ));
    for (const citizen of residents) citizenState.citizens.set(citizen.id, citizen);
    const household = createHousehold(householdId, residencePoint, 80, residents, 500, 'COUPLE');
    citizenState.households.set(household.id, household);
  }
  state.citizenState = serializeCitizenSimulation(citizenState);

  if (withTransit) {
    const serviceStops = denseStops ? CAPACITY_STOPS : RELIEF_LINE.stops;
    for (const [x, y] of [[10, 29], ...serviceStops] as [number, number][]) {
      grid[y][x].type = x === 10 ? TileType.BUS_DEPOT : TileType.BUS_STOP;
      grid[y][x].population = 0;
      grid[y][x].jobs = 0;
      grid[y][x].powered = true;
      grid[y][x].watered = true;
    }
    state.transitLines = [{ ...RELIEF_LINE, stops: serviceStops.map(([x, y]) => [x, y] as [number, number]) }];
  }

  return state;
}

function metrics(state: CityState): TransitReliefMetrics {
  return {
    congestionIndex: state.congestionIndex,
    averageCommuteTime: state.averageCommuteTime,
    carTrips: state.demographics?.tripStats.carTrips ?? 0,
    transitTrips: state.demographics?.tripStats.transitTrips ?? 0,
    transitRidership: state.transitRidership ?? 0,
    transitCoverage: state.transitCoverage ?? 0,
    capacityUtilizationPercent: state.transitCapacity && state.transitCapacity > 0
      ? Math.round((state.transitRidership ?? 0) / state.transitCapacity * 1000) / 10
      : 0,
  };
}

function runState(state: CityState, ticks: number): CityState {
  let current = state;
  for (let tick = 0; tick < ticks; tick += 1) current = simulateTick(current, { trafficDensity: 'high' });
  return current;
}

/**
 * Runs the same high-load corridor with and without a live bus line. This is
 * a regression benchmark for modal shift and congestion relief, not a game
 * mode or a save format feature.
 */
export function runTransitReliefBenchmark(ticks = 12, seed = 4242): TransitReliefBenchmarkResult {
  const start = Date.now();
  const baseline = metrics(runState(createReliefState(false, seed, 10), ticks));
  const withTransit = metrics(runState(createReliefState(true, seed, 10), ticks));
  const congestionReduction = Math.round((baseline.congestionIndex - withTransit.congestionIndex) * 10) / 10;
  const carTripReductionPercent = baseline.carTrips > 0
    ? Math.round((baseline.carTrips - withTransit.carTrips) / baseline.carTrips * 1000) / 10
    : 0;

  return {
    baseline,
    withTransit,
    congestionReduction,
    carTripReductionPercent,
    ticks,
    elapsedMs: Date.now() - start,
  };
}

/**
 * Uses a denser stop pattern and a high-population corridor to verify that a
 * live line can reach its scheduled vehicle capacity instead of remaining a
 * decorative low-ridership service. The short default horizon isolates the
 * initial network response before demographic churn changes the fixture.
 */
export function runTransitCapacityStressBenchmark(ticks = 2, seed = 4242): TransitCapacityStressResult {
  const start = Date.now();
  const state = runState(createReliefState(true, seed, 45, true), ticks);
  return { metrics: metrics(state), ticks, elapsedMs: Date.now() - start };
}
