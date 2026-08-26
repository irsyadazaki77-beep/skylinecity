import { TileData, TileType } from './types';
import { GAME_CONFIG } from './config';
import { RoadGraph, getAdjacentRoadNodeKey } from './traffic';
import { serviceUpgradeStats } from './serviceUpgrades';

export interface NetworkUtilityResult {
  powerCapacity: number;
  powerDemand: number;
  waterCapacity: number;
  waterDemand: number;
  overloadedPowerGrids: number;
  overloadedWaterGrids: number;
}

export interface CityServicesResult {
  healthcareCoverage: number;
  educationCoverage: number;
  fireSafety: number;
  crimeRate: number;
  wasteCapacity: number;
  wasteProduction: number;
  wasteCoverage: number;
  fireServiceCapacity: number;
  policeServiceCapacity: number;
  healthcareCapacity: number;
  educationCapacity: number;
  serviceResponseQuality: number;
  happiness: number;
}

/**
 * Helper to get 4-directional neighboring coordinates within grid bounds
 */
function getNeighbors(x: number, y: number, width: number, height: number): [number, number][] {
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  const neighbors: [number, number][] = [];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      neighbors.push([nx, ny]);
    }
  }
  return neighbors;
}

/**
 * Power & Water Network Distribution Engine
 * Analyzes contiguous networks formed by roads, utility plants, and zoned buildings.
 */
