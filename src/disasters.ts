import { GAME_CONFIG } from './config';
import { SeededRandom } from './citizenSimulation/prng';
import { CityDisaster, CityDisasterType, TileData, TileType } from './types';

export interface DisasterSimulationResult {
  disasters: CityDisaster[];
  spawned: CityDisaster[];
  activeDisasters: number;
  responseLoad: number;
  resolved: number;
  happinessPenalty: number;
  recoveryRate: number;
}

const DISASTER_TYPES: CityDisasterType[] = ['EARTHQUAKE', 'FLOOD', 'WILDFIRE', 'STORM'];

function isNearWater(grid: TileData[][], x: number, y: number): boolean {
  return [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => grid[y + dy]?.[x + dx]?.water);
}

function chooseDisasterType(allTiles: TileData[], random: SeededRandom): CityDisasterType {
  const hasWater = allTiles.some((tile) => tile.water);
  const hasForest = allTiles.some((tile) => tile.resource === 'forest' && !tile.water);
  const roll = random.next();
  if (roll < 0.28) return 'EARTHQUAKE';
  if (roll < 0.55 && hasWater) return 'FLOOD';
  if (roll < 0.78 && hasForest) return 'WILDFIRE';
  return 'STORM';
}

function chooseCenter(grid: TileData[][], type: CityDisasterType, random: SeededRandom, allTiles: TileData[]): TileData | undefined {
  const candidates = allTiles.filter((tile) => {
    if (type === 'FLOOD') return !tile.water && isNearWater(grid, tile.x, tile.y);
    if (type === 'WILDFIRE') return !tile.water && (tile.resource === 'forest' || tile.type === TileType.EMPTY);
    return !tile.water;
  });
  return random.pick(candidates) ?? allTiles.find((tile) => !tile.water);
}

