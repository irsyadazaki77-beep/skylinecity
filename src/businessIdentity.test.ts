import { describe, expect, it } from 'vitest';
import { deriveBusinessProfile } from './businessIdentity';
import { createTile, TileType } from './types';

describe('business identity', () => {
  it('derives stable identity and reconciled financials from simulation telemetry', () => {
    const tile = createTile(8, 12, { type: TileType.INDUSTRIAL, level: 2, jobs: 21, companyProfit: 73, companyEfficiency: 0.82, inputShortage: 0.1 });
    const first = deriveBusinessProfile(tile)!;
    const second = deriveBusinessProfile({ ...tile })!;
    expect(first).toEqual(second);
    expect(first.revenue - first.expenses).toBe(first.profit);
    expect(first.employees).toBe(21);
    expect(first.freightDependency).toBe(90);
  });

  it('does not invent a business for non-employment tiles', () => {
    expect(deriveBusinessProfile(createTile(1, 1, { type: TileType.RESIDENTIAL }))).toBeNull();
  });
});
