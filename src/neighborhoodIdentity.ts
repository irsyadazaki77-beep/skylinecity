import { CityDistrict } from './districts';
import { CityState, TileData, TileType } from './types';

export type NeighborhoodIdentityType = 'FAMILY_QUARTER' | 'BUSINESS_CORE' | 'INDUSTRIAL_HUB' | 'WATERFRONT' | 'GREEN_DISTRICT' | 'TRANSIT_CORRIDOR' | 'RESILIENT_QUARTER';

export interface NeighborhoodIdentity {
  districtId: string;
  type: NeighborhoodIdentityType;
  confidence: number;
  evidence: Record<string, number>;
  reasons: string[];
  effects: { demand: number; landValue: number; happiness: number; traffic: number; serviceNeed: number };
  derivedDay: number;
}

export interface NeighborhoodIdentityState { identities: NeighborhoodIdentity[] }

const EFFECTS: Record<NeighborhoodIdentityType, NeighborhoodIdentity['effects']> = {
  FAMILY_QUARTER: { demand: 2, landValue: 2, happiness: 1.5, traffic: 0.5, serviceNeed: 1 },
  BUSINESS_CORE: { demand: 2, landValue: 3, happiness: 0, traffic: 2, serviceNeed: 1 },
  INDUSTRIAL_HUB: { demand: 3, landValue: -2, happiness: -1, traffic: 3, serviceNeed: 1 },
  WATERFRONT: { demand: 1, landValue: 4, happiness: 2, traffic: 1, serviceNeed: 0.5 },
  GREEN_DISTRICT: { demand: 1, landValue: 3, happiness: 2, traffic: -1, serviceNeed: 0.5 },
  TRANSIT_CORRIDOR: { demand: 2, landValue: 2, happiness: 1, traffic: -2, serviceNeed: 1 },
  RESILIENT_QUARTER: { demand: 1, landValue: 2, happiness: 1, traffic: 0, serviceNeed: 0.5 },
};

const LABELS: Record<NeighborhoodIdentityType, string> = {
  FAMILY_QUARTER: 'Family Quarter', BUSINESS_CORE: 'Business Core', INDUSTRIAL_HUB: 'Industrial Hub', WATERFRONT: 'Waterfront', GREEN_DISTRICT: 'Green District', TRANSIT_CORRIDOR: 'Transit Corridor', RESILIENT_QUARTER: 'Resilient Quarter',
};
export const IDENTITY_COLORS: Record<NeighborhoodIdentityType, string> = { FAMILY_QUARTER: '#fb7185', BUSINESS_CORE: '#818cf8', INDUSTRIAL_HUB: '#f59e0b', WATERFRONT: '#38bdf8', GREEN_DISTRICT: '#34d399', TRANSIT_CORRIDOR: '#22d3ee', RESILIENT_QUARTER: '#a78bfa' };

function mean(tiles: TileData[], select: (tile: TileData) => number): number {
  return tiles.length ? tiles.reduce((sum, tile) => sum + select(tile), 0) / tiles.length : 0;
}

export function deriveNeighborhoodIdentity(state: CityState, district: CityDistrict): NeighborhoodIdentity {
  const tiles = district.tiles.map(([x, y]) => state.grid[y]?.[x]).filter((tile): tile is TileData => Boolean(tile));
  const developed = tiles.filter((tile) => tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD && !tile.water);
  const count = (type: TileType) => developed.filter((tile) => tile.type === type).length;
  const share = (type: TileType) => count(type) / Math.max(1, developed.length);
  const residential = share(TileType.RESIDENTIAL);
  const commercial = share(TileType.COMMERCIAL) + share(TileType.OFFICE);
  const industrial = share(TileType.INDUSTRIAL);
  const transit = mean(tiles, (tile) => tile.transitCovered ? 1 : 0);
  const green = Math.max(0, 1 - mean(developed, (tile) => tile.pollution) / 100);
  const services = mean(developed, (tile) => [tile.healthCovered, tile.schoolCovered, tile.fireCovered, tile.policeCovered].filter(Boolean).length / 4);
  const resilience = mean(tiles, (tile) => tile.type === TileType.FLOOD_BARRIER ? 1 : Math.max(0, 1 - (tile.disasterImpact ?? 0) / 100));
  const waterfront = mean(tiles, (tile) => [[0,1],[1,0],[0,-1],[-1,0]].some(([dx,dy]) => state.grid[tile.y + dy]?.[tile.x + dx]?.water) ? 1 : 0);
  const density = mean(developed, (tile) => Math.min(1, (tile.level ?? 1) / 5));
  const scores: Record<NeighborhoodIdentityType, number> = {
    FAMILY_QUARTER: residential * 55 + services * 25 + green * 15,
    BUSINESS_CORE: commercial * 55 + density * 25 + transit * 20,
    INDUSTRIAL_HUB: industrial * 65 + Math.min(1, mean(developed, (tile) => tile.jobs) / 20) * 20,
    WATERFRONT: waterfront * 60 + green * 15 + commercial * 10,
    GREEN_DISTRICT: green * 40 + services * 15 + (district.policy === 'GREEN' ? 30 : 0),
    TRANSIT_CORRIDOR: transit * 60 + density * 15 + (district.policy === 'TRANSIT_ORIENTED' ? 25 : 0),
    RESILIENT_QUARTER: resilience * 35 + services * 15 + (district.policy === 'COMMUNITY_SERVICES' ? 20 : 0) + tiles.filter((tile) => tile.type === TileType.FLOOD_BARRIER).length * 8,
  };
  const ranked = (Object.entries(scores) as [NeighborhoodIdentityType, number][]).sort(([a, av], [b, bv]) => bv - av || a.localeCompare(b));
  const [type, score] = ranked[0];
  const reasons = Object.entries({ residential, commercial, industrial, transit, green, services, waterfront, resilience })
    .sort(([a, av], [b, bv]) => bv - av || a.localeCompare(b)).slice(0, 3)
    .map(([key, value]) => `${key} ${Math.round(value * 100)}%`);
  return { districtId: district.id, type, confidence: Math.min(100, Math.round(score)), evidence: Object.fromEntries(Object.entries(scores).map(([key, value]) => [key, Math.round(value)])), reasons: [`${LABELS[type]} muncul dari data kawasan`, ...reasons], effects: EFFECTS[type], derivedDay: state.day };
}

export function advanceNeighborhoodIdentities(state: CityState): NeighborhoodIdentityState {
  if ((state.milestoneLevel ?? 0) < 1) return { identities: [] };
  return { identities: (state.districts ?? []).map((district) => deriveNeighborhoodIdentity(state, district)) };
}

export function applyNeighborhoodIdentityEffects(state: CityState): void {
  const identities = state.neighborhoodIdentityState?.identities ?? [];
  state.residentialDemand = Math.min(100, state.residentialDemand + identities.filter((item) => item.type === 'FAMILY_QUARTER').reduce((sum, item) => sum + item.effects.demand, 0));
  state.commercialDemand = Math.min(100, state.commercialDemand + identities.filter((item) => item.type === 'BUSINESS_CORE' || item.type === 'WATERFRONT').reduce((sum, item) => sum + item.effects.demand, 0));
  state.industrialDemand = Math.min(100, state.industrialDemand + identities.filter((item) => item.type === 'INDUSTRIAL_HUB').reduce((sum, item) => sum + item.effects.demand, 0));
  state.happiness = Math.max(0, Math.min(100, state.happiness + identities.reduce((sum, item) => sum + item.effects.happiness, 0)));
}
