import { getRoadClass, TileData, TileType } from './types';
import { RoadGraph, getAdjacentRoadNodeKey } from './traffic';
import { parcelCapacityMultiplier } from './parcels';
import { mixedUseJobCapacityMultiplier } from './mixedUse';
import { getOfficeCapacity, getResidentialCapacity } from './zoning';
import { maxLevelFor, requirementSet, BuildingEvolutionContext } from './buildingEvolution';
import { getConstructionStage } from './constructionPresentation';
import { getOrBuildSpatialRegistry } from './simulationContext';

export const RESIDENTIAL_CAPACITIES = [0, 4, 12, 25, 50, 100];
export const COMMERCIAL_CAPACITIES = [0, 4, 12, 25, 50, 90];
export const INDUSTRIAL_CAPACITIES = [0, 5, 15, 30, 55, 90];

export const BUILDING_NAMES = {
  RESIDENTIAL: [
    'Empty Plot',
    'Small Housing',
    'Townhouse',
    'Apartment Block',
    'High-Rise Residences',
    'Residential Skyscraper'
  ],
  COMMERCIAL: [
    'Empty Plot',
    'Small Shop',
    'Office Building',
    'Commercial Complex',
    'Commercial Tower',
    'Commercial Skyscraper'
  ],
  INDUSTRIAL: [
    'Empty Plot',
    'Workshop',
    'Factory',
    'Industrial Complex',
    'Advanced Industry',
    'High-Tech Industrial Hub'
  ]
};

export interface DepthSimulationResult {
  landValueAverage: number;
  suitabilityAverage: number;
  pollutionAverage: number;
  noiseAverage: number;
  educationLevel: number;
  healthIndex: number;
  buildingLevelCounts: {
    residential: number[];
    commercial: number[];
    industrial: number[];
  };
}

const ENVIRONMENT_OFFSETS = (() => {
  const offsets: Array<{ dx: number; dy: number; decay: number }> = [];
  const radius = 3;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= radius) {
        offsets.push({ dx, dy, decay: (radius - distance) / radius });
      }
    }
  }
  return offsets;
})();

/**
 * Simulates Land Value, Pollution, Noise, Health, Education, and Crime across the city grid.
 */
