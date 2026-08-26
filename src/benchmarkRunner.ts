import { getLastSimulationPhaseTimings, simulateTick } from './engine';
import { createBenchmarkState, BenchmarkScenario } from './metropolisBenchmarks';
import { getStateHash } from './releaseReadiness';
import { percentile } from './simulationScheduler';
import { CityState } from './types';

export const OFFICIAL_BENCHMARKS: BenchmarkScenario[] = [
  'SMALL_TOWN',
  'CONGESTED_CORRIDOR',
  'INDUSTRIAL_CITY',
  'FLOOD_RECOVERY',
  'PERFORMANCE_100K',
];

export interface BenchmarkPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

export interface BenchmarkReport {
  scenario: BenchmarkScenario;
  seed: number;
  ticks: number;
  tickMs: BenchmarkPercentiles;
  phaseMs: Record<string, BenchmarkPercentiles>;
  population: number;
  gridPopulation: number;
  citizenAgents: number;
  populationScale: number;
  entities: number;
  activeRegions: number;
  stateHash: string;
  finite: boolean;
}

export interface BenchmarkSuiteReport {
  reports: BenchmarkReport[];
  deterministic: boolean;
  passed: boolean;
}

function summarize(samples: number[]): BenchmarkPercentiles {
  return { p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), p99: percentile(samples, 0.99) };
}

export function isFiniteCityState(state: CityState): boolean {
  const scalarValues = [
    state.money, state.population, state.income, state.expenses, state.happiness,
    state.trafficAverage, state.congestionIndex, state.averageCommuteTime,
  ];
  return scalarValues.every(Number.isFinite) && state.grid.flat().every((tile) => [
    tile.population, tile.jobs, tile.traffic, tile.elevation, tile.pollution,
    tile.noise, tile.crime, tile.health, tile.education, tile.landValue,
  ].every(Number.isFinite));
}

export function runOfficialBenchmark(scenario: BenchmarkScenario, ticks = 10, seed = 2088): BenchmarkReport {
  let state = createBenchmarkState(scenario, seed);
  // Warm caches once, but do not include that non-representative tick in the report.
  const benchmarkMode = scenario === 'PERFORMANCE_100K';
  state = simulateTick(state, { trafficDensity: 'high', benchmarkMode });
  const tickSamples: number[] = [];
  const phaseSamples: Record<string, number[]> = {};
  for (let index = 0; index < ticks; index += 1) {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    state = simulateTick(state, { trafficDensity: 'high', benchmarkMode });
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
    tickSamples.push(elapsed);
    for (const [phase, timing] of Object.entries(getLastSimulationPhaseTimings())) {
      (phaseSamples[phase] ??= []).push(timing);
    }
  }
  const phaseMs = Object.fromEntries(Object.entries(phaseSamples).map(([phase, samples]) => [phase, summarize(samples)]));
  return {
    scenario,
    seed,
    ticks,
    tickMs: summarize(tickSamples),
    phaseMs,
    population: state.population,
    gridPopulation: state.grid.flat().reduce((sum, tile) => sum + (tile.type === 'RESIDENTIAL' ? tile.population : 0), 0),
    citizenAgents: state.citizenState?.citizens?.length ?? 0,
    populationScale: state.citizenState?.populationScale ?? 1,
    entities: (state.activeTrips?.length ?? 0) + (state.activeFreightTrips?.length ?? 0) + (state.transitVehicles?.length ?? 0) + (state.serviceVehicles?.length ?? 0),
    activeRegions: state.activeRegionKeys?.length ?? state.unlockedRegions.length,
    stateHash: getStateHash(state),
    finite: isFiniteCityState(state),
  };
}

export function runOfficialBenchmarkSuite(ticks = 10, seed = 2088): BenchmarkSuiteReport {
  const reports = OFFICIAL_BENCHMARKS.map((scenario) => runOfficialBenchmark(scenario, ticks, seed));
  const replayReports = OFFICIAL_BENCHMARKS.map((scenario) => runOfficialBenchmark(scenario, ticks, seed));
  const deterministic = reports.every((report, index) => report.stateHash === replayReports[index].stateHash);
  const passed = deterministic && reports.every((report) => report.finite);
  return { reports, deterministic, passed };
}
