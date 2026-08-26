import { MixedUseFloorProgram, TileData, TileType } from './types';

export interface MixedUseProgramProfile {
  label: string;
  retailFloors: number;
  officeFloors: number;
  residentialFloors: number;
  jobCapacityMultiplier: number;
  revenueMultiplier: number;
}

export const MIXED_USE_PROGRAMS: Record<MixedUseFloorProgram, MixedUseProgramProfile> = {
  RETAIL_LIVING: {
    label: 'Retail Living',
    retailFloors: 1,
    officeFloors: 0,
    residentialFloors: 3,
    jobCapacityMultiplier: 1.08,
    revenueMultiplier: 1.06,
  },
  CREATIVE_OFFICE: {
    label: 'Creative Office',
    retailFloors: 1,
    officeFloors: 2,
    residentialFloors: 2,
    jobCapacityMultiplier: 1.2,
    revenueMultiplier: 1.12,
  },
  HOSPITALITY: {
    label: 'Hospitality',
    retailFloors: 1,
    officeFloors: 1,
    residentialFloors: 2,
    jobCapacityMultiplier: 1.16,
    revenueMultiplier: 1.1,
  },
  COMMUNITY_HUB: {
    label: 'Community Hub',
    retailFloors: 1,
    officeFloors: 0,
    residentialFloors: 2,
    jobCapacityMultiplier: 1.05,
    revenueMultiplier: 1.04,
  },
};

export interface MixedUseMetrics {
  mixedUseBlocks: number;
  mixedUseFloorArea: number;
  mixedUseJobs: number;
}

function stableProgramIndex(tile: TileData): number {
  const seed = tile.parcelSeed ?? ((tile.x * 1103515245 + tile.y * 12345 + tile.level * 2654435761) | 0);
  return Math.abs(seed) % Object.keys(MIXED_USE_PROGRAMS).length;
}

function sameRegion(a: TileData, b: TileData): boolean {
  return Math.floor(a.x / 20) === Math.floor(b.x / 20) && Math.floor(a.y / 20) === Math.floor(b.y / 20);
}

function canJoinMixed(tile: TileData | undefined, type: TileType, anchor: TileData): boolean {
  return Boolean(
    tile &&
    tile.type === type &&
    tile.level >= 2 &&
    !tile.abandoned &&
    tile.powered &&
    tile.watered &&
    !tile.water &&
    tile.elevation === anchor.elevation &&
    sameRegion(tile, anchor),
  );
}

function clearProgram(tile: TileData): void {
  tile.mixedUseProgram = undefined;
  tile.mixedUseFloorCount = undefined;
  tile.mixedUseRetailFloors = undefined;
  tile.mixedUseOfficeFloors = undefined;
  tile.mixedUseResidentialFloors = undefined;
}

/**
 * Assigns a stable, data-driven floor program to every eligible mixed-use
 * block. The commercial frontage tile is the block anchor; the residential
 * back parcels keep their own population simulation while sharing the block's
 * program for diagnostics and future household economics.
 */
export function reconcileMixedUsePrograms(
  grid: TileData[][],
  options: { enabled?: boolean; mixedUseTiles?: Set<string> } = {},
): MixedUseMetrics {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const enabled = options.enabled ?? true;
  let mixedUseBlocks = 0;
  let mixedUseFloorArea = 0;
  let mixedUseJobs = 0;

  for (const row of grid) {
    for (const tile of row) clearProgram(tile);
  }

  const areaAllowed = (x: number, y: number) => !options.mixedUseTiles || [
    `${x},${y}`,
    `${x + 1},${y}`,
    `${x},${y + 1}`,
    `${x + 1},${y + 1}`,
  ].every((key) => options.mixedUseTiles!.has(key));

  if (!enabled) return { mixedUseBlocks, mixedUseFloorArea, mixedUseJobs };

  const programs = Object.keys(MIXED_USE_PROGRAMS) as MixedUseFloorProgram[];
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const anchor = grid[y][x];
      if (anchor.type !== TileType.COMMERCIAL || anchor.level < 2 || !areaAllowed(x, y)) continue;
      if (!canJoinMixed(grid[y][x + 1], TileType.COMMERCIAL, anchor)) continue;
      if (!canJoinMixed(grid[y + 1][x], TileType.RESIDENTIAL, anchor)) continue;
      if (!canJoinMixed(grid[y + 1][x + 1], TileType.RESIDENTIAL, anchor)) continue;

      const program = programs[stableProgramIndex(anchor)];
      const profile = MIXED_USE_PROGRAMS[program];
      const floorCount = Math.max(4, Math.min(10, anchor.level + 4));
      const residentialFloors = Math.max(1, floorCount - profile.retailFloors - profile.officeFloors);
      anchor.mixedUseProgram = program;
      anchor.mixedUseFloorCount = floorCount;
      anchor.mixedUseRetailFloors = profile.retailFloors;
      anchor.mixedUseOfficeFloors = profile.officeFloors;
      anchor.mixedUseResidentialFloors = residentialFloors;
      grid[y][x + 1].mixedUseProgram = program;
      grid[y + 1][x].mixedUseProgram = program;
      grid[y + 1][x + 1].mixedUseProgram = program;

      mixedUseBlocks += 1;
      mixedUseFloorArea += floorCount * 4;
      mixedUseJobs += Math.round((anchor.jobs + grid[y][x + 1].jobs) * profile.jobCapacityMultiplier);
    }
  }

  return { mixedUseBlocks, mixedUseFloorArea, mixedUseJobs };
}

export function mixedUseJobCapacityMultiplier(tile: TileData): number {
  const program = tile.mixedUseProgram;
  return program ? MIXED_USE_PROGRAMS[program].jobCapacityMultiplier : 1;
}

export function mixedUseRevenueMultiplier(tile: TileData): number {
  const program = tile.mixedUseProgram;
  return program ? MIXED_USE_PROGRAMS[program].revenueMultiplier : 1;
}
