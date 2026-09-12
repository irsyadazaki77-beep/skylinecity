import { expect, it } from 'vitest';
import { getRenderQuality } from './renderQuality';

it('applies a real low-detail budget for the low graphics preset', () => {
  const low = getRenderQuality('balanced', 'low');
  const medium = getRenderQuality('balanced', 'medium');
  expect(low.shadowCasters).toBe(0);
  expect(low.nearLodDistance).toBeLessThan(medium.nearLodDistance);
  expect(low.maxPedestrians).toBeLessThan(medium.maxPedestrians);
  expect(getRenderQuality('reduced', 'high')).toEqual(low);
});
