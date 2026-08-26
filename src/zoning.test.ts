import { describe, expect, it } from 'vitest';
import { createTile, TileType } from './types';
import { getOfficeCapacity, getResidentialCapacity, getZoneDensity } from './zoning';
import { calculateTileRent } from './citizenSimulation/satisfaction';

describe('density zoning and office foundations', () => {
  it('scales residential capacity by density while preserving legacy low-density defaults', () => {
    const low = createTile(0, 0, { type: TileType.RESIDENTIAL, level: 2 });
    const medium = createTile(1, 0, { type: TileType.RESIDENTIAL, level: 2, zoneDensity: 'MEDIUM' });
    const high = createTile(2, 0, { type: TileType.RESIDENTIAL, level: 2, zoneDensity: 'HIGH' });

    expect(getZoneDensity(low)).toBe('LOW');
    expect(getResidentialCapacity(medium, 12)).toBeGreaterThan(getResidentialCapacity(low, 12));
    expect(getResidentialCapacity(high, 12)).toBeGreaterThan(getResidentialCapacity(medium, 12));
  });

  it('makes denser housing cheaper per household while office capacity grows with level', () => {
    const low = createTile(0, 0, { type: TileType.RESIDENTIAL, level: 2, landValue: 50, zoneDensity: 'LOW' });
    const high = createTile(1, 0, { type: TileType.RESIDENTIAL, level: 2, landValue: 50, zoneDensity: 'HIGH' });

    expect(calculateTileRent(high)).toBeLessThan(calculateTileRent(low));
    expect(getOfficeCapacity(5)).toBeGreaterThan(getOfficeCapacity(1));
  });
});
