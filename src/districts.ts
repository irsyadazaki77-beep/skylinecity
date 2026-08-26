import { TileData, TileType } from './types';

export type DistrictPolicy = 'GREEN' | 'TRANSIT_ORIENTED' | 'MIXED_USE' | 'INDUSTRIAL_LOGISTICS' | 'COMMUNITY_SERVICES';

export interface CityDistrict {
  id: string;
  name: string;
  policy: DistrictPolicy;
  color: string;
  center: [number, number];
  radius: number;
  createdDay: number;
  tiles: [number, number][];
}

export interface DistrictPolicyDefinition {
  id: DistrictPolicy;
  name: string;
  description: string;
  color: string;
}

export const DISTRICT_POLICIES: DistrictPolicyDefinition[] = [
  { id: 'GREEN', name: 'Green Quarter', description: 'Reduces pollution and noise while increasing land value around planted streets.', color: '#34d399' },
  { id: 'TRANSIT_ORIENTED', name: 'Transit-Oriented', description: 'Raises development suitability and nudges residents toward public transit.', color: '#22d3ee' },
  { id: 'MIXED_USE', name: 'Mixed-Use Core', description: 'Unlocks spatial mixed-use blocks and adds commercial demand inside the district.', color: '#a78bfa' },
  { id: 'INDUSTRIAL_LOGISTICS', name: 'Logistics Hub', description: 'Improves industrial demand and freight access for production parcels.', color: '#f59e0b' },
  { id: 'COMMUNITY_SERVICES', name: 'Community Services', description: 'Improves local service reach and residential desirability.', color: '#60a5fa' },
];

export function districtPolicyDefinition(policy: DistrictPolicy): DistrictPolicyDefinition {
  return DISTRICT_POLICIES.find((candidate) => candidate.id === policy) ?? DISTRICT_POLICIES[0];
}

export function districtContains(district: CityDistrict, x: number, y: number): boolean {
  return district.tiles.some(([tx, ty]) => tx === x && ty === y);
}

export function getDistrictAt(districts: CityDistrict[], x: number, y: number): CityDistrict | undefined {
  return districts.find((district) => districtContains(district, x, y));
}

export function createDistrict(
  grid: TileData[][],
  center: [number, number],
  options: { id: string; name: string; policy: DistrictPolicy; color?: string; radius?: number; createdDay: number },
): CityDistrict {
  const radius = Math.max(2, Math.min(8, Math.round(options.radius ?? 4)));
  const definition = districtPolicyDefinition(options.policy);
  const tiles: [number, number][] = [];
  for (let y = Math.max(0, center[1] - radius); y <= Math.min(grid.length - 1, center[1] + radius); y += 1) {
    for (let x = Math.max(0, center[0] - radius); x <= Math.min((grid[0]?.length ?? 1) - 1, center[0] + radius); x += 1) {
      if (Math.abs(x - center[0]) + Math.abs(y - center[1]) > radius) continue;
      if (grid[y][x].water) continue;
      tiles.push([x, y]);
    }
  }
  return {
    id: options.id,
    name: options.name.trim() || `${definition.name} ${options.id.replace(/\D/g, '') || '1'}`,
    policy: options.policy,
    color: options.color ?? definition.color,
    center,
    radius,
    createdDay: options.createdDay,
    tiles,
  };
}

export function getDistrictTileSet(districts: CityDistrict[], policy?: DistrictPolicy): Set<string> {
  return new Set(
    districts
      .filter((district) => !policy || district.policy === policy)
      .flatMap((district) => district.tiles.map(([x, y]) => `${x},${y}`)),
  );
}

export interface DistrictEffects {
  commercialDemandBonus: number;
  industrialDemandBonus: number;
  residentialDemandBonus: number;
  transitModeBoost: number;
  serviceCoverageBoost: number;
  greenDistrictCount: number;
}

/** Applies local policy effects to the tile environment before demand/services run. */
export function applyDistrictEffects(grid: TileData[][], districts: CityDistrict[]): DistrictEffects {
  const effects: DistrictEffects = {
    commercialDemandBonus: 0,
    industrialDemandBonus: 0,
    residentialDemandBonus: 0,
    transitModeBoost: 0,
    serviceCoverageBoost: 0,
    greenDistrictCount: 0,
  };
  const seen = new Set<string>();

  for (const district of districts) {
    if (district.policy === 'GREEN') effects.greenDistrictCount += 1;
    for (const [x, y] of district.tiles) {
      const tile = grid[y]?.[x];
      if (!tile || tile.type === TileType.ROAD || tile.type === TileType.EMPTY) continue;
      const key = `${x},${y}`;
      if (seen.has(`${district.id}:${key}`)) continue;
      seen.add(`${district.id}:${key}`);

      if (district.policy === 'GREEN') {
        tile.pollution = Math.max(0, Math.round(tile.pollution * 0.78 * 10) / 10);
        tile.noise = Math.max(0, Math.round(tile.noise * 0.86 * 10) / 10);
        tile.landValue = Math.min(100, tile.landValue + 4);
        effects.residentialDemandBonus += tile.type === TileType.RESIDENTIAL ? 0.04 : 0;
      } else if (district.policy === 'TRANSIT_ORIENTED') {
        tile.landValue = Math.min(100, tile.landValue + 3);
        tile.suitability = Math.min(100, (tile.suitability ?? 50) + 5);
        effects.transitModeBoost += 0.0025;
      } else if (district.policy === 'MIXED_USE') {
        tile.suitability = Math.min(100, (tile.suitability ?? 50) + 3);
        effects.commercialDemandBonus += tile.type === TileType.COMMERCIAL ? 0.12 : 0.04;
      } else if (district.policy === 'INDUSTRIAL_LOGISTICS') {
        effects.industrialDemandBonus += tile.type === TileType.INDUSTRIAL ? 0.12 : 0.03;
      } else if (district.policy === 'COMMUNITY_SERVICES') {
        tile.landValue = Math.min(100, tile.landValue + 2);
        tile.health = Math.min(100, tile.health + 4);
        effects.serviceCoverageBoost += 0.6;
        effects.residentialDemandBonus += tile.type === TileType.RESIDENTIAL ? 0.05 : 0;
      }
    }
  }

  effects.commercialDemandBonus = Math.min(12, Math.round(effects.commercialDemandBonus * 100) / 100);
  effects.industrialDemandBonus = Math.min(12, Math.round(effects.industrialDemandBonus * 100) / 100);
  effects.residentialDemandBonus = Math.min(12, Math.round(effects.residentialDemandBonus * 100) / 100);
  effects.transitModeBoost = Math.min(0.2, effects.transitModeBoost);
  effects.serviceCoverageBoost = Math.min(8, effects.serviceCoverageBoost);
  return effects;
}
