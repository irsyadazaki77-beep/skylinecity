import { GAME_CONFIG } from './config';
import { simulateCityDepthAndEnvironment, simulateBuildingEvolution, RESIDENTIAL_CAPACITIES, COMMERCIAL_CAPACITIES, INDUSTRIAL_CAPACITIES } from './depthSimulation';
import { simulateCityServices, simulateUtilityNetworks } from './services';
import { advanceIntersectionSignalStates, applySignalStatesToRoadGraph, buildRoadGraph } from './traffic';
import { simulateTransitNetwork } from './transit';
import { simulateLogistics } from './logistics';
import { simulateIncidents } from './incidents';
import { simulateDisasters } from './disasters';
import { simulateHydrology } from './hydrology';
import { getMilestoneLevel, ACHIEVEMENTS } from './progression';
import { BUILD_COSTS, CityEventData, CityState, createTile, GameSettings, getRoadClass, ROAD_MAINTENANCE_COSTS, TileData, TileType } from './types';
import { reconcileParcels, refreshParcelStatuses } from './parcels';
import { 
  createInitialCitizenSimulationState, 
  serializeCitizenSimulation, 
  hydrateCitizenSimulation, 
  simulateCitizenTick,
  SeededRandom 
} from './citizenSimulation';
import { canUnlockRegion } from './mapGenerator';
import { simulateParking } from './parking';
import { applyDistrictEffects, getDistrictTileSet } from './districts';
import { simulateServiceFleet } from './serviceFleet';
import { mixedUseJobCapacityMultiplier, mixedUseRevenueMultiplier, reconcileMixedUsePrograms } from './mixedUse';
import { applySimulationCommands } from './simulationCommands';
import { calculateCausalDiagnostics } from './causalDiagnostics';
import { advanceBackgroundRegions, calculateRegionTelemetry } from './regionSimulation';
import { simulateRecoveryProjects } from './recoveryProjects';
import { simulateTradeContracts } from './tradeContracts';
import { SCENARIO_DEFINITIONS } from './contentRegistry';
import { evaluateScenario } from './scenarioSystem';
import { deriveCitySpecialization } from './governance';
import { getOfficeCapacity, getResidentialCapacity } from './zoning';
import { calculateTileRent } from './citizenSimulation/satisfaction';
import { simulateClimate } from './climate';
import { serviceUpgradeStats } from './serviceUpgrades';
import { createStarterGrid } from './starterCity';
import {
  createSimulationTickContext,
  finalizeSimulationRenderRevisions,
  markTilesChanged,
  refreshTileAggregates,
  SimulationTickContext,
} from './simulationContext';
import { cloneCityStateForSimulation } from './simulationState';

export function createEmptyGrid(width = 60, height = 60): TileData[][] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => createTile(x, y)),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

let lastSimulationPhaseTimings: Record<string, number> = {};
let lastSimulationRenderRevisions = finalizeSimulationRenderRevisions(createSimulationTickContext([]));

function profilerNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Returns the most recent tick profile without contaminating deterministic city state. */
export function getLastSimulationPhaseTimings(): Record<string, number> {
  return { ...lastSimulationPhaseTimings };
}

/** Render metadata is transient and intentionally not part of CityState. */
export function getLastSimulationRenderRevisions() {
  return { ...lastSimulationRenderRevisions, dirtyChunkKeys: [...lastSimulationRenderRevisions.dirtyChunkKeys] };
}

function hasRoadAccess(tile: TileData, grid: TileData[][]): boolean {
  const { x, y } = tile;
  return [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => {
    const neighbor = grid[y + dy]?.[x + dx];
    return neighbor?.type === TileType.ROAD;
  });
}

export function allocateUtilities(
  grid: TileData[][], 
  unlockedUpgrades: string[] = [],
  powerDemandMultiplier = 1.0,
  waterDemandMultiplier = 1.0,
) {
  return simulateUtilityNetworks(grid, unlockedUpgrades, powerDemandMultiplier, waterDemandMultiplier);
}

export function calculateDemandsAndDesirability(
  grid: TileData[][],
  state: CityState,
  powerCapacity: number,
  powerDemand: number,
  waterCapacity: number,
  waterDemand: number,
  context?: SimulationTickContext,
) {
  const aggregates = context?.tileAggregates ?? createSimulationTickContext(grid).tileAggregates;
  const buildingsCount = aggregates.buildingCount;
  const reliableCount = aggregates.reliableBuildingCount;
  const officeJobs = aggregates.officeJobs;
  const utilityReliability = buildingsCount ? reliableCount / buildingsCount : 1;
  const serviceScore = (
    state.healthcareCoverage + state.educationCoverage + state.fireSafety + (100 - state.crimeRate) + state.wasteCoverage
  ) / 5;
  const utilityPenalty = (powerDemand > powerCapacity ? 24 : 0) + (waterDemand > waterCapacity ? 24 : 0);
  const taxFriction = (tax: number) => tax > GAME_CONFIG.TAX_OPTIMAL
    ? (tax - GAME_CONFIG.TAX_OPTIMAL) * GAME_CONFIG.TAX_Friction_MULT
    : (GAME_CONFIG.TAX_OPTIMAL - tax) * 2;
  const desirability = Math.round(clamp(
    50 + (state.happiness - 50) * 0.35 + (serviceScore - 50) * 0.25 + (utilityReliability - 0.5) * 30 - state.pollutionAverage * 0.35 - state.noiseAverage * 0.15 - utilityPenalty * 0.25 - Math.max(0, (state.parkingPressure ?? 0) - 1) * 8,
    0,
    100,
  ));

  const residentialDemand = Math.round(clamp(
    (desirability - 50) * 1.6 + Math.max(0, state.availableJobs - state.workers) * 0.4 - taxFriction(state.residentialTaxRate),
    GAME_CONFIG.DEMAND_MIN,
    GAME_CONFIG.DEMAND_MAX,
  ));
  const commercialDemand = Math.round(clamp(
    (desirability - 48) * 1.35 + Math.max(0, state.workers - state.availableJobs) * 0.25 - taxFriction(state.commercialTaxRate),
    GAME_CONFIG.DEMAND_MIN,
    GAME_CONFIG.DEMAND_MAX,
  ));
  const industrialDemand = Math.round(clamp(
    (desirability - 45) * 1.2 + (state.population > 0 ? 8 : 0) - taxFriction(state.industrialTaxRate) + (state.unlockedUpgrades.includes('highway_conn') ? 10 : 0),
    GAME_CONFIG.DEMAND_MIN,
    GAME_CONFIG.DEMAND_MAX,
  ));
  const universityWorkforce = state.demographics?.educationDistribution?.university ?? Math.round(state.workers * 0.2);
  const officeDemand = Math.round(clamp(
    (desirability - 42) * 1.15 + Math.max(0, universityWorkforce - (officeJobs * 0.7)) * 0.25 - taxFriction(state.commercialTaxRate),
    GAME_CONFIG.DEMAND_MIN,
    GAME_CONFIG.DEMAND_MAX,
  ));

  return { desirability, residentialDemand, commercialDemand, officeDemand, industrialDemand };
}

