import { TileData } from '../types';
import { RoadGraph } from '../traffic';
import { SeededRandom } from './prng';
import {
  Citizen,
  Household,
  WorkplaceFacility,
  SchoolFacility,
  DemographicBreakdown,
  CitizenSimulationState,
  SerializedCitizenSimulationState,
  EducationLevel,
  AgeStage,
  Trip,
} from './types';
import { createCitizen, createHousehold } from './migration';
import { syncSchoolFacilitiesAndEnrollment } from './schools';
import { syncWorkplaceFacilities, matchCitizensToWorkplaces } from './jobMatching';
import { simulateDemographicMigration } from './migration';
import { evaluateHouseholdSatisfaction } from './satisfaction';
import { generateCitizenTrips, applyTripTrafficToRoads } from './trips';
import { TransitAvailability } from '../transit';
import type { FreightTrip } from '../logistics';

export function createInitialDemographics(): DemographicBreakdown {
  return {
    totalCitizens: 0,
    totalHouseholds: 0,
    ageDistribution: {
      children: 0,
      students: 0,
      adults: 0,
      seniors: 0,
    },
    educationDistribution: {
      uneducated: 0,
      highSchool: 0,
      university: 0,
    },
    workforce: {
      totalJobSlots: 0,
      filledJobs: 0,
      vacantJobs: 0,
      unemployedCitizens: 0,
      employable: 0,
      employed: 0,
      unemployed: 0,
      totalEmployable: 0,
      totalEmployed: 0,
      totalUnemployed: 0,
      unemploymentRate: 0,
      averageSalary: 0,
    },
    householdStats: {
      averageSatisfaction: 50,
      averageRent: 0,
      averageSavings: 0,
      homelessHouseholds: 0,
    },
    tripStats: {
      totalTrips: 0,
      averageCommuteTime: 0,
      carTrips: 0,
      transitTrips: 0,
      bikeTrips: 0,
      walkTrips: 0,
    },
    migration: {
      immigrants: 0,
      emigrants: 0,
      relocations: 0,
      netMigration: 0,
    },
  };
}

export function createInitialCitizenSimulationState(seed = 2088): CitizenSimulationState {
  return {
    seed,
    nextCitizenId: 1,
    nextHouseholdId: 1,
    citizens: new Map<string, Citizen>(),
    households: new Map<string, Household>(),
    workplaces: new Map<string, WorkplaceFacility>(),
    schools: new Map<string, SchoolFacility>(),
    activeTrips: [],
    demographics: createInitialDemographics(),
    samplingFactor: 1,
    populationScale: 1,
    representedPopulation: 0,
  };
}

/**
 * Creates a deterministic sampled citizen population from the population already
 * stored on residential tiles. This is intentionally separate from the normal
 * empty-city constructor so regular games keep their existing migration flow,
 * while benchmarks and large-city fixtures can exercise real citizen logic.
 */
