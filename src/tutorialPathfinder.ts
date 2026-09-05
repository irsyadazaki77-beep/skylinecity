import { isTileInUnlockedRegion } from './mapGenerator';
import { TileData, TileType } from './types';

export interface RoadGuidanceResult {
  settlementCenter: [number, number];
  targetHighwayTile: [number, number] | null;
  bestPath: Array<[number, number]>;
  validTiles: Array<[number, number]>;
  blockedTiles: Array<[number, number]>;
  suboptimalTiles: Array<[number, number]>;
}

export interface UtilityGuidanceResult {
  powerTile: [number, number] | null;
  pumpTile: [number, number] | null;
  validCandidates: Array<[number, number]>;
}

export interface ZoningGuidanceResult {
  recommendedTiles: Array<[number, number]>;
  validTiles: Array<[number, number]>;
}

/**
 * Calculates the visual centroid of player-built or starter settlement tiles.
 */
export function findSettlementCentroid(grid: TileData[][]): [number, number] {
  const settledTiles: Array<[number, number]> = [];

  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < (grid[0]?.length ?? 0); x += 1) {
      const tile = grid[y][x];
      if (
        tile.type === TileType.RESIDENTIAL ||
        tile.type === TileType.COMMERCIAL ||
        tile.type === TileType.INDUSTRIAL ||
        tile.type === TileType.POWER_PLANT ||
        tile.type === TileType.WATER_PUMP ||
        (tile.type === TileType.ROAD && tile.roadClass !== 'HIGHWAY')
      ) {
        settledTiles.push([x, y]);
      }
    }
  }

  if (settledTiles.length === 0) return [30, 30];

  const sumX = settledTiles.reduce((acc, [x]) => acc + x, 0);
  const sumY = settledTiles.reduce((acc, [, y]) => acc + y, 0);
  return [Math.round(sumX / settledTiles.length), Math.round(sumY / settledTiles.length)];
}

/**
 * Calculates a balanced camera target that keeps both the target location and
 * the player's settlement visible in the same frame.
 */
export function calculateFramedFocus(
  target: [number, number],
  settlement: [number, number] = [30, 30],
  targetWeight = 0.6,
): [number, number] {
  const framedX = Math.round(settlement[0] * (1 - targetWeight) + target[0] * targetWeight);
  const framedY = Math.round(settlement[1] * (1 - targetWeight) + target[1] * targetWeight);
  return [framedX, framedY];
}

const CARDINALS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

/**
 * Calculates the shortest buildable road corridor connecting the local
 * settlement to the nearest regional highway.
 */
export function computeRoadRecommendations(
  grid: TileData[][],
  unlockedRegions: string[] = ['1,1'],
): RoadGuidanceResult {
  const settlementCenter = findSettlementCentroid(grid);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  // 1. Collect local road endpoints in the settlement
  const localRoads: Array<[number, number]> = [];
  const highways: Array<[number, number]> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = grid[y][x];
      if (tile.type === TileType.ROAD) {
        if (tile.roadClass === 'HIGHWAY') {
          highways.push([x, y]);
        } else {
          localRoads.push([x, y]);
        }
      }
    }
  }

  if (highways.length === 0) {
    return {
      settlementCenter,
      targetHighwayTile: null,
      bestPath: [],
      validTiles: [],
      blockedTiles: [],
      suboptimalTiles: [],
    };
  }

  // Find the closest highway tile to the settlement
  let bestHighway: [number, number] = highways[0];
  let minHighwayDist = Infinity;
  for (const [hx, hy] of highways) {
    const dist = Math.abs(hx - settlementCenter[0]) + Math.abs(hy - settlementCenter[1]);
    if (dist < minHighwayDist) {
      minHighwayDist = dist;
      bestHighway = [hx, hy];
    }
  }

  // Find candidate local starting road tiles (closest to chosen highway)
  const sortedStarts = [...localRoads].sort(([x1, y1], [x2, y2]) => {
    const d1 = Math.abs(x1 - bestHighway[0]) + Math.abs(y1 - bestHighway[1]);
    const d2 = Math.abs(x2 - bestHighway[0]) + Math.abs(y2 - bestHighway[1]);
    return d1 - d2;
  });

  const startTile = sortedStarts[0] ?? settlementCenter;

  // BFS from startTile to bestHighway through empty buildable tiles
  const queue: Array<[number, number]> = [startTile];
  const parent = new Map<string, [number, number] | null>();
  const visited = new Set<string>();
  const startKey = `${startTile[0]},${startTile[1]}`;
  visited.add(startKey);
  parent.set(startKey, null);

  let reachedHighway: [number, number] | null = null;

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    if (cx === bestHighway[0] && cy === bestHighway[1]) {
      reachedHighway = [cx, cy];
      break;
    }

    for (const [dx, dy] of CARDINALS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const tile = grid[ny][nx];
      // Can traverse empty buildable land in unlocked region, existing roads, or highway endpoint
      const isEndpoint = nx === bestHighway[0] && ny === bestHighway[1];
      const isRoad = tile.type === TileType.ROAD;
      const isBuildableEmpty = tile.type === TileType.EMPTY && !tile.water && isTileInUnlockedRegion(nx, ny, unlockedRegions);

      if (isEndpoint || isRoad || isBuildableEmpty) {
        visited.add(key);
        parent.set(key, [cx, cy]);
        queue.push([nx, ny]);
      }
    }
  }

  // Reconstruct path
  const bestPath: Array<[number, number]> = [];
  if (reachedHighway) {
    let curr: [number, number] | null = reachedHighway;
    while (curr) {
      const tile = grid[curr[1]][curr[0]];
      // Only include empty tiles that need to be built as road
      if (tile.type === TileType.EMPTY) {
        bestPath.unshift(curr);
      }
      curr = parent.get(`${curr[0]},${curr[1]}`) ?? null;
    }
  }

  // Categorize neighboring tiles around the best corridor
  const bestPathSet = new Set(bestPath.map(([x, y]) => `${x},${y}`));
  const validTiles: Array<[number, number]> = [];
  const blockedTiles: Array<[number, number]> = [];
  const suboptimalTiles: Array<[number, number]> = [];

  const corridorCenter = bestPath[0] ?? startTile;

  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = corridorCenter[0] + dx;
      const y = corridorCenter[1] + dy;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const key = `${x},${y}`;
      if (bestPathSet.has(key)) continue;

      const tile = grid[y][x];
      const unlocked = isTileInUnlockedRegion(x, y, unlockedRegions);

      if (!unlocked || tile.water || (tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD)) {
        blockedTiles.push([x, y]);
      } else if (tile.type === TileType.EMPTY) {
        const distToCorridor = Math.min(...bestPath.map(([px, py]) => Math.abs(px - x) + Math.abs(py - y)), Infinity);
        if (distToCorridor <= 1) {
          validTiles.push([x, y]);
        } else {
          suboptimalTiles.push([x, y]);
        }
      }
    }
  }

  return {
    settlementCenter,
    targetHighwayTile: bestHighway,
    bestPath,
    validTiles,
    blockedTiles,
    suboptimalTiles,
  };
}

