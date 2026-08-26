import { describe, expect, it } from 'vitest';
import { createTile, TileType } from './types';
import { repairRoadCondition } from './roadMaintenance';

describe('player-directed road maintenance', () => {
  it('repairs damaged road condition and reduces disaster impact within budget', () => {
    const road = createTile(2, 2, {
      type: TileType.ROAD,
      roadCondition: 45,
      disasterImpact: 30,
    });

    const result = repairRoadCondition(road, 100);

    expect(result.success).toBe(true);
    expect(result.cost).toBe(35);
    expect(result.tile.roadCondition).toBe(65);
    expect(result.tile.disasterImpact).toBe(26);
  });

  it('does not spend money on intact roads or non-road tiles', () => {
    const intact = createTile(0, 0, { type: TileType.ROAD, roadCondition: 100 });
    const park = createTile(0, 1, { type: TileType.PARK, roadCondition: 40 });

    expect(repairRoadCondition(intact, 100).success).toBe(false);
    expect(repairRoadCondition(park, 100).success).toBe(false);
  });
});