export function seedCitizenSimulationFromGrid(
  grid: TileData[][],
  seed = 2088,
  populationScale = 1,
): CitizenSimulationState {
  const scale = Math.max(1, Math.floor(populationScale));
  const state = createInitialCitizenSimulationState(seed);
  state.populationScale = scale;
  state.representedPopulation = grid.flat().reduce((sum, tile) => sum + (tile.type === 'RESIDENTIAL' ? Math.max(0, tile.population ?? 0) : 0), 0);
  const prng = new SeededRandom((seed ^ 0x6d2b79f5) >>> 0);

  const residentialTiles = grid.flat().filter((tile) => tile.type === 'RESIDENTIAL' && (tile.population ?? 0) > 0);
  const targetAgents = Math.min(
    state.representedPopulation,
    Math.max(1, Math.ceil(state.representedPopulation / scale)),
  );
  const agentCounts = new Map<string, number>();
  let assignedAgents = 0;
  const remainders = residentialTiles.map((tile) => {
    const exact = state.representedPopulation > 0
      ? (Math.max(0, tile.population ?? 0) / state.representedPopulation) * targetAgents
      : 0;
    const base = Math.floor(exact);
    agentCounts.set(`${tile.x},${tile.y}`, base);
    assignedAgents += base;
    return { tile, remainder: exact - base };
  });
  remainders.sort((a, b) => (b.remainder - a.remainder) || (a.tile.y - b.tile.y) || (a.tile.x - b.tile.x));
  for (let index = 0; index < targetAgents - assignedAgents; index += 1) {
    const entry = remainders[index % Math.max(1, remainders.length)];
    if (entry) agentCounts.set(`${entry.tile.x},${entry.tile.y}`, (agentCounts.get(`${entry.tile.x},${entry.tile.y}`) ?? 0) + 1);
  }

  for (const tile of residentialTiles) {
      const tileAgentCount = agentCounts.get(`${tile.x},${tile.y}`) ?? 0;
      if (tileAgentCount <= 0) continue;

      let remainingAgents = tileAgentCount;
      while (remainingAgents > 0) {
        const householdSize = Math.min(remainingAgents, prng.nextInt(1, Math.min(4, remainingAgents)));
        const householdId = `household-${state.nextHouseholdId++}`;
        const residence = { x: tile.x, y: tile.y };
        const citizens: Citizen[] = [];

        for (let index = 0; index < householdSize; index += 1) {
          const isChild = householdSize >= 3 && index >= 2;
          const age = isChild ? prng.nextInt(5, 16) : prng.nextInt(22, 58);
          const education = isChild
            ? EducationLevel.UNEDUCATED
            : prng.nextInt(0, 2) as EducationLevel;
          citizens.push(createCitizen(
            `citizen-${state.nextCitizenId++}`,
            householdId,
            residence,
            age,
            education,
            prng,
          ));
        }

        const householdType = householdSize >= 3
          ? 'FAMILY'
          : householdSize === 2
            ? 'COUPLE'
            : 'SINGLE';
        const household = createHousehold(
          householdId,
          residence,
          Math.max(1, Math.round((tile.rent ?? 10) * scale)),
          citizens,
          Math.max(200, Math.round(350 * scale)),
          householdType,
          householdType === 'FAMILY' ? 'LOW' : householdType === 'SINGLE' ? 'HIGH' : 'MEDIUM',
        );
        for (const citizen of citizens) state.citizens.set(citizen.id, citizen);
        state.households.set(household.id, household);
        remainingAgents -= householdSize;
      }
  }

  return state;
}

export function serializeCitizenSimulation(state: CitizenSimulationState): SerializedCitizenSimulationState {
  return {
    seed: state.seed,
    nextCitizenId: state.nextCitizenId,
    nextHouseholdId: state.nextHouseholdId,
    citizens: Array.from(state.citizens.values()),
    households: Array.from(state.households.values()),
    workplaces: Array.from(state.workplaces.values()),
    schools: Array.from(state.schools.values()),
    activeTrips: state.activeTrips ?? [],
    demographics: state.demographics,
    samplingFactor: state.samplingFactor ?? 1,
    populationScale: state.populationScale ?? 1,
    representedPopulation: state.representedPopulation ?? 0,
  };
}

export function hydrateCitizenSimulation(
  serialized?: SerializedCitizenSimulationState | null,
  defaultSeed = 2088,
): CitizenSimulationState {
  if (!serialized) {
    return createInitialCitizenSimulationState(defaultSeed);
  }

  const citizens = new Map<string, Citizen>();
  for (const c of serialized.citizens || []) {
    citizens.set(c.id, {
      ...c,
      residence: c.residence || { x: 0, y: 0 },
    });
  }

  const households = new Map<string, Household>();
  for (const h of serialized.households || []) {
    households.set(h.id, {
      ...h,
      residence: h.residence || { x: 0, y: 0 },
    });
  }

  const workplaces = new Map<string, WorkplaceFacility>();
  for (const w of serialized.workplaces || []) {
    const key = `${w.tileX},${w.tileY}`;
    workplaces.set(key, w);
  }

  const schools = new Map<string, SchoolFacility>();
  for (const s of serialized.schools || []) {
    const key = `${s.tileX},${s.tileY}`;
    schools.set(key, s);
  }

  return {
    seed: serialized.seed ?? defaultSeed,
    nextCitizenId: serialized.nextCitizenId ?? (citizens.size + 1),
    nextHouseholdId: serialized.nextHouseholdId ?? (households.size + 1),
    citizens,
    households,
    workplaces,
    schools,
    activeTrips: serialized.activeTrips || [],
    demographics: serialized.demographics || createInitialDemographics(),
    samplingFactor: serialized.samplingFactor ?? 1,
    populationScale: Math.max(1, serialized.populationScale ?? 1),
    representedPopulation: Math.max(0, serialized.representedPopulation ?? 0),
  };
}

