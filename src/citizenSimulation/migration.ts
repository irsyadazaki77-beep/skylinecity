import { TileData, TileType } from '../types';
import { ZoneDensity, ResidentialHouseholdType } from '../types';
import { RESIDENTIAL_CAPACITIES } from '../depthSimulation';
import { SeededRandom } from './prng';
import { 
  Citizen, 
  Household, 
  EducationLevel, 
  AgeStage, 
  MigrationSummary, 
  HouseholdSatisfactionFactors 
} from './types';
import { calculateTileRent, evaluateHouseholdSatisfaction } from './satisfaction';
import { getResidentialCapacity, getZoneDensity } from '../zoning';

export function createCitizen(
  id: string,
  householdId: string,
  residence: { x: number; y: number },
  age: number,
  education: EducationLevel,
  prng: SeededRandom,
): Citizen {
  let stage: AgeStage = AgeStage.ADULT;
  if (age < 18) {
    stage = AgeStage.CHILD;
  } else if (age <= 24) {
    stage = AgeStage.STUDENT;
  } else if (age >= 65) {
    stage = AgeStage.SENIOR;
  }

  return {
    id,
    householdId,
    residence,
    age,
    stage,
    education,
    workplace: null,
    school: null,
    health: prng.nextInt(70, 95),
    happiness: prng.nextInt(60, 85),
    commuteTime: 0,
    serviceNeeds: {
      healthcare: stage === AgeStage.SENIOR ? 90 : 40,
      education: stage === AgeStage.CHILD || stage === AgeStage.STUDENT ? 95 : 10,
      leisure: prng.nextInt(40, 80),
      goods: prng.nextInt(30, 70),
    },
  };
}

export function createHousehold(
  id: string,
  residence: { x: number; y: number },
  rent: number,
  citizens: Citizen[],
  savings = 250,
  householdType: ResidentialHouseholdType = 'SINGLE',
  preferredDensity: ZoneDensity = householdType === 'FAMILY' || householdType === 'SENIOR' ? 'LOW' : householdType === 'SINGLE' ? 'HIGH' : 'MEDIUM',
): Household {
  const citizenIds = citizens.map((c) => {
    c.householdId = id;
    c.residence = { ...residence };
    return c.id;
  });

  const defaultFactors: HouseholdSatisfactionFactors = {
    rentAffordability: 80,
    employment: 70,
    commute: 80,
    crime: 75,
    pollution: 80,
    schoolAccess: 80,
    healthAccess: 80,
    overall: 78,
  };

  return {
    id,
    residence: { ...residence },
    citizenIds,
    savings,
    rent,
    satisfaction: 78,
    satisfactionFactors: defaultFactors,
    relocationTimer: 0,
    householdType,
    preferredDensity,
    incomeClass: savings >= 700 ? 'HIGH' : savings >= 350 ? 'MIDDLE' : 'LOW',
  };
}

/**
 * Finds all residential tiles that have available capacity for new households.
 */
export function getVacantResidentialTiles(
  grid: TileData[][],
  unlockedUpgrades: string[] = [],
  populationScale = 1,
): { tile: TileData; vacancy: number }[] {
  const resMult = unlockedUpgrades.includes('high_dens_res') ? 2 : 1;
  const vacant: { tile: TileData; vacancy: number }[] = [];

  for (const row of grid) {
    for (const tile of row) {
      if (tile.type === TileType.RESIDENTIAL && tile.powered && tile.watered && !tile.abandoned) {
        const capacity = getResidentialCapacity(tile, (RESIDENTIAL_CAPACITIES[Math.min(5, Math.max(1, tile.level))] || 4) * resMult);
        const vacancy = capacity - (tile.population || 0);
        const agentVacancy = Math.floor(vacancy / Math.max(1, populationScale));
        if (agentVacancy > 0) {
          vacant.push({ tile, vacancy: agentVacancy });
        }
      }
    }
  }

  // Prefer genuinely suitable neighborhoods when households choose where to
  // live. Stable coordinate tie-breaking keeps migration deterministic.
  vacant.sort((a, b) => {
    const suitabilityDelta = (b.tile.suitability ?? b.tile.landValue ?? 0) - (a.tile.suitability ?? a.tile.landValue ?? 0);
    return suitabilityDelta || (a.tile.y - b.tile.y) || (a.tile.x - b.tile.x);
  });

  return vacant;
}

