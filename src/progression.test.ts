import { describe, expect, it } from 'vitest';
import { getLivingCityStage, getLivingCityUnlocks, getNextLivingCityUnlock, MISSIONS } from './progression';
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
    state.population = 500;
    state.operatingBudget = 10;
    state.transitCoverage = 25;
    state.transitActiveLines = 1;
    expect(MISSIONS.find((mission) => mission.id === 'positive_budget')?.check(state)).toBe(true);
    expect(MISSIONS.find((mission) => mission.id === 'mobility_network')?.check(state)).toBe(true);
  });

  it('gives every mission a bounded progress contract and a recovery path', () => {
    const state = createInitialCityState(createEmptyGrid(), 103);
    for (const mission of MISSIONS) {
      const value = mission.progress(state);
      expect(Number.isFinite(value.current)).toBe(true);
      expect(value.target).toBeGreaterThan(0);
      expect(value.unit).toBeTruthy();
      expect(mission.locationLabel).toBeTruthy();
      expect(mission.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(mission.impact).toBeTruthy();
      expect(mission.recoveryPath).toBeTruthy();
    }
  });

  it('uses the commercial growth thresholds for the residential mission', () => {
    const state = createInitialCityState(createEmptyGrid(), 104);
    const mission = MISSIONS.find((item) => item.id === 'first_citizens');
    state.population = 99;
    expect(mission?.check(state)).toBe(false);
    expect(mission?.progress(state)).toEqual({ current: 99, target: 100, unit: 'warga' });
    state.population = 100;
    expect(mission?.check(state)).toBe(true);
  });

  it('derives the 100-to-5000 living-city unlock ladder without save fields', () => {
    const state = createInitialCityState(createEmptyGrid(), 105);
    state.population = 1_000;
    expect(getLivingCityUnlocks(state).filter((item) => item.populationRequired).map((item) => item.id)).toEqual([
      'basic_services', 'commercial_growth', 'apartments_school', 'public_transit',
    ]);
    expect(getNextLivingCityUnlock(state)?.id).toBe('office_district');
    state.population = 5_000;
    expect(getNextLivingCityUnlock(state)).toBeNull();
  });

  it('maps population to four visibly distinct city stages', () => {
    expect([0, 249, 250, 999, 1_000, 4_999, 5_000].map(getLivingCityStage)).toEqual([1, 1, 2, 2, 3, 3, 4]);
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
