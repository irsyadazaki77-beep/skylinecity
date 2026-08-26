import { describe, expect, it } from 'vitest';
import { getNightFactor } from './components/world/DayNightSky';

describe('day/night rendering helpers', () => {
  it('keeps midday bright and midnight dark without React state updates', () => {
    expect(getNightFactor(12)).toBe(0);
    expect(getNightFactor(0)).toBe(1);
    expect(getNightFactor(24)).toBe(1);
  });

  it('normalizes values outside the 24-hour range', () => {
    expect(getNightFactor(-12)).toBe(getNightFactor(12));
    expect(getNightFactor(36)).toBe(getNightFactor(12));
  });
});
