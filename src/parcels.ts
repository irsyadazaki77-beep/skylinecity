import { ParcelOwnership, ParcelStatus, TileData, TileType } from './types';

const PARCEL_TYPES = new Set<TileType>([
  TileType.RESIDENTIAL,
  TileType.COMMERCIAL,
  TileType.INDUSTRIAL,
]);

export interface ParcelReconciliationResult {
  parcelCount: number;
  developedParcelCount: number;
  privateParcelCount: number;
  averageParcelSize: number;
}

interface Coordinate {
  x: number;
  y: number;
}

interface ExistingParcelGroup {
  type: TileType;
  coordinates: Coordinate[];
}

function hashParcel(x: number, y: number, type: TileType): number {
  let hash = (x * 374761393 + y * 668265263) >>> 0;
  for (let index = 0; index < type.length; index += 1) {
    hash = Math.imul(hash ^ type.charCodeAt(index), 16777619) >>> 0;
  }
  return hash >>> 0;
}

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

function isParcelTile(tile: TileData | undefined): tile is TileData {
  return Boolean(tile && PARCEL_TYPES.has(tile.type) && !tile.water);
}

function regionCompatible(a: TileData, b: TileData): boolean {
  return Math.floor(a.x / 20) === Math.floor(b.x / 20)
    && Math.floor(a.y / 20) === Math.floor(b.y / 20);
}

function canFitShape(
  grid: TileData[][],
  anchor: TileData,
  width: number,
  height: number,
  used: Set<string>,
): Coordinate[] | null {
  const coordinates: Coordinate[] = [];
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      const x = anchor.x + dx;
      const y = anchor.y + dy;
      const tile = grid[y]?.[x];
      const key = keyOf(x, y);
      if (!isParcelTile(tile) || tile.type !== anchor.type || !regionCompatible(tile, anchor) || used.has(key)) return null;
      // Existing parcel IDs represent ownership boundaries. Never merge two
      // already-owned lots while reconciling a newly zoned neighbor.
      if (tile.parcelId && tile.parcelId !== anchor.parcelId) return null;
      coordinates.push({ x, y });
    }
  }
  return coordinates;
}

function statusFor(tile: TileData): ParcelStatus {
  if (tile.abandoned) return 'ABANDONED';
  if ((tile.population ?? 0) > 0 || (tile.jobs ?? 0) > 0 || tile.level > 1) return 'ACTIVE';
  if ((tile.upgradeProgress ?? 0) > 0) return 'DEVELOPING';
  return 'ZONED';
}

function isDeveloped(tile: TileData): boolean {
  return !tile.abandoned && ((tile.population ?? 0) > 0 || (tile.jobs ?? 0) > 0 || tile.level > 1);
}

/**
 * Keeps zoning as persistent, owned lots instead of anonymous independent
 * cells. Fresh zoning is deterministically subdivided into 2x2, 2x1, 1x2,
 * or 1x1 lots; existing parcel IDs are never merged or randomly reshuffled.
 */
export function reconcileParcels(grid: TileData[][]): ParcelReconciliationResult {
  const used = new Set<string>();
  const existingGroups = new Map<string, ExistingParcelGroup>();

  for (const row of grid) {
    for (const tile of row) {
      if (!isParcelTile(tile) || !tile.parcelId) continue;
      const group = existingGroups.get(tile.parcelId) ?? { type: tile.type, coordinates: [] };
      if (group.type === tile.type) group.coordinates.push({ x: tile.x, y: tile.y });
      existingGroups.set(tile.parcelId, group);
    }
  }

  const parcelIds = new Set<string>();
  const developedIds = new Set<string>();
  const privateIds = new Set<string>();
  const sizeById = new Map<string, number>();

  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < (grid[0]?.length ?? 0); x += 1) {
      const anchor = grid[y][x];
      const anchorKey = keyOf(x, y);
      if (!PARCEL_TYPES.has(anchor.type) || anchor.water) {
        delete anchor.parcelId;
        delete anchor.parcelSeed;
        delete anchor.parcelWidth;
        delete anchor.parcelHeight;
        delete anchor.parcelIndex;
        delete anchor.parcelOwnership;
        delete anchor.parcelStatus;
        continue;
      }
      if (used.has(anchorKey)) continue;

      const seed = anchor.parcelSeed ?? hashParcel(x, y, anchor.type);
      let coordinates: Coordinate[] | null = null;
      if (anchor.parcelId) {
        const existing = existingGroups.get(anchor.parcelId);
        coordinates = existing?.coordinates.filter(({ x: px, y: py }) => !used.has(keyOf(px, py))) ?? null;
      }

      if (!coordinates || coordinates.length === 0) {
        const shapes = seed % 7 < 3
          ? [[2, 2], [2, 1], [1, 2], [1, 1]]
          : seed % 2 === 0
            ? [[2, 1], [1, 2], [2, 2], [1, 1]]
            : [[1, 2], [2, 1], [2, 2], [1, 1]];
        for (const [width, height] of shapes) {
          coordinates = canFitShape(grid, anchor, width, height, used);
          if (coordinates) break;
        }
      }

      coordinates = coordinates ?? [{ x, y }];
      const width = Math.max(...coordinates.map(({ x: px }) => px)) - x + 1;
      const height = Math.max(...coordinates.map(({ y: py }) => py)) - y + 1;
      const parcelId = anchor.parcelId ?? `parcel-${anchor.type.toLowerCase()}-${x}-${y}-${seed.toString(36)}`;
      const developed = coordinates.some(({ x: px, y: py }) => isDeveloped(grid[py][px]));
      const owner: ParcelOwnership = coordinates.some(({ x: px, y: py }) => grid[py][px].parcelOwnership === 'PRIVATE') || developed
        ? 'PRIVATE'
        : 'CITY';

      coordinates.forEach(({ x: px, y: py }, index) => {
        const tile = grid[py][px];
        used.add(keyOf(px, py));
        tile.parcelId = parcelId;
        tile.parcelSeed = seed;
        tile.parcelWidth = width;
        tile.parcelHeight = height;
        tile.parcelIndex = index;
        tile.parcelOwnership = owner;
        tile.parcelStatus = statusFor(tile);
      });

      parcelIds.add(parcelId);
      sizeById.set(parcelId, coordinates.length);
      if (developed) developedIds.add(parcelId);
      if (owner === 'PRIVATE') privateIds.add(parcelId);
    }
  }

  const parcelCount = parcelIds.size;
  const totalSize = [...sizeById.values()].reduce((sum, size) => sum + size, 0);
  return {
    parcelCount,
    developedParcelCount: developedIds.size,
    privateParcelCount: privateIds.size,
    averageParcelSize: parcelCount > 0 ? Math.round(totalSize / parcelCount * 100) / 100 : 0,
  };
}

export function parcelCapacityMultiplier(tile: TileData): number {
  const area = Math.max(1, (tile.parcelWidth ?? 1) * (tile.parcelHeight ?? 1));
  return Math.round((1 + Math.min(0.35, (area - 1) * 0.12)) * 100) / 100;
}
