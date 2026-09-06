import { describe, expect, it } from 'vitest';
import { createInitialCityState } from './engine';
import { createStarterGrid } from './starterCity';
import { createSaveEnvelope, deleteSave, importSavePreview, loadGame, migrateSaveState, saveGame, saveRepository } from './saveSystem';

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
    state.citizenStoryState = {
      active: [],
      lastEmittedByKey: { 'MOVED_IN:household-1': 8 },
      history: [{
        id: 'citizen-story-test', key: 'MOVED_IN:household-1', type: 'MOVED_IN', status: 'OBSERVED', day: 8,
        subjectId: 'citizen-1', householdId: 'household-1', title: 'Keluarga baru tiba', summary: 'Diturunkan dari migrasi.',
        cause: 'Hunian tersedia.', impact: 'Kebutuhan bertambah.', choice: 'Tambah pekerjaan.', estimatedCost: 0,
        projectedOutcome: 'Keluarga menetap.', location: { x: 35, y: 27 },
      }],
    };
    expect(envelope.buildId).toBeTruthy();
    expect(envelope.featureSet).toBe('stable');
    expect(saveGame('release-test', state, 'Test City')).toBe(true);
    const loaded = loadGame('release-test');
    expect(loaded?.gameState.seed).toBe(4242);
    expect(loaded?.gameState.grid.length).toBe(state.grid.length);
    const loadedCompany = loaded?.gameState.grid.flat().find((tile) => tile.type === 'INDUSTRIAL');
    expect(loadedCompany?.companySector).toBe('SPECIALIZED_GOODS');
    expect(loadedCompany?.companyEfficiency).toBe(0.84);
    expect(loaded?.gameState.citizenStoryState?.history[0]?.id).toBe('citizen-story-test');
    deleteSave('release-test');
  });

  it('rejects malformed imports before they can overwrite a slot', () => {
    expect(importSavePreview('{"hello":"world"}').valid).toBe(false);
    expect(importSavePreview('not-json').valid).toBe(false);
  });

  it('migrates version 13 cities to an empty citizen-story ledger', () => {
    const legacy = createInitialCityState(createStarterGrid(), 13);
    delete legacy.citizenStoryState;
    const migrated = migrateSaveState(legacy, 13);
    expect(migrated.citizenStoryState).toEqual({ active: [], history: [], lastEmittedByKey: {} });
  });

  it('migrates version 14 cities to neutral living-city domains', () => {
    const legacy = createInitialCityState(createStarterGrid(), 14);
    delete legacy.neighborhoodIdentityState; delete legacy.disasterPreparationState;
    delete legacy.policyConsequences; delete legacy.cityHistoryState; delete legacy.campaignStyleGoal;
    const migrated = migrateSaveState(legacy, 14);
    expect(migrated.neighborhoodIdentityState).toEqual({ identities: [] });
    expect(migrated.disasterPreparationState?.phase).toBe('MONITORING');
    expect(migrated.cityHistoryState?.events).toEqual([]);
    expect(migrated.campaignStyleGoal).toBe('BALANCED');
  });

  it('migrates synthetic policy comparisons to the observed-only contract', () => {
    const legacy = createInitialCityState(createStarterGrid(), 15);
    legacy.policyConsequences = [{
      policyId: 'small_biz', costPerDay: 10, benefit: 'benefit', beneficiary: 'winner', disadvantaged: 'loser',
      shortTerm: 'short', longTerm: 'long', measuredMetric: 'income', expectedDirection: 'UP', observedValue: 120,
      ...({ before: 120, after: 123 } as object),
    }];
    const migrated = migrateSaveState(legacy, 15);
    expect(migrated.policyConsequences?.[0]?.observedValue).toBe(120);
    expect('before' in (migrated.policyConsequences?.[0] ?? {})).toBe(false);
    expect('after' in (migrated.policyConsequences?.[0] ?? {})).toBe(false);
  });

  it('rejects structurally unsafe city states instead of hydrating them', () => {
    const state = createInitialCityState(createStarterGrid(), 99);
    const envelope = JSON.stringify({ ...createSaveEnvelope(state), state: { ...state, money: Number.POSITIVE_INFINITY } });
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
