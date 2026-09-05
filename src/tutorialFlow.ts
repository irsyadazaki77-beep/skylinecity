import { CityState, TileData, TileType } from './types';

export type TutorialStepId =
  | 'road'
  | 'utilities'
  | 'zoning'
  | 'time'
  | 'problems'
  | 'specialization'
  | 'first_emergency'
  | 'first_economy'
  | 'first_transit'
  | 'region_expansion'
  | 'first_disaster';

export const ALL_TUTORIAL_STEPS: TutorialStepId[] = [
  'road',
  'utilities',
  'zoning',
  'time',
  'problems',
  'specialization',
  'first_emergency',
  'first_economy',
  'first_transit',
  'region_expansion',
  'first_disaster',
];

/** The onboarding card is deliberately finite and context-independent. */
export const BASIC_TUTORIAL_STEPS: TutorialStepId[] = ['road', 'utilities', 'zoning', 'time', 'problems'];
/** Contextual milestones belong to the separate advanced guidance layer. */
export const ADVANCED_TUTORIAL_STEPS: TutorialStepId[] = ['specialization', 'first_emergency', 'first_economy', 'first_transit', 'region_expansion', 'first_disaster'];

export interface TutorialBaseline { roads: number; residential: number; jobZones: number; }

const CARDINALS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

export function hasLocalHighwayConnection(grid: TileData[][]): boolean {
  const localRoad = grid.flat().find((tile) => tile.type === TileType.ROAD && tile.roadClass !== 'HIGHWAY');
  if (!localRoad) return false;
  const queue: Array<[number, number]> = [[localRoad.x, localRoad.y]];
  const visited = new Set([`${localRoad.x},${localRoad.y}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const [x, y] = queue[index];
    const tile = grid[y]?.[x];
    if (tile?.type === TileType.ROAD && tile.roadClass === 'HIGHWAY') return true;
    for (const [dx, dy] of CARDINALS) {
      const neighbor = grid[y + dy]?.[x + dx];
      const key = `${x + dx},${y + dy}`;
      if (neighbor?.type !== TileType.ROAD || visited.has(key)) continue;
      visited.add(key);
      queue.push([x + dx, y + dy]);
    }
  }
  return false;
}

export function touchesRoad(grid: TileData[][], tile: TileData): boolean {
  return CARDINALS.some(([dx, dy]) => {
    const neighbor = grid[tile.y + dy]?.[tile.x + dx];
    return neighbor?.type === TileType.ROAD;
  });
}

export function touchesWater(grid: TileData[][], x: number, y: number): boolean {
  return CARDINALS.some(([dx, dy]) => {
    const neighbor = grid[y + dy]?.[x + dx];
    return Boolean(neighbor?.water);
  });
}

export function hasStarterUtilityNetwork(grid: TileData[][]): boolean {
  const touches = (tile: TileData, predicate: (neighbor: TileData) => boolean) => CARDINALS.some(([dx, dy]) => {
    const neighbor = grid[tile.y + dy]?.[tile.x + dx];
    return Boolean(neighbor && predicate(neighbor));
  });
  const plants = grid.flat().filter((tile) => tile.type === TileType.POWER_PLANT);
  const pumps = grid.flat().filter((tile) => tile.type === TileType.WATER_PUMP);
  return plants.some((tile) => touches(tile, (neighbor) => neighbor.type === TileType.ROAD))
    && pumps.some((tile) => touches(tile, (neighbor) => neighbor.type === TileType.ROAD)
      && touches(tile, (neighbor) => neighbor.water));
}

export function hasActivePower(state: CityState): boolean {
  if (state.powerCapacity > 0) return true;
  return state.grid.flat().some(
    (tile) => tile.type === TileType.POWER_PLANT && (tile.powered || touchesRoad(state.grid, tile))
  );
}

export function hasActiveWater(state: CityState): boolean {
  if (state.waterCapacity > 0) return true;
  return state.grid.flat().some(
    (tile) => tile.type === TileType.WATER_PUMP && (tile.watered || (touchesRoad(state.grid, tile) && touchesWater(state.grid, tile.x, tile.y)))
  );
}

export function hasActiveStarterUtilities(state: CityState): boolean {
  return (hasActivePower(state) && hasActiveWater(state)) || hasStarterUtilityNetwork(state.grid);
}

export function createTutorialBaseline(grid: TileData[][]): TutorialBaseline {
  const tiles = grid.flat();
  return {
    roads: tiles.filter((tile) => tile.type === TileType.ROAD).length,
    residential: tiles.filter((tile) => tile.type === TileType.RESIDENTIAL).length,
    jobZones: tiles.filter((tile) => [TileType.COMMERCIAL, TileType.INDUSTRIAL, TileType.OFFICE].includes(tile.type)).length,
  };
}

/** Pure progression rules keep onboarding testable and independent from storage/UI. */
export function isTutorialStepComplete(step: TutorialStepId, state: CityState, speed: number = 0, baseline: TutorialBaseline = { roads: 0, residential: 0, jobZones: 0 }): boolean {
  const tiles = state.grid.flat();
  if (step === 'road') return hasLocalHighwayConnection(state.grid);
  if (step === 'utilities') return hasActiveStarterUtilities(state);
  if (step === 'zoning') return state.population >= 25 || (tiles.filter((tile) => tile.type === TileType.RESIDENTIAL).length >= baseline.residential + 2 && tiles.filter((tile) => [TileType.COMMERCIAL, TileType.INDUSTRIAL, TileType.OFFICE].includes(tile.type)).length >= baseline.jobZones + 1);
  if (step === 'time') return speed > 0 || state.day > 1 || state.population >= 25;
  if (step === 'problems') return (state.recentSimulationEvents ?? []).some((event) => event.type === 'DIAGNOSTIC_RESOLVED') || state.day >= 10 || state.population >= 25;
  if (step === 'specialization') return state.activePolicies.includes('mixed_use') || state.activePolicies.includes('small_biz');
  if (step === 'first_emergency') {
    return tiles.some((tile) => tile.type === TileType.CLINIC || tile.type === TileType.FIRE_STATION || tile.type === TileType.POLICE_STATION);
  }
  if (step === 'first_economy') {
    return (state.operatingBudget ?? state.income - state.expenses) >= 0 && state.money >= 5000;
  }
  if (step === 'first_transit') {
    return (state.transitActiveLines ?? 0) > 0 || (state.transitRidership ?? 0) > 0 || tiles.some((tile) => tile.type === TileType.BUS_DEPOT || tile.type === TileType.TRAM_STATION);
  }
  if (step === 'region_expansion') {
    return (state.unlockedRegions?.length ?? 1) > 1;
  }
  if (step === 'first_disaster') {
    return (state.disastersResolved ?? 0) > 0 || (state.incidentsResolved ?? 0) > 0 || (state.floodBarrierCount ?? 0) > 0;
  }
  return false;
}
