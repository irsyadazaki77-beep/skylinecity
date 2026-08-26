import { describe, expect, it } from 'vitest';
import { simulateTradeContracts } from './tradeContracts';
import { createInitialCityState, createEmptyGrid } from './engine';

describe('persistent trade contracts', () => {
  it('splits capacity by commodity and settles export revenue deterministically', () => {
    const state = createInitialCityState(createEmptyGrid(4, 4), 7);
    state.tradeContracts = [
      { id: 'food-import', commodity: 'FOOD', direction: 'IMPORT', quantityPerDay: 20, pricePerUnit: 2, reliability: 80, remainingDays: 4, active: true },
      { id: 'goods-export', commodity: 'GOODS', direction: 'EXPORT', quantityPerDay: 10, pricePerUnit: 3, reliability: 50, remainingDays: 4, active: true },
    ];

    const result = simulateTradeContracts(state);

    expect(result.importCapacityByCommodity.FOOD).toBe(16);
    expect(result.exportCapacityByCommodity.GOODS).toBe(5);
    expect(result.exportRevenue).toBe(15);
    expect(result.contracts).toHaveLength(2);
  });
});
