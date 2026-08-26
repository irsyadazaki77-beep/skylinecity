import { describe, expect, it } from 'vitest';
import { createInitialCityState, getLastSimulationPhaseTimings, simulateTick } from './engine';
import { createStarterGrid } from './starterCity';

describe('simulation phase profiler', () => {
  it('records finite phase timings without adding telemetry to deterministic city state', () => {
    const input = createInitialCityState(createStarterGrid(), 2088, 'normal');
    const next = simulateTick(input);
    const profile = getLastSimulationPhaseTimings();
    expect(profile.CLONE).toBeGreaterThanOrEqual(0);
    expect(Object.values(profile).every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(next, 'simulationPhaseTimings')).toBe(false);
    expect(next.simulationPhase).toBe('HISTORY');
  });
});