/**
 * Simulates in-migration, internal relocation, and out-migration across the city.
 */
export function simulateDemographicMigration(
  grid: TileData[][],
  citizens: Map<string, Citizen>,
  households: Map<string, Household>,
  desirability: number,
  residentialDemand: number,
  residentialTaxRate: number,
  unlockedUpgrades: string[] = [],
  prng: SeededRandom,
  counters: { nextCitizenId: number; nextHouseholdId: number } = { nextCitizenId: 1, nextHouseholdId: 1 },
  populationScale = 1,
): MigrationSummary {
  let immigrants = 0;
  let emigrants = 0;
  let relocations = 0;

  // 1. Process Out-Migration (Emigration)
  const householdEntries = Array.from(households.entries());
  for (const [hId, household] of householdEntries) {
    const { satisfaction } = evaluateHouseholdSatisfaction(household, citizens, grid);
    household.satisfaction = satisfaction;

    // Check financial distress / rent payment
    const members = household.citizenIds.map((id) => citizens.get(id)).filter(Boolean) as Citizen[];
    const totalDailyIncome = members.reduce((sum, m) => sum + (m.workplace?.salary || 0), 0);
    household.savings += (totalDailyIncome - household.rent);

    if (satisfaction < 30 || household.savings < -100) {
      household.relocationTimer++;
    } else {
      household.relocationTimer = Math.max(0, household.relocationTimer - 1);
    }

    // Emigrate if unsatisfied for 3 consecutive days
    if (household.relocationTimer >= 3) {
      // Remove members from tile and simulation
      const tile = grid[household.residence.y]?.[household.residence.x];
      if (tile && tile.type === TileType.RESIDENTIAL) {
        tile.population = Math.max(0, (tile.population || 0) - household.citizenIds.length * Math.max(1, populationScale));
      }

      for (const cId of household.citizenIds) {
        citizens.delete(cId);
      }

      households.delete(hId);
      emigrants += household.citizenIds.length;
      continue;
    }

    // 2. Process Internal Relocation if household is moderately unhappy (satisfaction < 48)
    if (household.relocationTimer >= 1 && satisfaction < 48) {
      const vacancies = getVacantResidentialTiles(grid, unlockedUpgrades, populationScale);
      if (vacancies.length > 0) {
        // Score vacant alternative tiles
        let bestTile: TileData | null = null;
        let bestScore = satisfaction;

        for (const { tile: candidateTile } of vacancies) {
          if (candidateTile.x === household.residence.x && candidateTile.y === household.residence.y) continue;
          const rent = calculateTileRent(candidateTile, residentialTaxRate);
          const densityMatch = household.preferredDensity && household.preferredDensity === getZoneDensity(candidateTile) ? 18 : 0;
          const score = (candidateTile.landValue || 30) + densityMatch - (candidateTile.crime || 0) * 0.4 - (candidateTile.pollution || 0) * 0.5 - rent * 0.5;
          if (score > bestScore + 10) {
            bestScore = score;
            bestTile = candidateTile;
          }
        }

        if (bestTile) {
          const oldTile = grid[household.residence.y]?.[household.residence.x];
          if (oldTile && oldTile.type === TileType.RESIDENTIAL) {
            oldTile.population = Math.max(0, (oldTile.population || 0) - household.citizenIds.length * Math.max(1, populationScale));
          }
          household.residence = { x: bestTile.x, y: bestTile.y };
          household.rent = calculateTileRent(bestTile, residentialTaxRate);
          
          // Update residence for all household members
          for (const cId of household.citizenIds) {
            const citizen = citizens.get(cId);
            if (citizen) {
              citizen.residence = { x: bestTile.x, y: bestTile.y };
            }
          }

          bestTile.population = (bestTile.population || 0) + household.citizenIds.length * Math.max(1, populationScale);
          household.relocationTimer = 0;
          relocations++;
        }
      }
    }
  }

  // 3. Process In-Migration (Immigrants)
  if (desirability > 35 && residentialDemand > -10) {
    const vacancies = getVacantResidentialTiles(grid, unlockedUpgrades, populationScale);
    const maxImmigrants = Math.max(0, Math.ceil((desirability - 35) / 10) + Math.ceil(residentialDemand / 20));

    let spawned = 0;
    for (const { tile, vacancy } of vacancies) {
      if (spawned >= maxImmigrants) break;

      const space = Math.min(vacancy, maxImmigrants - spawned);
      if (space <= 0) continue;

      // Determine household composition
      const roll = prng.next();
      const householdCitizens: Citizen[] = [];
      const resPos = { x: tile.x, y: tile.y };

      // Education profile weighted by city desirability
      const getEdu = (): EducationLevel => {
        const eduRoll = prng.next();
        if (eduRoll < 0.35) return EducationLevel.UNEDUCATED;
        if (eduRoll < 0.80) return EducationLevel.HIGH_SCHOOL;
        return EducationLevel.UNIVERSITY;
      };

      const hId = `household-${counters.nextHouseholdId++}`;

      if (roll < 0.40) {
        // Single Adult
        const adult = createCitizen(`citizen-${counters.nextCitizenId++}`, hId, resPos, prng.nextInt(22, 55), getEdu(), prng);
        householdCitizens.push(adult);
      } else if (roll < 0.70) {
        // Working Couple
        const adult1 = createCitizen(`citizen-${counters.nextCitizenId++}`, hId, resPos, prng.nextInt(22, 58), getEdu(), prng);
        const adult2 = createCitizen(`citizen-${counters.nextCitizenId++}`, hId, resPos, prng.nextInt(22, 58), getEdu(), prng);
        householdCitizens.push(adult1, adult2);
      } else if (roll < 0.90) {
        // Family with 1-2 Children
        const parent1 = createCitizen(`citizen-${counters.nextCitizenId++}`, hId, resPos, prng.nextInt(28, 48), getEdu(), prng);
        const parent2 = createCitizen(`citizen-${counters.nextCitizenId++}`, hId, resPos, prng.nextInt(28, 48), getEdu(), prng);
        const child1 = createCitizen(`citizen-${counters.nextCitizenId++}`, hId, resPos, prng.nextInt(4, 16), EducationLevel.UNEDUCATED, prng);
        householdCitizens.push(parent1, parent2, child1);
        if (prng.chance(0.5) && space >= 4) {
          const child2 = createCitizen(`citizen-${counters.nextCitizenId++}`, hId, resPos, prng.nextInt(2, 12), EducationLevel.UNEDUCATED, prng);
          householdCitizens.push(child2);
        }
      } else {
        // Retired Senior Household
        const senior = createCitizen(`citizen-${counters.nextCitizenId++}`, hId, resPos, prng.nextInt(65, 82), getEdu(), prng);
        householdCitizens.push(senior);
      }

      if (householdCitizens.length > space) {
        householdCitizens.length = space;
      }

      if (householdCitizens.length === 0) continue;

      for (const c of householdCitizens) {
        citizens.set(c.id, c);
      }

      const rent = calculateTileRent(tile, residentialTaxRate);
      const householdType = householdCitizens.some((citizen) => citizen.stage === AgeStage.CHILD)
        ? 'FAMILY'
        : householdCitizens.every((citizen) => citizen.stage === AgeStage.SENIOR)
          ? 'SENIOR'
          : householdCitizens.length > 1 ? 'COUPLE' : 'SINGLE';
      const preferredDensity = householdType === 'FAMILY' ? 'LOW' : householdType === 'SENIOR' ? 'LOW' : householdType === 'SINGLE' ? 'HIGH' : 'MEDIUM';
      const household = createHousehold(
        hId,
        resPos,
        rent,
        householdCitizens,
        prng.nextInt(200, 500),
        householdType,
        preferredDensity,
      );
      households.set(household.id, household);

      tile.population = (tile.population || 0) + householdCitizens.length * Math.max(1, populationScale);
      spawned += householdCitizens.length;
      immigrants += householdCitizens.length;
    }
  }

  return {
    immigrants,
    emigrants,
    relocations,
    netMigration: immigrants - emigrants,
  };
}
