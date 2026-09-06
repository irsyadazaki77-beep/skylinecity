import { BenchmarkScenario } from './metropolisBenchmarks';

/** Measurements captured from the clean main baseline on 2026-09-05. */
export const OFFICIAL_BENCHMARK_BASELINE: Record<BenchmarkScenario, { p50: number; p95: number }> = {
  SMALL_TOWN: { p50: 21.4, p95: 40.1 },
  CONGESTED_CORRIDOR: { p50: 21.3, p95: 34.8 },
  INDUSTRIAL_CITY: { p50: 21.7, p95: 31.5 },
  FLOOD_RECOVERY: { p50: 18.1, p95: 26.9 },
  PERFORMANCE_100K: { p50: 61.5, p95: 110.0 },
};

/** The CI runner margin applies only to regression comparison, never budgets. */
export const BENCHMARK_REGRESSION_RATIO = 1.35;
export const BENCHMARK_REGRESSION_MARGIN_MS = 8;
