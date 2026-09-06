import { TileData, TileType, createTile } from './types';

// Deterministic LCG Seeded Random
function seededRandom(seed: number) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Seeded Bilinear Value Noise with Fractional Brownian Motion
class SeededNoise {
  private grid: number[] = [];
  constructor(seed: number) {
    const rnd = seededRandom(seed);
    for (let i = 0; i < 256; i++) {
      this.grid.push(rnd());
    }
  }

  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const r00 = this.grid[(X + Y) & 255];
    const r10 = this.grid[(X + 1 + Y) & 255];
    const r01 = this.grid[(X + Y + 1) & 255];
    const r11 = this.grid[(X + 1 + Y + 1) & 255];

    // Smoothstep interpolation
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const i1 = r00 + u * (r10 - r00);
    const i2 = r01 + u * (r11 - r01);
    return i1 + v * (i2 - i1);
  }

  fbm(x: number, y: number, octaves = 3): number {
    let value = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxVal = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxVal += amplitude;
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value / maxVal;
  }
}

export type MapPreset =
  | 'river_valley'
  | 'coastal_plains'
  | 'highland'
  | 'flatlands'
  | 'island_region'
  | 'floodplain'
  | 'industrial_basin';

export interface GeneratorParams {
  seed: number;
  preset: MapPreset;
  roughness: number;     // 0 to 1
  waterAmount: number;   // 0 to 1
  treeDensity: number;   // 0 to 1
}

export const REGION_SIZE = 20;
export const REGIONS_X = 3;
export const REGIONS_Y = 3;
export const WORLD_WIDTH = REGION_SIZE * REGIONS_X;  // 60
export const WORLD_HEIGHT = REGION_SIZE * REGIONS_Y; // 60

export function generateWorld(params: GeneratorParams): TileData[][] {
  const { seed, preset, roughness, waterAmount, treeDensity } = params;
  const n = new SeededNoise(seed);
  const rnd = seededRandom(seed + 42);

  const grid: TileData[][] = [];

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < WORLD_WIDTH; x++) {
      // 1. Calculate Base Elevation based on Preset
      let elevation = 0;
      let isWater = false;
      let resource: 'none' | 'fertile' | 'ore' | 'oil' | 'forest' = 'none';

      const nx = x / WORLD_WIDTH;
      const ny = y / WORLD_HEIGHT;

      if (preset === 'river_valley') {
        // Flat valley in center (x around 30) with mountains on left/right
        const distFromCenter = Math.abs(nx - 0.5);
        const mountainBase = Math.max(0, distFromCenter - 0.15) * 15;
        const noiseVal = n.fbm(x * 0.08, y * 0.08, 4) * roughness * 5;
        elevation = Math.round(mountainBase + noiseVal);

        // River curving down the center
        const riverCenter = 0.5 + Math.sin(y * 0.15) * 0.08 + n.noise(x * 0.05, y * 0.05) * 0.05;
        const riverWidth = 0.05 + waterAmount * 0.04;
        if (Math.abs(nx - riverCenter) < riverWidth) {
          isWater = true;
          elevation = 0;
        }
      } else if (preset === 'coastal_plains') {
        // Water on bottom half, plains rising into hills towards top
        const noiseVal = n.fbm(x * 0.06, y * 0.06, 3) * roughness * 4;
        elevation = Math.round(ny * 5 + noiseVal);

        const coastline = 0.7 + Math.sin(x * 0.1) * 0.05 + n.noise(x * 0.1, y * 0.1) * 0.05;
        if (ny > coastline - waterAmount * 0.15) {
          isWater = true;
          elevation = 0;
        }
      } else if (preset === 'highland') {
        // High base elevation with rough craters/lakes
        const baseNoise = n.fbm(x * 0.07, y * 0.07, 4) * roughness * 8;
        elevation = Math.round(2 + baseNoise);

        // Crater lake in center
        const distFromCenter = Math.sqrt(Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.5, 2));
        if (distFromCenter < 0.15 + waterAmount * 0.1) {
          isWater = true;
          elevation = 1;
        }
      } else if (preset === 'island_region') {
        // Tropical archipelago surrounded by ocean
        const distFromCenter = Math.sqrt(Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.5, 2));
        const islandNoise = n.fbm(x * 0.08, y * 0.08, 4) * 0.45;
        const isLand = (1 - distFromCenter * 1.5 + islandNoise) > (0.35 + waterAmount * 0.18);
        if (!isLand) {
          isWater = true;
          elevation = 0;
        } else {
          elevation = Math.max(1, Math.round(1 + (1 - distFromCenter) * 3 + islandNoise * 3));
        }
      } else if (preset === 'floodplain') {
        // Low flat delta with bifurcated river branches
        const noiseVal = n.fbm(x * 0.03, y * 0.03, 2) * roughness;
        elevation = Math.max(0, Math.min(1, Math.round(noiseVal)));
        const r1 = 0.35 + Math.sin(y * 0.12) * 0.08;
        const r2 = 0.68 + Math.cos(y * 0.14) * 0.09;
        const w = 0.035 + waterAmount * 0.03;
        if (Math.abs(nx - r1) < w || Math.abs(nx - r2) < w) {
          isWater = true;
          elevation = 0;
        }
      } else if (preset === 'industrial_basin') {
        // Flat interior basin encircled by mineral ridges
        const distFromCenter = Math.sqrt(Math.pow(nx - 0.5, 2) + Math.pow(ny - 0.5, 2));
        const rim = Math.max(0, distFromCenter - 0.22) * 12;
        const noiseVal = n.fbm(x * 0.07, y * 0.07, 3) * roughness * 5;
        elevation = Math.round(rim + noiseVal);
        if (distFromCenter < 0.08 + waterAmount * 0.05) {
          isWater = true;
          elevation = 0;
        }
      } else {
        // Flatlands - very smooth, minor water body
        const noiseVal = n.fbm(x * 0.04, y * 0.04, 2) * roughness * 2;
        elevation = Math.round(1 + noiseVal);

        // Small circular lake in corner
        const distFromCorner = Math.sqrt(Math.pow(nx - 0.15, 2) + Math.pow(ny - 0.15, 2));
        if (distFromCorner < 0.12 + waterAmount * 0.08) {
          isWater = true;
          elevation = 0;
        }
      }

      // Constrain elevation safely
      elevation = Math.max(0, Math.min(10, elevation));

      // 2. Generate Natural Resources
      const forestNoise = n.noise(x * 0.15, y * 0.15);
      const oilNoise = n.noise(x * 0.2 + 100, y * 0.2 + 100);
      const oreNoise = n.noise(x * 0.25 + 200, y * 0.25 + 200);

      if (isWater) {
        resource = 'none';
      } else if (elevation >= 5 && oreNoise > 0.65) {
        resource = 'ore';
      } else if (elevation <= 2 && oilNoise > 0.7) {
        resource = 'oil';
      } else if (forestNoise > 0.5 + (1 - treeDensity) * 0.3) {
        resource = 'forest';
      } else if (elevation === 1 || elevation === 2) {
        // Near water fertile land check
        let nearWater = false;
        if (preset === 'river_valley' && Math.abs(nx - 0.5) < 0.18) {
          nearWater = true;
        } else if (preset === 'coastal_plains' && ny > 0.5 && ny < 0.7) {
          nearWater = true;
        }
        if (nearWater || rnd() < 0.12) {
          resource = 'fertile';
        }
      }

      row.push(createTile(x, y, {
        elevation,
        resource,
        water: isWater,
        landValue: isWater ? 40 : 30 + elevation * 2,
      }));
    }
    grid.push(row);
  }

  // 3. Construct Outside Connection: Dual Highway running left-to-right at y=30
  const highwayY = 30;
  for (let x = 0; x < WORLD_WIDTH; x++) {
    // Carve elevation and water to make flat highway
    const t1 = grid[highwayY][x];
    t1.type = TileType.ROAD;
    t1.roadClass = 'HIGHWAY';
    t1.elevation = 1;
    t1.water = false;
    t1.powered = true;
    t1.watered = true;

    // Dual highway has double lanes
    if (highwayY + 1 < WORLD_HEIGHT) {
      const t2 = grid[highwayY + 1][x];
      t2.type = TileType.ROAD;
      t2.roadClass = 'HIGHWAY';
      t2.elevation = 1;
      t2.water = false;
      t2.powered = true;
      t2.watered = true;
    }
  }

  return grid;
}

