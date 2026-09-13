import { parcelCapacityMultiplier } from './parcels';
import { mixedUseJobCapacityMultiplier } from './mixedUse';
import { COMMERCIAL_CAPACITIES, INDUSTRIAL_CAPACITIES, RESIDENTIAL_CAPACITIES } from './depthSimulation';
import { getOfficeCapacity, getResidentialCapacity } from './zoning';
import { TileData, TileType } from './types';
import type { BuildingFootprint } from './urbanForm';
import { ConstructionStage, getConstructionStage } from './constructionPresentation';

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
  happiness?: number;
  taxRate?: number;
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
  developmentScore?: number;
  upgradingReasons?: string[];
  stalledReasons?: string[];
  abandonedReasons?: string[];
}

/**
 * Synchronized BuildingEntity structure bridging TileData, BuildingFootprint,
 * evolution status, and renderer state.
 */
export interface BuildingEntity {
  tile: TileData;
  footprint?: BuildingFootprint;
  summary: BuildingEvolutionSummary | null;
  constructionStage: ConstructionStage;
  constructionState?: TileData['constructionState'];
  constructionProgress?: number;
  targetLevel?: number;
  previousLevel?: number;
  constructionType?: TileData['constructionType'];
}

export function hasRoadAccess(tile: TileData, grid: TileData[][]): boolean {
  return [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => grid[tile.y + dy]?.[tile.x + dx]?.type === TileType.ROAD);
}

export function getFrontageRoadTraffic(tile: TileData, grid: TileData[][]): number {
  let maxTraffic = 0;
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const neighbor = grid[tile.y + dy]?.[tile.x + dx];
    if (neighbor?.type === TileType.ROAD) {
      maxTraffic = Math.max(maxTraffic, neighbor.traffic ?? 0);
    }
  }
  return maxTraffic;
}