/**
 * Pure stateful simulation step for citizen demographics, workplaces, schools, and trips.
 */
export function simulateCitizenTick(
  state: CitizenSimulationState,
  grid: TileData[][],
  roadGraph: RoadGraph,
  day: number,
  desirability: number,
  residentialDemand: number,
  residentialTaxRate: number,
  unlockedUpgrades: string[] = [],
  transitAvailability?: TransitAvailability,
  freightTrips: FreightTrip[] = [],
  allowMigration = true,
): {
  state: CitizenSimulationState;
  demographics: DemographicBreakdown;
  trafficAverage: number;
  congestionIndex: number;
  averageQueuePressure: number;
  averageCommuteTime: number;
} {
  const prng = new SeededRandom((state.seed ^ (day * 0x45d9f3b)) >>> 0);

  const { citizens, households, workplaces, schools } = state;
  const counters = {
    nextCitizenId: state.nextCitizenId,
    nextHouseholdId: state.nextHouseholdId,
  };

  // 1. Sync Schools & Student Enrollment
  syncSchoolFacilitiesAndEnrollment(grid, schools, citizens, prng);

  // 2. Sync Workplaces & Job Positions
  syncWorkplaceFacilities(grid, workplaces, citizens, prng);

  // 3. Demographic Migration (In-migration, Out-migration, Internal Relocation)
  const migration = allowMigration
    ? simulateDemographicMigration(
      grid,
      citizens,
      households,
      desirability,
      residentialDemand,
      residentialTaxRate,
      unlockedUpgrades,
      prng,
      counters,
      state.populationScale,
    )
    : {
      immigrants: 0,
      emigrants: 0,
      relocations: 0,
      netMigration: 0,
    };

  // 4. Job Matching & Unemployment
  const workforce = matchCitizensToWorkplaces(citizens, workplaces, prng);

  // 5. Household Satisfaction & Rent Evaluation
  let totalSatisfaction = 0;
  let totalRent = 0;
  let totalSavings = 0;
  let validHouseholdsCount = 0;

  for (const household of households.values()) {
    const { satisfaction, factors } = evaluateHouseholdSatisfaction(household, citizens, grid);
    household.satisfaction = satisfaction;
    household.satisfactionFactors = factors;
    totalSatisfaction += satisfaction;
    totalRent += household.rent;
    totalSavings += household.savings;
    validHouseholdsCount++;
  }

  const averageSatisfaction = validHouseholdsCount > 0 ? Math.round(totalSatisfaction / validHouseholdsCount) : 50;
  const averageRent = validHouseholdsCount > 0 ? Math.round(totalRent / validHouseholdsCount) : 0;
  const averageSavings = validHouseholdsCount > 0 ? Math.round(totalSavings / validHouseholdsCount) : 0;

  // 6. Generate Real Trips
  const { trips, averageCommuteTime, modeCounts } = generateCitizenTrips(
    citizens,
    households,
    grid,
    roadGraph,
    unlockedUpgrades,
    prng,
    state.samplingFactor,
    transitAvailability,
  );
  state.activeTrips = trips;

  // 7. Apply Real Trips to Road Traffic
  const { trafficAverage, congestionIndex, averageQueuePressure } = applyTripTrafficToRoads(
    grid,
    roadGraph,
    trips,
    unlockedUpgrades,
    state.samplingFactor,
    freightTrips,
  );

  // 8. Compile Comprehensive Demographic Breakdown
  let children = 0;
  let students = 0;
  let adults = 0;
  let seniors = 0;

  let uneducated = 0;
  let highSchool = 0;
  let university = 0;

  for (const citizen of citizens.values()) {
    if (citizen.stage === AgeStage.CHILD) children++;
    else if (citizen.stage === AgeStage.STUDENT) students++;
    else if (citizen.stage === AgeStage.ADULT) adults++;
    else if (citizen.stage === AgeStage.SENIOR) seniors++;

    if (citizen.education === EducationLevel.UNEDUCATED) uneducated++;
    else if (citizen.education === EducationLevel.HIGH_SCHOOL) highSchool++;
    else if (citizen.education === EducationLevel.UNIVERSITY) university++;
  }

  const totalCitizens = citizens.size;
  const representedCitizens = grid.flat().reduce((sum, tile) => sum + (tile.type === 'RESIDENTIAL' ? Math.max(0, tile.population ?? 0) : 0), 0);
  state.representedPopulation = representedCitizens;
  const representedHouseholds = Math.round(representedCitizens / 2.2);

  state.demographics = {
    totalCitizens,
    representedCitizens,
    totalHouseholds: households.size,
    representedHouseholds,
    ageDistribution: { children, students, adults, seniors },
    educationDistribution: { uneducated, highSchool, university },
    workforce,
    householdStats: {
      averageSatisfaction,
      averageRent,
      averageSavings,
      homelessHouseholds: 0,
    },
    tripStats: {
      totalTrips: trips.length,
      averageCommuteTime,
      carTrips: modeCounts.car,
      transitTrips: modeCounts.transit,
      bikeTrips: modeCounts.bike,
      walkTrips: modeCounts.walk,
    },
    migration,
  };

  state.nextCitizenId = counters.nextCitizenId;
  state.nextHouseholdId = counters.nextHouseholdId;

  return {
    state,
    demographics: state.demographics,
    trafficAverage,
    congestionIndex,
    averageQueuePressure,
    averageCommuteTime,
  };
}

