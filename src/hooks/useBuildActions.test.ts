import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState } from '../engine';
import { TileType } from '../types';
import { captureHistorySnapshot, restoreHistorySnapshot } from './useBuildActions';

describe('build history snapshots', () => {
  it('round-trips grid and non-grid domains without JSON diffing', () => {
    const initial = createInitialCityState(createEmptyGrid(4, 4), 8080);
    const before = captureHistorySnapshot(initial);
    const changed = {
      ...initial,
      grid: initial.grid.map((row, y) => row.map((tile, x) => (
        x === 1 && y === 1 ? { ...tile, type: TileType.ROAD, roadClass: 'LOCAL' as const } : tile
      ))),
      money: initial.money - 125,
      unlockedUpgrades: [...initial.unlockedUpgrades, 'HISTORY_TEST_UPGRADE'],
      activePolicies: [...initial.activePolicies, 'HISTORY_TEST_POLICY'],
      unlockedRegions: [...initial.unlockedRegions, 'HISTORY_TEST_REGION'],
      transitLines: [],
      districts: [],
      signalStates: { '1,1': { stage: 'GREEN', axis: 'ALL', elapsedSeconds: 4, phaseElapsedSeconds: 4, cycleSeconds: 60, greenSeconds: 30, yellowSeconds: 5, allRedSeconds: 2, pedestrianSeconds: 8, pedestrianCrossing: false } as const },
      serviceMaintenanceOrders: [],
      serviceDepotCondition: { fire: 0.5 },
      regions: {},
      residentialTaxRate: initial.residentialTaxRate + 0.05,
    };

    const after = captureHistorySnapshot(changed);
    const undone = restoreHistorySnapshot(changed, before);
    expect(undone).toEqual(initial);

    const redone = restoreHistorySnapshot(initial, after);
    expect(redone.grid[1][1].type).toBe(TileType.ROAD);
    expect(redone.money).toBe(initial.money - 125);
    expect(redone.unlockedUpgrades).toContain('HISTORY_TEST_UPGRADE');
    expect(redone.activePolicies).toContain('HISTORY_TEST_POLICY');
    expect(redone.transitLines).toEqual([]);
    expect(redone.districts).toEqual([]);
    expect(redone.signalStates?.['1,1']?.stage).toBe('GREEN');
    expect(redone.serviceDepotCondition).toEqual({ fire: 0.5 });
    expect(redone.residentialTaxRate).toBe(initial.residentialTaxRate + 0.05);
  });
});