export function simulatePopulation(
  grid: TileData[][],
  residentialDemand: number,
  commercialDemand: number,
  industrialDemand = 0,
  unlockedUpgrades: string[] = []
) {
  const resCapacityMultiplier = unlockedUpgrades.includes('high_dens_res') ? 2 : 1;
  const comCapacityMultiplier = unlockedUpgrades.includes('high_dens_com') ? 2 : 1;
  const indCapacityMultiplier = unlockedUpgrades.includes('high_dens_ind') ? 2 : 1;
  let totalPop = 0;
  let totalJobs = 0;

  for (const row of grid) {
    for (const tile of row) {
      if (tile.type === TileType.RESIDENTIAL) {
        const capacity = getResidentialCapacity(tile, RESIDENTIAL_CAPACITIES[Math.min(5, Math.max(1, tile.level))] * resCapacityMultiplier);
        if (!tile.powered || !tile.watered || !hasRoadAccess(tile, grid) || (tile.disasterImpact ?? 0) >= 75) {
          tile.population = 0;
          tile.abandoned = true;
          continue;
        }
        const suitabilityFactor = Math.max(0.45, Math.min(1.2, 0.45 + (tile.suitability ?? 50) / 100 * 0.75));
        const growth = residentialDemand > 0 && (tile.suitability ?? 50) >= 20
          ? Math.max(1, Math.ceil(residentialDemand / 30 * suitabilityFactor))
          : residentialDemand < -20 ? -1 : 0;
        tile.population = clamp((tile.population || 0) + growth, 0, capacity);
        if (tile.population > 0) tile.abandoned = false;
        totalPop += tile.population;
      } else if (tile.type === TileType.COMMERCIAL) {
        const capacity = COMMERCIAL_CAPACITIES[Math.min(5, Math.max(1, tile.level))] * comCapacityMultiplier;
        if (!tile.powered || !tile.watered || !hasRoadAccess(tile, grid) || (tile.disasterImpact ?? 0) >= 75) {
          tile.jobs = 0;
          tile.abandoned = true;
          continue;
        }
        const suitabilityFactor = Math.max(0.45, Math.min(1.2, 0.45 + (tile.suitability ?? 50) / 100 * 0.75));
        const growth = commercialDemand > 0 && (tile.suitability ?? 50) >= 20
          ? Math.max(1, Math.ceil(commercialDemand / 35 * suitabilityFactor))
          : commercialDemand < -20 ? -1 : 0;
        tile.jobs = clamp((tile.jobs || 0) + growth, 0, capacity);
        if (tile.jobs > 0) tile.abandoned = false;
        totalJobs += tile.jobs;
      } else if (tile.type === TileType.OFFICE) {
        const capacity = getOfficeCapacity(Math.min(5, Math.max(1, tile.level)));
        if (!tile.powered || !tile.watered || !hasRoadAccess(tile, grid) || (tile.disasterImpact ?? 0) >= 75) {
          tile.jobs = 0;
          tile.abandoned = true;
          continue;
        }
        const suitabilityFactor = Math.max(0.45, Math.min(1.2, 0.45 + (tile.suitability ?? 50) / 100 * 0.75));
        const growth = commercialDemand > 0 && (tile.suitability ?? 50) >= 20 ? Math.max(1, Math.ceil(commercialDemand / 35 * suitabilityFactor)) : commercialDemand < -20 ? -1 : 0;
        tile.jobs = clamp((tile.jobs || 0) + growth, 0, capacity);
        if (tile.jobs > 0) tile.abandoned = false;
        totalJobs += tile.jobs;
      } else if (tile.type === TileType.INDUSTRIAL) {
        const capacity = INDUSTRIAL_CAPACITIES[Math.min(5, Math.max(1, tile.level))] * indCapacityMultiplier;
        if (!tile.powered || !tile.watered || !hasRoadAccess(tile, grid) || (tile.disasterImpact ?? 0) >= 75) {
          tile.jobs = 0;
          tile.abandoned = true;
          continue;
        }
        const suitabilityFactor = Math.max(0.45, Math.min(1.2, 0.45 + (tile.suitability ?? 50) / 100 * 0.75));
        const growth = industrialDemand > 0 && (tile.suitability ?? 50) >= 20
          ? Math.max(1, Math.ceil(industrialDemand / 35 * suitabilityFactor))
          : industrialDemand < -20 ? -1 : 0;
        tile.jobs = clamp((tile.jobs || 0) + growth, 0, capacity);
        if (tile.jobs > 0) tile.abandoned = false;
        totalJobs += tile.jobs;
      }
    }
  }

  const workers = Math.floor(totalPop * GAME_CONFIG.WORKING_AGE_RATIO);
  return {
    totalPop,
    totalWorkers: workers,
    totalJobs,
    availableJobs: totalJobs,
    households: Math.ceil(totalPop / 2.2),
  };
}

/**
 * Fills commercial and industrial job slots independently from household
 * migration. The citizen simulation owns people and households, while the
 * city simulation owns building capacity; keeping these responsibilities
 * separate prevents a healthy demand signal from producing a city with no
 * taxable jobs.
 */
function simulateJobGrowth(
  grid: TileData[][],
  commercialDemand: number,
  officeDemand: number,
  industrialDemand: number,
  unlockedUpgrades: string[] = [],
): void {
  const commercialCapacityMultiplier = unlockedUpgrades.includes('high_dens_com') ? 2 : 1;
  const industrialCapacityMultiplier = unlockedUpgrades.includes('high_dens_ind') ? 2 : 1;

  for (const row of grid) {
    for (const tile of row) {
      if (tile.type !== TileType.COMMERCIAL && tile.type !== TileType.OFFICE && tile.type !== TileType.INDUSTRIAL) continue;

      const hasRoad = hasRoadAccess(tile, grid);
      const active = tile.powered && tile.watered && hasRoad && (tile.disasterImpact ?? 0) < 75;
      if (!active) {
        tile.jobs = Math.max(0, (tile.jobs || 0) - 2);
        if (tile.jobs === 0) tile.abandoned = true;
        continue;
      }

      if (tile.abandoned) {
        const demand = tile.type === TileType.COMMERCIAL ? commercialDemand : tile.type === TileType.OFFICE ? officeDemand : industrialDemand;
        if (demand > 10) {
          tile.abandoned = false;
          tile.upgradeProgress = 0;
        } else {
          continue;
        }
      }

      const level = Math.min(5, Math.max(1, tile.level));
      const capacity = (tile.type === TileType.COMMERCIAL
        ? COMMERCIAL_CAPACITIES[level] * commercialCapacityMultiplier * mixedUseJobCapacityMultiplier(tile)
        : tile.type === TileType.OFFICE
          ? getOfficeCapacity(level)
          : INDUSTRIAL_CAPACITIES[level] * industrialCapacityMultiplier);
      const demand = tile.type === TileType.COMMERCIAL ? commercialDemand : tile.type === TileType.OFFICE ? officeDemand : industrialDemand;
      const suitability = tile.suitability ?? 50;

      if (demand > 0 && suitability >= 20) {
        const growth = Math.max(1, Math.ceil(demand / 35 * Math.max(0.45, Math.min(1.2, 0.45 + suitability / 100 * 0.75))));
        tile.jobs = Math.min(capacity, (tile.jobs || 0) + growth);
        if (tile.jobs > 0) tile.abandoned = false;
      } else if (demand < -20) {
        tile.jobs = Math.max(0, (tile.jobs || 0) - 1);
        if (tile.jobs === 0) tile.abandoned = true;
      }
    }
  }
}

