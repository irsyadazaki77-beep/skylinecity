import { getLastSimulationPhaseTimings, simulateTick } from './engine';
import { createBenchmarkState, BenchmarkScenario } from './metropolisBenchmarks';
import { getStateHash } from './releaseReadiness';
import { getSimulationBudgetMs, percentile } from './simulationScheduler';
import { CityState } from './types';
import {
  BENCHMARK_REGRESSION_MARGIN_MS,
  BENCHMARK_REGRESSION_RATIO,
  OFFICIAL_BENCHMARK_BASELINE,
} from './benchmarkBaseline';

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
  budgetMs: number;
  budgetExceeded: boolean;
  regressionExceeded: boolean;
}

export interface BenchmarkIntegrityGate {
  passed: boolean;
  deterministic: boolean;
  finite: boolean;
  validReplay: boolean;
  failures: string[];
}

export interface BenchmarkPerformanceGate {
  passed: boolean;
  failures: string[];
}

export interface BenchmarkSuiteReport {
  reports: BenchmarkReport[];
  deterministic: boolean;
  integrityGate: BenchmarkIntegrityGate;
  performanceGate: BenchmarkPerformanceGate;
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
  if (!scalarValues.every(Number.isFinite)) return false;
  for (let y = 0; y < state.grid.length; y += 1) {
    const row = state.grid[y];
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (![tile.population, tile.jobs, tile.traffic, tile.elevation, tile.pollution,
        tile.noise, tile.crime, tile.health, tile.education, tile.landValue].every(Number.isFinite)) return false;
    }
  }
  return true;
}

function sumGridPopulation(state: CityState): number {
  let population = 0;
  for (let y = 0; y < state.grid.length; y += 1) {
    const row = state.grid[y];
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile.type === 'RESIDENTIAL') population += tile.population;
    }
  }
  return population;
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
  const budgetMs = getSimulationBudgetMs(state.population);
  const tickMs = summarize(tickSamples);
  const baseline = OFFICIAL_BENCHMARK_BASELINE[scenario];
  const regressionExceeded = tickMs.p95 > baseline.p95 * BENCHMARK_REGRESSION_RATIO + BENCHMARK_REGRESSION_MARGIN_MS
    || tickMs.p50 > baseline.p50 * BENCHMARK_REGRESSION_RATIO + BENCHMARK_REGRESSION_MARGIN_MS;
  return {
    scenario,
    seed,
    ticks,
    tickMs,
    phaseMs,
    population: state.population,
    gridPopulation: sumGridPopulation(state),
    citizenAgents: state.citizenState?.citizens?.length ?? 0,
    populationScale: state.citizenState?.populationScale ?? 1,
    entities: (state.activeTrips?.length ?? 0) + (state.activeFreightTrips?.length ?? 0) + (state.transitVehicles?.length ?? 0) + (state.serviceVehicles?.length ?? 0),
    activeRegions: state.activeRegionKeys?.length ?? state.unlockedRegions.length,
    stateHash: getStateHash(state),
    finite: isFiniteCityState(state),
    budgetMs,
    budgetExceeded: tickMs.p95 > budgetMs,
    regressionExceeded,
  };
}

export function runOfficialBenchmarkSuite(ticks = 10, seed = 2088): BenchmarkSuiteReport {
  const reports = OFFICIAL_BENCHMARKS.map((scenario) => runOfficialBenchmark(scenario, ticks, seed));
  const replayReports = OFFICIAL_BENCHMARKS.map((scenario) => runOfficialBenchmark(scenario, ticks, seed));
  const deterministic = reports.every((report, index) => report.stateHash === replayReports[index].stateHash);
  const finite = reports.every((report) => report.finite);
  const validReplay = deterministic && replayReports.every((report) => report.finite);
  const integrityFailures = [
    ...(!deterministic ? ['deterministic replay mismatch'] : []),
    ...(!finite ? ['non-finite authoritative state'] : []),
    ...(!validReplay ? ['replay produced an invalid state'] : []),
  ];
  const integrityGate: BenchmarkIntegrityGate = {
    passed: integrityFailures.length === 0,
    deterministic,
    finite,
    validReplay,
    failures: integrityFailures,
  };
  const performanceFailures = reports.flatMap((report) => [
    ...(report.budgetExceeded ? [`${report.scenario} exceeded ${report.budgetMs}ms p95 budget`] : []),
    ...(report.regressionExceeded ? [`${report.scenario} regressed against committed baseline`] : []),
  ]);
  const performanceGate: BenchmarkPerformanceGate = {
    passed: performanceFailures.length === 0,
    failures: performanceFailures,
  };
  return {
    reports,
    deterministic,
    integrityGate,
    performanceGate,
    passed: integrityGate.passed && performanceGate.passed,
  };
}
