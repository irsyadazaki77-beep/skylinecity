import { GAME_CONFIG } from './config';
import { TileData, TileType } from './types';

export interface RoadRepairResult {
  success: boolean;
  tile: TileData;
  cost: number;
  restoredCondition: number;
}

/** Repairs one road segment as a player-directed recovery action. */
export function repairRoadCondition(tile: TileData, budget: number): RoadRepairResult {
  if (tile.type !== TileType.ROAD || tile.water) {
    return { success: false, tile, cost: 0, restoredCondition: 0 };
  }

  const currentCondition = Math.max(0, Math.min(100, tile.roadCondition ?? 100));
  const restoredCondition = Math.min(GAME_CONFIG.ROAD_REPAIR_AMOUNT, 100 - currentCondition);
  if (restoredCondition <= 0) return { success: false, tile, cost: 0, restoredCondition: 0 };

  const cost = Math.max(1, Math.ceil((restoredCondition / GAME_CONFIG.ROAD_REPAIR_AMOUNT) * GAME_CONFIG.ROAD_REPAIR_COST));
  if (budget < cost) return { success: false, tile, cost, restoredCondition: 0 };

  return {
    success: true,
    tile: {
      ...tile,
      roadCondition: Math.round((currentCondition + restoredCondition) * 10) / 10,
      disasterImpact: Math.max(0, Math.round(((tile.disasterImpact ?? 0) - restoredCondition * 0.2) * 10) / 10),
    },
    cost,
    restoredCondition,
  };
}
