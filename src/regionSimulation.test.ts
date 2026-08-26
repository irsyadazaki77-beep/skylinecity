import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState } from './engine';
import { advanceBackgroundRegions, calculateRegionTelemetry, getRegionSimulationLevel } from './regionSimulation';

describe('region simulation level of detail', () => {
  it('freezes empty unloaded regions without changing their last simulation day', () => {
    const state = createInitialCityState(createEmptyGrid(), 100);
    state.unlockedRegions = ['1,1', '2,1'];
    state.activeRegionKeys = ['1,1'];
    state.day = 12;
    state.regions = {
      '1,1': { key: '1,1', rx: 1, ry: 1, active: true, loaded: true, simulationLevel: 'FULL', lastSimulatedDay: 12, residentCount: 1, jobCount: 0, trafficLoad: 0, freightLoad: 0, waterDepth: 0 },
      '2,1': { key: '2,1', rx: 2, ry: 1, active: false, loaded: false, simulationLevel: 'BACKGROUND', lastSimulatedDay: 4, residentCount: 0, jobCount: 0, trafficLoad: 0, freightLoad: 0, waterDepth: 0 },
    };
    const telemetry = calculateRegionTelemetry(state);
    expect(getRegionSimulationLevel(state, telemetry['2,1'], false)).toBe('FROZEN');
    const next = advanceBackgroundRegions({ ...state, regions: telemetry }, state.activeRegionKeys);
    expect(next.regions?.['2,1'].simulationLevel).toBe('FROZEN');
    expect(next.regions?.['2,1'].lastSimulatedDay).toBe(4);
  });

  it('keeps populated unloaded regions in deterministic background simulation', () => {
    const state = createInitialCityState(createEmptyGrid(), 101);
    state.unlockedRegions = ['1,1', '2,1'];
    state.activeRegionKeys = ['1,1'];
    state.regions = {
      '2,1': { key: '2,1', rx: 2, ry: 1, active: false, loaded: false, simulationLevel: 'BACKGROUND', lastSimulatedDay: 2, residentCount: 50, jobCount: 20, trafficLoad: 5, freightLoad: 1, waterDepth: 0 },
    };
    const next = advanceBackgroundRegions(state, state.activeRegionKeys);
    expect(next.regions?.['2,1'].simulationLevel).toBe('BACKGROUND');
    expect(next.regions?.['2,1'].residentCount).toBeGreaterThanOrEqual(50);
  });
});
