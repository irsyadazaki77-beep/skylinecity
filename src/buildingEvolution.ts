import { parcelCapacityMultiplier } from './parcels';
import { mixedUseJobCapacityMultiplier } from './mixedUse';
import { COMMERCIAL_CAPACITIES, INDUSTRIAL_CAPACITIES, RESIDENTIAL_CAPACITIES } from './depthSimulation';
import { getOfficeCapacity, getResidentialCapacity } from './zoning';
import { TileData, TileType } from './types';

export type EvolutionStatus = 'INACTIVE' | 'ABANDONED' | 'BLOCKED' | 'PROGRESSING' | 'READY' | 'MAX_LEVEL';

export interface EvolutionRequirement {
  key: string;
  label: string;
  met: boolean;
  current: string;
  target: string;
}

export interface BuildingEvolutionContext {
  grid: TileData[][];
  unlockedUpgrades: string[];
  residentialDemand: number;
  commercialDemand: number;
  officeDemand: number;
  industrialDemand: number;
}

export interface BuildingEvolutionSummary {
  status: EvolutionStatus;
  currentLevel: number;
  nextLevel: number | null;
  maxLevel: number;
  capacity: number;
  occupancy: number;
  occupancyPercent: number;
  demand: number;
  progress: number;
  requirements: EvolutionRequirement[];
  blockers: string[];
}

function hasRoadAccess(tile: TileData, grid: TileData[][]): boolean {
  return [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => grid[tile.y + dy]?.[tile.x + dx]?.type === TileType.ROAD);
}

function maxLevelFor(tile: TileData, unlockedUpgrades: string[]): number {
  if (unlockedUpgrades.includes('sky_permits')) return 5;
  if (tile.type === TileType.RESIDENTIAL && unlockedUpgrades.includes('high_dens_res')) return 3;
  if ((tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE) && unlockedUpgrades.includes('high_dens_com')) return 3;
  if (tile.type === TileType.INDUSTRIAL && unlockedUpgrades.includes('high_dens_ind')) return 3;
  return 2;
}

function capacityFor(tile: TileData, level: number): number {
  const parcelMultiplier = parcelCapacityMultiplier(tile);
  if (tile.type === TileType.RESIDENTIAL) {
    return getResidentialCapacity(tile, Math.round(RESIDENTIAL_CAPACITIES[level] * parcelMultiplier));
  }
  if (tile.type === TileType.COMMERCIAL) {
    return Math.round(COMMERCIAL_CAPACITIES[level] * parcelMultiplier * mixedUseJobCapacityMultiplier(tile));
  }
  if (tile.type === TileType.OFFICE) return Math.round(getOfficeCapacity(level) * parcelMultiplier);
  return Math.round(INDUSTRIAL_CAPACITIES[level] * parcelMultiplier);
}

function demandFor(tile: TileData, context: BuildingEvolutionContext): number {
  if (tile.type === TileType.RESIDENTIAL) return context.residentialDemand;
  if (tile.type === TileType.COMMERCIAL) return context.commercialDemand;
  if (tile.type === TileType.OFFICE) return context.officeDemand;
  return context.industrialDemand;
}

function requirementSet(tile: TileData, nextLevel: number, occupancyPercent: number): EvolutionRequirement[] {
  const requirements: EvolutionRequirement[] = [
    { key: 'occupancy', label: 'Occupancy bangunan', met: occupancyPercent >= 75, current: `${Math.round(occupancyPercent)}%`, target: '≥ 75%' },
  ];
  const landValue = tile.landValue ?? 30;
  const suitability = tile.suitability ?? landValue;
  const pollution = tile.pollution ?? 0;
  const crime = tile.crime ?? 30;

  if (nextLevel === 2) {
    requirements.push(
      { key: 'land-value', label: 'Nilai lahan', met: landValue >= 20, current: `${Math.round(landValue)}`, target: '≥ 20' },
      { key: 'suitability', label: 'Kesesuaian lahan', met: suitability >= 35, current: `${Math.round(suitability)}`, target: '≥ 35' },
    );
  } else if (nextLevel === 3) {
    requirements.push(
      { key: 'land-value', label: 'Nilai lahan', met: landValue >= 35, current: `${Math.round(landValue)}`, target: '≥ 35' },
      { key: 'suitability', label: 'Kesesuaian lahan', met: suitability >= 48, current: `${Math.round(suitability)}`, target: '≥ 48' },
      { key: 'fire-or-police', label: 'Perlindungan kota', met: tile.fireCovered || tile.policeCovered, current: tile.fireCovered || tile.policeCovered ? 'aktif' : 'tidak ada', target: 'Fire atau Police' },
    );
  } else if (nextLevel === 4) {
    requirements.push(
      { key: 'land-value', label: 'Nilai lahan', met: landValue >= 50, current: `${Math.round(landValue)}`, target: '≥ 50' },
      { key: 'suitability', label: 'Kesesuaian lahan', met: suitability >= 62, current: `${Math.round(suitability)}`, target: '≥ 62' },
      { key: 'fire', label: 'Fire coverage', met: tile.fireCovered, current: tile.fireCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'police', label: 'Police coverage', met: tile.policeCovered, current: tile.policeCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'health-or-school', label: 'Health/Education', met: tile.healthCovered || tile.schoolCovered, current: tile.healthCovered || tile.schoolCovered ? 'aktif' : 'tidak ada', target: 'Health atau School' },
      { key: 'pollution', label: 'Polusi', met: pollution < 35, current: `${Math.round(pollution)}`, target: '< 35' },
    );
  } else if (nextLevel === 5) {
    requirements.push(
      { key: 'land-value', label: 'Nilai lahan', met: landValue >= 65, current: `${Math.round(landValue)}`, target: '≥ 65' },
      { key: 'suitability', label: 'Kesesuaian lahan', met: suitability >= 76, current: `${Math.round(suitability)}`, target: '≥ 76' },
      { key: 'fire', label: 'Fire coverage', met: tile.fireCovered, current: tile.fireCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'police', label: 'Police coverage', met: tile.policeCovered, current: tile.policeCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'health', label: 'Health coverage', met: tile.healthCovered, current: tile.healthCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'school', label: 'School coverage', met: tile.schoolCovered, current: tile.schoolCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'waste', label: 'Waste coverage', met: tile.wasteCovered, current: tile.wasteCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'education', label: 'Pendidikan lokal', met: (tile.education ?? 0) >= 50, current: `${Math.round(tile.education ?? 0)}`, target: '≥ 50' },
      { key: 'pollution', label: 'Polusi', met: pollution < 25, current: `${Math.round(pollution)}`, target: '< 25' },
      { key: 'crime', label: 'Kriminalitas', met: crime < 20, current: `${Math.round(crime)}`, target: '< 20' },
    );
  }

  return requirements;
}