function floodAffectedTiles(grid: TileData[][], disaster: CityDisaster, allTiles: TileData[]): TileData[] {
  const center = grid[disaster.centerY]?.[disaster.centerX];
  if (!center) return [];

  // Floods follow a connected lowland corridor instead of painting a perfect
  // circle. A nearby water tile supplies the flood level; higher terrain
  // blocks propagation while one extra tile of reach models the moving front.
  const nearbyWater = allTiles
    .filter((tile) => {
      if (!tile.water) return false;
      const dx = tile.x - center.x;
      const dy = tile.y - center.y;
      return dx * dx + dy * dy <= (disaster.radius + 3) ** 2;
    })
    .sort((a, b) => {
      const aDx = a.x - center.x;
      const aDy = a.y - center.y;
      const bDx = b.x - center.x;
      const bDy = b.y - center.y;
      return (aDx * aDx + aDy * aDy) - (bDx * bDx + bDy * bDy);
    });
  const waterLevel = nearbyWater[0]?.elevation ?? center.elevation;
  const floodLevel = waterLevel + disaster.severity * 0.8 + 0.5;
  const queue: Array<{ x: number; y: number }> = [{ x: center.x, y: center.y }];
  const visited = new Set<string>();
  const affected: TileData[] = [];

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex++];
    const key = `${current.x},${current.y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const tile = grid[current.y]?.[current.x];
    if (!tile) continue;
    const distance = Math.hypot(tile.x - center.x, tile.y - center.y);
    if (distance > disaster.radius + 1.5) continue;
    if (!tile.water && tile !== center && tile.elevation > floodLevel) continue;
    if (!tile.water) affected.push(tile);

    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!visited.has(`${nx},${ny}`)) queue.push({ x: nx, y: ny });
    }
  }

  return affected;
}

function affectedTilesFor(grid: TileData[][], disaster: CityDisaster, allTiles: TileData[]): TileData[] {
  if (disaster.type === 'FLOOD') return floodAffectedTiles(grid, disaster, allTiles);
  return allTiles.filter((tile) => (
    !tile.water && Math.hypot(tile.x - disaster.centerX, tile.y - disaster.centerY) <= disaster.radius
  ));
}

/**
 * Deterministic, low-frequency disaster simulation. Impacts are persistent
 * enough to matter, then decay/repair so the city can recover rather than
 * entering an unrecoverable state.
 */
export function simulateDisasters(
  grid: TileData[][],
  previous: CityDisaster[] = [],
  day: number,
  seed: number,
  responseQuality = 100,
  spawnChance = GAME_CONFIG.DISASTER_CHANCE,
): DisasterSimulationResult {
  const allTiles = grid.flat();
  const random = new SeededRandom(((seed ?? 2088) ^ (day * 0x45d9f3b)) >>> 0);
  const recoveryFactor = Math.max(0.35, Math.min(1.2, responseQuality / 100));
  const recoveryRate = Math.round(GAME_CONFIG.DISASTER_REPAIR_RATE * recoveryFactor * 10) / 10;
  const disasters: CityDisaster[] = [];
  let resolved = 0;

  for (const disaster of previous) {
    const remainingDays = Math.round((disaster.remainingDays - 0.35 * recoveryFactor) * 10) / 10;
    if (remainingDays <= 0) resolved += 1;
    else disasters.push({ ...disaster, remainingDays, affectedTiles: 0 });
  }

  const canSpawn = disasters.length < 1;
  const spawned: CityDisaster[] = [];
  if (canSpawn && random.chance(spawnChance)) {
    const type = chooseDisasterType(allTiles, random);
    const center = chooseCenter(grid, type, random, allTiles);
    if (center) {
      const severity = random.nextInt(1, 3) as 1 | 2 | 3;
      const disaster: CityDisaster = {
        id: `disaster-${day}-${random.nextInt(1000, 9999)}`,
        type,
        centerX: center.x,
        centerY: center.y,
        radius: 1 + severity,
        severity,
        createdDay: day,
        remainingDays: 2 + severity,
        affectedTiles: 0,
      };
      disasters.push(disaster);
      spawned.push(disaster);
    }
  }

  for (const row of grid) {
    for (const tile of row) {
      tile.disasterSeverity = 0;
      tile.disasterImpact = Math.round(Math.max(0, (tile.disasterImpact ?? 0) * GAME_CONFIG.DISASTER_IMPACT_DECAY) * 10) / 10;
      if (tile.type === TileType.ROAD) {
        tile.roadCondition = Math.min(100, (tile.roadCondition ?? 100) + recoveryRate);
      }
    }
  }

  let responseLoad = 0;
  for (const disaster of disasters) {
    const affected = affectedTilesFor(grid, disaster, allTiles);
    let affectedTiles = affected.length;
    responseLoad += disaster.severity * disaster.remainingDays;
    for (const tile of affected) {
      const distanceFactor = Math.max(0.2, 1 - Math.hypot(tile.x - disaster.centerX, tile.y - disaster.centerY) / (disaster.radius + 1));
      const localSeverity = Math.max(1, Math.round(disaster.severity * distanceFactor));
      tile.disasterSeverity = Math.max(tile.disasterSeverity ?? 0, localSeverity);
      tile.disasterImpact = Math.min(100, Math.round(((tile.disasterImpact ?? 0) + localSeverity * 9) * 10) / 10);
      if (tile.type === TileType.ROAD) {
        const damage = disaster.type === 'EARTHQUAKE' ? localSeverity * 11 : disaster.type === 'FLOOD' ? localSeverity * 8 : localSeverity * 6;
        tile.roadCondition = Math.max(25, Math.round((tile.roadCondition ?? 100) - damage));
      }
    }
    disaster.affectedTiles = affectedTiles;
  }

  return {
    disasters,
    spawned,
    activeDisasters: disasters.length,
    responseLoad: Math.round(responseLoad * 10) / 10,
    resolved,
    happinessPenalty: Math.min(20, Math.round((responseLoad * 0.35 + disasters.length * 1.5) * 10) / 10),
    recoveryRate,
  };
}
