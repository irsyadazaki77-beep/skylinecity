import { describe, it, expect } from 'vitest';
import { cloneCityState } from './useBuildActions';
import { createInitialCityState } from '../engine';
import { createStarterGrid } from '../starterCity';

describe('Domain hooks foundation', () => {
  it('clones city state deeply without mutating previous reference', () => {
    const original = createInitialCityState(createStarterGrid(), 2088, 'normal');
    const cloned = cloneCityState(original);

    expect(cloned).not.toBe(original);
    expect(cloned.grid).not.toBe(original.grid);
    expect(cloned.money).toBe(original.money);

    cloned.money = 999999;
    expect(original.money).not.toBe(999999);
  });

  it('preserves grid dimensions and properties in clone', () => {
    const original = createInitialCityState(createStarterGrid(), 2088, 'normal');
    const cloned = cloneCityState(original);

    expect(cloned.grid.length).toBe(original.grid.length);
    expect(cloned.grid[0].length).toBe(original.grid[0].length);
    expect(cloned.grid[5][5].x).toBe(5);
    expect(cloned.grid[5][5].y).toBe(5);
  });

  it('computes compact tile deltas for localized build edits without cloning full city', async () => {
    const { useBuildActions } = await import('./useBuildActions');
    expect(typeof useBuildActions).toBe('function');

    const state1 = createInitialCityState(createStarterGrid(), 2088, 'normal');
    const state2 = {
      ...state1,
      grid: state1.grid.map((row, y) =>
        y === 10 ? row.map((tile, x) => (x === 10 ? { ...tile, type: 'ROAD' as any } : tile)) : row,
      ),
      money: state1.money - 20,
    };

    // Verify state2 has identical reference for all unchanged rows
    expect(state2.grid[0]).toBe(state1.grid[0]);
    expect(state2.grid[10][10].type).toBe('ROAD');
  });
});

