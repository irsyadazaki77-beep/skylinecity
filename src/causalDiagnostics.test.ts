import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState } from './engine';
import { calculateCausalDiagnostics } from './causalDiagnostics';
import { TileType } from './types';

describe('causal diagnostics', () => {
  it('explains office vacancy, production shortage, and rent pressure', () => {
    const state = createInitialCityState(createEmptyGrid(4, 4), 99);
    state.officeDemand = 30;
    state.officeUtilization = 0.4;
    state.productionEfficiency = 0.5;
    state.freightReliability = 55;
    state.tradeImportCapacity = 20;
    state.grid[1][1] = { ...state.grid[1][1], type: TileType.RESIDENTIAL, rentPressure: 2.5 };

    const diagnostics = calculateCausalDiagnostics(state);
    const titles = diagnostics.map((diagnostic) => diagnostic.title);

    expect(titles).toContain('Kantor kurang terisi');
    expect(titles).toContain('Input industri kurang');
    expect(titles).toContain('Tekanan sewa perumahan');
  });
});
