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

  it('completes the living-city mission from three distinct real story types', () => {
    const state = createInitialCityState(createEmptyGrid(3, 3), 12);
    state.citizenStoryState = {
      active: [], lastEmittedByKey: {},
      history: ['MOVED_IN', 'FOUND_WORK', 'USED_TRANSIT'].map((type, index) => ({
        id: `story-${index}`, key: `${type}:${index}`, type: type as 'MOVED_IN' | 'FOUND_WORK' | 'USED_TRANSIT', status: 'OBSERVED' as const,
        day: index + 1, subjectId: `citizen-${index}`, householdId: `household-${index}`, title: type, summary: type,
        cause: 'state', impact: 'state', choice: 'act', estimatedCost: 0, projectedOutcome: 'change', location: { x: 1, y: 1 },
      })),
    };
    expect(MISSIONS.find((mission) => mission.id === 'living_city')?.check(state)).toBe(true);
  });
});
