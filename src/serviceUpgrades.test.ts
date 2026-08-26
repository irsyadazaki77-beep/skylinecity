import { describe, expect, it } from 'vitest';
import { TileType } from './types';
import { serviceUpgradeStats } from './serviceUpgrades';

describe('service upgrade modules', () => {
  it('only applies compatible upgrades and exposes operating cost', () => {
    const base = serviceUpgradeStats(TileType.FIRE_STATION);
    const upgraded = serviceUpgradeStats(TileType.FIRE_STATION, ['fire_engine_bay', 'fire_training', 'ambulance_wing']);

    expect(upgraded.capacityMultiplier).toBeGreaterThan(base.capacityMultiplier);
    expect(upgraded.rangeBonus).toBeGreaterThan(0);
    expect(upgraded.dailyUpkeep).toBeGreaterThan(0);
    expect(upgraded.upgrades.every((upgrade) => upgrade.facilityTypes.includes(TileType.FIRE_STATION))).toBe(true);
  });
});