export class CitizenManager {
  private state: CitizenSimulationState;

  constructor(citySeed = 2088, initialState?: CitizenSimulationState) {
    this.state = initialState || createInitialCitizenSimulationState(citySeed);
  }

  public reset(citySeed = 2088): void {
    this.state = createInitialCitizenSimulationState(citySeed);
  }

  public getState(): CitizenSimulationState {
    return this.state;
  }

  public setState(newState: CitizenSimulationState): void {
    this.state = newState;
  }

  public getCitizens(): Map<string, Citizen> {
    return this.state.citizens;
  }

  public getHouseholds(): Map<string, Household> {
    return this.state.households;
  }

  public getDemographics(): DemographicBreakdown {
    return this.state.demographics;
  }

  public getActiveTrips(): Trip[] {
    return this.state.activeTrips;
  }

  public simulateTick(
    grid: TileData[][],
    roadGraph: RoadGraph,
    day: number,
    desirability: number,
    residentialDemand: number,
    residentialTaxRate: number,
    unlockedUpgrades: string[] = [],
    transitAvailability?: TransitAvailability,
  ): {
    demographics: DemographicBreakdown;
    trafficAverage: number;
    congestionIndex: number;
    averageQueuePressure: number;
    averageCommuteTime: number;
  } {
    const result = simulateCitizenTick(
      this.state,
      grid,
      roadGraph,
      day,
      desirability,
      residentialDemand,
      residentialTaxRate,
      unlockedUpgrades,
      transitAvailability,
    );
    this.state = result.state;
    return {
      demographics: result.demographics,
      trafficAverage: result.trafficAverage,
      congestionIndex: result.congestionIndex,
      averageQueuePressure: result.averageQueuePressure,
      averageCommuteTime: result.averageCommuteTime,
    };
  }
}
