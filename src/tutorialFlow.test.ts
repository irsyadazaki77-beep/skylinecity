import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState } from './engine';
import { createStarterGrid } from './starterCity';
import { computeRoadRecommendations } from './tutorialPathfinder';
import { createTutorialBaseline, hasLocalHighwayConnection, hasStarterUtilityNetwork, isTutorialStepComplete } from './tutorialFlow';
import { TileType } from './types';

describe('contextual onboarding progression', () => {
  it('requires the real highway connection and enough housing for 25 citizens', () => {
    const state = createInitialCityState(createStarterGrid(), 12);
    const baseline = createTutorialBaseline(state.grid);
    const recommendation = computeRoadRecommendations(state.grid, state.unlockedRegions);

    expect(recommendation.bestPath).toHaveLength(1);
    expect(hasLocalHighwayConnection(state.grid)).toBe(false);
    expect(isTutorialStepComplete('road', state, 0, baseline)).toBe(false);
    const [roadX, roadY] = recommendation.bestPath[0];
    state.grid[roadY][roadX].type = TileType.ROAD;
    state.grid[roadY][roadX].roadClass = 'LOCAL';
    expect(isTutorialStepComplete('road', state, 0, baseline)).toBe(true);
    expect(hasStarterUtilityNetwork(state.grid)).toBe(true);
    expect(isTutorialStepComplete('utilities', state, 0, baseline)).toBe(true);

    state.grid[27][36].type = TileType.RESIDENTIAL;
    state.grid[27][40].type = TileType.RESIDENTIAL;
    state.grid[29][35].type = TileType.COMMERCIAL;
    expect(isTutorialStepComplete('zoning', state, 0, baseline)).toBe(true);
  });

  it('only completes the time step once simulation starts', () => {
    const state = createInitialCityState(createEmptyGrid(3, 3), 12);
    expect(isTutorialStepComplete('time', state, 0, createTutorialBaseline(state.grid))).toBe(false);
    expect(isTutorialStepComplete('time', state, 1, createTutorialBaseline(state.grid))).toBe(true);
  });

  it('verifies optional contextual milestones for emergency, transit, economy, and expansion', () => {
    const state = createInitialCityState(createEmptyGrid(5, 5), 12);
    const baseline = createTutorialBaseline(state.grid);

    expect(isTutorialStepComplete('first_emergency', state, 1, baseline)).toBe(false);
    state.grid[2][2].type = TileType.CLINIC;
    expect(isTutorialStepComplete('first_emergency', state, 1, baseline)).toBe(true);

    expect(isTutorialStepComplete('region_expansion', state, 1, baseline)).toBe(false);
    state.unlockedRegions = ['1,1', '1,2'];
    expect(isTutorialStepComplete('region_expansion', state, 1, baseline)).toBe(true);

    expect(isTutorialStepComplete('first_transit', state, 1, baseline)).toBe(false);
    state.transitActiveLines = 1;
    expect(isTutorialStepComplete('first_transit', state, 1, baseline)).toBe(true);

    expect(isTutorialStepComplete('specialization', state, 1, baseline)).toBe(false);
    state.activePolicies = ['small_biz'];
    expect(isTutorialStepComplete('specialization', state, 1, baseline)).toBe(true);
  });

  it('verifies starter power plant and water pump are considered active in initial state', () => {
    const state = createInitialCityState(createStarterGrid(), 2088);
    expect(state.powerCapacity).toBeGreaterThanOrEqual(50);
    expect(state.waterCapacity).toBeGreaterThanOrEqual(50);
    expect(hasStarterUtilityNetwork(state.grid)).toBe(true);
    expect(isTutorialStepComplete('utilities', state, 0, createTutorialBaseline(state.grid))).toBe(true);
  });
});