/**
 * Evaluates the same level-up contract used by the simulation and returns
 * player-facing reasons in priority order. Keeping this pure makes the
 * inspector explain the actual simulation state instead of guessing from a
 * single percentage bar.
 */
export function evaluateBuildingEvolution(tile: TileData, context: BuildingEvolutionContext): BuildingEvolutionSummary | null {
  const isZoned = tile.type === TileType.RESIDENTIAL || tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE || tile.type === TileType.INDUSTRIAL;
  if (!isZoned) return null;

  const currentLevel = Math.min(5, Math.max(1, tile.level));
  const maxLevel = maxLevelFor(tile, context.unlockedUpgrades);
  const capacity = capacityFor(tile, currentLevel);
  const occupancy = tile.type === TileType.RESIDENTIAL ? tile.population : tile.jobs;
  const occupancyPercent = capacity > 0 ? Math.min(100, occupancy / capacity * 100) : 0;
  const demand = demandFor(tile, context);
  const nextLevel = currentLevel < maxLevel ? currentLevel + 1 : null;
  const requirements = nextLevel ? requirementSet(tile, nextLevel, occupancyPercent) : [];
  const blockers: string[] = [];

  if (!tile.powered) blockers.push('Bangunan belum mendapat listrik.');
  if (!tile.watered) blockers.push('Bangunan belum mendapat air.');
  if (!hasRoadAccess(tile, context.grid)) blockers.push('Belum memiliki frontage ke jalan yang terhubung.');
  if ((tile.disasterImpact ?? 0) >= 75) blockers.push('Dampak bencana terlalu tinggi untuk berevolusi.');
  if (tile.abandoned) blockers.push('Bangunan terbengkalai; pulihkan layanan dan demand terlebih dahulu.');
  if (nextLevel === null) blockers.push(maxLevel === 5 ? 'Sudah mencapai level maksimum.' : `Butuh upgrade untuk membuka level ${maxLevel + 1}.`);
  if (nextLevel !== null) {
    if (occupancyPercent < 75) blockers.push(`Occupancy baru ${Math.round(occupancyPercent)}%; butuh minimal 75%.`);
    if (demand <= 0) blockers.push(`Demand sektor sedang ${Math.round(demand)}; tunggu atau ubah kebijakan kota.`);
    for (const requirement of requirements.slice(1)) {
      if (!requirement.met) blockers.push(`${requirement.label}: ${requirement.current} (target ${requirement.target}).`);
    }
  }

  const status: EvolutionStatus = !tile.powered || !tile.watered || !hasRoadAccess(tile, context.grid) || (tile.disasterImpact ?? 0) >= 75
    ? 'INACTIVE'
    : tile.abandoned
      ? 'ABANDONED'
      : nextLevel === null
        ? 'MAX_LEVEL'
        : blockers.length === 0
          ? 'READY'
          : (tile.upgradeProgress ?? 0) > 0 || occupancyPercent > 0
            ? 'PROGRESSING'
            : 'BLOCKED';

  return {
    status,
    currentLevel,
    nextLevel,
    maxLevel,
    capacity,
    occupancy,
    occupancyPercent,
    demand,
    progress: Math.max(0, Math.min(100, tile.upgradeProgress ?? 0)),
    requirements,
    blockers,
  };
}