export function calculateEconomy(
  grid: TileData[][],
  population = 0,
  households = 0,
  workers = 0,
  _jobs = 0,
  unlockedUpgrades: string[] = [],
  residentialTaxRate = 9,
  commercialTaxRate = 9,
  industrialTaxRate = 9,
  costMultiplier = 1.0,
  incomeMultiplier = 1.0,
  freightReliability = 100,
) {
  const has = (id: string) => unlockedUpgrades.includes(id);
  let resRevenue = 0;
  let comRevenue = 0;
  let officeRevenue = 0;
  let indRevenue = 0;
  let maintenance = 0;
  let commercialJobs = 0;
  let officeJobs = 0;
  let industrialJobs = 0;
  const buildingLevelCounts = {
    residential: [0, 0, 0, 0, 0],
    commercial: [0, 0, 0, 0, 0],
    industrial: [0, 0, 0, 0, 0],
  };

  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
    if (!tile.abandoned) {
      const levelIndex = Math.max(0, Math.min(4, Math.round(tile.level ?? 1) - 1));
      if (tile.type === TileType.RESIDENTIAL) buildingLevelCounts.residential[levelIndex] += 1;
      else if (tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE) buildingLevelCounts.commercial[levelIndex] += 1;
      else if (tile.type === TileType.INDUSTRIAL) buildingLevelCounts.industrial[levelIndex] += 1;
    }
    if (tile.type === TileType.RESIDENTIAL) resRevenue += (tile.population || 0) * GAME_CONFIG.BASE_RES_TAX_COEFF * (residentialTaxRate / 9);
    if (tile.type === TileType.COMMERCIAL) {
      commercialJobs += tile.jobs || 0;
      comRevenue += (tile.jobs || 0) * GAME_CONFIG.BASE_COM_TAX_COEFF * (commercialTaxRate / 9) * mixedUseRevenueMultiplier(tile);
    }
    if (tile.type === TileType.OFFICE) {
      officeJobs += tile.jobs || 0;
      officeRevenue += (tile.jobs || 0) * GAME_CONFIG.BASE_COM_TAX_COEFF * 1.15 * (commercialTaxRate / 9);
    }
    if (tile.type === TileType.INDUSTRIAL) {
      industrialJobs += tile.jobs || 0;
      indRevenue += (tile.jobs || 0) * GAME_CONFIG.BASE_IND_TAX_COEFF * (industrialTaxRate / 9);
    }
    
    // The prebuilt outside connection is public infrastructure and does not
    // consume the player's municipal maintenance budget.
    const isOutsideConnection = tile.type === TileType.ROAD && (tile.y === 30 || tile.y === 31) && grid.length >= 40;
    if (!isOutsideConnection) {
      const tileMaintenance = tile.type === TileType.ROAD
        ? ROAD_MAINTENANCE_COSTS[getRoadClass(tile)]
        : (GAME_CONFIG.MAINTENANCE_COSTS[tile.type] ?? 0);
      maintenance += tileMaintenance * costMultiplier;
      if (tile.serviceUpgrades?.length) maintenance += serviceUpgradeStats(tile.type, tile.serviceUpgrades).dailyUpkeep * costMultiplier;
    }
  }
}

  if (has('prop_tax_hike')) resRevenue *= 1.2;
  if (has('wealth_tax')) resRevenue *= 1.15;
  if (has('small_biz') || has('startup_hubs') || has('tourism') || has('mixed_use')) comRevenue *= 1 + (has('small_biz') ? 0.2 : 0) + (has('startup_hubs') ? 0.15 : 0) + (has('tourism') ? 0.3 : 0) + (has('mixed_use') ? 0.1 : 0);
  if (has('startup_hubs') || has('ai_management') || has('megacity')) officeRevenue *= 1 + (has('startup_hubs') ? 0.18 : 0) + (has('ai_management') ? 0.12 : 0) + (has('megacity') ? 0.15 : 0);
  if (has('corp_subsidies') || has('auto_logistics')) indRevenue *= 1 + (has('corp_subsidies') ? 0.2 : 0) + (has('auto_logistics') ? 0.3 : 0);
  if (has('highway_conn')) indRevenue *= 1.15;
  if (has('megacity')) {
    resRevenue *= 1.2;
    comRevenue *= 1.2;
    indRevenue *= 1.2;
  }

  // Lightweight inter-sector market: households create retail demand, while
  // commercial activity creates demand for locally produced goods. Oversupply
  // reduces taxable activity; scarcity raises activity up to a controlled
  // ceiling without adding another pathfinding pass to each simulation tick.
  const consumerDemand = Math.round(Math.max(0, population) * 0.7 + Math.max(0, households) * 1.3);
  const retailSupply = Math.round(Math.max(0, commercialJobs) * 2.4);
  const goodsDemand = Math.round(Math.max(0, population) * 0.35 + Math.max(0, commercialJobs) * 0.8);
  const goodsSupply = Math.round(Math.max(0, industrialJobs) * 1.7);
  const officeDemand = Math.round(Math.max(0, workers) * 0.45 + Math.max(0, population) * 0.12);
  const officeSupply = Math.round(Math.max(0, officeJobs) * 1.8);
  const marketRatio = (demand: number, supply: number) => supply > 0
    ? Math.max(0.35, Math.min(1.15, demand / supply))
    : demand > 0 ? 0.35 : 1;
  const commercialUtilization = Math.round((0.55 + marketRatio(consumerDemand, retailSupply) * 0.45) * 100) / 100;
  const industrialUtilization = Math.round((0.55 + marketRatio(goodsDemand, goodsSupply) * 0.45) * 100) / 100;
  const officeUtilization = Math.round((0.55 + marketRatio(officeDemand, officeSupply) * 0.45) * 100) / 100;
  const logisticsFactor = Math.max(0.65, Math.min(1, 0.65 + freightReliability / 100 * 0.35));
  comRevenue *= commercialUtilization * logisticsFactor;
  officeRevenue *= officeUtilization * logisticsFactor;
  indRevenue *= industrialUtilization * logisticsFactor;

  const policyMaintenance = unlockedUpgrades.reduce((sum, id) => sum + (GAME_CONFIG.UPGRADE_MAINTENANCE[id] ?? 0), 0) * costMultiplier;
  let reduction = 0;
  if (has('urban_planning')) reduction += 0.1;
  if (has('recycling')) reduction += 0.05;
  if (has('green_roofs')) reduction += 0.05;
  if (has('ai_management')) reduction += 0.2;
  maintenance = Math.round((maintenance + policyMaintenance) * (1 - Math.min(0.45, reduction)));

  const totalRevenue = (resRevenue + comRevenue + officeRevenue + indRevenue) * incomeMultiplier;

  return {
    income: Math.max(0, Math.round(totalRevenue)),
    expenses: maintenance,
    serviceMaint: maintenance,
    residentialRevenue: Math.round(resRevenue * incomeMultiplier),
    commercialRevenue: Math.round(comRevenue * incomeMultiplier),
    officeRevenue: Math.round(officeRevenue * incomeMultiplier),
    industrialRevenue: Math.round(indRevenue * incomeMultiplier),
    consumerDemand,
    retailSupply,
    goodsDemand,
    goodsSupply,
    commercialUtilization,
    officeUtilization,
    industrialUtilization,
    marketHealth: Math.round(((commercialUtilization + officeUtilization + industrialUtilization) / 3) * 100),
    buildingLevelCounts,
  };
}

const POSSIBLE_EVENTS: CityEventData[] = [
  {
    id: 'heatwave',
    name: 'Tropical Heatwave',
    description: 'High temperatures increase city-wide electricity and water consumption by 35%.',
    durationDays: 6,
    remainingDays: 6,
    type: 'HEATWAVE',
    powerDemandMultiplier: 1.35,
    waterDemandMultiplier: 1.35,
    happinessImpact: -5,
  },
  {
    id: 'economic_boom',
    name: 'Regional Economic Boom',
    description: 'Investment surge boosts commercial demand and tax returns by 20%.',
    durationDays: 8,
    remainingDays: 8,
    type: 'ECONOMIC_BOOM',
    demandMultiplier: 1.2,
    incomeMultiplier: 1.2,
    happinessImpact: 8,
  },
  {
    id: 'heavy_rain',
    name: 'Monsoon Rain Season',
    description: 'Heavy precipitation cools the region but slows road commute speeds.',
    durationDays: 5,
    remainingDays: 5,
    type: 'HEAVY_RAIN',
    waterDemandMultiplier: 0.8,
    happinessImpact: -2,
  },
  {
    id: 'tech_surge',
    name: 'Clean Tech Surge',
    description: 'Local startups expand industrial employment opportunities.',
    durationDays: 7,
    remainingDays: 7,
    type: 'TECH_SURGE',
    demandMultiplier: 1.25,
    incomeMultiplier: 1.1,
    happinessImpact: 5,
  },
];

