import { describe, expect, it } from 'vitest';
import { getCarVisualScale } from './TrafficVehicles';

describe('traffic visual archetypes', () => {
  it('maps car archetypes deterministically and loops predictably', () => {
    expect(getCarVisualScale(0)).toEqual([1, 1, 1]);
    expect(getCarVisualScale(1)).toEqual([0.48, 0.72, 0.82]);
    expect(getCarVisualScale(4)).toEqual(getCarVisualScale(0));
    expect(getCarVisualScale(5)).toEqual(getCarVisualScale(1));
  });
});