export function maxLevelFor(tile: TileData, unlockedUpgrades: string[]): number {
  const density = tile.zoneDensity;
  // Low density zones represent suburban and low-rise neighborhoods (max level 2)
  if (density === 'LOW') {
    return 2;
  }

  if (unlockedUpgrades.includes('sky_permits')) {
    // Medium density corridors cap at level 4 even with sky permits
    if (density === 'MEDIUM') return 4;
    return 5;
  }

  if (tile.type === TileType.RESIDENTIAL && unlockedUpgrades.includes('high_dens_res')) return Math.max(tile.level ?? 1, 3);
  if ((tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE) && unlockedUpgrades.includes('high_dens_com')) return Math.max(tile.level ?? 1, 3);
  if (tile.type === TileType.INDUSTRIAL && unlockedUpgrades.includes('high_dens_ind')) return Math.max(tile.level ?? 1, 3);
  return Math.max(tile.level ?? 1, 2);
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

export function requirementSet(
  tile: TileData,
  nextLevel: number,
  occupancyPercent: number,
  context?: BuildingEvolutionContext,
): EvolutionRequirement[] {
  const requirements: EvolutionRequirement[] = [
    { key: 'occupancy', label: 'Okupansi bangunan', met: occupancyPercent >= 75, current: `${Math.round(occupancyPercent)}%`, target: '≥ 75%' },
  ];
  const landValue = tile.landValue ?? 30;
  const suitability = tile.suitability ?? landValue;
  const pollution = tile.pollution ?? 0;
  const crime = tile.crime ?? 30;
  const frontageTraffic = context ? getFrontageRoadTraffic(tile, context.grid) : (tile.traffic ?? 0);
  const cityHappiness = context?.happiness ?? 60;
  const taxRate = context?.taxRate ?? 9;

  if (nextLevel === 2) {
    requirements.push(
      { key: 'land-value', label: 'Nilai lahan', met: landValue >= 20, current: `${Math.round(landValue)}`, target: '≥ 20' },
      { key: 'suitability', label: 'Kesesuaian lahan', met: suitability >= 35, current: `${Math.round(suitability)}`, target: '≥ 35' },
    );
  } else if (nextLevel === 3) {
    requirements.push(
      { key: 'land-value', label: 'Nilai lahan', met: landValue >= 35, current: `${Math.round(landValue)}`, target: '≥ 35' },
      { key: 'suitability', label: 'Kesesuaian lahan', met: suitability >= 48, current: `${Math.round(suitability)}`, target: '≥ 48' },
      { key: 'fire-or-police', label: 'Perlindungan darurat', met: tile.fireCovered || tile.policeCovered, current: tile.fireCovered || tile.policeCovered ? 'aktif' : 'tidak ada', target: 'Fire atau Police' },
    );
  } else if (nextLevel === 4) {
    requirements.push(
      { key: 'land-value', label: 'Nilai lahan', met: landValue >= 50, current: `${Math.round(landValue)}`, target: '≥ 50' },
      { key: 'suitability', label: 'Kesesuaian lahan', met: suitability >= 62, current: `${Math.round(suitability)}`, target: '≥ 62' },
      { key: 'fire', label: 'Cakupan Pemadam', met: tile.fireCovered, current: tile.fireCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'police', label: 'Cakupan Polisi', met: tile.policeCovered, current: tile.policeCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'health-or-school', label: 'Layanan Publik', met: tile.healthCovered || tile.schoolCovered, current: tile.healthCovered || tile.schoolCovered ? 'aktif' : 'tidak ada', target: 'Health atau School' },
      { key: 'pollution', label: 'Polusi lingkungan', met: pollution < 35, current: `${Math.round(pollution)}`, target: '< 35' },
      { key: 'traffic', label: 'Lalu lintas jalan', met: frontageTraffic < 85, current: `${Math.round(frontageTraffic)}%`, target: '< 85%' },
      { key: 'happiness', label: 'Kebahagiaan kota', met: cityHappiness >= 45, current: `${Math.round(cityHappiness)}%`, target: '≥ 45%' },
      { key: 'tax', label: 'Tarif pajak', met: taxRate <= 14, current: `${taxRate}%`, target: '≤ 14%' },
    );
  } else if (nextLevel === 5) {
    requirements.push(
      { key: 'land-value', label: 'Nilai lahan', met: landValue >= 65, current: `${Math.round(landValue)}`, target: '≥ 65' },
      { key: 'suitability', label: 'Kesesuaian lahan', met: suitability >= 76, current: `${Math.round(suitability)}`, target: '≥ 76' },
      { key: 'fire', label: 'Cakupan Pemadam', met: tile.fireCovered, current: tile.fireCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'police', label: 'Cakupan Polisi', met: tile.policeCovered, current: tile.policeCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'health', label: 'Cakupan Kesehatan', met: tile.healthCovered, current: tile.healthCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'school', label: 'Cakupan Pendidikan', met: tile.schoolCovered, current: tile.schoolCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'waste', label: 'Pengelolaan Sampah', met: tile.wasteCovered, current: tile.wasteCovered ? 'aktif' : 'tidak ada', target: 'aktif' },
      { key: 'education', label: 'Indeks Pendidikan', met: (tile.education ?? 0) >= 50, current: `${Math.round(tile.education ?? 0)}`, target: '≥ 50' },
      { key: 'pollution', label: 'Polusi lingkungan', met: pollution < 25, current: `${Math.round(pollution)}`, target: '< 25' },
      { key: 'crime', label: 'Kriminalitas', met: crime < 20, current: `${Math.round(crime)}`, target: '< 20' },
      { key: 'traffic', label: 'Lalu lintas jalan', met: frontageTraffic < 80, current: `${Math.round(frontageTraffic)}%`, target: '< 80%' },
      { key: 'happiness', label: 'Kebahagiaan kota', met: cityHappiness >= 55, current: `${Math.round(cityHappiness)}%`, target: '≥ 55%' },
      { key: 'tax', label: 'Tarif pajak', met: taxRate <= 12, current: `${taxRate}%`, target: '≤ 12%' },
    );
  }

  return requirements;
}

/**
 * Evaluates the authoritative level-up contract used by the simulation and returns
 * player-facing reasons in priority order.
 */
export function evaluateBuildingEvolution(tile: TileData, context: BuildingEvolutionContext): BuildingEvolutionSummary | null {
  const isZoned = tile.type === TileType.RESIDENTIAL || tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE || tile.type === TileType.INDUSTRIAL;
  if (!isZoned) return null;

  const currentLevel = Math.min(5, Math.max(1, tile.level));
  const maxLevel = maxLevelFor(tile, context.unlockedUpgrades);
  const capacity = capacityFor(tile, currentLevel);
  const occupancy = tile.type === TileType.RESIDENTIAL ? tile.population : tile.jobs;
  const occupancyPercent = capacity > 0 ? Math.min(100, (occupancy / capacity) * 100) : 0;
  const demand = demandFor(tile, context);
  const nextLevel = currentLevel < maxLevel ? currentLevel + 1 : null;
  const requirements = nextLevel ? requirementSet(tile, nextLevel, occupancyPercent, context) : [];
  const blockers: string[] = [];

  if (!tile.powered) blockers.push('Bangunan belum mendapat pasokan listrik.');
  if (!tile.watered) blockers.push('Bangunan belum mendapat pasokan air bersih.');
  if (!hasRoadAccess(tile, context.grid)) blockers.push('Belum memiliki frontage ke jalan yang terhubung.');
  if ((tile.disasterImpact ?? 0) >= 75) blockers.push('Dampak bencana terlalu tinggi untuk berevolusi.');
  if (tile.abandoned) blockers.push('Bangunan terbengkalai; pulihkan layanan dasar dan permintaan sektor.');
  if (tile.zoneDensity === 'LOW' && currentLevel >= 2) {
    blockers.push('Kepadatan zona rendah dibatasi pada tingkat 2 (kawasan suburban/rumah tapak).');
  } else if (tile.zoneDensity === 'MEDIUM' && currentLevel >= 4) {
    blockers.push('Kepadatan zona sedang dibatasi pada tingkat 4 (koridor mid-rise).');
  } else if (nextLevel === null) {
    blockers.push(maxLevel === 5 ? 'Sudah mencapai tingkat maksimum.' : `Butuh upgrade teknologi untuk membuka tingkat ${maxLevel + 1}.`);
  }

  if (nextLevel !== null) {
    if (occupancyPercent < 75) blockers.push(`Occupancy baru ${Math.round(occupancyPercent)}%; butuh minimal 75%.`);
    if (demand <= 0) blockers.push(`Demand sektor sedang ${Math.round(demand)}; butuh pertumbuhan positif.`);
    for (const requirement of requirements.slice(1)) {
      if (!requirement.met) {
        blockers.push(`${requirement.label}: ${requirement.current} (target ${requirement.target}).`);
      }
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

  const landValue = tile.landValue ?? 30;
  const suitability = tile.suitability ?? landValue;
  const serviceCount = [tile.fireCovered, tile.policeCovered, tile.healthCovered, tile.schoolCovered, tile.wasteCovered].filter(Boolean).length;
  const servicePct = serviceCount * 20;
  const envPct = Math.max(0, 100 - (tile.pollution ?? 0) * 0.6 - (tile.noise ?? 0) * 0.4);
  const roadConnected = hasRoadAccess(tile, context.grid);
  const transitBonus = tile.transitCovered ? 15 : 0;
  const accessPct = Math.min(100, (roadConnected ? 70 : 0) + transitBonus + (tile.roadCondition ? tile.roadCondition * 0.15 : 15));

  const developmentScore = Math.round(
    landValue * 0.25 +
    suitability * 0.25 +
    servicePct * 0.20 +
    envPct * 0.15 +
    accessPct * 0.15,
  );

  const upgradingReasons: string[] = [];
  if (landValue >= 50) upgradingReasons.push('Nilai lahan tinggi');
  if (suitability >= 60) upgradingReasons.push('Kesesuaian fungsi lahan sangat baik');
  if (serviceCount >= 4) upgradingReasons.push('Layanan kota lengkap');
  if (tile.transitCovered) upgradingReasons.push('Terhubung transportasi publik');
  if (demand > 20) upgradingReasons.push('Permintaan pasar sektor positif');
  if (occupancyPercent >= 75) upgradingReasons.push('Kapasitas terisi optimal (≥ 75%)');

  const stalledReasons: string[] = [...blockers];
  const abandonedReasons: string[] = [];
  if (tile.abandoned) {
    if (!tile.powered) abandonedReasons.push('Kehilangan pasokan listrik');
    if (!tile.watered) abandonedReasons.push('Kehilangan pasokan air bersih');
    if (!roadConnected) abandonedReasons.push('Terputus dari jaringan jalan');
    if ((tile.pollution ?? 0) > 60) abandonedReasons.push('Polusi lingkungan terlalu pekat');
    if ((tile.crime ?? 0) > 60) abandonedReasons.push('Tingkat kriminalitas ekstrem');
    if (demand < -20) abandonedReasons.push('Resesi permintaan sektor berkepanjangan');
    if (abandonedReasons.length === 0) abandonedReasons.push('Penurunan okupansi dan kekurangan layanan pendukung');
  }

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
    developmentScore,
    upgradingReasons,
    stalledReasons,
    abandonedReasons,
  };
}

/**
 * Creates a synchronized BuildingEntity linking TileData, footprint, evolution summary,
 * and current construction stage.
 */
export function createBuildingEntity(
  tile: TileData,
  context: BuildingEvolutionContext,
  footprint?: BuildingFootprint,
): BuildingEntity {
  const summary = evaluateBuildingEvolution(tile, context);
  const constructionStage = getConstructionStage(tile);
  return {
    tile,
    footprint,
    summary,
    constructionStage,
    constructionState: tile.constructionState ?? (constructionStage === 'RENOVATING' ? 'RENOVATING' : constructionStage === 'COMPLETED' || constructionStage === 'OCCUPIED' ? 'COMPLETED' : 'FRAME'),
    constructionProgress: tile.constructionProgress ?? tile.upgradeProgress ?? 100,
    targetLevel: tile.targetLevel ?? (tile.level < 5 ? tile.level + 1 : tile.level),
    previousLevel: tile.previousLevel ?? tile.level,
    constructionType: tile.constructionType ?? ((tile.upgradeProgress ?? 0) > 0 ? 'UPGRADE' : undefined),
  };
}
