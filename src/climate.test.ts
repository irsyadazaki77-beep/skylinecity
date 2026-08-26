import { describe, expect, it } from 'vitest';
import { simulateClimate } from './climate';

describe('climate and seasons', () => {
  it('is deterministic for the same day and seed', () => {
    expect(simulateClimate(120, 2088)).toEqual(simulateClimate(120, 2088));
  });

  it('rotates seasons and applies meaningful weather multipliers', () => {
    expect(simulateClimate(1, 2088).season).toBe('SPRING');
    expect(simulateClimate(91, 2088).season).toBe('SUMMER');
    expect(simulateClimate(181, 2088).season).toBe('AUTUMN');
    expect(simulateClimate(271, 2088).season).toBe('WINTER');
    const climate = simulateClimate(91, 11);
    expect(climate.powerDemandMultiplier).toBeGreaterThanOrEqual(1);
    expect(climate.precipitation).toBeGreaterThan(0);
  });
});
