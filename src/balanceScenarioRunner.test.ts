import { describe, expect, it } from 'vitest';
import { runBalanceScenario, runBalanceSuite } from './balanceScenarioRunner';

describe('balance scenario guardrails', () => {
  it('produces finite deterministic traces for the starter city', () => {
    const first = runBalanceScenario('SMALL_TOWN', 3, 321);
    const second = runBalanceScenario('SMALL_TOWN', 3, 321);
    expect(first.finite).toBe(true);
    expect(first.deterministicHash).toBe(second.deterministicHash);
    expect(first.samples).toHaveLength(3);
    expect(first.samples.every((sample) => Number.isFinite(sample.operatingBudget))).toBe(true);
  });

  it('keeps the starter city recoverable through the onboarding window', () => {
    const report = runBalanceScenario('SMALL_TOWN', 90, 2088);
    expect(report.warnings).toEqual([]);
    expect(report.finalPopulation).toBeGreaterThanOrEqual(15);
    expect(report.minMoney).toBeGreaterThan(0);
    expect(report.minHappiness).toBeGreaterThanOrEqual(40);
  }, 30_000);

  it('keeps the official suite replayable and finite', () => {
    const report = runBalanceSuite({ SMALL_TOWN: 2, CONGESTED_CORRIDOR: 2, INDUSTRIAL_CITY: 2, FLOOD_RECOVERY: 2, PERFORMANCE_100K: 1 }, 444);
    expect(report.deterministic).toBe(true);
    expect(report.reports).toHaveLength(5);
    expect(report.reports.every((item) => item.finite)).toBe(true);
    expect(report.passed).toBe(true);
  }, 30_000);
});