/**
 * Recommends precise placement points for essential utilities (Power & Water).
 */
export function computeUtilityRecommendations(
  grid: TileData[][],
  unlockedRegions: string[] = ['1,1'],
): UtilityGuidanceResult {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  let powerTile: [number, number] | null = null;
  let pumpTile: [number, number] | null = null;
  const validCandidates: Array<[number, number]> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = grid[y][x];
      if (tile.type !== TileType.EMPTY || tile.water || !isTileInUnlockedRegion(x, y, unlockedRegions)) continue;

      const hasRoadNeighbor = CARDINALS.some(([dx, dy]) => {
        const neighbor = grid[y + dy]?.[x + dx];
        return neighbor?.type === TileType.ROAD;
      });

      const hasWaterNeighbor = CARDINALS.some(([dx, dy]) => {
        const neighbor = grid[y + dy]?.[x + dx];
        return neighbor?.water;
      });

      if (hasRoadNeighbor) {
        validCandidates.push([x, y]);
        if (!powerTile && !hasWaterNeighbor) {
          powerTile = [x, y];
        }
        if (!pumpTile && hasWaterNeighbor) {
          pumpTile = [x, y];
        }
      }
    }
  }

  return {
    powerTile: powerTile ?? validCandidates[0] ?? null,
    pumpTile: pumpTile ?? null,
    validCandidates,
  };
}

/**
 * Recommends optimal zoning parcels adjacent to active roads.
 */
export function computeZoningRecommendations(
  grid: TileData[][],
  unlockedRegions: string[] = ['1,1'],
): ZoningGuidanceResult {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  const recommendedTiles: Array<[number, number]> = [];
  const validTiles: Array<[number, number]> = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = grid[y][x];
      if (tile.type !== TileType.EMPTY || tile.water || !isTileInUnlockedRegion(x, y, unlockedRegions)) continue;

      const roadNeighbors = CARDINALS.filter(([dx, dy]) => {
        const neighbor = grid[y + dy]?.[x + dx];
        return neighbor?.type === TileType.ROAD;
      });

      if (roadNeighbors.length > 0) {
        validTiles.push([x, y]);
        // Prefer lots with exactly 1 or 2 road frontages in settlement
        if (roadNeighbors.length <= 2) {
          recommendedTiles.push([x, y]);
        }
      }
    }
  }

  return {
    recommendedTiles: recommendedTiles.slice(0, 12),
    validTiles,
  };
}

/**
 * Calculates a balanced camera framing that keeps both the settlement centroid
 * and the tutorial target visible in context.
 */
export function calculateTutorialFraming(
  grid: TileData[][],
  targetTile?: [number, number],
): { focus: [number, number]; zoom: number } {
  const settlement = findSettlementCentroid(grid);
  if (!targetTile) {
    return { focus: settlement, zoom: 1.25 };
  }
  const midX = Math.round((settlement[0] + targetTile[0]) / 2);
  const midY = Math.round((settlement[1] + targetTile[1]) / 2);
  const distance = Math.hypot(targetTile[0] - settlement[0], targetTile[1] - settlement[1]);
  const zoom = Math.max(0.85, Math.min(1.4, 1.6 - distance * 0.035));
  return { focus: [midX, midY], zoom };
}

