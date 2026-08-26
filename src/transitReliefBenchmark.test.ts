import { describe, expect, it } from 'vitest';
import { runTransitCapacityStressBenchmark, runTransitReliefBenchmark } from './transitReliefBenchmark';

describe('transit congestion relief benchmark', () => {
  it('produces a deterministic modal-shift comparison', () => {
    const first = runTransitReliefBenchmark(8, 4242);
    const second = runTransitReliefBenchmark(8, 4242);

    expect(first.baseline).toEqual(second.baseline);
    expect(first.withTransit).toEqual(second.withTransit);
    expect(first.withTransit.transitCoverage).toBeGreaterThan(0);
    expect(first.withTransit.transitRidership).toBeGreaterThan(0);
    expect(first.withTransit.transitTrips).toBeGreaterThan(0);
  });

  it('measures fewer car trips and lower congestion when the corridor is served', () => {
    const result = runTransitReliefBenchmark(12, 4242);

    expect(result.withTransit.carTrips).toBeLessThan(result.baseline.carTrips);
    expect(result.withTransit.congestionIndex).toBeLessThan(result.baseline.congestionIndex);
    expect(result.carTripReductionPercent).toBeGreaterThan(0);
    expect(Number.isFinite(result.elapsedMs)).toBe(true);
  });

  it('reaches scheduled vehicle capacity on a dense multi-stop corridor', () => {
    const result = runTransitCapacityStressBenchmark(2, 4242);
    expect(result.metrics.transitCoverage).toBeGreaterThan(0);
    expect(result.metrics.transitRidership).toBeGreaterThan(0);
    expect(result.metrics.capacityUtilizationPercent).toBeGreaterThanOrEqual(85);
    expect(Number.isFinite(result.elapsedMs)).toBe(true);
  });
});