export function simulateUtilityNetworks(
  grid: TileData[][],
  unlockedUpgrades: string[] = [],
  powerDemandMultiplier = 1.0,
  waterDemandMultiplier = 1.0,
): NetworkUtilityResult {
  const height = grid.length;
  const width = grid[0].length;
  const hasU = (id: string) => unlockedUpgrades.includes(id);

  const powerCapMult = Math.max(0.1, 1 + (hasU('smart_grid') ? 0.2 : 0) + (hasU('adv_turbines') ? 0.5 : 0) + (hasU('smart_sensors') ? 0.1 : 0));
  const waterCapMult = Math.max(0.1, 1 + (hasU('high_cap_pipes') ? 0.2 : 0) + (hasU('deep_pumps') ? 0.5 : 0) + (hasU('smart_sensors') ? 0.1 : 0));
  
  const powerDemandMult = Math.max(0.1, (1 - (hasU('solar_subsidies') ? 0.1 : 0)) * powerDemandMultiplier);
  const waterDemandMult = Math.max(0.1, (1 - (hasU('water_meters') ? 0.1 : 0)) * waterDemandMultiplier);

  const visited = Array.from({ length: height }, () => Array(width).fill(false));

  let totalPowerCapacity = 0;
  let totalPowerDemand = 0;
  let totalWaterCapacity = 0;
  let totalWaterDemand = 0;
  let overloadedPowerGrids = 0;
  let overloadedWaterGrids = 0;

  // Reset all tiles before distribution
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid[y][x].powered = false;
      grid[y][x].watered = false;
    }
  }

  // Find all connected utility networks via BFS
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y][x]) continue;

      const startTile = grid[y][x];
      // Only non-empty tiles conduct utilities through the city grid
      if (startTile.type === TileType.EMPTY) {
        visited[y][x] = true;
        continue;
      }

      // BFS to find connected component network
      const queue: [number, number][] = [[x, y]];
      visited[y][x] = true;
      const componentTiles: TileData[] = [];

      let compPowerCapacity = 0;
      let compWaterCapacity = 0;

      let queueIndex = 0;
      while (queueIndex < queue.length) {
        const [cx, cy] = queue[queueIndex++];
        const currentTile = grid[cy][cx];
        componentTiles.push(currentTile);

        // Power Plant generation
        if (currentTile.type === TileType.POWER_PLANT) {
          compPowerCapacity += 50 * powerCapMult;
        }
        // Water Pump generation
        if (currentTile.type === TileType.WATER_PUMP) {
          compWaterCapacity += 50 * waterCapMult;
        }

        // Utilities travel through roads. A building can join a network only
        // when it touches a road; adjacent buildings do not create a hidden
        // utility bridge.
        for (const [nx, ny] of getNeighbors(cx, cy, width, height)) {
          const neighbor = grid[ny][nx];
          const canConduct = currentTile.type === TileType.ROAD || neighbor.type === TileType.ROAD;
          if (!visited[ny][nx] && neighbor.type !== TileType.EMPTY && canConduct) {
            visited[ny][nx] = true;
            queue.push([nx, ny]);
          }
        }
      }

      compPowerCapacity = Math.round(compPowerCapacity);
      compWaterCapacity = Math.round(compWaterCapacity);

      // A utility facility only contributes usable capacity when its network
      // reaches at least one road tile. Isolated plants/pumps may exist on
      // the map, but they cannot distribute anything to the city.
      const networkHasRoad = componentTiles.some((tile) => tile.type === TileType.ROAD);
      if (!networkHasRoad) {
        compPowerCapacity = 0;
        compWaterCapacity = 0;
      }

      totalPowerCapacity += compPowerCapacity;
      totalWaterCapacity += compWaterCapacity;

      // Filter demanding buildings (Residential, Commercial, Industrial, and Services)
      const demandingTiles = componentTiles.filter(t => 
        t.type === TileType.RESIDENTIAL ||
        t.type === TileType.COMMERCIAL ||
        t.type === TileType.OFFICE ||
        t.type === TileType.INDUSTRIAL ||
        t.type === TileType.FIRE_STATION ||
        t.type === TileType.POLICE_STATION ||
        t.type === TileType.CLINIC ||
        t.type === TileType.SCHOOL ||
        t.type === TileType.WASTE_MANAGEMENT ||
        t.type === TileType.BUS_DEPOT ||
        t.type === TileType.TRAM_STATION ||
        t.type === TileType.BUS_STOP ||
        t.type === TileType.TRAM_STOP ||
        t.type === TileType.WAREHOUSE ||
        t.type === TileType.CARGO_TERMINAL
      );

      let compPowerDemand = 0;
      let compWaterDemand = 0;

      for (const tile of demandingTiles) {
        compPowerDemand += Math.max(1, Math.round(1 * powerDemandMult));
        compWaterDemand += Math.max(1, Math.round(1 * waterDemandMult));
      }

      totalPowerDemand += compPowerDemand;
      totalWaterDemand += compWaterDemand;

      if (compPowerDemand > compPowerCapacity && compPowerCapacity > 0) {
        overloadedPowerGrids++;
      }
      if (compWaterDemand > compWaterCapacity && compWaterCapacity > 0) {
        overloadedWaterGrids++;
      }

      // Allocate power deterministically within this connected network component
      let powerPool = compPowerCapacity;
      for (const tile of demandingTiles) {
        const pReq = Math.max(1, Math.round(1 * powerDemandMult));
        if (powerPool >= pReq) {
          tile.powered = true;
          powerPool -= pReq;
        } else {
          tile.powered = false;
        }
      }

      // Allocate water deterministically within this connected network component
      let waterPool = compWaterCapacity;
      for (const tile of demandingTiles) {
        const wReq = Math.max(1, Math.round(1 * waterDemandMult));
        if (waterPool >= wReq) {
          tile.watered = true;
          waterPool -= wReq;
        } else {
          tile.watered = false;
        }
      }
    }
  }

  return {
    powerCapacity: totalPowerCapacity,
    powerDemand: totalPowerDemand,
    waterCapacity: totalWaterCapacity,
    waterDemand: totalWaterDemand,
    overloadedPowerGrids,
    overloadedWaterGrids,
  };
}

/**
 * City Services Network Engine (Fire, Police, Healthcare, Education, Waste)
 * Uses the road graph to simulate service accessibility, capacity, and reach.
 */
