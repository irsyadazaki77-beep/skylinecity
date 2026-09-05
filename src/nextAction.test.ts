import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState } from './engine';
import { getNextActionModel } from './nextAction';
import { TileType } from './types';

describe('central next-action model', () => {
  it('exposes the action contract used by UI surfaces', () => {
    const state = createInitialCityState(createEmptyGrid(6, 6), 101);
    const action = getNextActionModel(state, 0);

    expect(action.actionType).toBe(action.action.kind);
    expect(action.label).toBe(action.actionLabel);
    expect(action.reason).toBe(action.description);
    expect(action.estimatedCost).toBeGreaterThanOrEqual(0);
    expect(action.expectedImpact.length).toBeGreaterThan(0);
    expect(action.completionRule.length).toBeGreaterThan(0);
  });

  it('shares a concrete tool and target when the city needs a road', () => {
    const state = createInitialCityState(createEmptyGrid(8, 8), 102);
    state.day = 2;
    state.powerCapacity = 100;
    state.waterCapacity = 100;
    for (let x = 1; x < 7; x += 1) state.grid[3][x].type = TileType.ROAD;
    const action = getNextActionModel(state, 0);

    if (action.action.kind !== 'TOOL') throw new Error(`Expected a tool action, got ${action.action.kind}`);
    expect(action.tool).toBe(action.action.tool);
  });
});
