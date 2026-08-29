import { describe, expect, it } from 'vitest';
import { MISSIONS } from './progression';
import { createEmptyGrid, createInitialCityState } from './engine';

describe('progression mission chain', () => {
  it('offers actionable early-game grants', () => {
    const state = createInitialCityState(createEmptyGrid(), 101);
    state.powerCapacity = 100;
    state.waterCapacity = 100;
    expect(MISSIONS.find((mission) => mission.id === 'first_utilities')?.check(state)).toBe(true);
    expect(MISSIONS.find((mission) => mission.id === 'first_citizens')?.check(state)).toBe(false);
  });

  it('checks transit and fiscal objectives from live telemetry', () => {
    const state = createInitialCityState(createEmptyGrid(), 102);
    state.population = 50;
    state.operatingBudget = 10;
    state.transitCoverage = 25;
    state.transitActiveLines = 1;
    expect(MISSIONS.find((mission) => mission.id === 'positive_budget')?.check(state)).toBe(true);
    expect(MISSIONS.find((mission) => mission.id === 'mobility_network')?.check(state)).toBe(true);
  });
});
