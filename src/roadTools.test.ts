import { describe, expect, it } from 'vitest';
import { getOrthogonalRoadPath } from './roadTools';

describe('getOrthogonalRoadPath', () => {
  it('keeps a straight horizontal drag unchanged', () => {
    expect(getOrthogonalRoadPath([2, 4], [5, 4])).toEqual([[2, 4], [3, 4], [4, 4], [5, 4]]);
  });

  it('reaches the exact diagonal endpoint with one orthogonal bend', () => {
    expect(getOrthogonalRoadPath([2, 2], [5, 4])).toEqual([
      [2, 2], [3, 2], [4, 2], [5, 2], [5, 3], [5, 4],
    ]);
  });

  it('handles reverse drags and a single-tile click', () => {
    expect(getOrthogonalRoadPath([5, 4], [2, 2])).toEqual([
      [5, 4], [4, 4], [3, 4], [2, 4], [2, 3], [2, 2],
    ]);
    expect(getOrthogonalRoadPath([3, 3], [3, 3])).toEqual([[3, 3]]);
  });
});
