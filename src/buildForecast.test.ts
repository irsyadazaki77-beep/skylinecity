import { describe, expect, it } from 'vitest';
import { calculateBuildForecast } from './buildForecast';
import { TileType } from './types';

describe('build placement forecast', () => {
  it('estimates capacity, traffic, and tax for residential density', () => {
    const forecast = calculateBuildForecast('RESIDENTIAL_HIGH', 4, 'LOCAL');
    expect(forecast?.capacity).toBe(96);
    expect(forecast?.households).toBeGreaterThan(0);
    expect(forecast?.trafficDemand).toBeGreaterThan(0);
    expect(forecast?.estimatedTax).toBeGreaterThan(0);
  });

  it('treats highways as capacity infrastructure with maintenance cost', () => {
    const forecast = calculateBuildForecast(TileType.ROAD, 10, 'HIGHWAY');
    expect(forecast?.capacity).toBe(120);
    expect(forecast?.maintenance).toBeGreaterThan(0);
    expect(forecast?.trafficDemand).toBe(0);
  });

  it('returns no forecast when the preview has no valid tiles', () => {
    expect(calculateBuildForecast(TileType.COMMERCIAL, 0, 'LOCAL')).toBeNull();
  });
});