export function unlockRegion(
  state: CityState,
  rx: number,
  ry: number
): { success: boolean; newState: CityState; cost?: number; error?: string } {
  const check = canUnlockRegion(rx, ry, state.unlockedRegions, state.money);
  if (!check.canUnlock) {
    return { success: false, newState: state, cost: check.cost, error: check.reason };
  }
  const key = `${rx},${ry}`;
  const newState: CityState = {
    ...state,
    money: state.money - check.cost,
    unlockedRegions: [...state.unlockedRegions, key],
  };
  return { success: true, newState, cost: check.cost };
}

export function simulateTick(input: CityState, settings?: Partial<GameSettings> & { benchmarkMode?: boolean }): CityState {
  const phaseTimings: Record<string, number> = {};
  let phaseStartedAt = profilerNow();
  let phaseName = 'CLONE';
  const markPhase = (nextPhase: string) => {
    const now = profilerNow();
    phaseTimings[phaseName] = Math.round((now - phaseStartedAt) * 10) / 10;
    phaseName = nextPhase;
    phaseStartedAt = now;
  };

  // One mutable working copy is the explicit mutation boundary for the tick.
  // Nested mutable collections are copied by cloneCityStateForSimulation;
  // input remains safe for replay, undo, and stale-worker rejection.
  const state = cloneCityStateForSimulation(input);
  const grid = state.grid;
  const context = createSimulationTickContext(grid);

  markPhase('INPUT');
  state.simulationPhase = 'INPUT';
  const appliedCommands = applySimulationCommands(state, state.commandQueue ?? []);
  state.commandQueue = [];
  refreshTileAggregates(context, grid);
  for (const command of appliedCommands) {
    const payload = command.payload as { x?: number; y?: number; changes?: Array<{ x: number; y: number }> };
    const coordinates: Array<[number, number]> = [];
    if (Number.isInteger(payload.x) && Number.isInteger(payload.y)) coordinates.push([payload.x!, payload.y!]);
    for (const change of payload.changes ?? []) {
      if (Number.isInteger(change.x) && Number.isInteger(change.y)) coordinates.push([change.x, change.y]);
    }
    if (coordinates.length === 0) continue;
    const kind = command.type === 'TERRAFORM' ? 'TERRAIN' : command.type === 'SET_SIGNAL' || command.type === 'REPAIR_ROAD' ? 'ROAD' : 'TOPOLOGY';
    markTilesChanged(context, coordinates, kind);
  }
  const commandEvents = appliedCommands.map((command) => ({
    id: `command-applied-${command.id}`,
    type: 'COMMAND_APPLIED',
    day: state.day,
    phase: 'INPUT' as const,
    payload: { commandId: command.id, commandType: command.type },
  }));

  const initialParcels = reconcileParcels(state.grid);
  state.parcelCount = initialParcels.parcelCount;
  state.developedParcelCount = initialParcels.developedParcelCount;
  state.privateParcelCount = initialParcels.privateParcelCount;
  state.averageParcelSize = initialParcels.averageParcelSize;

  state.day = Math.max(1, state.day + 1);
  state.timeOfDay = ((input.timeOfDay ?? 6) + 6) % 24;
  const climate = simulateClimate(state.day, state.seed ?? 2088, { season: input.season, weather: input.weather });
  state.season = climate.season;
  state.weather = climate.weather;
  state.temperature = climate.temperature;
  state.precipitation = climate.precipitation;
  state.climatePowerMultiplier = climate.powerDemandMultiplier;
  state.climateWaterMultiplier = climate.waterDemandMultiplier;
  state.climateTrafficMultiplier = climate.trafficMultiplier;
  state.climateFireRisk = climate.fireRisk;
  state.simulationPhase = 'DISASTERS';
  markPhase('DISASTERS');

  const recoveryResult = simulateRecoveryProjects(state);
  state.recoveryProjects = recoveryResult.projects;
  state.capitalBudget = Math.max(0, (state.capitalBudget ?? Math.max(0, state.money)) - recoveryResult.spending);
  const tradeResult = simulateTradeContracts(state);
  state.tradeContracts = tradeResult.contracts;
  state.tradeImportCapacity = tradeResult.importCapacity;
  state.tradeExportCapacity = tradeResult.exportCapacity;
  state.tradeExportRevenue = tradeResult.exportRevenue;

  const disasterResult = simulateDisasters(
    state.grid,
    state.disasters ?? [],
    state.day,
    state.seed ?? 2088,
    state.serviceResponseQuality ?? 0,
  );
  state.disasters = disasterResult.disasters;
  state.activeDisasters = disasterResult.activeDisasters;
  state.disasterResponseLoad = disasterResult.responseLoad;
  state.disastersResolved = disasterResult.resolved;
  state.disasterHappinessPenalty = disasterResult.happinessPenalty;
  state.disasterRecoveryRate = disasterResult.recoveryRate;

  // Surface water is simulated after disaster decay so persistent floodwater
  // can continue to affect terrain, buildings, and recovery on each tick.
  const hydrology = simulateHydrology(state.grid, climate.precipitation);
  state.floodedTiles = hydrology.floodedTiles;
  state.averageWaterDepth = hydrology.averageDepth;
  state.peakWaterDepth = hydrology.peakDepth;
  state.flowingWaterTiles = hydrology.flowingTiles;
  state.reservoirStorage = hydrology.reservoirStorage;
  state.floodBarrierCount = hydrology.floodBarrierCount;

  // Difficulty multiplier
  const difficulty = settings?.difficulty ?? 'normal';
  const diffMods = GAME_CONFIG.DIFFICULTY_MODIFIERS[difficulty] ?? GAME_CONFIG.DIFFICULTY_MODIFIERS.normal;

  // Active Events Lifecycle
  const currentEvents: CityEventData[] = [];
  for (const ev of state.eventsData ?? []) {
    const nextRemaining = ev.remainingDays - 1;
    if (nextRemaining > 0) {
      currentEvents.push({ ...ev, remainingDays: nextRemaining });
    }
  }

  // Spontaneous Event Trigger using deterministic Seeded PRNG
  const eventPrng = new SeededRandom(((state.seed ?? 2088) ^ (state.day * 0x3c6ef35f)) >>> 0);
  if (currentEvents.length === 0 && eventPrng.next() < diffMods.eventChance) {
    const chosen = POSSIBLE_EVENTS[eventPrng.nextInt(0, POSSIBLE_EVENTS.length - 1)];
    currentEvents.push({ ...chosen, remainingDays: chosen.durationDays });
  }

  state.eventsData = currentEvents;
  state.activeEvents = currentEvents.map((e) => e.name);

  // Aggregate event multipliers
  let evPowerMult = 1.0;
  let evWaterMult = 1.0;
  let evDemandMult = 1.0;
  let evIncomeMult = 1.0;
  let evHappinessOffset = climate.happinessImpact;

  for (const ev of currentEvents) {
    if (ev.powerDemandMultiplier) evPowerMult *= ev.powerDemandMultiplier;
    if (ev.waterDemandMultiplier) evWaterMult *= ev.waterDemandMultiplier;
    if (ev.demandMultiplier) evDemandMult *= ev.demandMultiplier;
    if (ev.incomeMultiplier) evIncomeMult *= ev.incomeMultiplier;
    if (ev.happinessImpact) evHappinessOffset += ev.happinessImpact;
  }
  evPowerMult *= climate.powerDemandMultiplier;
  evWaterMult *= climate.waterDemandMultiplier;

  // Allocate utilities passing active event multipliers directly to BFS network allocation
  markPhase('UTILITIES');
  const utilities = simulateUtilityNetworks(state.grid, state.unlockedUpgrades, evPowerMult, evWaterMult);
  markTilesChanged(context, utilities.changedTiles, 'UTILITY');
  refreshTileAggregates(context, grid);
  state.simulationPhase = 'UTILITIES';
  state.powerCapacity = utilities.powerCapacity;
  state.powerDemand = utilities.powerDemand;
  state.waterCapacity = utilities.waterCapacity;
  state.waterDemand = utilities.waterDemand;

  markPhase('ENVIRONMENT');
  const roadGraph = buildRoadGraph(state.grid, state.unlockedUpgrades, state.timeOfDay, state.signalStates);
  context.roadGraph = roadGraph;
  state.signalStates = advanceIntersectionSignalStates(roadGraph, state.signalStates, state.timeOfDay, 1);
  applySignalStatesToRoadGraph(roadGraph, state.signalStates);
  const depth = simulateCityDepthAndEnvironment(state.grid, roadGraph, state.unlockedUpgrades);
  state.landValueAverage = depth.landValueAverage;
  state.suitabilityAverage = depth.suitabilityAverage;
  state.pollutionAverage = depth.pollutionAverage;
  state.noiseAverage = depth.noiseAverage;
  state.educationLevel = depth.educationLevel;
  state.healthIndex = depth.healthIndex;
  const districtEffects = applyDistrictEffects(state.grid, state.districts ?? []);
  const mixedUseEnabled = state.unlockedUpgrades.includes('mixed_use') || state.activePolicies.includes('mixed_use');
  const mixedUseTiles = mixedUseEnabled ? undefined : getDistrictTileSet(state.districts ?? [], 'MIXED_USE');
  const initialMixedUse = reconcileMixedUsePrograms(state.grid, {
    enabled: mixedUseEnabled || mixedUseTiles.size > 0,
    mixedUseTiles,
  });
  markTilesChanged(context, initialMixedUse.changedTiles ?? [], 'BUILDING');
  state.mixedUseBlocks = initialMixedUse.mixedUseBlocks;
  state.mixedUseFloorArea = initialMixedUse.mixedUseFloorArea;
  state.mixedUseJobs = initialMixedUse.mixedUseJobs;
  const initialParking = simulateParking(state.grid);
  state.parkingDemand = initialParking.demand;
  state.parkingSupply = initialParking.supply;
  state.parkingCoverage = initialParking.coverage;
  state.parkingPressure = initialParking.pressure;

  markPhase('SERVICES_INITIAL');
  const services = simulateCityServices(
    state.grid,
    roadGraph,
    context.tileAggregates.population,
    context.tileAggregates.jobs,
    state.desirability,
    state.averageCommuteTime,
    state.residentialTaxRate,
    state.unlockedUpgrades,
  );
  state.healthcareCoverage = clamp(services.healthcareCoverage + districtEffects.serviceCoverageBoost, 0, 100);
  state.educationCoverage = clamp(services.educationCoverage + districtEffects.serviceCoverageBoost, 0, 100);
  state.fireSafety = clamp(services.fireSafety + districtEffects.serviceCoverageBoost, 0, 100);
  state.crimeRate = clamp(services.crimeRate - districtEffects.serviceCoverageBoost, 0, 100);
  state.wasteCapacity = services.wasteCapacity;
  state.wasteProduction = services.wasteProduction;
  state.wasteCoverage = clamp(services.wasteCoverage + districtEffects.serviceCoverageBoost, 0, 100);
  state.fireServiceCapacity = services.fireServiceCapacity;
  state.policeServiceCapacity = services.policeServiceCapacity;
  state.healthcareCapacity = services.healthcareCapacity;
  state.educationCapacity = services.educationCapacity;
  state.serviceResponseQuality = services.serviceResponseQuality;
  state.happiness = clamp(services.happiness + districtEffects.serviceCoverageBoost * 0.35 + evHappinessOffset - disasterResult.happinessPenalty, 0, 100);

  markPhase('DEMAND');
  const demands = calculateDemandsAndDesirability(state.grid, state, state.powerCapacity, state.powerDemand, state.waterCapacity, state.waterDemand, context);
  state.desirability = demands.desirability;
  state.residentialDemand = clamp(Math.round((demands.residentialDemand + districtEffects.residentialDemandBonus) * diffMods.demandMultiplier * evDemandMult), GAME_CONFIG.DEMAND_MIN, GAME_CONFIG.DEMAND_MAX);
  state.commercialDemand = clamp(Math.round((demands.commercialDemand + districtEffects.commercialDemandBonus) * diffMods.demandMultiplier * evDemandMult), GAME_CONFIG.DEMAND_MIN, GAME_CONFIG.DEMAND_MAX);
  state.officeDemand = clamp(Math.round((demands.officeDemand + districtEffects.commercialDemandBonus * 0.6) * diffMods.demandMultiplier * evDemandMult), GAME_CONFIG.DEMAND_MIN, GAME_CONFIG.DEMAND_MAX);
  state.industrialDemand = clamp(Math.round((demands.industrialDemand + districtEffects.industrialDemandBonus) * diffMods.demandMultiplier * evDemandMult), GAME_CONFIG.DEMAND_MIN, GAME_CONFIG.DEMAND_MAX);

  markPhase('URBAN_FORM');
  const preLogistics = simulateLogistics(state.grid, roadGraph, state.warehouseInventory ?? {}, false);
  const logisticsGrowthFactor = Math.max(0.65, Math.min(1, 0.65 + preLogistics.freightReliability / 100 * 0.35));
  const evolvedBuildingTiles = simulateBuildingEvolution(
    state.grid,
    roadGraph,
    state.residentialDemand,
    Math.round(state.commercialDemand * logisticsGrowthFactor),
    Math.round((state.officeDemand ?? state.commercialDemand) * logisticsGrowthFactor),
    Math.round(state.industrialDemand * logisticsGrowthFactor),
    state.unlockedUpgrades,
  );
  markTilesChanged(context, evolvedBuildingTiles, 'BUILDING');
  const evolvedParcels = refreshParcelStatuses(state.grid);
  state.parcelCount = evolvedParcels.parcelCount;
  state.developedParcelCount = evolvedParcels.developedParcelCount;
  state.privateParcelCount = evolvedParcels.privateParcelCount;
  state.averageParcelSize = evolvedParcels.averageParcelSize;
  const evolvedMixedUse = reconcileMixedUsePrograms(state.grid, {
    enabled: mixedUseEnabled || mixedUseTiles.size > 0,
    mixedUseTiles,
  });
  markTilesChanged(context, evolvedMixedUse.changedTiles ?? [], 'BUILDING');
  state.mixedUseBlocks = evolvedMixedUse.mixedUseBlocks;
  state.mixedUseFloorArea = evolvedMixedUse.mixedUseFloorArea;
  state.mixedUseJobs = evolvedMixedUse.mixedUseJobs;
  simulateJobGrowth(
    state.grid,
    Math.round(state.commercialDemand * logisticsGrowthFactor),
    Math.round((state.officeDemand ?? state.commercialDemand) * logisticsGrowthFactor),
    Math.round(state.industrialDemand * logisticsGrowthFactor),
    state.unlockedUpgrades,
  );
  refreshTileAggregates(context, grid);
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (tile.type === TileType.RESIDENTIAL) {
        tile.rent = calculateTileRent(tile, state.residentialTaxRate);
        const estimatedHouseholds = Math.max(1, (tile.population || 0) / 2.2);
        tile.rentPressure = Math.round(Math.min(3, (tile.rent / Math.max(1, estimatedHouseholds * 22))) * 100) / 100;
        tile.affordability = Math.round(clamp(100 - (tile.rentPressure - 1) * 45, 0, 100));
      }
    }
  }
  // Transit is evaluated before the citizen step so modal choice can react to
  // the network that exists on this tick. Facilities are capacity providers,
  // not merely decorative buildings: they must be powered and road-connected.
  markPhase('TRAFFIC_NETWORK');
  const transitNetwork = simulateTransitNetwork(
    state.grid,
    roadGraph,
    context.tileAggregates.population,
    state.unlockedUpgrades,
    state.transitLines ?? [],
    state.timeOfDay,
    state.day,
  );
  state.simulationPhase = 'TRAFFIC';
  const transitAvailability = {
    enabled: transitNetwork.transitCapacity > 0,
    bus: transitNetwork.busDepots > 0,
    tram: transitNetwork.tramStations > 0,
    coverage: Math.min(100, transitNetwork.transitCoverage + districtEffects.transitModeBoost * 100),
    capacity: transitNetwork.transitCapacity,
    activeVehicles: transitNetwork.activeVehicles,
    averageWaitTime: transitNetwork.averageWaitTime,
    transferOpportunities: transitNetwork.transferOpportunities,
    vehicleAgents: transitNetwork.vehicleAgents,
    platformCapacity: transitNetwork.platformCapacity,
    averageDwellTime: transitNetwork.averageDwellTime,
    lines: transitNetwork.activeLineDetails,
  };

  // Execute pure citizen simulation state step
  const activeCitizenSimState = hydrateCitizenSimulation(state.citizenState, state.seed ?? 2088);
  activeCitizenSimState.samplingFactor = settings?.trafficDensity === 'low'
    ? 0.5 * Math.max(1, activeCitizenSimState.populationScale ?? 1)
    : settings?.trafficDensity === 'high'
      ? 1.5 * Math.max(1, activeCitizenSimState.populationScale ?? 1)
      : Math.max(1, activeCitizenSimState.populationScale ?? 1);
  markPhase('POPULATION');
  const citizenResults = simulateCitizenTick(
    activeCitizenSimState,
    state.grid,
    roadGraph,
    state.day,
    state.desirability,
    state.residentialDemand,
    state.residentialTaxRate,
    state.unlockedUpgrades,
    transitAvailability,
    preLogistics.freightTrips,
    !settings?.benchmarkMode,
  );
  state.simulationPhase = 'POPULATION';

  state.citizenState = serializeCitizenSimulation(citizenResults.state);
  state.demographics = citizenResults.demographics;
  state.activeTrips = citizenResults.state.activeTrips;
  state.trafficAverage = citizenResults.trafficAverage;
  state.averageCommuteTime = citizenResults.averageCommuteTime;
  state.congestionIndex = citizenResults.congestionIndex;
  state.averageQueuePressure = citizenResults.averageQueuePressure;
  if (climate.trafficMultiplier !== 1) {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const tile = row[x];
        if (tile.type === TileType.ROAD) {
          tile.traffic = Math.min(100, Math.round((tile.traffic || 0) * climate.trafficMultiplier * 10) / 10);
        }
      }
    }
    state.trafficAverage = Math.min(100, Math.round(state.trafficAverage * climate.trafficMultiplier * 10) / 10);
    state.congestionIndex = Math.min(100, Math.round(state.congestionIndex * climate.trafficMultiplier * 10) / 10);
    state.averageCommuteTime = Math.round(state.averageCommuteTime * climate.trafficMultiplier * 10) / 10;
  }

  // Single Source of Truth for Population and Workforce
  const livingCitizens = citizenResults.demographics.representedCitizens ?? citizenResults.demographics.totalCitizens;
  state.population = livingCitizens;
  state.households = citizenResults.demographics.representedHouseholds ?? citizenResults.demographics.totalHouseholds;
  state.workers = citizenResults.demographics.workforce.employable;
  state.totalJobSlots = citizenResults.demographics.workforce.totalJobSlots;
  state.filledJobs = citizenResults.demographics.workforce.filledJobs;
  state.vacantJobs = citizenResults.demographics.workforce.vacantJobs;
  state.unemployedCitizens = citizenResults.demographics.workforce.unemployedCitizens;
  state.availableJobs = citizenResults.demographics.workforce.totalJobSlots;
  state.employment = citizenResults.demographics.workforce.employable > 0
    ? Math.round((citizenResults.demographics.workforce.employed / citizenResults.demographics.workforce.employable) * 1000) / 10
    : 0;
  state.unemploymentRate = citizenResults.demographics.workforce.unemploymentRate;

  const updatedParking = simulateParking(state.grid);
  state.parkingDemand = updatedParking.demand;
  state.parkingSupply = updatedParking.supply;
  state.parkingCoverage = updatedParking.coverage;
  state.parkingPressure = updatedParking.pressure;

  markPhase('LOGISTICS');
  const logistics = simulateLogistics(state.grid, roadGraph, preLogistics.warehouseInventory, true, tradeResult.importCapacityByCommodity);
  state.freightDemand = logistics.freightDemand;
  state.freightCapacity = logistics.freightCapacity + tradeResult.importCapacity;
  state.freightReliability = Math.round(((logistics.freightReliability * 0.8) + (tradeResult.reliability * 0.2)) * 10) / 10;
  state.industrialAccess = logistics.industrialAccess;
  state.commercialStock = logistics.commercialStock;
  state.commodityDemand = logistics.commodityDemand;
  state.commoditySupply = logistics.commoditySupply;
  state.commodityStock = logistics.commodityStock;
  state.productionInputDemand = logistics.productionInputDemand;
  state.productionEfficiency = logistics.productionEfficiency;
  state.cargoTerminals = logistics.cargoTerminals;
  state.cargoThroughput = logistics.cargoThroughput;
  state.connectedIndustries = logistics.connectedIndustries;
  state.activeFreightTrips = logistics.freightTrips;
  state.warehouses = logistics.warehouses;
  state.warehouseCapacity = logistics.warehouseCapacity;
  state.warehouseBuffer = logistics.warehouseBuffer;
  state.warehouseInventory = logistics.warehouseInventory;

  // Recalculate services with updated true population
  markPhase('SERVICES_FINAL');
  const updatedServices = simulateCityServices(
    state.grid,
    roadGraph,
    state.population,
    state.availableJobs,
    state.desirability,
    state.averageCommuteTime,
    state.residentialTaxRate,
    state.unlockedUpgrades,
  );
  state.simulationPhase = 'SERVICES';
  state.healthcareCoverage = clamp(updatedServices.healthcareCoverage + districtEffects.serviceCoverageBoost, 0, 100);
  state.educationCoverage = clamp(updatedServices.educationCoverage + districtEffects.serviceCoverageBoost, 0, 100);
  state.fireSafety = clamp(updatedServices.fireSafety + districtEffects.serviceCoverageBoost, 0, 100);
  state.crimeRate = clamp(updatedServices.crimeRate - districtEffects.serviceCoverageBoost, 0, 100);
  state.wasteCapacity = updatedServices.wasteCapacity;
  state.wasteProduction = updatedServices.wasteProduction;
  state.wasteCoverage = clamp(updatedServices.wasteCoverage + districtEffects.serviceCoverageBoost, 0, 100);
  state.fireServiceCapacity = updatedServices.fireServiceCapacity;
  state.policeServiceCapacity = updatedServices.policeServiceCapacity;
  state.healthcareCapacity = updatedServices.healthcareCapacity;
  state.educationCapacity = updatedServices.educationCapacity;
  state.serviceResponseQuality = updatedServices.serviceResponseQuality;
  markPhase('INCIDENTS');
  const incidentResult = simulateIncidents(
    state.grid,
    roadGraph,
    state.incidents ?? [],
    state.day,
    state.seed ?? 2088,
    state.serviceResponseQuality,
    {
      fire: state.fireServiceCapacity ?? 0,
      police: state.policeServiceCapacity ?? 0,
      healthcare: state.healthcareCapacity ?? 0,
    },
  );
  state.simulationPhase = 'INCIDENTS';
  state.incidents = incidentResult.incidents;
  state.activeIncidents = incidentResult.incidents.length;
  state.incidentResponseLoad = incidentResult.responseLoad;
  state.incidentsResolved = incidentResult.resolved;
  state.incidentHappinessPenalty = incidentResult.happinessPenalty;
  state.incidentDispatchedUnits = incidentResult.dispatchedUnits;
  state.incidentQueuedUnits = incidentResult.queuedUnits;
  const maintenanceOrders = state.serviceMaintenanceOrders ?? [];
  const remainingMaintenanceOrders = [];
  for (const order of maintenanceOrders) {
    if (order.remainingTicks <= 1) {
      const key = `${order.facility.x},${order.facility.y}`;
      state.serviceDepotCondition = { ...(state.serviceDepotCondition ?? {}), [key]: 100 };
      continue;
    }
    remainingMaintenanceOrders.push({ ...order, remainingTicks: order.remainingTicks - 1 });
  }
  state.serviceMaintenanceOrders = remainingMaintenanceOrders;
  const serviceFleet = simulateServiceFleet(
    state.serviceVehicles ?? [],
    state.incidents ?? [],
    state.grid,
    roadGraph,
    state.day,
    state.serviceResponseQuality ?? 0,
    state.serviceDepotCondition ?? {},
  );
  state.serviceVehicles = serviceFleet.agents;
  state.serviceFleetTotal = serviceFleet.totalUnits;
  state.serviceFleetActive = serviceFleet.activeUnits;
  state.serviceFleetAvailable = serviceFleet.availableUnits;
  state.serviceFleetOnScene = serviceFleet.onSceneUnits;
  state.serviceFleetAverageCondition = serviceFleet.averageCondition;
  state.serviceDepotCondition = serviceFleet.depotCondition;
  state.serviceFleetMaintenanceCost = serviceFleet.maintenanceCost;
  state.serviceBayQueues = serviceFleet.bayQueues;
  markPhase('TRANSIT_FINAL');
  const updatedTransit = simulateTransitNetwork(
    state.grid,
    roadGraph,
    state.population,
    state.unlockedUpgrades,
    state.transitLines ?? [],
    state.timeOfDay,
    state.day,
  );
  state.transitCapacity = updatedTransit.transitCapacity;
  state.transitRidership = updatedTransit.transitRidership;
  state.transitCoverage = Math.min(100, updatedTransit.transitCoverage + districtEffects.transitModeBoost * 100);
  state.transitBusDepots = updatedTransit.busDepots;
  state.transitTramStations = updatedTransit.tramStations;
  state.transitActiveLines = updatedTransit.activeLines;
  state.transitActiveVehicles = updatedTransit.activeVehicles;
  state.transitAverageWait = updatedTransit.averageWaitTime;
  state.transitTransferOpportunities = updatedTransit.transferOpportunities;
  state.transitVehicles = updatedTransit.vehicleAgents;
  state.transitPlatformCapacity = updatedTransit.platformCapacity;
  state.transitAverageDwell = updatedTransit.averageDwellTime;
  state.transitFareRevenue = updatedTransit.fareRevenue;
  state.transitOperatingCost = updatedTransit.operatingCost;
  const transitHappinessBonus = Math.round(updatedTransit.transitCoverage * 0.04);
  const logisticsHappinessOffset = Math.round((logistics.freightReliability - 70) * 0.03);
  state.happiness = clamp(updatedServices.happiness + districtEffects.serviceCoverageBoost * 0.35 + evHappinessOffset + transitHappinessBonus + logisticsHappinessOffset - incidentResult.happinessPenalty - disasterResult.happinessPenalty, 0, 100);

  markPhase('ECONOMY');
  const economy = calculateEconomy(
    state.grid,
    state.population,
    state.households,
    state.workers,
    state.availableJobs,
    [...state.unlockedUpgrades, ...state.activePolicies],
    state.residentialTaxRate,
    state.commercialTaxRate,
    state.industrialTaxRate,
    diffMods.costMultiplier,
    evIncomeMult,
    logistics.freightReliability,
  );
  state.simulationPhase = 'ECONOMY';
  state.income = economy.income + (state.transitFareRevenue ?? 0) + tradeResult.exportRevenue;
  state.expenses = economy.expenses + (state.transitOperatingCost ?? 0) + serviceFleet.operatingCost + serviceFleet.maintenanceCost + recoveryResult.spending;
  state.consumerDemand = economy.consumerDemand;
  state.retailSupply = economy.retailSupply;
  state.goodsDemand = economy.goodsDemand;
  state.goodsSupply = economy.goodsSupply;
  state.commercialUtilization = economy.commercialUtilization;
  state.officeUtilization = economy.officeUtilization;
  state.industrialUtilization = economy.industrialUtilization;
  state.marketHealth = economy.marketHealth;
  state.money = Math.round(clamp(state.money + state.income - state.expenses, -10_000_000, 999_999_999));
  state.operatingBudget = state.income - state.expenses;
  state.specialization = deriveCitySpecialization(state);
  if (state.money < 0) {
    state.municipalDebt = Math.round(((state.municipalDebt ?? 0) + Math.abs(state.money) * 0.015) * 10) / 10;
  } else if ((state.municipalDebt ?? 0) > 0 && state.operatingBudget > 0) {
    const repayment = Math.min(state.municipalDebt ?? 0, state.operatingBudget * 0.08);
    state.municipalDebt = Math.round(((state.municipalDebt ?? 0) - repayment) * 10) / 10;
  }
  
  // Monotonic milestone progression: achieved milestones never regress
  state.milestoneLevel = Math.max(state.milestoneLevel ?? 0, getMilestoneLevel(state));

  state.buildingLevelCounts = economy.buildingLevelCounts;
  state.completedMissions = [...state.completedMissions];
  state.unlockedAchievements = [...state.unlockedAchievements];
  for (const achievement of ACHIEVEMENTS) {
    if (!state.unlockedAchievements.includes(achievement.id) && achievement.check(state)) state.unlockedAchievements.push(achievement.id);
  }
  markPhase('HISTORY');
  state.history = [...state.history, {
    day: state.day,
    population: state.population,
    money: state.money,
    income: state.income,
    expenses: state.expenses,
    happiness: state.happiness,
    desirability: state.desirability,
    trafficAverage: state.trafficAverage,
    residentialDemand: state.residentialDemand,
    commercialDemand: state.commercialDemand,
    officeDemand: state.officeDemand ?? 0,
    industrialDemand: state.industrialDemand,
    congestionIndex: state.congestionIndex,
    averageCommuteTime: state.averageCommuteTime,
    serviceResponseQuality: state.serviceResponseQuality ?? 0,
    transitCoverage: state.transitCoverage ?? 0,
  }].slice(-60);

  const activeRegionKeys = state.activeRegionKeys ?? state.unlockedRegions ?? ['1,1'];
  state.regions = calculateRegionTelemetry(state, activeRegionKeys);
  const regionalState = advanceBackgroundRegions(state, activeRegionKeys);
  state.regions = regionalState.regions;
  const previousDiagnostics = state.causalDiagnostics ?? [];
  state.causalDiagnostics = calculateCausalDiagnostics(state);
  const resolvedDiagnosticEvents = previousDiagnostics
    .filter((prev) => !state.causalDiagnostics!.some((cur) => cur.title === prev.title))
    .map((resolved) => ({
      id: `diag-resolved-${state.day}-${resolved.id}`,
      type: 'DIAGNOSTIC_RESOLVED' as const,
      day: state.day,
      phase: 'HISTORY' as const,
      payload: { title: resolved.title, category: resolved.category },
    }));

  if (state.activeScenarioId) {
    const scenario = SCENARIO_DEFINITIONS.find((candidate) => candidate.id === state.activeScenarioId);
    if (scenario) {
      const progress = evaluateScenario(state, scenario);
      state.scenarioCompleted = progress.completed;
      state.scenarioObjectiveValues = progress.objectiveValues;
    }
  }
  state.recentSimulationEvents = [
    ...(state.recentSimulationEvents ?? []),
    ...commandEvents,
    ...resolvedDiagnosticEvents,
    {
      id: `tick-${state.day}`,
      type: 'SIMULATION_TICK_COMPLETED',
      day: state.day,
      phase: 'HISTORY' as const,
      payload: { population: state.population, money: state.money, congestion: state.congestionIndex },
    },
  ].slice(-50);
  state.simulationPhase = 'HISTORY';
  state.schemaVersion = Math.max(1, state.schemaVersion ?? 1);

  const profileEnd = profilerNow();
  phaseTimings[phaseName] = Math.round((profileEnd - phaseStartedAt) * 10) / 10;
  lastSimulationPhaseTimings = phaseTimings;
  lastSimulationRenderRevisions = finalizeSimulationRenderRevisions(context);

  return state;
}

