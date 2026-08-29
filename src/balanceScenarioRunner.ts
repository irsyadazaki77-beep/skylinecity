import { createBenchmarkState, BenchmarkScenario } from './metropolisBenchmarks';
import { getStateHash } from './releaseReadiness';
import { simulateTick } from './engine';
import { CityState } from './types';

export interface BalanceSample {
  day: number;
  population: number;
  money: number;
  operatingBudget: number;
  happiness: number;
  congestion: number;
  serviceResponseQuality: number;
  residentialDemand: number;
  commercialDemand: number;
  industrialDemand: number;
}

export interface BalanceReport {
  scenario: BenchmarkScenario;
  seed: number;
  ticks: number;
  samples: BalanceSample[];
  minMoney: number;
  maxDebt: number;
  minHappiness: number;
  finalPopulation: number;
  finalMilestone: number;
  bankruptcyDays: number;
  finite: boolean;
  deterministicHash: string;
  warnings: string[];
}

export const DEFAULT_BALANCE_TICKS: Record<BenchmarkScenario, number> = {
  SMALL_TOWN: 90,
  CONGESTED_CORRIDOR: 90,
  INDUSTRIAL_CITY: 90,
  FLOOD_RECOVERY: 90,
  PERFORMANCE_100K: 10,
};

function sampleState(state: CityState): BalanceSample {
  return {
    day: state.day,
    population: state.population,
    money: state.money,
    operatingBudget: state.operatingBudget ?? state.income - state.expenses,
    happiness: state.happiness,
    congestion: state.congestionIndex,
    serviceResponseQuality: state.serviceResponseQuality ?? 100,
    residentialDemand: state.residentialDemand,
    commercialDemand: state.commercialDemand,
    industrialDemand: state.industrialDemand,
  };
}

function isFiniteState(state: CityState): boolean {
  const scalarValues = [
    state.money, state.population, state.income, state.expenses, state.happiness,
    state.trafficAverage, state.congestionIndex, state.averageCommuteTime,
    state.powerCapacity, state.powerDemand, state.waterCapacity, state.waterDemand,
  ];
  return scalarValues.every(Number.isFinite) && state.grid.flat().every((tile) => [
    tile.population, tile.jobs, tile.traffic, tile.elevation, tile.pollution,
    tile.noise, tile.crime, tile.health, tile.education, tile.landValue,
  ].every(Number.isFinite));
}

/**
 * Runs a deterministic economic health trace. This intentionally uses the same
 * benchmark fixtures and tick pipeline as gameplay; it is a guardrail for
 * balancing changes, not a second simulation implementation.
 */
export function runBalanceScenario(
  scenario: BenchmarkScenario,
  ticks = DEFAULT_BALANCE_TICKS[scenario],
  seed = 2088,
): BalanceReport {
  let state = createBenchmarkState(scenario, seed);
  const samples: BalanceSample[] = [];
  let finite = true;
  let bankruptcyDays = 0;
  let minMoney = state.money;
  let maxDebt = state.municipalDebt ?? 0;
  let minHappiness = state.happiness;

  for (let index = 0; index < Math.max(1, ticks); index += 1) {
    state = simulateTick(state, { trafficDensity: 'high', benchmarkMode: scenario === 'PERFORMANCE_100K' });
    const sample = sampleState(state);
    samples.push(sample);
    finite = finite && isFiniteState(state);
    minMoney = Math.min(minMoney, state.money);
    maxDebt = Math.max(maxDebt, state.municipalDebt ?? 0);
    minHappiness = Math.min(minHappiness, state.happiness);
    if (state.money < 0) bankruptcyDays += 1;
  }

  const warnings: string[] = [];
  if (!finite) warnings.push('non-finite state');
  if (bankruptcyDays > Math.ceil(Math.max(1, ticks) * 0.25)) warnings.push('persistent negative treasury');
  if (minHappiness < 20) warnings.push('critical happiness');
  if (scenario === 'SMALL_TOWN' && state.population < 15) warnings.push('starter growth below onboarding target');
  if (scenario !== 'PERFORMANCE_100K' && state.population === 0) warnings.push('no represented population');

  return {
    scenario,
    seed,
    ticks: Math.max(1, ticks),
    samples,
    minMoney,
    maxDebt,
    minHappiness,
    finalPopulation: state.population,
    finalMilestone: state.milestoneLevel,
    bankruptcyDays,
    finite,
    deterministicHash: getStateHash(state),
    warnings,
  };
}

export function runBalanceSuite(
  ticksByScenario: Partial<Record<BenchmarkScenario, number>> = {},
  seed = 2088,
): { reports: BalanceReport[]; deterministic: boolean; passed: boolean } {
  const scenarios: BenchmarkScenario[] = ['SMALL_TOWN', 'CONGESTED_CORRIDOR', 'INDUSTRIAL_CITY', 'FLOOD_RECOVERY', 'PERFORMANCE_100K'];
  const reports = scenarios.map((scenario) => runBalanceScenario(scenario, ticksByScenario[scenario] ?? DEFAULT_BALANCE_TICKS[scenario], seed));
  const replay = scenarios.map((scenario) => runBalanceScenario(scenario, ticksByScenario[scenario] ?? DEFAULT_BALANCE_TICKS[scenario], seed));
  const deterministic = reports.every((report, index) => report.deterministicHash === replay[index].deterministicHash);
  // Balance warnings are intentionally advisory: benchmark fixtures represent
  // different stress states (including an empty industrial city and a flood
  // recovery crisis). Only deterministic, finite state is a hard gate.
  const passed = deterministic && reports.every((report) => report.finite);
  return { reports, deterministic, passed };
}
