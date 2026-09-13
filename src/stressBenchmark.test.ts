import { describe, it, expect } from 'vitest';
import { simulateTick, createInitialCityState, getLastSimulationPhaseTimings, getLastSimulationDirtyChunkKeys, getLastSimulationChangedTileKeys } from './engine';
import { createTile, TileType, CityState } from './types';
import { createStarterGrid } from './starterCity';

function createDenseGrid(size: number) {
  const grid: any[][] = [];
  for (let y = 0; y < size; y++) {
    const row: any[] = [];
    for (let x = 0; x < size; x++) {
      row.push(createTile(x, y, TileType.EMPTY));
    }
    grid.push(row);
  }

  // Orthogonal road network every 4 tiles
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (y % 4 === 0 || x % 4 === 0) {
        grid[y][x].type = TileType.ROAD;
        grid[y][x].roadClass = (y % 12 === 0 || x % 12 === 0) ? 'ARTERIAL' : 'LOCAL';
      } else {
        const mod = (x + y) % 3;
        if (mod === 0) {
          grid[y][x].type = TileType.RESIDENTIAL;
          grid[y][x].population = 120;
          grid[y][x].level = 3;
        } else if (mod === 1) {
          grid[y][x].type = TileType.COMMERCIAL;
          grid[y][x].jobs = 60;
          grid[y][x].level = 2;
        } else {
          grid[y][x].type = TileType.INDUSTRIAL;
          grid[y][x].jobs = 75;
          grid[y][x].level = 2;
        }
        grid[y][x].powered = true;
        grid[y][x].watered = true;
      }
    }
  }

  // Plant utilities
  grid[1][1].type = TileType.POWER_PLANT;
  grid[1][2].type = TileType.WATER_PUMP;
  grid[1][3].type = TileType.FIRE_STATION;
  grid[2][1].type = TileType.POLICE_STATION;
  grid[2][2].type = TileType.HOSPITAL;
  grid[2][3].type = TileType.SCHOOL;

  return grid;
}

describe('Large City Stress & Scalability Benchmark', () => {
  it('measures 60x60, 120x120, and 240x240 cities under multi-rate simulation', () => {
    const scenarios = [
      { name: 'Small Town (60x60)', size: 60, ticks: 10 },
      { name: 'Medium Dense (120x120)', size: 120, ticks: 6 },
      { name: 'Mega Metropolis (240x240)', size: 240, ticks: 3 },
    ];

    const results: any[] = [];

    for (const sc of scenarios) {
      const grid = createDenseGrid(sc.size);
      let state = createInitialCityState(grid, 2088);
      
      const tickTimes: number[] = [];
      const phaseTotals: Record<string, number> = {};
      let totalDirtyTiles = 0;

      // Warmup 1 tick
      state = simulateTick(state, { benchmarkMode: true });

      for (let i = 0; i < sc.ticks; i++) {
        const start = performance.now();
        state = simulateTick(state, { benchmarkMode: true });
        const duration = performance.now() - start;
        tickTimes.push(duration);

        const phases = getLastSimulationPhaseTimings();
        for (const [k, v] of Object.entries(phases)) {
          phaseTotals[k] = (phaseTotals[k] || 0) + v;
        }

        const dirtyTiles = getLastSimulationChangedTileKeys();
        totalDirtyTiles += dirtyTiles.size;
      }

      const avgTick = tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length;
      const minTick = Math.min(...tickTimes);
      const maxTick = Math.max(...tickTimes);
      const avgDirtyTiles = totalDirtyTiles / sc.ticks;
      const totalTiles = sc.size * sc.size;
      const workerPayloadKb = Math.round(((avgDirtyTiles * 150 + 2048) / 1024) * 10) / 10;
      const fullGridPayloadKb = Math.round(((totalTiles * 300) / 1024) * 10) / 10;

      const trafficMs = (phaseTotals['traffic'] || 0) / sc.ticks;
      const economyMs = (phaseTotals['economy'] || 0) / sc.ticks;
      const citizenMs = (phaseTotals['citizenAgents'] || 0) / sc.ticks;
      const depthMs = (phaseTotals['depthSimulation'] || 0) / sc.ticks;

      const result = {
        name: sc.name,
        gridSize: `${sc.size}x${sc.size} (${totalTiles.toLocaleString()} tiles)`,
        avgTickMs: Math.round(avgTick * 100) / 100,
        minTickMs: Math.round(minTick * 100) / 100,
        maxTickMs: Math.round(maxTick * 100) / 100,
        trafficMs: Math.round(trafficMs * 100) / 100,
        economyMs: Math.round(economyMs * 100) / 100,
        citizenMs: Math.round(citizenMs * 100) / 100,
        depthMs: Math.round(depthMs * 100) / 100,
        avgDirtyTiles: Math.round(avgDirtyTiles),
        compactPayloadKb: workerPayloadKb,
        unoptimizedPayloadKb: fullGridPayloadKb,
        payloadReductionPercent: Math.round((1 - workerPayloadKb / fullGridPayloadKb) * 1000) / 10,
        population: state.population,
      };
      results.push(result);
    }

    console.log('\n================ LARGE CITY BENCHMARK METRICS ================');
    console.table(results);
    console.log('==============================================================\n');

    expect(results[0].avgTickMs).toBeLessThan(120);
    expect(results[1].avgTickMs).toBeLessThan(450);
    expect(results[2].payloadReductionPercent).toBeGreaterThan(95);
  }, 60000);
});
