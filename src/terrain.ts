import { GAME_CONFIG } from './config';
import { ActiveTool, TileData, TerrainTool } from './types';

export const TERRAIN_TOOLS: TerrainTool[] = [
  'RAISE_TERRAIN',
  'LOWER_TERRAIN',
  'LEVEL_TERRAIN',
  'SMOOTH_TERRAIN',
];

export function isTerrainTool(tool: ActiveTool): tool is TerrainTool {
  return TERRAIN_TOOLS.includes(tool as TerrainTool);
}

export function getTerrainBrushTiles(
  centerX: number,
  centerY: number,
  brushSize: number,
  width: number,
  height: number,
): [number, number][] {
  const radius = Math.max(0, Math.round(brushSize) - 1);
  const tiles: [number, number][] = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x >= 0 && x < width && y >= 0 && y < height) tiles.push([x, y]);
    }
  }
  return tiles;
}

/**
 * Applies one deterministic terraforming stroke. The grid is mutated in
 * place, matching the existing simulation edit pipeline, and the return value
 * is the number of land tiles whose elevation actually changed.
 */
export function applyTerrainTool(
  grid: TileData[][],
  centerX: number,
  centerY: number,
  tool: TerrainTool,
  brushSize = 1,
): number {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const center = grid[centerY]?.[centerX];
  if (!center || center.water) return 0;

  const brushTiles = getTerrainBrushTiles(centerX, centerY, brushSize, width, height);
  const sourceElevations = new Map<string, number>();
  for (const [x, y] of brushTiles) sourceElevations.set(`${x},${y}`, grid[y][x].elevation);

  let changed = 0;
  for (const [x, y] of brushTiles) {
    const tile = grid[y][x];
    if (tile.water) continue;

    let nextElevation = tile.elevation;
    if (tool === 'RAISE_TERRAIN') {
      nextElevation = tile.elevation + 1;
    } else if (tool === 'LOWER_TERRAIN') {
      nextElevation = tile.elevation - 1;
    } else if (tool === 'LEVEL_TERRAIN') {
      nextElevation = center.elevation;
    } else if (tool === 'SMOOTH_TERRAIN') {
      let sum = sourceElevations.get(`${x},${y}`) ?? tile.elevation;
      let samples = 1;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const neighbor = grid[y + dy]?.[x + dx];
        if (!neighbor || neighbor.water) continue;
        sum += sourceElevations.get(`${x + dx},${y + dy}`) ?? neighbor.elevation;
        samples += 1;
      }
      nextElevation = Math.round(sum / samples);
    }

    nextElevation = Math.max(
      GAME_CONFIG.TERRAIN_MIN_ELEVATION,
      Math.min(GAME_CONFIG.TERRAIN_MAX_ELEVATION, nextElevation),
    );
    if (nextElevation !== tile.elevation) {
      tile.elevation = nextElevation;
      changed += 1;
    }
  }

  return changed;
}
