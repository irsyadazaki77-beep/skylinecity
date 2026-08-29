import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState } from './engine';
import { getCoreLoopAdvice } from './coreLoopAdvisor';
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
});
