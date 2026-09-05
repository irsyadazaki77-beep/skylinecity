import { createEmptyGrid, createInitialCityState, simulateTick } from './engine';
import { createStarterGrid } from './starterCity';
import { TileType, CityState } from './types';
import { seedCitizenSimulationFromGrid, serializeCitizenSimulation } from './citizenSimulation';

export type BenchmarkScenario = 'SMALL_TOWN' | 'CONGESTED_CORRIDOR' | 'INDUSTRIAL_CITY' | 'FLOOD_RECOVERY' | 'PERFORMANCE_100K';

export function createBenchmarkState(scenario: BenchmarkScenario, seed = 2088): CityState {
  const grid = scenario === 'SMALL_TOWN' ? createStarterGrid() : createEmptyGrid();
  if (scenario !== 'SMALL_TOWN') {
    if (scenario === 'PERFORMANCE_100K') {
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
        grid[30][x].roadClass = scenario === 'CONGESTED_CORRIDOR' ? 'ARTERIAL' : 'HIGHWAY';
        grid[31][x].type = TileType.ROAD;
        grid[31][x].roadClass = scenario === 'CONGESTED_CORRIDOR' ? 'LOCAL' : 'HIGHWAY';
      }
      for (let x = 8; x < 52; x += 4) {
        const type = scenario === 'INDUSTRIAL_CITY' ? TileType.INDUSTRIAL : TileType.RESIDENTIAL;
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
      if (scenario === 'INDUSTRIAL_CITY') {
        grid[29][7].type = TileType.RESIDENTIAL;
        grid[29][7].population = 40;
        grid[29][8].type = TileType.RESIDENTIAL;
        grid[29][8].population = 40;
        grid[29][16].type = TileType.RESIDENTIAL;
        grid[29][16].population = 40;
        grid[29][44].type = TileType.RESIDENTIAL;
        grid[29][44].population = 40;
      }
      if (scenario === 'FLOOD_RECOVERY') {
        for (let x = 10; x < 48; x += 1) grid[29][x].waterDepth = 0.9;
      }
    }
  }
  const state = createInitialCityState(grid, seed, 'normal');
  if (scenario === 'PERFORMANCE_100K') {
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
  if (scenario === 'FLOOD_RECOVERY') state.activeScenarioId = 'flood-resilience';
  return state;
}

export function runBenchmarkScenario(scenario: BenchmarkScenario, ticks = 30, seed = 2088): { state: CityState; elapsedMs: number } {
  let state = createBenchmarkState(scenario, seed);
  const start = Date.now();
  for (let index = 0; index < ticks; index += 1) {
    state = simulateTick(state, {
      trafficDensity: 'high',
      benchmarkMode: scenario === 'PERFORMANCE_100K',
    });
  }
  return { state, elapsedMs: Date.now() - start };
}
