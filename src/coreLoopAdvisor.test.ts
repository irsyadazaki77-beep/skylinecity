import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState } from './engine';
import { getCoreLoopAdvice } from './coreLoopAdvisor';
import { createStarterGrid } from './starterCity';
import { computeRoadRecommendations } from './tutorialPathfinder';
import { TileType } from './types';

describe('core loop advisor', () => {
  it('starts paused cities with an explicit run action', () => {
    const state = createInitialCityState(createEmptyGrid(), 1);
    expect(getCoreLoopAdvice(state, 0).id).toBe('start-simulation');
  });

  it('moves from housing to jobs as the city is built', () => {
    const state = createInitialCityState(createEmptyGrid(), 2);
    state.day = 2;
    state.powerCapacity = 100;
    state.waterCapacity = 100;
    for (let i = 0; i < 8; i += 1) state.grid[2][i].type = TileType.ROAD;
    expect(getCoreLoopAdvice(state, 0).id).toBe('zone-residential');
    for (let i = 0; i < 4; i += 1) state.grid[1][i].type = TileType.RESIDENTIAL;
    expect(getCoreLoopAdvice(state, 0).id).toBe('zone-jobs');
  });

  it('routes a weak cashflow signal to the treasury panel', () => {
    const state = createInitialCityState(createEmptyGrid(), 3);
    state.day = 2;
    state.powerCapacity = 100;
    state.waterCapacity = 100;
    state.money = 100;
    state.operatingBudget = -40;
    for (let i = 0; i < 8; i += 1) state.grid[2][i].type = TileType.ROAD;
    for (let i = 0; i < 4; i += 1) state.grid[1][i].type = TileType.RESIDENTIAL;
    for (let i = 0; i < 2; i += 1) state.grid[0][i].type = TileType.COMMERCIAL;
    state.population = 25;
    expect(getCoreLoopAdvice(state, 1).action).toEqual({ kind: 'TREASURY' });
  });

  it('does not advise building duplicate utilities for starter city', () => {
    const state = createInitialCityState(createStarterGrid(), 2088);
    const initialAdvice = getCoreLoopAdvice(state, 0);
    expect(initialAdvice.id).toBe('connect-road');

    // Connect the road
    const rec = computeRoadRecommendations(state.grid, state.unlockedRegions);
    const [gapX, gapY] = rec.bestPath[0];
    state.grid[gapY][gapX].type = TileType.ROAD;
    state.grid[gapY][gapX].roadClass = 'LOCAL';

    const connectedAdvice = getCoreLoopAdvice(state, 0);
    // Should NOT suggest building power plant or water pump since starter has both
    expect(connectedAdvice.id).not.toBe('connect-power');
    expect(connectedAdvice.id).not.toBe('connect-water');
    expect(connectedAdvice.actionLabel).not.toBe('Pilih power plant');
    expect(connectedAdvice.actionLabel).not.toBe('Pilih water pump');
  });

  it('suggests connecting existing power plant to road instead of buying duplicate', () => {
    const state = createInitialCityState(createEmptyGrid(6, 6), 2088);
    state.day = 2;
    state.grid[1][1].type = TileType.POWER_PLANT;
    state.grid[1][1].powered = false;
    state.powerCapacity = 0;
    const advice = getCoreLoopAdvice(state, 0);
    expect(advice.id).toBe('connect-power');
    expect(advice.actionLabel).toBe('Pilih jalan');
  });
});
