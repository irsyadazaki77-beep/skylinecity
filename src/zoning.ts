import { TileData, TileType, ZoneDensity } from './types';

export const RESIDENTIAL_DENSITY_CAPACITY_MULTIPLIER: Record<ZoneDensity, number> = {
  LOW: 1,
  MEDIUM: 1.65,
  HIGH: 2.7,
};

export const RESIDENTIAL_DENSITY_RENT_MULTIPLIER: Record<ZoneDensity, number> = {
  LOW: 1,
  MEDIUM: 0.78,
  HIGH: 0.62,
};

export const OFFICE_CAPACITIES = [0, 5, 14, 30, 58, 110];

export function isJobBuilding(tile: Pick<TileData, 'type'>): boolean {
  return tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE || tile.type === TileType.INDUSTRIAL;
}

export function getZoneDensity(tile: Pick<TileData, 'type' | 'zoneDensity'>): ZoneDensity {
  if (tile.zoneDensity) return tile.zoneDensity;
  return tile.type === TileType.RESIDENTIAL ? 'LOW' : 'MEDIUM';
}

export function getResidentialCapacity(tile: Pick<TileData, 'level' | 'zoneDensity'>, baseCapacity: number): number {
  return Math.round(baseCapacity * RESIDENTIAL_DENSITY_CAPACITY_MULTIPLIER[getZoneDensity({ ...tile, type: TileType.RESIDENTIAL })]);
}

export function getOfficeCapacity(level: number): number {
  return OFFICE_CAPACITIES[Math.min(5, Math.max(1, level))] ?? OFFICE_CAPACITIES[1];
}

export function getZoneRentMultiplier(tile: Pick<TileData, 'type' | 'zoneDensity'>): number {
  return tile.type === TileType.RESIDENTIAL
    ? RESIDENTIAL_DENSITY_RENT_MULTIPLIER[getZoneDensity(tile)]
    : 1;
}

export function getDensityLabel(density: ZoneDensity): string {
  return density === 'LOW' ? 'Low Density' : density === 'MEDIUM' ? 'Medium Density' : 'High Density';
}