export function getRegionCoord(x: number, y: number): { rx: number; ry: number } {
  return {
    rx: Math.floor(x / REGION_SIZE),
    ry: Math.floor(y / REGION_SIZE),
  };
}

export function getRegionKey(rx: number, ry: number): string {
  return `${rx},${ry}`;
}

export function isTileInUnlockedRegion(x: number, y: number, unlockedRegions: string[]): boolean {
  const { rx, ry } = getRegionCoord(x, y);
  return unlockedRegions.includes(getRegionKey(rx, ry));
}

export function getRegionUnlockCost(unlockedCount: number): number {
  return 2500 + unlockedCount * 1500;
}

export function canUnlockRegion(
  rx: number,
  ry: number,
  unlockedRegions: string[],
  currentMoney: number
): { canUnlock: boolean; cost: number; reason?: string } {
  const key = getRegionKey(rx, ry);
  const cost = getRegionUnlockCost(unlockedRegions.length);

  if (rx < 0 || rx >= REGIONS_X || ry < 0 || ry >= REGIONS_Y) {
    return { canUnlock: false, cost, reason: 'Out of regional bounds' };
  }

  if (unlockedRegions.includes(key)) {
    return { canUnlock: false, cost, reason: 'Region already unlocked' };
  }

  // Check adjacency (cardinal directions: North, South, East, West)
  const isAdjacent = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => {
    return unlockedRegions.includes(getRegionKey(rx + dx, ry + dy));
  });

  if (!isAdjacent) {
    return { canUnlock: false, cost, reason: 'Region must be adjacent to an existing unlocked district' };
  }

  if (currentMoney < cost) {
    return { canUnlock: false, cost, reason: `Insufficient municipal funds ($${cost} required)` };
  }

  return { canUnlock: true, cost };
}
