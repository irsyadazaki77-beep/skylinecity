import { TileData, TileType } from './types';

export interface BuildingFootprint {
  rootX: number;
  rootY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  mixedUse?: boolean;
}

/** Returns the yaw that points a building's designed front toward its road frontage. */
export function getBuildingFrontageRotation(tile: TileData, grid: TileData[][]): number {
  const neighbors = [
    { dx: 0, dy: 1, rotation: 0 },      // south / +Z is the model's default front
    { dx: 0, dy: -1, rotation: Math.PI },
    { dx: 1, dy: 0, rotation: -Math.PI / 2 },
    { dx: -1, dy: 0, rotation: Math.PI / 2 },
  ];
  const frontage = neighbors.find(({ dx, dy }) => grid[tile.y + dy]?.[tile.x + dx]?.type === TileType.ROAD);
  return frontage?.rotation ?? 0;
}

const FOOTPRINT_TYPES = new Set<TileType>([
  TileType.RESIDENTIAL,
  TileType.COMMERCIAL,
  TileType.INDUSTRIAL,
]);

/**
 * Derives render-time footprints from mature adjacent parcels. Simulation
 * values remain per tile, while the visual city can form coherent 2x2 blocks.
 */
export function deriveBuildingFootprints(
  grid: TileData[][],
  options: { allowMixedUse?: boolean; mixedUseTiles?: Set<string> } = {},
): Map<string, BuildingFootprint> {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const allowMixedUse = options.allowMixedUse ?? true;
  const mixedUseTiles = options.mixedUseTiles;
  const footprints = new Map<string, BuildingFootprint>();
  const claimed = new Set<string>();
  const sameRegion = (a: TileData, b: TileData): boolean => (
    Math.floor(a.x / 20) === Math.floor(b.x / 20) && Math.floor(a.y / 20) === Math.floor(b.y / 20)
  );

  const canJoin = (tile: TileData | undefined, anchor: TileData): boolean => Boolean(
    tile &&
    FOOTPRINT_TYPES.has(tile.type) &&
    tile.type === anchor.type &&
    ((!anchor.parcelId && !tile.parcelId) || (Boolean(anchor.parcelId) && tile.parcelId === anchor.parcelId)) &&
    tile.level >= 3 &&
    tile.level === anchor.level &&
    !tile.abandoned &&
    tile.powered &&
    tile.watered &&
    !tile.water &&
    tile.elevation === anchor.elevation,
  );

  const canJoinMixed = (tile: TileData | undefined, type: TileType, anchor: TileData): boolean => Boolean(
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

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const anchor = grid[y][x];
      const anchorKey = `${x},${y}`;
      if (!FOOTPRINT_TYPES.has(anchor.type) || anchor.level < 3 || anchor.abandoned || claimed.has(anchorKey)) continue;

      // A commercial frontage with residential parcels directly behind it is
      // rendered as one contemporary mixed-use block. Simulation remains
      // parcel-based: only the visual footprint is combined.
      const mixedUseAreaAllowed = !mixedUseTiles || [
        `${x},${y}`,
        `${x + 1},${y}`,
        `${x},${y + 1}`,
        `${x + 1},${y + 1}`,
      ].every((key) => mixedUseTiles.has(key));
      const canMakeMixedUse = allowMixedUse && mixedUseAreaAllowed && anchor.type === TileType.COMMERCIAL && x + 1 < width && y + 1 < height
        && canJoinMixed(grid[y][x + 1], TileType.COMMERCIAL, anchor)
        && canJoinMixed(grid[y + 1][x], TileType.RESIDENTIAL, anchor)
        && canJoinMixed(grid[y + 1][x + 1], TileType.RESIDENTIAL, anchor)
        && !claimed.has(`${x + 1},${y}`)
        && !claimed.has(`${x},${y + 1}`)
        && !claimed.has(`${x + 1},${y + 1}`);

      if (canMakeMixedUse) {
        const mixedFootprint: BuildingFootprint = {
          rootX: x,
          rootY: y,
          centerX: x + 0.5,
          centerY: y + 0.5,
          width: 2,
          height: 2,
          mixedUse: true,
        };
        for (let dy = 0; dy < mixedFootprint.height; dy += 1) {
          for (let dx = 0; dx < mixedFootprint.width; dx += 1) {
            const key = `${x + dx},${y + dy}`;
            claimed.add(key);
            footprints.set(key, mixedFootprint);
          }
        }
        continue;
      }

      const parcelWidth = anchor.parcelId ? Math.max(1, Math.min(2, anchor.parcelWidth ?? 1)) : 2;
      const parcelHeight = anchor.parcelId ? Math.max(1, Math.min(2, anchor.parcelHeight ?? 1)) : 2;
      const canMakeParcelFootprint = parcelWidth > 1 || parcelHeight > 1;
      const parcelCells = canMakeParcelFootprint
        ? Array.from({ length: parcelHeight }, (_, dy) => Array.from({ length: parcelWidth }, (_, dx) => ({ dx, dy }))).flat()
        : [];
      const canMakePersistentFootprint = canMakeParcelFootprint
        && parcelCells.every(({ dx, dy }) => {
          const candidate = grid[y + dy]?.[x + dx];
          return canJoin(candidate, anchor)
            && sameRegion(candidate!, anchor)
            && !claimed.has(`${x + dx},${y + dy}`);
        });

      const footprint: BuildingFootprint = canMakePersistentFootprint
        ? { rootX: x, rootY: y, centerX: x + (parcelWidth - 1) / 2, centerY: y + (parcelHeight - 1) / 2, width: parcelWidth, height: parcelHeight }
        : { rootX: x, rootY: y, centerX: x, centerY: y, width: 1, height: 1 };

      for (let dy = 0; dy < footprint.height; dy += 1) {
        for (let dx = 0; dx < footprint.width; dx += 1) {
          const key = `${x + dx},${y + dy}`;
          claimed.add(key);
          footprints.set(key, footprint);
        }
      }
    }
  }

  return footprints;
}
