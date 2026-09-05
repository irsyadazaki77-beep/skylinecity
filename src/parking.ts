import { TileData, TileType } from './types';

export interface ParkingMetrics {
  demand: number;
  supply: number;
  coverage: number;
  pressure: number;
}

export const PARKING_SPACES_PER_LOT = 24;

function parkingDemandFor(tile: TileData): number {
  if (tile.type === TileType.RESIDENTIAL) return Math.max(0, tile.population) * 0.16;
  if (tile.type === TileType.COMMERCIAL) return Math.max(0, tile.jobs) * 0.42;
  if (tile.type === TileType.INDUSTRIAL) return Math.max(0, tile.jobs) * 0.2;
  return 0;
}

export function hasNearbyParking(grid: TileData[][], x: number, y: number, radius = 2): boolean {
  for (const row of grid) {
    for (const tile of row) {
      if (tile.type === TileType.PARKING && Math.abs(tile.x - x) + Math.abs(tile.y - y) <= radius) return true;
    }
  }
  return false;
}

/**
 * Matches parking supply to nearby residential, commercial, and industrial
 * demand. Lots are intentionally finite resources so players must choose
 * between curb/parking space, parks, transit, and higher land efficiency.
 */
export function simulateParking(grid: TileData[][]): ParkingMetrics {
  const lots: TileData[] = [];
  const demandTiles: Array<{ tile: TileData; demand: number }> = [];
  let totalDemand = 0;

  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (tile.type === TileType.PARKING) {
        lots.push(tile);
      } else {
        const d = parkingDemandFor(tile);
        if (d > 0) {
          demandTiles.push({ tile, demand: d });
          totalDemand += d;
        }
      }
    }
  }

  const supply = lots.length * PARKING_SPACES_PER_LOT;
  const demand = totalDemand;
  const remaining = new Map(lots.map((lot) => [`${lot.x},${lot.y}`, PARKING_SPACES_PER_LOT]));
  let covered = 0;

  for (const { tile, demand: tileDemand } of demandTiles) {
    let remainingDemand = tileDemand;
    const candidates = lots
      .filter((lot) => Math.abs(lot.x - tile.x) + Math.abs(lot.y - tile.y) <= 3)
      .sort((a, b) => (
        Math.abs(a.x - tile.x) + Math.abs(a.y - tile.y)
        - (Math.abs(b.x - tile.x) + Math.abs(b.y - tile.y))
      ));
    for (const lot of candidates) {
      const key = `${lot.x},${lot.y}`;
      const available = remaining.get(key) ?? 0;
      const allocation = Math.min(available, remainingDemand);
      remaining.set(key, available - allocation);
      remainingDemand -= allocation;
      covered += allocation;
      if (remainingDemand <= 0) break;
    }
  }

  return {
    demand: Math.round(demand * 10) / 10,
    supply,
    coverage: demand > 0 ? Math.round(Math.min(100, covered / demand * 100)) : 100,
    pressure: demand > 0 ? Math.min(2, Math.round((demand / Math.max(1, supply)) * 100) / 100) : 0,
  };
}
