import { describe, expect, it } from 'vitest';
import { createTile, TileType } from './types';
import { buildRoadGraph } from './traffic';
import { simulateCityServices } from './services';

describe('service response telemetry', () => {
  it('provides a visible civic baseline for a micro-town before dedicated facilities', () => {
    const grid = Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => createTile(x, y)));
    for (let x = 0; x < 4; x += 1) grid[1][x] = createTile(x, 1, { type: TileType.ROAD });
    grid[0][1] = createTile(1, 0, { type: TileType.RESIDENTIAL, population: 8, powered: true, watered: true });
    const result = simulateCityServices(grid, buildRoadGraph(grid), 8, 4, 50, 5, 9, []);

    expect(result.fireSafety).toBeGreaterThanOrEqual(70);
    expect(result.wasteCoverage).toBeGreaterThanOrEqual(75);
    expect(grid[0][1].fireCovered).toBe(true);
    expect(grid[0][1].wasteCovered).toBe(true);
  });

  it('writes deterministic response minutes for covered buildings', () => {
    const grid = Array.from({ length: 4 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
    grid[0][1] = createTile(1, 0, { type: TileType.ROAD });
    grid[1][1] = createTile(1, 1, { type: TileType.FIRE_STATION, powered: true });
    grid[2][1] = createTile(1, 2, { type: TileType.ROAD });
    grid[3][1] = createTile(1, 3, { type: TileType.RESIDENTIAL, population: 10, powered: true });
    const roadGraph = buildRoadGraph(grid);
    const result = simulateCityServices(grid, roadGraph, 10, 5, 50, 5, 9, []);

    expect(result.fireSafety).toBeGreaterThan(0);
    expect(grid[3][1].fireCovered).toBe(true);
    expect(grid[3][1].serviceResponseTimes?.fire).toBeGreaterThan(0);
    expect(grid[3][1].serviceResponseTimes?.fire).toBeLessThan(10);
  });

  it('evaluates emergency serviceResponseQuality accurately across facility states', () => {
    // 1. Kota tanpa fasilitas darurat -> response quality harus 0
    const emptyGrid = Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => createTile(x, y)));
    for (let x = 0; x < 4; x += 1) emptyGrid[1][x] = createTile(x, 1, { type: TileType.ROAD });
    emptyGrid[0][1] = createTile(1, 0, { type: TileType.RESIDENTIAL, population: 40, powered: true, watered: true });
    const noServicesResult = simulateCityServices(emptyGrid, buildRoadGraph(emptyGrid), 40, 4, 50, 5, 9, []);
    expect(noServicesResult.serviceResponseQuality).toBe(0);

    // 2. Satu fasilitas darurat tetapi tidak terhubung jaringan jalan -> response quality tetap 0
    const disconnectedGrid = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => createTile(x, y)));
    disconnectedGrid[0][0] = createTile(0, 0, { type: TileType.FIRE_STATION, powered: true }); // terisolasi di sudut tanpa jalan di tetangganya
    disconnectedGrid[2][2] = createTile(2, 2, { type: TileType.ROAD });
    disconnectedGrid[2][3] = createTile(3, 2, { type: TileType.RESIDENTIAL, population: 30, powered: true });
    const disconnectedResult = simulateCityServices(disconnectedGrid, buildRoadGraph(disconnectedGrid), 30, 4, 50, 5, 9, []);
    expect(disconnectedResult.serviceResponseQuality).toBe(0);

    // 3. Satu fasilitas pemadam aktif terhubung jalan -> response quality > 0
    const oneServiceGrid = Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => createTile(x, y)));
    for (let x = 0; x < 4; x += 1) oneServiceGrid[1][x] = createTile(x, 1, { type: TileType.ROAD });
    oneServiceGrid[0][1] = createTile(1, 0, { type: TileType.FIRE_STATION, powered: true });
    oneServiceGrid[2][1] = createTile(1, 2, { type: TileType.RESIDENTIAL, population: 30, powered: true, watered: true });
    const oneResult = simulateCityServices(oneServiceGrid, buildRoadGraph(oneServiceGrid), 30, 4, 50, 5, 9, []);
    expect(oneResult.serviceResponseQuality).toBeGreaterThan(0);
    expect(oneResult.serviceResponseQuality).toBeLessThanOrEqual(100);

    // 4. Layanan lengkap (Fire, Police, Clinic) terhubung jalan -> response quality tinggi
    const fullServiceGrid = Array.from({ length: 6 }, (_, y) => Array.from({ length: 6 }, (_, x) => createTile(x, y)));
    for (let x = 0; x < 6; x += 1) fullServiceGrid[2][x] = createTile(x, 2, { type: TileType.ROAD });
    fullServiceGrid[1][1] = createTile(1, 1, { type: TileType.FIRE_STATION, powered: true });
    fullServiceGrid[1][3] = createTile(3, 1, { type: TileType.POLICE_STATION, powered: true });
    fullServiceGrid[1][5] = createTile(5, 1, { type: TileType.CLINIC, powered: true });
    fullServiceGrid[3][2] = createTile(2, 3, { type: TileType.RESIDENTIAL, population: 60, powered: true, watered: true });
    const fullResult = simulateCityServices(fullServiceGrid, buildRoadGraph(fullServiceGrid), 60, 4, 50, 5, 9, []);
    expect(fullResult.serviceResponseQuality).toBeGreaterThanOrEqual(70);

    // Clinic-only coverage is still a valid emergency response signal, while
    // non-emergency services do not leak into this metric.
    const clinicOnlyGrid = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => createTile(x, y)));
    for (let x = 0; x < 5; x += 1) clinicOnlyGrid[2][x] = createTile(x, 2, { type: TileType.ROAD });
    clinicOnlyGrid[1][1] = createTile(1, 1, { type: TileType.CLINIC, powered: true });
    clinicOnlyGrid[3][1] = createTile(1, 3, { type: TileType.RESIDENTIAL, population: 30, powered: true, watered: true });
    const clinicOnlyResult = simulateCityServices(clinicOnlyGrid, buildRoadGraph(clinicOnlyGrid), 30, 4, 50, 5, 9, []);
    expect(clinicOnlyResult.serviceResponseQuality).toBeGreaterThan(0);

    const civicOnlyGrid = Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => createTile(x, y)));
    for (let x = 0; x < 5; x += 1) civicOnlyGrid[2][x] = createTile(x, 2, { type: TileType.ROAD });
    civicOnlyGrid[1][1] = createTile(1, 1, { type: TileType.SCHOOL, powered: true });
    civicOnlyGrid[1][3] = createTile(3, 1, { type: TileType.WASTE_MANAGEMENT, powered: true });
    civicOnlyGrid[3][1] = createTile(1, 3, { type: TileType.RESIDENTIAL, population: 30, powered: true, watered: true });
    const civicOnlyResult = simulateCityServices(civicOnlyGrid, buildRoadGraph(civicOnlyGrid), 30, 4, 50, 5, 9, []);
    expect(civicOnlyResult.serviceResponseQuality).toBe(0);
  });
});
