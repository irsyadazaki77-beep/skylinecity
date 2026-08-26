import { describe, expect, it } from 'vitest';
import { createInitialCityState } from './engine';
import { createStarterGrid } from './starterCity';
import { createSaveEnvelope, deleteSave, importSavePreview, loadGame, saveGame, saveRepository } from './saveSystem';

describe('release save compatibility', () => {
  it('creates a versioned stable envelope and round-trips legacy-compatible storage', () => {
    const state = createInitialCityState(createStarterGrid(), 4242);
    const companyTile = state.grid.flat().find((tile) => tile.type === 'INDUSTRIAL');
    if (companyTile) {
      companyTile.companySector = 'SPECIALIZED_GOODS';
      companyTile.companyEfficiency = 0.84;
      companyTile.companyProfit = 19;
      companyTile.inputShortage = 0.16;
    }
    const envelope = createSaveEnvelope(state);
    expect(envelope.buildId).toBeTruthy();
    expect(envelope.featureSet).toBe('stable');
    expect(saveGame('release-test', state, 'Test City')).toBe(true);
    const loaded = loadGame('release-test');
    expect(loaded?.gameState.seed).toBe(4242);
    expect(loaded?.gameState.grid.length).toBe(state.grid.length);
    const loadedCompany = loaded?.gameState.grid.flat().find((tile) => tile.type === 'INDUSTRIAL');
    expect(loadedCompany?.companySector).toBe('SPECIALIZED_GOODS');
    expect(loadedCompany?.companyEfficiency).toBe(0.84);
    deleteSave('release-test');
  });

  it('rejects malformed imports before they can overwrite a slot', () => {
    expect(importSavePreview('{"hello":"world"}').valid).toBe(false);
    expect(importSavePreview('not-json').valid).toBe(false);
  });

  it('rejects structurally unsafe city states instead of hydrating them', () => {
    const state = createInitialCityState(createStarterGrid(), 99);
    const envelope = JSON.stringify({ ...createSaveEnvelope(state), state: { ...state, money: 1e999 } });
    expect(importSavePreview(envelope).valid).toBe(false);
  });

  it('keeps the async repository usable when IndexedDB is unavailable', async () => {
    const state = createInitialCityState(createStarterGrid(), 77);
    expect(await saveRepository.save('async-test', state, 'Async City')).toBe(true);
    const loaded = await saveRepository.load('async-test');
    expect(loaded?.cityName).toBe('Async City');
    expect((await saveRepository.listSlots()).some((slot) => slot.slotId === 'autosave')).toBe(true);
    await saveRepository.delete('async-test');
  });
});
