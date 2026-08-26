import { TileData, TileType } from '../types';
import { Citizen, Household, HouseholdSatisfactionFactors, AgeStage } from './types';
import { getZoneDensity, getZoneRentMultiplier } from '../zoning';

/**
 * Computes the daily rent price for a residence tile based on land value, building level, and taxes.
 */
export function calculateTileRent(tile: TileData, residentialTaxRate = 9): number {
  if (tile.type !== TileType.RESIDENTIAL) return 0;
  const baseRent = 8 + tile.level * 6;
  const landValueFactor = (tile.landValue || 30) / 40;
  const taxFactor = residentialTaxRate / 9;
  const densityMultiplier = getZoneRentMultiplier(tile);
  const infrastructurePremium = tile.zoneDensity === 'HIGH' && (tile.transitCovered || tile.schoolCovered) ? 1.08 : 1;
  return Math.max(5, Math.round(baseRent * landValueFactor * taxFactor * densityMultiplier * infrastructurePremium));
}

/**
 * Calculates detailed satisfaction factors and overall score for a household.
 */
export function evaluateHouseholdSatisfaction(
  household: Household,
  citizens: Map<string, Citizen>,
  grid: TileData[][],
): { satisfaction: number; factors: HouseholdSatisfactionFactors } {
  const tile = grid[household.residence.y]?.[household.residence.x];

  // If residence tile is invalid, destroyed, or not residential
  if (!tile || tile.type !== TileType.RESIDENTIAL || tile.abandoned) {
    const factors: HouseholdSatisfactionFactors = {
      rentAffordability: 0,
      employment: 0,
      commute: 0,
      crime: 0,
      pollution: 0,
      schoolAccess: 0,
      healthAccess: 0,
      overall: 0,
    };
    return { satisfaction: 0, factors };
  }

  // 1. Members and Income
  const members = household.citizenIds
    .map((id) => citizens.get(id))
    .filter((c): c is Citizen => Boolean(c));

  const adults = members.filter((m) => m.stage === AgeStage.ADULT || m.stage === AgeStage.STUDENT);
  const employedAdults = adults.filter((m) => m.workplace !== null);
  const childrenAndStudents = members.filter((m) => m.stage === AgeStage.CHILD || m.stage === AgeStage.STUDENT);
  const density = getZoneDensity(tile);

  const totalDailyIncome = employedAdults.reduce((sum, m) => sum + (m.workplace?.salary ?? 0), 0);
  const dailyRent = household.rent;

  // 2. Rent Affordability (0 to 100)
  let rentAffordability = 50;
  if (totalDailyIncome > 0) {
    const rentToIncomeRatio = dailyRent / totalDailyIncome;
    if (rentToIncomeRatio <= 0.3) {
      rentAffordability = 100;
    } else if (rentToIncomeRatio <= 0.5) {
      rentAffordability = 75;
    } else if (rentToIncomeRatio <= 0.75) {
      rentAffordability = 45;
    } else {
      rentAffordability = Math.max(10, Math.round(100 - rentToIncomeRatio * 70));
    }
  } else {
    // Unemployed household living off savings
    if (household.savings > dailyRent * 10) {
      rentAffordability = 40;
    } else if (household.savings > 0) {
      rentAffordability = 20;
    } else {
      rentAffordability = 0; // Broke & rent burdened
    }
  }

  // 3. Employment Factor (0 to 100)
  let employmentScore = 100;
  if (adults.length > 0) {
    const employmentRatio = employedAdults.length / adults.length;
    employmentScore = Math.round(employmentRatio * 100);
  }

  // 4. Commute Factor (0 to 100)
  let commuteScore = 90;
  if (employedAdults.length > 0) {
    const totalCommute = employedAdults.reduce((sum, m) => sum + m.commuteTime, 0);
    const avgCommute = totalCommute / employedAdults.length;
    if (avgCommute <= 8) {
      commuteScore = 100;
    } else if (avgCommute <= 18) {
      commuteScore = Math.round(100 - (avgCommute - 8) * 3);
    } else if (avgCommute <= 35) {
      commuteScore = Math.round(70 - (avgCommute - 18) * 2);
    } else {
      commuteScore = Math.max(10, Math.round(36 - (avgCommute - 35) * 1.2));
    }
  }

  // 5. Crime Factor (0 to 100)
  const crimeScore = Math.max(0, Math.min(100, Math.round(100 - (tile.crime || 0))));

  // 6. Pollution & Environmental Quality (0 to 100)
  const pollutionPenalty = (tile.pollution || 0) * 0.85 + (tile.noise || 0) * 0.25;
  const pollutionScore = Math.max(0, Math.min(100, Math.round(100 - pollutionPenalty)));

  // 7. School Access (0 to 100)
  let schoolAccess = 85;
  if (childrenAndStudents.length > 0) {
    if (tile.schoolCovered) {
      schoolAccess = 95;
    } else {
      schoolAccess = 25; // Children without school access causes steep dissatisfaction
    }
  }

  // 8. Healthcare Access (0 to 100)
  const healthAccess = tile.healthCovered ? 95 : 35;

  // Utility bonus/penalty
  const utilityOk = tile.powered && tile.watered;
  const utilityMultiplier = utilityOk ? 1.0 : 0.3;

  // Composite Weighted Satisfaction
  const composite = (
    rentAffordability * 0.22 +
    employmentScore * 0.22 +
    commuteScore * 0.14 +
    crimeScore * 0.12 +
    pollutionScore * 0.10 +
    schoolAccess * 0.10 +
    healthAccess * 0.10
  ) * utilityMultiplier;

  const densityPreferencePenalty = household.preferredDensity && household.preferredDensity !== density ? 5 : 0;
  const overall = Math.max(0, Math.min(100, Math.round(composite - densityPreferencePenalty)));

  const factors: HouseholdSatisfactionFactors = {
    rentAffordability,
    employment: employmentScore,
    commute: commuteScore,
    crime: crimeScore,
    pollution: pollutionScore,
    schoolAccess,
    healthAccess,
    overall,
  };

  return { satisfaction: overall, factors };
}
