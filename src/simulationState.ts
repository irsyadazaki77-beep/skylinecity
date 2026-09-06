import { CityState, TileData } from './types';

function cloneTile(tile: TileData): TileData {
  return {
    ...tile,
    laneStates: tile.laneStates ? tile.laneStates.map((lane) => ({ ...lane })) : undefined,
    prohibitedTurns: tile.prohibitedTurns ? [...tile.prohibitedTurns] : undefined,
    serviceUpgrades: tile.serviceUpgrades ? [...tile.serviceUpgrades] : undefined,
    serviceResponseTimes: tile.serviceResponseTimes ? { ...tile.serviceResponseTimes } : undefined,
  };
}

function cloneGrid(grid: TileData[][]): TileData[][] {
  const height = grid.length;
  const nextGrid = new Array(height);
  for (let y = 0; y < height; y += 1) {
    const row = grid[y];
    const width = row.length;
    const nextRow = new Array(width);
    for (let x = 0; x < width; x += 1) {
      nextRow[x] = cloneTile(row[x]);
    }
    nextGrid[y] = nextRow;
  }
  return nextGrid;
}

function fastCloneValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const len = value.length;
    const res = new Array(len);
    for (let i = 0; i < len; i += 1) {
      res[i] = fastCloneValue(value[i]);
    }
    return res as unknown as T;
  }
  if (value instanceof Map) {
    const map = new Map();
    for (const [k, v] of value.entries()) {
      map.set(fastCloneValue(k), fastCloneValue(v));
    }
    return map as unknown as T;
  }
  if (value instanceof Set) {
    const set = new Set();
    for (const v of value.values()) {
      set.add(fastCloneValue(v));
    }
    return set as unknown as T;
  }
  const output: Record<string, unknown> = {};
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    output[key] = fastCloneValue((value as Record<string, unknown>)[key]);
  }
  return output as T;
}

function cloneStructured<T>(value: T | undefined): T | undefined {
  if (value === undefined) return undefined;
  return fastCloneValue(value);
}

/**
 * Creates the mutable working state for one tick. The authoritative input is
 * never handed to a mutating subsystem. Large immutable-ish collections are
 * reused; collections whose members can be touched by a subsystem are copied
 * at their mutation boundary.
 */
export function cloneCityStateForSimulation(input: CityState): CityState {
  return {
    ...input,
    grid: cloneGrid(input.grid),
    unlockedRegions: input.unlockedRegions ? [...input.unlockedRegions] : ['1,1'],
    unlockedUpgrades: [...input.unlockedUpgrades],
    activePolicies: [...input.activePolicies],
    eventsData: cloneStructured(input.eventsData),
    activeEvents: [...input.activeEvents],
    unlockedAchievements: [...input.unlockedAchievements],
    completedMissions: [...input.completedMissions],
    history: [...input.history],
    incidents: cloneStructured(input.incidents),
    serviceVehicles: cloneStructured(input.serviceVehicles),
    serviceMaintenanceOrders: cloneStructured(input.serviceMaintenanceOrders),
    serviceBayQueues: cloneStructured(input.serviceBayQueues),
    serviceDepotCondition: cloneStructured(input.serviceDepotCondition),
    disasters: cloneStructured(input.disasters),
    districts: cloneStructured(input.districts),
    commandQueue: cloneStructured(input.commandQueue),
    recentSimulationEvents: cloneStructured(input.recentSimulationEvents),
    tradeContracts: cloneStructured(input.tradeContracts),
    recoveryProjects: cloneStructured(input.recoveryProjects),
    causalDiagnostics: cloneStructured(input.causalDiagnostics),
    signalStates: cloneStructured(input.signalStates),
    transitLines: cloneStructured(input.transitLines),
    transitVehicles: cloneStructured(input.transitVehicles),
    activeTrips: cloneStructured(input.activeTrips),
    activeFreightTrips: cloneStructured(input.activeFreightTrips),
    warehouseInventory: cloneStructured(input.warehouseInventory),
    regions: cloneStructured(input.regions),
    citizenState: cloneStructured(input.citizenState),
    demographics: cloneStructured(input.demographics),
    citizenStoryState: cloneStructured(input.citizenStoryState),
    neighborhoodIdentityState: cloneStructured(input.neighborhoodIdentityState),
    disasterPreparationState: cloneStructured(input.disasterPreparationState),
    policyConsequences: cloneStructured(input.policyConsequences),
    cityHistoryState: cloneStructured(input.cityHistoryState),
    campaignEvaluation: cloneStructured(input.campaignEvaluation),
    campaignStyleGoal: cloneStructured(input.campaignStyleGoal),
    scenarioObjectiveValues: cloneStructured(input.scenarioObjectiveValues),
  };
}
