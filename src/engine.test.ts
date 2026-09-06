import { describe, it, expect } from 'vitest';
import { TileType, CityState } from './types';
import { 
  createEmptyGrid, 
  allocateUtilities, 
  calculateDemandsAndDesirability, 
  simulatePopulation, 
  calculateEconomy, 
  simulateTick,
  unlockRegion,
  createInitialCityState
} from './engine';
import { buildRoadGraph } from './traffic';
import { simulateCityServices, simulateUtilityNetworks } from './services';
import { canUnlockRegion, isTileInUnlockedRegion, getRegionUnlockCost } from './mapGenerator';
import { createStarterGrid } from './starterCity';
import { saveGame, loadGame, importSaveJson, CURRENT_SAVE_VERSION } from './saveSystem';
import { 
  createInitialCitizenSimulationState, 
  serializeCitizenSimulation, 
  createCitizen, 
  createHousehold, 
  EducationLevel,
  SeededRandom 
} from './citizenSimulation';

function createMockCityState(overrides: Partial<CityState> = {}): CityState {
  const grid = createEmptyGrid();
  const initCitizenSim = createInitialCitizenSimulationState(2088);
  return {
    grid,
    money: 10000,
    population: 0,
    day: 1,
    seed: 2088,
    powerCapacity: 50,
    powerDemand: 10,
    waterCapacity: 50,
    waterDemand: 10,
    trafficAverage: 0,
    averageCommuteTime: 0,
    congestionIndex: 0,
    income: 0,
    expenses: 0,
    unlockedUpgrades: [],
    households: 0,
    workers: 0,
    employment: 0,
    unemploymentRate: 0,
    availableJobs: 15,
    totalJobSlots: 0,
    filledJobs: 0,
    vacantJobs: 0,
    unemployedCitizens: 0,
    residentialDemand: 0,
    commercialDemand: 0,
    industrialDemand: 0,
    desirability: 50,
    residentialTaxRate: 9,
    commercialTaxRate: 9,
    industrialTaxRate: 9,
    history: [],
    happiness: 65,
    healthcareCoverage: 80,
    educationCoverage: 75,
    fireSafety: 90,
    crimeRate: 15,
    wasteCapacity: 200,
    wasteProduction: 20,
    wasteCoverage: 100,
    milestoneLevel: 0,
    activePolicies: [],
    activeEvents: [],
    eventsData: [],
    completedMissions: [],
    unlockedAchievements: [],
    landValueAverage: 35,
    pollutionAverage: 0,
    noiseAverage: 0,
    educationLevel: 0,
    healthIndex: 50,
    buildingLevelCounts: {
      residential: [0, 0, 0, 0, 0],
      commercial: [0, 0, 0, 0, 0],
      industrial: [0, 0, 0, 0, 0],
    },
    unlockedRegions: ['1,1'],
    demographics: initCitizenSim.demographics,
    citizenState: serializeCitizenSimulation(initCitizenSim),
    activeTrips: [],
    ...overrides,
  };
}