export function simulateCityServices(
  grid: TileData[][],
  roadGraph: RoadGraph,
  totalPopulation: number,
  employedCitizens: number,
  desirability: number,
  averageCommuteTime: number,
  residentialTaxRate: number,
  unlockedUpgrades: string[]
): CityServicesResult {
  const height = grid.length;
  const width = grid[0].length;

  // Reset coverage tags
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid[y][x].fireCovered = false;
      grid[y][x].policeCovered = false;
      grid[y][x].healthCovered = false;
      grid[y][x].schoolCovered = false;
      grid[y][x].wasteCovered = false;
      grid[y][x].serviceResponseTimes = {};
    }
  }

  // Collect active service buildings
  interface ServiceFacility {
    type: TileType;
    x: number;
    y: number;
    roadNodeKey: string;
    range: number;
    capacity: number;
    operationalCapacity?: number;
    responseBonus?: number;
  }

  const facilities: ServiceFacility[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      // A service building is operational when powered and road-connected;
      // water demand still participates in utility overload calculations, but
      // emergency/service dispatch itself does not require potable water.
      const roadNodeKey = getAdjacentRoadNodeKey(x, y, roadGraph);
      if (!roadNodeKey || !tile.powered) continue;

      if (tile.type === TileType.FIRE_STATION) {
        const upgrades = serviceUpgradeStats(tile.type, tile.serviceUpgrades);
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.FIRE_STATION.ROAD_RANGE + upgrades.rangeBonus,
          capacity: Math.round(GAME_CONFIG.CITY_SERVICES.FIRE_STATION.CAPACITY * upgrades.capacityMultiplier),
          responseBonus: upgrades.responseBonus,
        });
      } else if (tile.type === TileType.POLICE_STATION) {
        const upgrades = serviceUpgradeStats(tile.type, tile.serviceUpgrades);
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.POLICE_STATION.ROAD_RANGE + upgrades.rangeBonus,
          capacity: Math.round(GAME_CONFIG.CITY_SERVICES.POLICE_STATION.CAPACITY * upgrades.capacityMultiplier),
          responseBonus: upgrades.responseBonus,
        });
      } else if (tile.type === TileType.CLINIC) {
        const upgrades = serviceUpgradeStats(tile.type, tile.serviceUpgrades);
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.CLINIC.ROAD_RANGE + upgrades.rangeBonus,
          capacity: Math.round(GAME_CONFIG.CITY_SERVICES.CLINIC.CAPACITY * upgrades.capacityMultiplier),
          responseBonus: upgrades.responseBonus,
        });
      } else if (tile.type === TileType.SCHOOL) {
        const upgrades = serviceUpgradeStats(tile.type, tile.serviceUpgrades);
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.SCHOOL.ROAD_RANGE + upgrades.rangeBonus,
          capacity: Math.round(GAME_CONFIG.CITY_SERVICES.SCHOOL.CAPACITY * upgrades.capacityMultiplier),
          responseBonus: upgrades.responseBonus,
        });
      } else if (tile.type === TileType.WASTE_MANAGEMENT) {
        const upgrades = serviceUpgradeStats(tile.type, tile.serviceUpgrades);
        facilities.push({
          type: tile.type,
          x,
          y,
          roadNodeKey,
          range: GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.ROAD_RANGE + upgrades.rangeBonus,
          capacity: Math.round(GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.CAPACITY * upgrades.capacityMultiplier),
          responseBonus: upgrades.responseBonus,
        });
      }
    }
  }

  type CapacityService = 'fire' | 'police' | 'health' | 'school';
  const allocatedServiceLoad = new Map<string, number>();
  let responseFactorSum = 0;
  let responseFacilityCount = 0;
  const serviceIdForFacility = (type: TileType): CapacityService | null => {
    if (type === TileType.FIRE_STATION) return 'fire';
    if (type === TileType.POLICE_STATION) return 'police';
    if (type === TileType.CLINIC) return 'health';
    if (type === TileType.SCHOOL) return 'school';
    return null;
  };
  const isServiceTarget = (tile: TileData, service: CapacityService): boolean => {
    if (service === 'health' || service === 'school') return tile.type === TileType.RESIDENTIAL;
    return tile.type === TileType.RESIDENTIAL || tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL;
  };
  const serviceLoad = (tile: TileData, service: CapacityService): number => {
    if (service === 'health' || service === 'school') return Math.max(1, tile.population);
    return Math.max(1, tile.population + tile.jobs);
  };

  // Calculate road reach for each facility via Dijkstra/BFS
  for (const facility of facilities) {
    const reachableRoads = new Set<string>();
    const distances = new Map<string, number>();
    const queue: { key: string; dist: number }[] = [{ key: facility.roadNodeKey, dist: 0 }];
    distances.set(facility.roadNodeKey, 0);

    let queueIndex = 0;
    while (queueIndex < queue.length) {
      const { key, dist } = queue[queueIndex++];
      reachableRoads.add(key);

      if (dist >= facility.range) continue;

      const node = roadGraph.nodes.get(key);
      if (!node) continue;

      for (const neighborKey of node.neighbors) {
        const nextDist = dist + 1;
        if (nextDist <= facility.range && (!distances.has(neighborKey) || nextDist < distances.get(neighborKey)!)) {
          distances.set(neighborKey, nextDist);
          queue.push({ key: neighborKey, dist: nextDist });
        }
      }
    }

    const capacityService = serviceIdForFacility(facility.type);
    const averageTraffic = reachableRoads.size > 0
      ? [...reachableRoads].reduce((sum, key) => sum + (grid[roadGraph.nodes.get(key)!.y][roadGraph.nodes.get(key)!.x].traffic || 0), 0) / reachableRoads.size
      : 0;
    const responseFactor = Math.max(0.45, Math.min(1, 1 - averageTraffic / 180 + (facility.responseBonus ?? 0)));
    facility.operationalCapacity = Math.max(1, Math.round(facility.capacity * responseFactor));
    responseFactorSum += responseFactor;
    responseFacilityCount += 1;
    const candidates = new Map<string, { tile: TileData; distance: number }>();

    // Find zoned buildings touched by this covered road network. Candidate
    // assignment is capacity-limited and shared across overlapping facilities.
    for (const roadKey of reachableRoads) {
      const roadNode = roadGraph.nodes.get(roadKey);
      if (!roadNode) continue;

      for (const [nx, ny] of getNeighbors(roadNode.x, roadNode.y, width, height)) {
        const neighborTile = grid[ny][nx];
        const distance = distances.get(roadKey) ?? facility.range;
        const responseMinutes = Math.round((1 + (distance * 1.2) / Math.max(0.45, responseFactor)) * 10) / 10;
        if (facility.type === TileType.WASTE_MANAGEMENT) {
          if (
            neighborTile.type === TileType.RESIDENTIAL ||
            neighborTile.type === TileType.COMMERCIAL ||
            neighborTile.type === TileType.INDUSTRIAL
          ) {
            neighborTile.wasteCovered = true;
            const previous = neighborTile.serviceResponseTimes?.waste;
            neighborTile.serviceResponseTimes = {
              ...(neighborTile.serviceResponseTimes ?? {}),
              waste: previous === undefined ? responseMinutes : Math.min(previous, responseMinutes),
            };
          }
        } else if (capacityService && isServiceTarget(neighborTile, capacityService)) {
          const key = `${neighborTile.x},${neighborTile.y}`;
          const existing = candidates.get(key);
          if (!existing || distance < existing.distance) {
            candidates.set(key, { tile: neighborTile, distance });
          }
        }
      }
    }

    if (capacityService) {
      let remainingCapacity = facility.operationalCapacity;
      for (const { tile, distance } of [...candidates.values()].sort((a, b) => a.distance - b.distance)) {
        if (remainingCapacity <= 0) break;
        const key = `${capacityService}:${tile.x},${tile.y}`;
        const demand = serviceLoad(tile, capacityService);
        const alreadyAllocated = allocatedServiceLoad.get(key) ?? 0;
        const allocation = Math.min(remainingCapacity, Math.max(0, demand - alreadyAllocated));
        if (allocation <= 0) continue;
        allocatedServiceLoad.set(key, alreadyAllocated + allocation);
        remainingCapacity -= allocation;
        if (capacityService === 'fire') tile.fireCovered = true;
        if (capacityService === 'police') tile.policeCovered = true;
        if (capacityService === 'health') tile.healthCovered = true;
        if (capacityService === 'school') tile.schoolCovered = true;
        const responseMinutes = Math.round((1 + (distance * 1.2) / Math.max(0.45, responseFactor)) * 10) / 10;
        const previousResponse = tile.serviceResponseTimes?.[capacityService];
        tile.serviceResponseTimes = {
          ...(tile.serviceResponseTimes ?? {}),
          [capacityService]: previousResponse === undefined ? responseMinutes : Math.min(previousResponse, responseMinutes),
        };
      }
    }
  }

  // Calculate Aggregate Service Metrics
  let policeCoveredUnits = 0;
  let fireDemandUnits = 0;
  let fireCoveredUnits = 0;
  let healthCoveredCapacity = 0;
  let schoolCoveredCapacity = 0;
  let wasteUnitsProduced = 0;
  let totalWasteCapacity = 0;
  let fireServiceCapacity = 0;
  let policeServiceCapacity = 0;
  let healthcareCapacity = 0;
  let educationCapacity = 0;

  for (const facility of facilities) {
    if (facility.type === TileType.WASTE_MANAGEMENT) {
      totalWasteCapacity += facility.operationalCapacity ?? facility.capacity;
    }
    if (facility.type === TileType.FIRE_STATION) fireServiceCapacity += facility.operationalCapacity ?? facility.capacity;
    if (facility.type === TileType.POLICE_STATION) policeServiceCapacity += facility.operationalCapacity ?? facility.capacity;
    if (facility.type === TileType.CLINIC) healthcareCapacity += facility.operationalCapacity ?? facility.capacity;
    if (facility.type === TileType.SCHOOL) educationCapacity += facility.operationalCapacity ?? facility.capacity;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type === TileType.RESIDENTIAL) {
        const fireLoad = Math.max(1, tile.population + tile.jobs);
        fireDemandUnits += fireLoad;
        fireCoveredUnits += allocatedServiceLoad.get(`fire:${tile.x},${tile.y}`) ?? 0;
        healthCoveredCapacity += allocatedServiceLoad.get(`health:${tile.x},${tile.y}`) ?? 0;
        schoolCoveredCapacity += allocatedServiceLoad.get(`school:${tile.x},${tile.y}`) ?? 0;
        policeCoveredUnits += allocatedServiceLoad.get(`police:${tile.x},${tile.y}`) ?? 0;
        wasteUnitsProduced += tile.population * GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.PER_POP_WASTE;
      } else if (tile.type === TileType.COMMERCIAL) {
        const fireLoad = Math.max(1, tile.population + tile.jobs);
        fireDemandUnits += fireLoad;
        fireCoveredUnits += allocatedServiceLoad.get(`fire:${tile.x},${tile.y}`) ?? 0;
        policeCoveredUnits += allocatedServiceLoad.get(`police:${tile.x},${tile.y}`) ?? 0;
        wasteUnitsProduced += tile.jobs * 0.5;
      } else if (tile.type === TileType.INDUSTRIAL) {
        const fireLoad = Math.max(1, tile.population + tile.jobs);
        fireDemandUnits += fireLoad;
        fireCoveredUnits += allocatedServiceLoad.get(`fire:${tile.x},${tile.y}`) ?? 0;
        policeCoveredUnits += allocatedServiceLoad.get(`police:${tile.x},${tile.y}`) ?? 0;
        wasteUnitsProduced += tile.jobs * GAME_CONFIG.CITY_SERVICES.WASTE_MANAGEMENT.PER_IND_WASTE;
      }
    }
  }

  wasteUnitsProduced = Math.round(wasteUnitsProduced);

  // A new settlement has a small informal civic layer before it can afford
  // dedicated service buildings. This keeps the first 25 residents from
  // immediately abandoning a playable starter pocket, while every metric
  // still drops to the real network result once the town grows beyond that
  // threshold or a service facility is actually built.
  const isMicroTown = totalPopulation > 0 && totalPopulation <= 25;
  const hasFacility = (type: TileType) => facilities.some((facility) => facility.type === type);
  const microTownCoverage = (type: TileType, fallback: number, actual: number) => (
    isMicroTown && !hasFacility(type) ? Math.max(actual, fallback) : actual
  );

  // Compute effective coverage percentages.
  const healthcareCoverage = totalPopulation > 0
    ? Math.min(100, Math.round(microTownCoverage(TileType.CLINIC, 45, healthCoveredCapacity / totalPopulation * 100)))
    : (hasFacility(TileType.CLINIC) ? 100 : 0);

  const educationCoverage = totalPopulation > 0
    ? Math.min(100, Math.round(microTownCoverage(TileType.SCHOOL, 45, schoolCoveredCapacity / totalPopulation * 100)))
    : (hasFacility(TileType.SCHOOL) ? 100 : 0);

  const fireSafety = fireDemandUnits > 0
    ? Math.min(100, Math.round(microTownCoverage(TileType.FIRE_STATION, 70, fireCoveredUnits / fireDemandUnits * 100)))
    : 100;

  const policeRatio = totalPopulation > 0
    ? Math.min(1, microTownCoverage(TileType.POLICE_STATION, 20, policeCoveredUnits / totalPopulation * 100) / 100)
    : (hasFacility(TileType.POLICE_STATION) ? 1 : 0);
  
  // Crime rate: base 35% without police, drops down to 5% with full police coverage
  const crimeRate = Math.max(5, Math.min(80, Math.round(35 - policeRatio * 30)));

  const wasteCoverage = wasteUnitsProduced > 0
    ? Math.min(100, Math.round(microTownCoverage(TileType.WASTE_MANAGEMENT, 75, totalWasteCapacity / wasteUnitsProduced * 100)))
    : (totalWasteCapacity > 0 ? 100 : 80);

  // Happiness calculation (0 to 100% composite score)
  let happiness = 50;
  // Services boost happiness
  happiness += (healthcareCoverage - 50) * 0.15;
  happiness += (educationCoverage - 50) * 0.15;
  happiness += (fireSafety - 50) * 0.15;
  happiness += (50 - crimeRate) * 0.2;
  happiness += (wasteCoverage - 50) * 0.15;
  
  // Traffic & commute friction
  if (averageCommuteTime > 8) {
    happiness -= Math.min(15, (averageCommuteTime - 8) * 1.5);
  }

  // Tax friction
  if (residentialTaxRate > GAME_CONFIG.TAX_OPTIMAL) {
    happiness -= (residentialTaxRate - GAME_CONFIG.TAX_OPTIMAL) * 2;
  } else {
    happiness += (GAME_CONFIG.TAX_OPTIMAL - residentialTaxRate) * 1.5;
  }

  happiness = Math.max(0, Math.min(100, Math.round(happiness)));

  return {
    healthcareCoverage,
    educationCoverage,
    fireSafety,
    crimeRate,
    wasteCapacity: totalWasteCapacity,
    wasteProduction: wasteUnitsProduced,
    wasteCoverage,
    fireServiceCapacity,
    policeServiceCapacity,
    healthcareCapacity,
    educationCapacity,
    serviceResponseQuality: responseFacilityCount > 0
      ? Math.round((responseFactorSum / responseFacilityCount) * 100)
      : 100,
    happiness,
  };
}