export function createInitialCityState(grid: TileData[][] = createStarterGrid(), seed = 2088, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): CityState {
  const startingMoney = difficulty === 'easy' 
    ? Math.round(GAME_CONFIG.STARTING_MONEY * 1.5) 
    : difficulty === 'hard' 
    ? Math.round(GAME_CONFIG.STARTING_MONEY * 0.75) 
    : GAME_CONFIG.STARTING_MONEY;

  const initialCitizenSim = createInitialCitizenSimulationState(seed);
  const initialUtilities = simulateUtilityNetworks(grid, [], 1.0, 1.0);

  return {
    schemaVersion: 1,
    featureSet: 'stable',
    grid,
    seed,
    money: startingMoney,
    population: 0,
    day: 1,
    season: 'SPRING',
    weather: 'CLEAR',
    temperature: 28,
    precipitation: 1,
    climatePowerMultiplier: 1,
    climateWaterMultiplier: 1,
    climateTrafficMultiplier: 1,
    climateFireRisk: 1,
    powerCapacity: initialUtilities.powerCapacity,
    powerDemand: initialUtilities.powerDemand,
    waterCapacity: initialUtilities.waterCapacity,
    waterDemand: initialUtilities.waterDemand,
    transitCapacity: 0,
    transitRidership: 0,
    transitCoverage: 0,
    transitBusDepots: 0,
    transitTramStations: 0,
    transitActiveLines: 0,
    transitActiveVehicles: 0,
    transitAverageWait: 0,
    transitTransferOpportunities: 0,
    transitPlatformCapacity: 0,
    transitAverageDwell: 0,
    transitFareRevenue: 0,
    transitOperatingCost: 0,
    parkingDemand: 0,
    parkingSupply: 0,
    parkingCoverage: 100,
    parkingPressure: 0,
    transitLines: [],
    transitVehicles: [],
    serviceVehicles: [],
    serviceFleetTotal: 0,
    serviceFleetActive: 0,
    serviceFleetAvailable: 0,
    serviceFleetOnScene: 0,
    serviceFleetAverageCondition: 100,
    serviceDepotCondition: {},
    serviceFleetMaintenanceCost: 0,
    serviceMaintenanceOrders: [],
    serviceBayQueues: {},
    parcelCount: 0,
    developedParcelCount: 0,
    privateParcelCount: 0,
    averageParcelSize: 0,
    mixedUseBlocks: 0,
    mixedUseFloorArea: 0,
    mixedUseJobs: 0,
    activeFreightTrips: [],
    trafficAverage: 0,
    averageCommuteTime: 0,
    congestionIndex: 0,
    averageQueuePressure: 0,
    income: 0,
    expenses: 0,
    unlockedUpgrades: [],
    households: 0,
    workers: 0,
    employment: 0,
    unemploymentRate: 0,
    availableJobs: 0,
    totalJobSlots: 0,
    filledJobs: 0,
    vacantJobs: 0,
    unemployedCitizens: 0,
    residentialDemand: 0,
    commercialDemand: 0,
    officeDemand: 0,
    industrialDemand: 0,
    consumerDemand: 0,
    retailSupply: 0,
    goodsDemand: 0,
    goodsSupply: 0,
    commercialUtilization: 0,
    officeUtilization: 0,
    industrialUtilization: 0,
    marketHealth: 0,
    freightDemand: 0,
    freightCapacity: 0,
    freightReliability: 100,
    industrialAccess: 100,
    commercialStock: 100,
    commodityDemand: { FOOD: 0, GOODS: 0, MATERIALS: 0, FUEL: 0 },
    commoditySupply: { FOOD: 0, GOODS: 0, MATERIALS: 0, FUEL: 0 },
    commodityStock: { FOOD: 100, GOODS: 100, MATERIALS: 100, FUEL: 100 },
    productionInputDemand: { FOOD: 0, GOODS: 0, MATERIALS: 0, FUEL: 0 },
    productionEfficiency: 1,
    cargoTerminals: 0,
    cargoThroughput: 0,
    connectedIndustries: 0,
    warehouses: 0,
    warehouseCapacity: 0,
    warehouseBuffer: 0,
    warehouseInventory: {},
    desirability: 50,
    residentialTaxRate: GAME_CONFIG.DEFAULT_TAX_RATE,
    commercialTaxRate: GAME_CONFIG.DEFAULT_TAX_RATE,
    industrialTaxRate: GAME_CONFIG.DEFAULT_TAX_RATE,
    history: [],
    happiness: 50,
    healthcareCoverage: 0,
    educationCoverage: 0,
    fireSafety: 100,
    crimeRate: 35,
    wasteCapacity: 0,
    wasteProduction: 0,
    wasteCoverage: 80,
    fireServiceCapacity: 0,
    policeServiceCapacity: 0,
    healthcareCapacity: 0,
    educationCapacity: 0,
    serviceResponseQuality: 0,
    incidents: [],
    activeIncidents: 0,
    incidentResponseLoad: 0,
    incidentsResolved: 0,
    incidentHappinessPenalty: 0,
    incidentDispatchedUnits: 0,
    incidentQueuedUnits: 0,
    disasters: [],
    activeDisasters: 0,
    disasterResponseLoad: 0,
    disastersResolved: 0,
    disasterHappinessPenalty: 0,
    disasterRecoveryRate: 0,
    milestoneLevel: 0,
    activePolicies: [],
    districts: [],
    timeOfDay: 6,
    floodedTiles: 0,
    averageWaterDepth: 0,
    peakWaterDepth: 0,
    flowingWaterTiles: 0,
    reservoirStorage: 0,
    floodBarrierCount: 0,
    activeEvents: [],
    eventsData: [],
    completedMissions: [],
    unlockedAchievements: [],
    landValueAverage: 30,
    suitabilityAverage: 50,
    pollutionAverage: 0,
    noiseAverage: 0,
    educationLevel: 0,
    healthIndex: 50,
    buildingLevelCounts: { residential: [0, 0, 0, 0, 0], commercial: [0, 0, 0, 0, 0], industrial: [0, 0, 0, 0, 0] },
    unlockedRegions: ['1,1'],
    demographics: initialCitizenSim.demographics,
    activeTrips: [],
    citizenState: serializeCitizenSimulation(initialCitizenSim),
    regions: {},
    activeRegionKeys: ['1,1'],
    commandQueue: [],
    recentSimulationEvents: [],
    simulationPhase: 'HISTORY',
    tradeContracts: [],
    recoveryProjects: [],
    causalDiagnostics: [],
    municipalDebt: 0,
    capitalBudget: startingMoney,
    operatingBudget: 0,
    specialization: 'BALANCED',
    scenarioCompleted: false,
    scenarioObjectiveValues: {},
  };
}

export function getBuildCost(type: TileType): number {
  return BUILD_COSTS[type] ?? 0;
}