describe('Skyline Simulator Engine 2.0 Subsystems (Phase 1)', () => {

  it('does not mutate input state and replays deterministically from the same snapshot', () => {
    const input = createMockCityState();
    input.grid[0][0].type = TileType.ROAD;
    input.grid[0][1].type = TileType.RESIDENTIAL;
    input.grid[0][1].population = 8;
    input.transitLines = [{
      id: 'line-test', name: 'Test', mode: 'BUS', stops: [[0, 0], [0, 1]], frequency: 8, active: true,
    }];
    const before = structuredClone(input);

    const first = simulateTick(input);
    const replay = simulateTick(structuredClone(before));

    expect(input).toEqual(before);
    expect(first).toEqual(replay);
  });

  it('should create starter jobs and taxable activity during the first city tick', () => {
    const next = simulateTick(createInitialCityState(createStarterGrid(), 2088, 'normal'));
    const jobs = next.grid.flat()
      .filter((tile) => tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL)
      .reduce((sum, tile) => sum + (tile.jobs || 0), 0);

    expect(jobs).toBeGreaterThan(0);
    expect(next.income).toBeGreaterThan(0);
  });
  
  it('should allocate power and water strictly through connected network infrastructure', () => {
    const grid = createEmptyGrid();
    
    // Connected Network A: Power Plant at (0,0), connected Road at (0,1), Residential at (0,2)
    grid[0][0].type = TileType.POWER_PLANT;
    grid[0][1].type = TileType.ROAD;
    grid[0][2].type = TileType.RESIDENTIAL;

    // Connected Network B: Water Pump at (2,0), connected Road at (2,1), Residential at (2,2)
    grid[2][0].type = TileType.WATER_PUMP;
    grid[2][1].type = TileType.ROAD;
    grid[2][2].type = TileType.RESIDENTIAL;

    // Disconnected Isolated Residential at (5,5) with no generator or pump connected
    grid[5][5].type = TileType.RESIDENTIAL;
    
    const { powerCapacity, waterCapacity } = allocateUtilities(grid, []);
    
    expect(powerCapacity).toBe(50);
    expect(waterCapacity).toBe(50);
    
    // Network A residential has power, but no water
    expect(grid[0][2].powered).toBe(true);
    expect(grid[0][2].watered).toBe(false);

    // Network B residential has water, but no power
    expect(grid[2][2].watered).toBe(true);
    expect(grid[2][2].powered).toBe(false);

    // Isolated residential has neither power nor water
    expect(grid[5][5].powered).toBe(false);
    expect(grid[5][5].watered).toBe(false);
  });

  it('should not count isolated power plants or pumps as usable city capacity', () => {
    const grid = createEmptyGrid();
    grid[2][2].type = TileType.POWER_PLANT;
    grid[4][4].type = TileType.WATER_PUMP;

    const result = allocateUtilities(grid, []);

    expect(result.powerCapacity).toBe(0);
    expect(result.waterCapacity).toBe(0);
  });

  it('should include a road-connected warehouse in utility allocation', () => {
    const grid = createEmptyGrid();
    grid[0][0].type = TileType.POWER_PLANT;
    grid[0][1].type = TileType.ROAD;
    grid[0][2].type = TileType.WAREHOUSE;

    const result = allocateUtilities(grid, []);

    expect(result.powerDemand).toBeGreaterThanOrEqual(1);
    expect(grid[0][2].powered).toBe(true);
  });

  it('should apply event utility multipliers directly to tile-level power and water distribution', () => {
    const grid = createEmptyGrid();
    grid[0][0].type = TileType.POWER_PLANT; // 50 power
    grid[0][1].type = TileType.ROAD;
    
    // 40 residential tiles connected to road (each takes 1 unit of power normally)
    for (let i = 2; i < 42; i++) {
      grid[0][i].type = TileType.ROAD;
      grid[1][i].type = TileType.RESIDENTIAL;
    }

    // Normal allocation: 40 demand <= 50 capacity -> all powered
    const normal = simulateUtilityNetworks(grid, [], 1.0, 1.0);
    expect(normal.powerDemand).toBe(40);
    expect(grid[1][40].powered).toBe(true);

    // Heatwave allocation with 1.5x multiplier: each tile rounds to 2 units -> 40 * 2 = 80 demand > 50 capacity -> overload, last tiles lose power
    const heatwave = simulateUtilityNetworks(grid, [], 1.5, 1.5);
    expect(heatwave.powerDemand).toBe(80);
    expect(heatwave.overloadedPowerGrids).toBeGreaterThan(0);
    expect(grid[1][40].powered).toBe(false);
  });

  it('should calculate desirability and zoning demands correctly with taxes and services', () => {
    const state = createMockCityState();

    const { desirability, residentialDemand } = calculateDemandsAndDesirability(
      state.grid,
      state,
      50, 10, 50, 10
    );

    expect(desirability).toBeGreaterThanOrEqual(50); 
    expect(residentialDemand).toBeGreaterThanOrEqual(-100);
  });

  it('should penalize residential demand when tax rates are excessively high', () => {
    const state = createMockCityState({ residentialTaxRate: 20 });

    const { residentialDemand } = calculateDemandsAndDesirability(
      state.grid,
      state,
      50, 10, 50, 10
    );

    // Demand should be penalized and pushed to very low levels
    expect(residentialDemand).toBeLessThan(0);
  });

  it('should simulate city services coverage along connected road networks', () => {
    const grid = createEmptyGrid();
    
    // Connected road from (1,0) to (5,0)
    for (let x = 1; x <= 5; x++) {
      grid[0][x].type = TileType.ROAD;
    }

    // Power plant connected to road
    grid[0][0].type = TileType.POWER_PLANT;

    // Clinic placed next to road at (1,1)
    grid[1][1].type = TileType.CLINIC;
    grid[1][1].powered = true;

    // Fire Station placed next to road at (2,1)
    grid[1][2].type = TileType.FIRE_STATION;
    grid[1][2].powered = true;

    // Residential building next to road at (5,1)
    grid[1][5].type = TileType.RESIDENTIAL;
    grid[1][5].population = 10;
    grid[1][5].powered = true;
    grid[1][5].watered = true;

    const roadGraph = buildRoadGraph(grid, []);
    const servicesResult = simulateCityServices(grid, roadGraph, 10, 5, 60, 2, 9, []);

    expect(grid[1][5].healthCovered).toBe(true);
    expect(grid[1][5].fireCovered).toBe(true);
    expect(servicesResult.healthcareCoverage).toBe(100);
    expect(servicesResult.fireSafety).toBe(100);
    expect(servicesResult.happiness).toBeGreaterThan(50);
  });

  it('should cap healthcare coverage by facility capacity instead of radius alone', () => {
    const grid = createEmptyGrid();
    for (let x = 0; x <= 4; x++) grid[0][x].type = TileType.ROAD;
    grid[0][0].type = TileType.CLINIC;
    grid[0][0].powered = true;
    grid[1][1].type = TileType.RESIDENTIAL;
    grid[1][1].population = 300;
    grid[1][1].powered = true;
    grid[1][1].watered = true;

    const result = simulateCityServices(grid, buildRoadGraph(grid), 300, 100, 60, 2, 9, []);

    expect(grid[1][1].healthCovered).toBe(true);
    expect(result.healthcareCapacity).toBe(140);
    expect(result.healthcareCoverage).toBe(47);
  });

  it('should reduce effective emergency capacity when reachable roads are congested', () => {
    const grid = createEmptyGrid();
    for (let x = 1; x <= 4; x += 1) {
      grid[0][x].type = TileType.ROAD;
      grid[0][x].traffic = 100;
    }
    grid[0][0].type = TileType.CLINIC;
    grid[0][0].powered = true;
    grid[1][1].type = TileType.RESIDENTIAL;
    grid[1][1].population = 100;
    grid[1][1].powered = true;
    grid[1][1].watered = true;

    const result = simulateCityServices(grid, buildRoadGraph(grid), 100, 50, 60, 2, 9, []);

    expect(result.serviceResponseQuality).toBeLessThan(60);
    expect(result.healthcareCapacity).toBeLessThan(140);
    expect(result.healthcareCoverage).toBeLessThan(100);
  });

  it('should expose market utilization differences between scarcity and oversupply', () => {
    const scarceGrid = createEmptyGrid();
    scarceGrid[0][0].type = TileType.COMMERCIAL;
    scarceGrid[0][0].jobs = 10;
    scarceGrid[0][1].type = TileType.INDUSTRIAL;
    scarceGrid[0][1].jobs = 10;
    const oversuppliedGrid = createEmptyGrid();
    oversuppliedGrid[0][0].type = TileType.COMMERCIAL;
    oversuppliedGrid[0][0].jobs = 100;
    oversuppliedGrid[0][1].type = TileType.INDUSTRIAL;
    oversuppliedGrid[0][1].jobs = 100;

    const scarce = calculateEconomy(scarceGrid, 100, 50, 60, 20);
    const oversupplied = calculateEconomy(oversuppliedGrid, 100, 50, 60, 200);

    expect(scarce.commercialUtilization).toBeGreaterThan(oversupplied.commercialUtilization);
    expect(scarce.industrialUtilization).toBeGreaterThan(oversupplied.industrialUtilization);
    expect(scarce.marketHealth).toBeGreaterThan(oversupplied.marketHealth);
  });

  it('should cause abandonment when utilities or road access are missing', () => {
    const grid = createEmptyGrid();
    grid[1][0].type = TileType.ROAD; 
    grid[1][1].type = TileType.RESIDENTIAL;
    grid[1][1].powered = false; // missing power
    grid[1][1].watered = true;
    grid[1][1].population = 1;

    // Run tick - population drops to 0
    const { totalPop } = simulatePopulation(grid, 50, 50, 50, []);
    expect(totalPop).toBe(0);
    expect(grid[1][1].abandoned).toBe(true);
  });

  it('should drive industrial growth using industrialDemand and not commercialDemand', () => {
    const grid = createEmptyGrid();
    grid[1][0].type = TileType.ROAD;
    grid[1][1].type = TileType.INDUSTRIAL;
    grid[1][1].powered = true;
    grid[1][1].watered = true;
    grid[1][1].jobs = 0;

    // Positive industrial demand with negative commercial demand should still grow industry
    const popResult = simulatePopulation(grid, 0, -50, 40, []);
    expect(grid[1][1].jobs).toBeGreaterThan(0);
    expect(popResult.totalJobs).toBeGreaterThan(0);
  });

  it('should calculate economy breakdown correctly with services maintenance', () => {
    const grid = createEmptyGrid();
    grid[0][0].type = TileType.ROAD;
    grid[0][1].type = TileType.FIRE_STATION;
    grid[0][2].type = TileType.POLICE_STATION;
    grid[0][3].type = TileType.CLINIC;

    const { expenses, serviceMaint } = calculateEconomy(
      grid,
      0, 0, 0, 0, [], 9, 9, 9
    );

    expect(serviceMaint).toBeGreaterThan(0);
    expect(expenses).toBeGreaterThan(0);
  });

  it('should preserve achieved milestone levels monotonically even if funds drop', () => {
    const state = createMockCityState({
      milestoneLevel: 3,
      money: 100, // Very low funds, below milestone 3 requirement ($25,000)
      population: 300,
    });

    const next = simulateTick(state);
    expect(next.milestoneLevel).toBeGreaterThanOrEqual(3);
  });

  it('should apply traffic density settings to citizen trip sampling', () => {
    const state = createMockCityState();

    const low = simulateTick(state, { trafficDensity: 'low' });
    const high = simulateTick(state, { trafficDensity: 'high' });

    expect(low.citizenState?.samplingFactor).toBe(0.5);
    expect(high.citizenState?.samplingFactor).toBe(1.5);
  });

  it('should correctly validate region lock, cost, and adjacent expansions', () => {
    const unlocked = ['1,1'];
    
    // (1,2) is adjacent South of (1,1) -> valid
    const canSouth = canUnlockRegion(1, 2, unlocked, 10000);
    expect(canSouth.canUnlock).toBe(true);
    expect(canSouth.cost).toBe(getRegionUnlockCost(1));

    // (0,0) is diagonal and not cardinally adjacent -> invalid
    const canCorner = canUnlockRegion(0, 0, unlocked, 10000);
    expect(canCorner.canUnlock).toBe(false);

    // Out of bounds (3,3) -> invalid
    const canOOB = canUnlockRegion(3, 3, unlocked, 10000);
    expect(canOOB.canUnlock).toBe(false);

    // Insufficient funds
    const canBroke = canUnlockRegion(1, 0, unlocked, 100);
    expect(canBroke.canUnlock).toBe(false);

    // Executing unlockRegion
    const initialState = createMockCityState({ money: 10000, unlockedRegions: ['1,1'] });
    const unlockRes = unlockRegion(initialState, 1, 2);
    expect(unlockRes.success).toBe(true);
    expect(unlockRes.newState.unlockedRegions).toContain('1,2');
    expect(unlockRes.newState.money).toBeLessThan(10000);

    // Checking tile unlocked helper
    expect(isTileInUnlockedRegion(25, 45, unlockRes.newState.unlockedRegions)).toBe(true); // region (1,2)
    expect(isTileInUnlockedRegion(5, 5, unlockRes.newState.unlockedRegions)).toBe(false); // region (0,0)
  });

  it('should preserve citizenState, road hierarchy, parcel, hydrology, disaster, dispatch, and metrics in save and load operations (Version 10)', () => {
    const prng = new SeededRandom(5555);
    const simState = createInitialCitizenSimulationState(5555);
    const c1 = createCitizen('citizen-1', 'household-1', { x: 2, y: 2 }, 30, EducationLevel.UNIVERSITY, prng);
    simState.citizens.set(c1.id, c1);
    const h1 = createHousehold('household-1', { x: 2, y: 2 }, 20, [c1], 350);
    simState.households.set(h1.id, h1);

    const state = createMockCityState({
      unlockedRegions: ['1,1', '1,2'],
      population: 1,
      citizenState: serializeCitizenSimulation(simState),
    });
    state.grid[0][0].type = TileType.ROAD;
    state.grid[0][0].roadClass = 'ARTERIAL';
    state.grid[0][0].roadStructure = 'TUNNEL';
    state.grid[0][0].roadCondition = 47;
    state.grid[0][0].disasterImpact = 22;
    state.grid[0][1].type = TileType.WATER_RESERVOIR;
    state.grid[0][1].reservoirLevel = 0.65;
    state.grid[0][2].type = TileType.FLOOD_BARRIER;
    state.grid[0][3].type = TileType.COMMERCIAL;
    state.grid[0][3].mixedUseProgram = 'CREATIVE_OFFICE';
    state.grid[0][3].mixedUseFloorCount = 7;
    state.grid[0][3].mixedUseRetailFloors = 1;
    state.grid[0][3].mixedUseOfficeFloors = 2;
    state.grid[0][3].mixedUseResidentialFloors = 4;
    state.incidentDispatchedUnits = 2;
    state.incidentQueuedUnits = 1;
    state.disasterRecoveryRate = 3;
    state.serviceDepotCondition = { '1,2': 87.5 };
    state.serviceFleetMaintenanceCost = 3.1;

    const saved = saveGame('test_save_v3', state, 'Test Metropolis');
    expect(saved).toBe(true);

    const loaded = loadGame('test_save_v3');
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded?.gameState.unlockedRegions).toEqual(['1,1', '1,2']);
    expect(loaded?.gameState.citizenState?.citizens.length).toBe(1);
    expect(loaded?.gameState.citizenState?.citizens[0].residence).toEqual({ x: 2, y: 2 });
    expect(loaded?.gameState.grid[0][0].roadClass).toBe('ARTERIAL');
    expect(loaded?.gameState.grid[0][0].roadStructure).toBe('TUNNEL');
    expect(loaded?.gameState.grid[0][0].roadCondition).toBe(47);
    expect(loaded?.gameState.grid[0][0].disasterImpact).toBe(22);
    expect(loaded?.gameState.grid[0][1].type).toBe(TileType.WATER_RESERVOIR);
    expect(loaded?.gameState.grid[0][1].reservoirLevel).toBe(0.65);
    expect(loaded?.gameState.grid[0][2].type).toBe(TileType.FLOOD_BARRIER);
    expect(loaded?.gameState.grid[0][3].mixedUseProgram).toBe('CREATIVE_OFFICE');
    expect(loaded?.gameState.grid[0][3].mixedUseFloorCount).toBe(7);
    expect(loaded?.gameState.grid[0][3].mixedUseOfficeFloors).toBe(2);
    expect(loaded?.gameState.incidentDispatchedUnits).toBe(2);
    expect(loaded?.gameState.incidentQueuedUnits).toBe(1);
    expect(loaded?.gameState.disasterRecoveryRate).toBe(3);
    expect(loaded?.gameState.serviceDepotCondition).toEqual({ '1,2': 87.5 });
    expect(loaded?.gameState.serviceFleetMaintenanceCost).toBe(3.1);
  });

  it('should migrate legacy Version 1 and Version 2 save files safely without data corruption', () => {
    const legacyState = createMockCityState();
    delete (legacyState as any).citizenState;
    legacyState.grid[1][1].type = TileType.RESIDENTIAL;
    legacyState.grid[1][1].population = 3;

    // Simulate saving as Version 2 via importSaveJson
    const v2SaveJson = JSON.stringify({
      version: 2,
      id: 'legacy_slot',
      cityName: 'Old City',
      timestamp: Date.now(),
      gameState: legacyState,
    });

    importSaveJson('legacy_slot', v2SaveJson);

    const loaded = loadGame('legacy_slot');
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded?.gameState.citizenState).toBeDefined();
    expect(loaded?.gameState.citizenState?.citizens.length).toBe(3);
  });

  it('should advance and decay active city events deterministically without flaky random triggers', () => {
    const state = createMockCityState({
      eventsData: [{
        id: 'test_heatwave',
        name: 'Tropical Heatwave',
        description: 'High heat surge',
        durationDays: 3,
        remainingDays: 2,
        type: 'HEATWAVE',
        powerDemandMultiplier: 1.5,
        waterDemandMultiplier: 1.5,
      }],
      activeEvents: ['Tropical Heatwave'],
    });

    const tick1 = simulateTick(state);
    expect(tick1.eventsData?.[0]?.remainingDays).toBe(1);

    const tick2 = simulateTick(tick1);
    expect(tick2.eventsData?.length).toBe(0);
    expect(tick2.activeEvents?.length).toBe(0);
  });
});