export function simulateCityDepthAndEnvironment(
  grid: TileData[][],
  roadGraph: RoadGraph,
  unlockedUpgrades: string[]
): DepthSimulationResult {
  const height = grid.length;
  const width = grid[0].length;
  const registry = getOrBuildSpatialRegistry(grid);
  const hasRecycling = unlockedUpgrades.includes('recycling');
  const hasGreenRoofs = unlockedUpgrades.includes('green_roofs');

  // Initialize depth maps with flat typed buffers
  const size = height * width;
  const pollutionMap = new Float32Array(size);
  const noiseMap = new Float32Array(size);
  // The park radius is used both for absorption and land-value uplift. Build
  // the influence map while visiting parks so the per-tile pass does not
  // rescan a 7x7 neighbourhood for every tile.
  const parkInfluence = new Uint8Array(size);

  const applyEmitter = (x: number, y: number, pSrc: number, nSrc: number) => {
    let pollSource = pSrc;
    let noiseSource = nSrc;
    if (hasRecycling) pollSource *= 0.8;
    if (hasGreenRoofs) pollSource *= 0.85;

    if (pollSource > 0 || noiseSource > 0) {
      for (let i = 0; i < ENVIRONMENT_OFFSETS.length; i += 1) {
        const { dx, dy, decay } = ENVIRONMENT_OFFSETS[i];
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = ny * width + nx;
          pollutionMap[idx] += pollSource * decay;
          noiseMap[idx] += noiseSource * decay;
        }
      }
    }
  };

  // 1. Calculate Pollution & Noise sources directly from indexed emitter tiles
  const powerPlants = registry.zonesByType.get(TileType.POWER_PLANT) ?? [];
  for (let i = 0; i < powerPlants.length; i += 1) applyEmitter(powerPlants[i].x, powerPlants[i].y, 35, 20);

  const offices = registry.zonesByType.get(TileType.OFFICE) ?? [];
  for (let i = 0; i < offices.length; i += 1) applyEmitter(offices[i].x, offices[i].y, 3, 5);

  const industrial = registry.zonesByType.get(TileType.INDUSTRIAL) ?? [];
  for (let i = 0; i < industrial.length; i += 1) {
    const tile = industrial[i];
    let p = 5, n = 5;
    if (tile.level === 1) { p = 8; n = 8; }
    else if (tile.level === 2) { p = 18; n = 15; }
    else if (tile.level === 3) { p = 28; n = 22; }
    else if (tile.level === 4) { p = 12; n = 10; }
    applyEmitter(tile.x, tile.y, p, n);
  }

  const roads = registry.zonesByType.get(TileType.ROAD) ?? [];
  for (let i = 0; i < roads.length; i += 1) {
    const tile = roads[i];
    if ((tile.traffic || 0) > 5) {
      const rClass = getRoadClass(tile);
      const roadImpact = rClass === 'HIGHWAY' ? 1.45 : rClass === 'ARTERIAL' ? 1.15 : 0.45;
      const maxPoll = rClass === 'HIGHWAY' ? 35 : rClass === 'ARTERIAL' ? 22 : 8;
      const maxNoise = rClass === 'HIGHWAY' ? 48 : rClass === 'ARTERIAL' ? 32 : 16;
      const p = Math.min(maxPoll, Math.round(tile.traffic * 0.6 * roadImpact));
      const n = Math.min(maxNoise, Math.round(tile.traffic * 0.9 * roadImpact));
      applyEmitter(tile.x, tile.y, p, n);
    }
  }

  const wastePlants = registry.zonesByType.get(TileType.WASTE_MANAGEMENT) ?? [];
  for (let i = 0; i < wastePlants.length; i += 1) applyEmitter(wastePlants[i].x, wastePlants[i].y, 15, 10);

  const busDepots = registry.zonesByType.get(TileType.BUS_DEPOT) ?? [];
  for (let i = 0; i < busDepots.length; i += 1) applyEmitter(busDepots[i].x, busDepots[i].y, 0, 5);

  const tramStations = registry.zonesByType.get(TileType.TRAM_STATION) ?? [];
  for (let i = 0; i < tramStations.length; i += 1) applyEmitter(tramStations[i].x, tramStations[i].y, 0, 4);

  // 2. Apply Parks absorption directly from indexed parks
  const parks = registry.zonesByType.get(TileType.PARK) ?? [];
  for (let i = 0; i < parks.length; i += 1) {
    const tile = parks[i];
    const x = tile.x;
    const y = tile.y;
    const radius = 3;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = ny * width + nx;
          parkInfluence[idx] = 1;
          pollutionMap[idx] = Math.max(0, pollutionMap[idx] - 12);
          noiseMap[idx] = Math.max(0, noiseMap[idx] - 10);
        }
      }
    }
  }

  let totalLandValue = 0;
  let totalSuitability = 0;
  let suitabilityTiles = 0;
  let totalPollution = 0;
  let totalNoise = 0;
  let totalHealth = 0;
  let totalEducation = 0;
  let activeTilesCount = 0;

  const resLevels = [0, 0, 0, 0, 0, 0];
  const comLevels = [0, 0, 0, 0, 0, 0];
  const indLevels = [0, 0, 0, 0, 0, 0];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      const idx = y * width + x;

      const disasterImpact = tile.disasterImpact ?? 0;
      const pVal = Math.min(100, Math.round(pollutionMap[idx] + disasterImpact * 0.2));
      const nVal = Math.min(100, Math.round(noiseMap[idx] + disasterImpact * 0.1));

      tile.pollution = pVal;
      tile.noise = nVal;

      // Local Health: boosted by healthcare, penalized by pollution & missing waste
      let health = (tile.healthCovered ? 85 : 40) - (pVal * 0.4) - (tile.wasteCovered ? 0 : 20) - disasterImpact * 0.25;
      health = Math.max(0, Math.min(100, Math.round(health)));
      tile.health = health;

      // Local Education: boosted by schools over time
      let edu = tile.education ?? 0;
      if (tile.schoolCovered) {
        edu = Math.min(100, edu + 5);
      } else {
        edu = Math.max(0, edu - 2);
      }
      tile.education = edu;

      // Local Crime: police coverage suppresses crime
      let crime = tile.policeCovered ? 10 : 45;
      if (nVal > 40) crime += 10;
      crime = Math.max(0, Math.min(100, Math.round(crime)));
      tile.crime = crime;

      // Local Land Value Calculation
      let lv = 35; // base
      if (tile.fireCovered) lv += 10;
      if (tile.policeCovered) lv += 10;
      if (tile.healthCovered) lv += 10;
      if (tile.schoolCovered) lv += 10;

      if (parkInfluence[idx] === 1) lv += 25;

      lv -= (pVal * 0.35) + (nVal * 0.25) + (crime * 0.3) + disasterImpact * 0.3;
      lv = Math.max(0, Math.min(100, Math.round(lv)));
      tile.landValue = lv;

      // Land-use suitability separates land value from actual planning fit.
      // A pleasant residential street, a commercial arterial, and an
      // industrial highway frontage should not receive identical growth.
      const roadKey = getAdjacentRoadNodeKey(x, y, roadGraph);
      const roadNode = roadKey ? roadGraph.nodes.get(roadKey) : undefined;
      const cleanScore = Math.max(0, Math.min(100, (100 - pVal) * 0.6 + (100 - nVal) * 0.4));
      const serviceScore = [
        tile.fireCovered,
        tile.policeCovered,
        tile.healthCovered,
        tile.schoolCovered,
        tile.wasteCovered,
      ].filter(Boolean).length * 20;
      const roadScore = !roadNode
        ? 0
        : tile.type === TileType.RESIDENTIAL
          ? (roadNode.roadClass === 'LOCAL' ? 85 : roadNode.roadClass === 'ARTERIAL' ? 62 : 35)
          : tile.type === TileType.COMMERCIAL
            ? (roadNode.roadClass === 'HIGHWAY' ? 100 : roadNode.roadClass === 'ARTERIAL' ? 86 : 55)
            : (roadNode.roadClass === 'HIGHWAY' ? 100 : roadNode.roadClass === 'ARTERIAL' ? 84 : 38);
      const resourceBonus = tile.type === TileType.INDUSTRIAL && tile.resource !== 'none' ? 10 : 0;
      const suitabilityBase = tile.type === TileType.RESIDENTIAL
        ? lv * 0.45 + cleanScore * 0.25 + serviceScore * 0.2 + roadScore * 0.1
        : tile.type === TileType.COMMERCIAL
          ? lv * 0.3 + cleanScore * 0.2 + serviceScore * 0.15 + roadScore * 0.35
            : tile.type === TileType.OFFICE
              ? lv * 0.32 + cleanScore * 0.18 + serviceScore * 0.12 + roadScore * 0.38
            : tile.type === TileType.INDUSTRIAL
            ? lv * 0.2 + cleanScore * 0.2 + serviceScore * 0.1 + roadScore * 0.5 + resourceBonus
            : lv;
      tile.suitability = Math.max(0, Math.min(100, Math.round(suitabilityBase)));

      // Accumulate stats
      if (tile.type !== TileType.EMPTY) {
        totalLandValue += lv;
        if (tile.type === TileType.RESIDENTIAL || tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL) {
          totalSuitability += tile.suitability ?? lv;
          suitabilityTiles += 1;
        }
        totalPollution += pVal;
        totalNoise += nVal;
        totalHealth += health;
        totalEducation += edu;
        activeTilesCount++;
      }

      // Count building levels
      if (tile.type === TileType.RESIDENTIAL && !tile.abandoned) {
        resLevels[Math.min(5, Math.max(1, tile.level))]++;
      } else if ((tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE) && !tile.abandoned) {
        comLevels[Math.min(5, Math.max(1, tile.level))]++;
      } else if (tile.type === TileType.INDUSTRIAL && !tile.abandoned) {
        indLevels[Math.min(5, Math.max(1, tile.level))]++;
      }
    }
  }

  const denominator = Math.max(1, activeTilesCount);

  return {
    landValueAverage: Math.round(totalLandValue / denominator),
    suitabilityAverage: Math.round(totalSuitability / Math.max(1, suitabilityTiles)),
    pollutionAverage: Math.round((totalPollution / denominator) * 10) / 10,
    noiseAverage: Math.round((totalNoise / denominator) * 10) / 10,
    educationLevel: Math.round(totalEducation / denominator),
    healthIndex: Math.round(totalHealth / denominator),
    buildingLevelCounts: {
      residential: resLevels.slice(1), // L1 to L5
      commercial: comLevels.slice(1),
      industrial: indLevels.slice(1),
    }
  };
}

