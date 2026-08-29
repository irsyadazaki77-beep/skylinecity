import { describe, expect, it } from 'vitest';
import { runOfficialBenchmark, runOfficialBenchmarkSuite } from './benchmarkRunner';
import { createSimulationSchedulerState, observeSimulationTick } from './simulationScheduler';

describe('public beta benchmark and scheduler guardrails', () => {
  it('reports deterministic, finite official benchmark telemetry', () => {
    const first = runOfficialBenchmark('SMALL_TOWN', 2, 777);
    const second = runOfficialBenchmark('SMALL_TOWN', 2, 777);
    expect(first.finite).toBe(true);
    expect(first.stateHash).toBe(second.stateHash);
    expect(first.tickMs.p95).toBeGreaterThanOrEqual(0);
    expect(first.budgetMs).toBe(50);
    expect(typeof first.budgetExceeded).toBe('boolean');
    expect(Object.values(first.phaseMs).every((sample) => Number.isFinite(sample.p95))).toBe(true);
  });

  it('covers every official scenario without relying on timing-sensitive pass/fail limits', () => {
    const report = runOfficialBenchmarkSuite(1, 888);
    expect(report.reports).toHaveLength(5);
    expect(report.deterministic).toBe(true);
    expect(report.passed).toBe(true);
  }, 30_000);

  it('exercises represented population and sampled citizen workload in the 100k fixture', () => {
    const report = runOfficialBenchmark('PERFORMANCE_100K', 1, 888);
    expect(report.population).toBe(100_000);
    expect(report.gridPopulation).toBe(100_000);
    expect(report.citizenAgents).toBeGreaterThan(0);
    expect(report.populationScale).toBeGreaterThan(1);
  }, 30_000);

  it('reduces visual quality and cadence after a sustained over-budget tick', () => {
    const result = observeSimulationTick(createSimulationSchedulerState(), 130, 100_000, 3);
    expect(result.telemetry.overloaded).toBe(true);
    expect(result.telemetry.qualityTier).toBe('reduced');
    expect(result.telemetry.ticksPerInterval).toBe(1);
    expect(result.telemetry.intervalMs).toBeGreaterThanOrEqual(1_000);
  });
});
