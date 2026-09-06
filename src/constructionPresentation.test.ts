import { describe, expect, it } from 'vitest';
import { getConstructionStage, getConstructionStageLabel } from './constructionPresentation';
import { createTile, TileType } from './types';

describe('construction presentation', () => {
  it('uses persisted evolution progress for deterministic visual phases', () => {
    const tile = createTile(4, 5, { type: TileType.COMMERCIAL, parcelStatus: 'DEVELOPING', upgradeProgress: 25 });
    expect(getConstructionStage(tile)).toBe('FOUNDATION');
    expect(getConstructionStage({ ...tile, upgradeProgress: 35 })).toBe('FRAME');
    expect(getConstructionStage({ ...tile, upgradeProgress: 50 })).toBe('STRUCTURE');
    expect(getConstructionStage({ ...tile, upgradeProgress: 75 })).toBe('FACADE');
    expect(getConstructionStage({ ...tile, upgradeProgress: 90 })).toBe('FINISHING');
  });

  it('shows RENOVATING when an occupied building is upgrading', () => {
    const tile = createTile(3, 3, { type: TileType.RESIDENTIAL, population: 12, upgradeProgress: 40 });
    expect(getConstructionStage(tile)).toBe('RENOVATING');
  });

  it('prioritizes damage and abandonment', () => {
    const tile = createTile(2, 3, { type: TileType.RESIDENTIAL, population: 8, abandoned: true });
    expect(getConstructionStage(tile)).toBe('ABANDONED');
    expect(getConstructionStage({ ...tile, disasterImpact: 70 })).toBe('DAMAGED');
  });

  it('provides bilingual stage labels', () => {
    expect(getConstructionStageLabel('FRAME', 'id')).toBe('Rangka Struktur');
    expect(getConstructionStageLabel('FRAME', 'en')).toBe('Structural Framing');
    expect(getConstructionStageLabel('RENOVATING', 'id')).toBe('Renovasi Peningkatan');
  });
});