/**
 * Simulates Building Evolution (Level 1 to 5) with Stability & Progression Requirements.
 */
export function simulateBuildingEvolution(
  grid: TileData[][],
  roadGraph: RoadGraph,
  resDemand: number,
  comDemand: number,
  officeDemand: number,
  indDemand: number,
  unlockedUpgrades: string[],
  options?: {
    happiness?: number;
    taxRate?: number;
    tickStep?: number;
  },
): Array<[number, number]> {
  const height = grid.length;
  const width = grid[0].length;
  const step = Math.max(1, options?.tickStep ?? 1);
  const changedTiles: Array<[number, number]> = [];
  const visualSignature = (tile: TileData) => {
    const stage = getConstructionStage(tile);
    const progressTier = Math.floor((tile.upgradeProgress ?? 0) / 25);
    const readyBeacon = (tile.upgradeProgress ?? 0) >= 90 ? 1 : 0;
    return `${tile.type}|${tile.level}|${tile.abandoned ? 1 : 0}|${tile.powered ? 1 : 0}|${tile.watered ? 1 : 0}|${tile.disasterImpact ?? 0}|${tile.elevation}|${stage}|${progressTier}|${readyBeacon}|${tile.constructionState ?? ''}|${tile.constructionProgress ?? 0}`;
  };

  const evolutionContext: BuildingEvolutionContext = {
    grid,
    unlockedUpgrades,
    residentialDemand: resDemand,
    commercialDemand: comDemand,
    officeDemand,
    industrialDemand: indDemand,
    happiness: options?.happiness,
    taxRate: options?.taxRate,
  };

  const reg = getOrBuildSpatialRegistry(grid);
  const buildingTiles = [
    ...(reg.zonesByType.get(TileType.RESIDENTIAL) ?? []),
    ...(reg.zonesByType.get(TileType.COMMERCIAL) ?? []),
    ...(reg.zonesByType.get(TileType.OFFICE) ?? []),
    ...(reg.zonesByType.get(TileType.INDUSTRIAL) ?? []),
  ];

  for (let i = 0; i < buildingTiles.length; i += 1) {
    const tile = buildingTiles[i];
    const x = tile.x;
    const y = tile.y;

    const beforeVisual = visualSignature(tile);

      const hasRoad = getAdjacentRoadNodeKey(x, y, roadGraph) !== null;
      const isActive = tile.powered && tile.watered && hasRoad;

      if (!isActive) {
        tile.upgradeProgress = 0;
        tile.jobs = Math.max(0, tile.jobs - 2);
        tile.population = Math.max(0, tile.population - 2);
        if (tile.population === 0 && tile.jobs === 0) {
          tile.abandoned = true;
          if (tile.level > 1) tile.level = Math.max(1, tile.level - 1);
        }
        if (visualSignature(tile) !== beforeVisual) changedTiles.push([x, y]);
        continue;
      }

      // Active building evaluation
      if (tile.abandoned) {
        const demand = tile.type === TileType.RESIDENTIAL ? resDemand : (tile.type === TileType.COMMERCIAL ? comDemand : tile.type === TileType.OFFICE ? officeDemand : indDemand);
        if (demand > 10) {
          tile.abandoned = false;
          tile.upgradeProgress = 0;
          tile.constructionState = 'COMPLETED';
          tile.constructionProgress = 100;
          tile.constructionType = undefined;
        }
        if (visualSignature(tile) !== beforeVisual) changedTiles.push([x, y]);
        continue;
      }

      // Advance new building construction lifecycle deterministically
      if (tile.constructionType === 'NEW' || (tile.population === 0 && tile.jobs === 0 && (tile.constructionProgress ?? 100) < 100)) {
        tile.constructionProgress = Math.min(100, (tile.constructionProgress ?? 0) + 20 * step);
        tile.targetLevel = 1;
        tile.previousLevel = 0;
        if (tile.constructionProgress < 15) {
          tile.constructionState = 'EMPTY_LOT';
        } else if (tile.constructionProgress < 35) {
          tile.constructionState = 'FOUNDATION';
        } else if (tile.constructionProgress < 60) {
          tile.constructionState = 'FRAME';
        } else if (tile.constructionProgress < 85) {
          tile.constructionState = 'STRUCTURE';
        } else if (tile.constructionProgress < 100) {
          tile.constructionState = 'FINISHING';
        } else {
          tile.constructionState = 'COMPLETED';
          tile.constructionType = undefined;
          tile.constructionProgress = 100;
        }
      }

      const currentLevel = Math.min(5, Math.max(1, tile.level));
      const maxLevel = maxLevelFor(tile, unlockedUpgrades);
      let currentCap = 0;
      let targetDemand = 0;

      if (tile.type === TileType.RESIDENTIAL) {
        currentCap = getResidentialCapacity(tile, Math.round(RESIDENTIAL_CAPACITIES[currentLevel] * parcelCapacityMultiplier(tile)));
        targetDemand = resDemand;
      } else if (tile.type === TileType.COMMERCIAL) {
        currentCap = Math.round(COMMERCIAL_CAPACITIES[currentLevel] * parcelCapacityMultiplier(tile) * mixedUseJobCapacityMultiplier(tile));
        targetDemand = comDemand;
      } else if (tile.type === TileType.OFFICE) {
        currentCap = Math.round(getOfficeCapacity(currentLevel) * parcelCapacityMultiplier(tile));
        targetDemand = officeDemand;
      } else {
        currentCap = Math.round(INDUSTRIAL_CAPACITIES[currentLevel] * parcelCapacityMultiplier(tile));
        targetDemand = indDemand;
      }

      const currentOcc = tile.type === TileType.RESIDENTIAL ? tile.population : tile.jobs;
      const occupancyRatio = currentCap > 0 ? currentOcc / currentCap : 0;

      // Authoritative Evolution Check using unified requirementSet
      if (currentLevel < maxLevel && occupancyRatio >= 0.75 && targetDemand > 0) {
        const nextLevel = currentLevel + 1;
        const requirements = requirementSet(tile, nextLevel, occupancyRatio * 100, evolutionContext);
        const reqsMet = requirements.every((req) => req.met);

        if (reqsMet) {
          tile.upgradeProgress = (tile.upgradeProgress ?? 0) + 25 * step;
          tile.constructionType = 'UPGRADE';
          tile.previousLevel = currentLevel;
          tile.targetLevel = nextLevel;
          tile.constructionProgress = tile.upgradeProgress;
          tile.constructionState = 'RENOVATING';
          if (tile.upgradeProgress >= 100) {
            tile.level = nextLevel;
            tile.previousLevel = nextLevel;
            tile.upgradeProgress = 0;
            tile.constructionProgress = 100;
            tile.constructionState = 'COMPLETED';
            tile.constructionType = undefined;
          }
        } else {
          tile.upgradeProgress = Math.max(0, (tile.upgradeProgress ?? 0) - 10);
          if ((tile.upgradeProgress ?? 0) === 0 && tile.constructionType === 'UPGRADE') {
            tile.constructionType = undefined;
            tile.constructionState = 'COMPLETED';
            tile.constructionProgress = 100;
          }
        }
      } else {
        tile.upgradeProgress = Math.max(0, (tile.upgradeProgress ?? 0) - 10);
        if ((tile.upgradeProgress ?? 0) === 0 && tile.constructionType === 'UPGRADE') {
          tile.constructionType = undefined;
          tile.constructionState = 'COMPLETED';
          tile.constructionProgress = 100;
        }
      }

      // Check degradation if conditions severely decay
      if (tile.pollution! > 75 || tile.crime! > 75) {
        tile.upgradeProgress = 0;
        if (tile.level > 1) {
          tile.level -= 1;
        } else {
          tile.abandoned = true;
        }
      }
      if (visualSignature(tile) !== beforeVisual) changedTiles.push([x, y]);
    }
    return changedTiles;
  }
