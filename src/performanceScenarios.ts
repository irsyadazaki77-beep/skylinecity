import { simulateTick } from './engine';
import { BenchmarkScenario, createBenchmarkState } from './metropolisBenchmarks';
import { CityState } from './types';

export type RepeatableStressScenario = BenchmarkScenario | 'TRAFFIC_HEAVY';

export const REPEATABLE_STRESS_SCENARIOS: RepeatableStressScenario[] = [
  'SMALL_TOWN', 'CONGESTED_CORRIDOR', 'INDUSTRIAL_CITY', 'FLOOD_RECOVERY', 'TRAFFIC_HEAVY',
  'PERFORMANCE_100K', 'DENSE_CITY', 'TRANSIT_STRESS', 'NIGHT_CITY', 'DISASTER_CITY',
];

export function createStressScenario(id: RepeatableStressScenario, seed = 2088): CityState {
  const state = createBenchmarkState(id === 'TRAFFIC_HEAVY' ? 'CONGESTED_CORRIDOR' : id, seed);
  if (id === 'TRAFFIC_HEAVY') {
    // Increase only the fixture's traffic demand. Simulation rules and the
    // authoritative state remain unchanged; this is a repeatable stress input.
    for (const row of state.grid) for (const tile of row) {
      if (tile.type === 'RESIDENTIAL') tile.population = Math.max(tile.population, 120);
      if (tile.type === 'COMMERCIAL') tile.jobs = Math.max(tile.jobs, 100);
    }
  }
  return state;
}

export function runStressScenario(id: RepeatableStressScenario, ticks = 30, seed = 2088): { state: CityState; tickMs: number[] } {
  let state = createStressScenario(id, seed);
  const tickMs: number[] = [];
  for (let index = 0; index < ticks; index += 1) {
    const start = performance.now();
    state = simulateTick(state, { trafficDensity: 'high', benchmarkMode: id === 'PERFORMANCE_100K' || id === 'DENSE_CITY' });
    tickMs.push(performance.now() - start);
  }
  return { state, tickMs };
}
