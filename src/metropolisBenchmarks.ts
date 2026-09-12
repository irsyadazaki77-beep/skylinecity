import { createEmptyGrid, createInitialCityState, simulateTick } from './engine';
import { createStarterGrid } from './starterCity';
import { TileType, CityState } from './types';
import { seedCitizenSimulationFromGrid, serializeCitizenSimulation } from './citizenSimulation';

export type BenchmarkScenario =
  | 'SMALL_TOWN' | 'CONGESTED_CORRIDOR' | 'INDUSTRIAL_CITY' | 'FLOOD_RECOVERY'
  | 'PERFORMANCE_100K' | 'DENSE_CITY' | 'TRANSIT_STRESS' | 'NIGHT_CITY' | 'DISASTER_CITY';

export function createBenchmarkState(scenario: BenchmarkScenario, seed = 2088): CityState {
  const baseScenario = scenario === 'DENSE_CITY' ? 'CONGESTED_CORRIDOR'
    : scenario === 'TRANSIT_STRESS' || scenario === 'NIGHT_CITY' ? 'CONGESTED_CORRIDOR'
      : scenario === 'DISASTER_CITY' ? 'FLOOD_RECOVERY' : scenario;
  const grid = baseScenario === 'SMALL_TOWN' ? createStarterGrid() : createEmptyGrid();
  if (baseScenario !== 'SMALL_TOWN') {
    if (baseScenario === 'PERFORMANCE_100K') {
      // Dense orthogonal city fixture. Every developed tile is adjacent to a
      // road and the utility facilities share the same connected topology, so
      // the benchmark measures citizen/network work rather than an accidental
      // unpowered-city failure path.
      for (let y = 1; y < 60; y += 3) {
        for (let x = 1; x < 59; x += 1) {
          grid[y][x].type = TileType.ROAD;
          grid[y][x].roadClass = 'ARTERIAL';
        }
      }
      for (let x = 1; x < 60; x += 3) {
        for (let y = 0; y < 60; y += 1) {
          grid[y][x].type = TileType.ROAD;
          grid[y][x].roadClass = 'ARTERIAL';
        }
      }

      const utilitySlots: [number, number][] = [];
      for (let y = 0; y < 60; y += 1) {
        for (let x = 0; x < 60; x += 1) {
          const tile = grid[y][x];
          if (tile.type !== TileType.EMPTY || tile.water) continue;
          const roadAdjacent = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => grid[y + dy]?.[x + dx]?.type === TileType.ROAD);
          if (roadAdjacent) utilitySlots.push([x, y]);
        }
      }
      for (let index = 0; index < 50; index += 1) {
        const slot = utilitySlots[index];
        if (!slot) break;
        grid[slot[1]][slot[0]].type = TileType.POWER_PLANT;
      }
      for (let index = 50; index < 100; index += 1) {
        const slot = utilitySlots[index];
        if (!slot) break;
        grid[slot[1]][slot[0]].type = TileType.WATER_PUMP;
      }

      const residentialTiles = [] as typeof grid[number][number][];
      for (let y = 0; y < 60; y += 1) {
        for (let x = 0; x < 60; x += 1) {
          const tile = grid[y][x];
          if (tile.type !== TileType.EMPTY || tile.water) continue;
          const type = (x + y) % 5 === 0 ? TileType.COMMERCIAL : TileType.RESIDENTIAL;
          tile.type = type;
          tile.level = 5;
          tile.zoneDensity = type === TileType.RESIDENTIAL ? 'HIGH' : undefined;
          tile.powered = true;
          tile.watered = true;
          if (type === TileType.RESIDENTIAL) residentialTiles.push(tile);
          else tile.jobs = 80;
        }
      }

      let populationRemaining = 100_000;
      for (const tile of residentialTiles) {
        const assigned = Math.min(200, populationRemaining);
        tile.population = assigned;
        populationRemaining -= assigned;
        if (populationRemaining <= 0) break;
      }
      if (populationRemaining > 0 && residentialTiles.length > 0) {
        residentialTiles[0].population += populationRemaining;
      }
    } else {
      for (let x = 6; x < 54; x += 1) {
        grid[30][x].type = TileType.ROAD;
        grid[30][x].roadClass = baseScenario === 'CONGESTED_CORRIDOR' ? 'ARTERIAL' : 'HIGHWAY';
        grid[31][x].type = TileType.ROAD;
        grid[31][x].roadClass = baseScenario === 'CONGESTED_CORRIDOR' ? 'LOCAL' : 'HIGHWAY';
      }
      for (let x = 8; x < 52; x += 4) {
        const type = baseScenario === 'INDUSTRIAL_CITY' ? TileType.INDUSTRIAL : TileType.RESIDENTIAL;
        grid[29][x].type = type;
        grid[29][x].population = type === TileType.RESIDENTIAL ? 80 : 0;
        grid[29][x].jobs = type === TileType.INDUSTRIAL ? 70 : 0;
        grid[32][x].type = TileType.COMMERCIAL;
        grid[32][x].jobs = 45;
      }
      // Every stress fixture is difficult by design, not accidentally
      // impossible: seed a minimal connected utility pair and a small
      // residential foothold so diagnostics can guide a measurable recovery.
      grid[29][6].type = TileType.POWER_PLANT;
      grid[32][6].type = TileType.WATER_PUMP;
      grid[29][12].type = TileType.FIRE_STATION;
      grid[29][24].type = TileType.POLICE_STATION;
      grid[29][36].type = TileType.CLINIC;
      grid[32][24].type = TileType.SCHOOL;
      grid[32][36].type = TileType.WASTE_MANAGEMENT;
      if (baseScenario === 'INDUSTRIAL_CITY') {
        grid[29][7].type = TileType.RESIDENTIAL;
        grid[29][7].population = 40;
        grid[29][8].type = TileType.RESIDENTIAL;
        grid[29][8].population = 40;
        grid[29][16].type = TileType.RESIDENTIAL;
        grid[29][16].population = 40;
        grid[29][44].type = TileType.RESIDENTIAL;
        grid[29][44].population = 40;
      }
      if (baseScenario === 'FLOOD_RECOVERY') {
        for (let x = 10; x < 48; x += 1) grid[29][x].waterDepth = 0.9;
      }
    }
  }
  if (scenario === 'DENSE_CITY') {
    for (let x = 6; x < 54; x += 1) {
      for (const y of [29, 32]) {
        const tile = grid[y][x];
        if (tile.type !== TileType.EMPTY) continue;
        tile.type = (x + y) % 4 === 0 ? TileType.COMMERCIAL : TileType.RESIDENTIAL;
        tile.level = 4;
        tile.population = tile.type === TileType.RESIDENTIAL ? 70 : 0;
        tile.jobs = tile.type === TileType.COMMERCIAL ? 55 : 0;
        tile.powered = true;
        tile.watered = true;
      }
    }
  }
  const state = createInitialCityState(grid, seed, 'normal');
  if (baseScenario === 'PERFORMANCE_100K') {
    // The fixture represents 100k residents with sampled citizen agents. This
    // keeps the benchmark meaningful without pretending that an empty citizen
    // state is equivalent to a large population.
    const populationScale = 5000;
    const seededCitizens = seedCitizenSimulationFromGrid(grid, seed, populationScale);
    state.citizenState = serializeCitizenSimulation(seededCitizens);
    state.demographics = seededCitizens.demographics;
    state.population = Math.round(grid.flat().reduce((sum, tile) => sum + (tile.type === TileType.RESIDENTIAL ? tile.population : 0), 0));
    state.households = Math.round(seededCitizens.households.size * populationScale);
  }
  if (baseScenario === 'FLOOD_RECOVERY') state.activeScenarioId = 'flood-resilience';
  if (scenario === 'NIGHT_CITY') state.timeOfDay = 22;
  if (scenario === 'TRANSIT_STRESS') {
    state.transitLines = Array.from({ length: 12 }, (_, index) => ({
      id: `stress-line-${index}`,
      name: `Stress Line ${index + 1}`,
      mode: index % 3 === 0 ? 'TRAM' as const : 'BUS' as const,
      stops: [[6, 30], [18, 30], [30, 30], [42, 30], [53, 30]] as [number, number][],
      frequency: 4 + (index % 4),
      active: true,
    }));
  }
  if (scenario === 'DISASTER_CITY') {
    state.disasters = [{ id: 'benchmark-disaster', type: 'FLOOD', centerX: 29, centerY: 30, radius: 12, severity: 3, createdDay: state.day, remainingDays: 8, affectedTiles: 76 }];
    state.activeDisasters = 1;
  }
  return state;
}

export function runBenchmarkScenario(scenario: BenchmarkScenario, ticks = 30, seed = 2088): { state: CityState; elapsedMs: number } {
  let state = createBenchmarkState(scenario, seed);
  const start = Date.now();
  for (let index = 0; index < ticks; index += 1) {
    state = simulateTick(state, {
      trafficDensity: 'high',
      benchmarkMode: scenario === 'PERFORMANCE_100K' || scenario === 'DENSE_CITY',
    });
  }
  return { state, elapsedMs: Date.now() - start };
}
