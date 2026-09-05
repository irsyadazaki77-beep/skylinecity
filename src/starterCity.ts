import { generateWorld } from './mapGenerator';
import { RoadClass, TileData, TileType } from './types';

const HIGHWAY_Y = 30;
const STARTER_SEED = 2088;

type StarterPocket = {
  left: number;
  top: number;
  pumpX: number;
  pumpY: number;
};

function isBuildable(tile: TileData | undefined): tile is TileData {
  return Boolean(tile && !tile.water);
}

function touchesWater(grid: TileData[][], x: number, y: number): boolean {
  return [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => grid[y + dy]?.[x + dx]?.water);
}

/**
 * Finds a small, contiguous piece of land above the outside highway.
 * The old starter layout used fixed coordinates that land in the river on
 * the default seed, silently omitting the power plant and all starter zones.
 */
function findStarterPocket(grid: TileData[][]): StarterPocket | null {
  const candidates: Array<StarterPocket & { score: number }> = [];

  for (let top = 20; top <= 27; top += 1) {
    for (let left = 3; left <= 52; left += 1) {
      const pumpX = left - 1;
      const pumpY = top + 2;
      const cells: TileData[] = [];

      // The pocket contains the buildable block plus the pump tile and the
      // single-column road that connects it to the prebuilt highway.
      for (let y = top; y <= HIGHWAY_Y; y += 1) {
        for (let x = left - 1; x <= left + 6; x += 1) {
          const tile = grid[y]?.[x];
          if (tile) cells.push(tile);
        }
      }

      if (cells.length !== (HIGHWAY_Y - top + 1) * 8 || cells.some((tile) => !isBuildable(tile))) continue;
      if (!touchesWater(grid, pumpX, pumpY)) continue;

      const distanceFromCenter = Math.abs((left + 3) - 36) + Math.abs(top - 25);
      candidates.push({ left, top, pumpX, pumpY, score: distanceFromCenter });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0] ?? null;
}

function place(grid: TileData[][], x: number, y: number, type: TileType, roadClass?: RoadClass): boolean {
  const tile = grid[y]?.[x];
  if (!isBuildable(tile)) return false;
  grid[y][x] = {
    ...tile,
    type,
    ...(type === TileType.ROAD && roadClass ? { roadClass } : {}),
    level: 1,
    population: 0,
    jobs: 0,
    abandoned: false,
    upgradeProgress: 0,
  };
  return true;
}

export function createStarterGrid(): TileData[][] {
  const grid = generateWorld({
    seed: STARTER_SEED,
    preset: 'river_valley',
    roughness: 0.55,
    waterAmount: 0.42,
    treeDensity: 0.62,
  });

  const pocket = findStarterPocket(grid);

  // A deterministic fallback keeps the game playable even if the map
  // generator parameters change enough that no river-adjacent pocket exists.
  const left = pocket?.left ?? 34;
  const top = pocket?.top ?? 25;

  // Two local streets, plus a direct connection to the outside highway.
  for (let x = left; x <= left + 6; x += 1) {
    place(grid, x, top + 1, TileType.ROAD);
    place(grid, x, top + 3, TileType.ROAD);
  }
  for (let y = top + 1; y <= HIGHWAY_Y; y += 1) {
    // Leave one deliberate gap before the regional highway. This is the
    // player's first meaningful build: one cheap local-road tile completes a
    // real network connection instead of asking for decorative extra roads.
    if (y !== HIGHWAY_Y - 1) place(grid, left, y, TileType.ROAD);
  }

  // Re-assert the regional connection after the local connector is carved.
  // The two highway rows are public infrastructure with highway capacity.
  for (let x = 0; x < grid[0].length; x += 1) {
    for (const y of [HIGHWAY_Y, HIGHWAY_Y + 1]) {
      const tile = grid[y]?.[x];
      if (tile?.type === TileType.ROAD) tile.roadClass = 'HIGHWAY';
    }
  }

  // Core utilities are placed on land and adjacent to the local road.
  const pumpX = pocket?.pumpX ?? left - 1;
  const pumpY = pocket?.pumpY ?? top + 2;
  if (pocket) place(grid, pumpX, pumpY, TileType.WATER_PUMP);
  place(grid, left + 2, top + 2, TileType.POWER_PLANT);

  // Starter RCI blocks all front the same road, so they are immediately
  // eligible for utilities, migration, jobs, and citizen trips.
  place(grid, left + 1, top, TileType.RESIDENTIAL);
  place(grid, left + 3, top, TileType.RESIDENTIAL);
  place(grid, left + 4, top, TileType.COMMERCIAL);
  place(grid, left + 5, top, TileType.INDUSTRIAL);

  return grid;
}
