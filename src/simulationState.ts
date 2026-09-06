import { CityState, TileData } from './types';

function cloneTile(tile: TileData): TileData {
  return {
    ...tile,
    laneStates: tile.laneStates?.map((lane) => ({ ...lane })),
    prohibitedTurns: tile.prohibitedTurns ? [...tile.prohibitedTurns] : undefined,
    serviceUpgrades: tile.serviceUpgrades ? [...tile.serviceUpgrades] : undefined,
    serviceResponseTimes: tile.serviceResponseTimes ? { ...tile.serviceResponseTimes } : undefined,
  };
}

function cloneGrid(grid: TileData[][]): TileData[][] {
  return grid.map((row) => row.map(cloneTile));
}

function cloneStructured<T>(value: T | undefined): T | undefined {
  if (value === undefined) return undefined;
  try {
    return structuredClone(value);
  } catch {
    return clonePlainValue(value) as T;
  }
}

function clonePlainValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(clonePlainValue);
  if (value instanceof Map) return new Map([...value.entries()].map(([key, entry]) => [clonePlainValue(key), clonePlainValue(entry)]));
  if (value instanceof Set) return new Set([...value].map(clonePlainValue));
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) output[key] = clonePlainValue(entry);
  return output;
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
