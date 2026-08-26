import { TileData, TileType } from './types';

export interface HydrologyResult {
  floodedTiles: number;
  averageDepth: number;
  peakDepth: number;
  flowingTiles: number;
  reservoirStorage: number;
  floodBarrierCount: number;
}

const DIRECTIONS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;

function surfaceResistance(tile: TileData): number {
  if (tile.type === TileType.PARK) return 0.2;
  if (tile.type === TileType.PARKING) return 0.06;
  if (tile.type === TileType.ROAD) return 0.02;
  if (tile.type === TileType.WATER_RESERVOIR) return 1;
  if (tile.type === TileType.EMPTY && (tile.resource === 'forest' || tile.resource === 'fertile')) return 0.05;
  return 0.01;
}

/**
 * Lightweight deterministic surface-water solver. Water follows connected
 * lowland cells, records its downhill flow direction, and produces a bounded
 * flood depth without permanently converting land into water.
 */
export function simulateHydrology(grid: TileData[][], rainfallMultiplier = 0.8): HydrologyResult {
  const width = grid[0]?.length ?? 0;
  const queue: number[] = [];
  const distances = new Int16Array(grid.length * width);
  distances.fill(-1);
  const nonWater: TileData[] = [];
  const reservoirs: TileData[] = [];
  let floodBarrierCount = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (tile.type === TileType.WATER_RESERVOIR) {
        reservoirs.push(tile);
        tile.reservoirLevel = Math.max(0, Math.min(1, (tile.reservoirLevel ?? 0) - 0.025));
        tile.waterDepth = 0;
      } else {
        if (tile.type === TileType.FLOOD_BARRIER) floodBarrierCount += 1;
        if (!tile.water && tile.type !== TileType.FLOOD_BARRIER) nonWater.push(tile);
        const rainfallDepth = tile.water ? 0 : Math.max(0, Math.min(0.22, (rainfallMultiplier - 0.8) * 0.16 * (1 - surfaceResistance(tile))));
        tile.waterDepth = tile.water ? 1 : rainfallDepth;
      }
      tile.flowDx = 0;
      tile.flowDy = 0;
      if (tile.water) {
        const index = tile.y * width + tile.x;
        distances[index] = 0;
        queue.push(index);
      }
    }
  }

  let queueIndex = 0;

  while (queueIndex < queue.length) {
    const currentIndex = queue[queueIndex++];
    const currentX = width > 0 ? currentIndex % width : 0;
    const currentY = width > 0 ? Math.floor(currentIndex / width) : 0;
    const currentTile = grid[currentY]?.[currentX];
    if (!currentTile) continue;
    if (currentTile.type === TileType.FLOOD_BARRIER || currentTile.type === TileType.WATER_RESERVOIR) continue;
    const currentDepth = currentTile.waterDepth ?? 0;
    const distance = distances[currentIndex] >= 0 ? distances[currentIndex] : 0;
    if (distance >= 5 || currentDepth <= 0.2) continue;

    let lowerNeighbor: TileData | undefined;
    for (const [dx, dy] of DIRECTIONS) {
      const candidate = grid[currentY + dy]?.[currentX + dx];
      if (!candidate || candidate.type === TileType.FLOOD_BARRIER || candidate.type === TileType.WATER_RESERVOIR) continue;
      if (!lowerNeighbor || candidate.elevation < lowerNeighbor.elevation) lowerNeighbor = candidate;
    }
    if (lowerNeighbor && lowerNeighbor.elevation < currentTile.elevation) {
      currentTile.flowDx = Math.sign(lowerNeighbor.x - currentTile.x);
      currentTile.flowDy = Math.sign(lowerNeighbor.y - currentTile.y);
    }

    for (const [dx, dy] of DIRECTIONS) {
      const neighbor = grid[currentY + dy]?.[currentX + dx];
      if (!neighbor) continue;
      if (neighbor.type === TileType.FLOOD_BARRIER) continue;
      if (neighbor.type === TileType.WATER_RESERVOIR) {
        const intake = Math.min(0.38, currentDepth * 0.62);
        neighbor.reservoirLevel = Math.round(Math.min(1, (neighbor.reservoirLevel ?? 0) + intake) * 100) / 100;
        continue;
      }
      const barrier = Math.max(0, neighbor.elevation - currentTile.elevation);
      if (barrier > 1.2) continue;
      const nextDepth = neighbor.water
        ? 1
        : Math.max(0, currentDepth - 0.16 - barrier * 0.12 - surfaceResistance(neighbor));
      if (nextDepth <= (neighbor.waterDepth ?? 0) + 0.04) continue;
      neighbor.waterDepth = Math.round(Math.min(1, nextDepth) * 100) / 100;
      const nextDistance = distance + 1;
      const neighborIndex = neighbor.y * width + neighbor.x;
      if (distances[neighborIndex] < 0 || nextDistance < distances[neighborIndex]) {
        distances[neighborIndex] = nextDistance;
        queue.push(neighborIndex);
      }
    }
  }

  let floodedTiles = 0;
  let flowingTiles = 0;
  let depthSum = 0;
  let peakDepth = 0;
  for (const tile of nonWater) {
    const depth = tile.waterDepth ?? 0;
    depthSum += depth;
    peakDepth = Math.max(peakDepth, depth);
    if (Math.abs(tile.flowDx ?? 0) + Math.abs(tile.flowDy ?? 0) > 0) flowingTiles += 1;
    if (depth >= 0.48) {
      floodedTiles += 1;
      tile.disasterImpact = Math.min(100, Math.max(tile.disasterImpact ?? 0, Math.round(depth * 20 * 10) / 10));
      tile.disasterSeverity = Math.max(tile.disasterSeverity ?? 0, depth >= 0.78 ? 2 : 1);
    }
  }

  const reservoirStorage = reservoirs.length > 0
    ? Math.round(reservoirs.reduce((sum, tile) => sum + (tile.reservoirLevel ?? 0), 0) / reservoirs.length * 100) / 100
    : 0;

  return {
    floodedTiles,
    averageDepth: nonWater.length > 0 ? Math.round((depthSum / nonWater.length) * 100) / 100 : 0,
    peakDepth: Math.round(peakDepth * 100) / 100,
    flowingTiles,
    reservoirStorage,
    floodBarrierCount,
  };
}
