import { describe, expect, it } from 'vitest';
import { simulateLogistics } from './logistics';
import { buildRoadGraph } from './traffic';
import { createTile, TileType } from './types';

function makeGrid(withHighway: boolean) {
  const grid = Array.from({ length: 4 }, (_, y) =>
    Array.from({ length: 6 }, (_, x) => createTile(x, y)),
  );
  for (let x = 0; x < 6; x += 1) {
    grid[1][x] = createTile(x, 1, {
      type: TileType.ROAD,
      roadClass: withHighway && x === 0 ? 'HIGHWAY' : 'ARTERIAL',
    });
  }
  grid[0][2] = createTile(2, 0, { type: TileType.INDUSTRIAL, jobs: 20 });
  grid[0][4] = createTile(4, 0, { type: TileType.COMMERCIAL, jobs: 15 });
  grid[2][4] = createTile(4, 2, { type: TileType.RESIDENTIAL, population: 40 });
  return grid;
}

describe('freight logistics simulation', () => {
  it('connects industrial output to the external highway and reports reliable freight', () => {
    const grid = makeGrid(true);
    const result = simulateLogistics(grid, buildRoadGraph(grid));

    expect(result.connectedIndustries).toBe(1);
    expect(result.industrialAccess).toBeGreaterThan(0);
    expect(result.freightDemand).toBeGreaterThan(0);
    expect(result.freightCapacity).toBeGreaterThan(0);
    expect(result.freightReliability).toBeGreaterThan(0);
    expect(result.freightTrips.length).toBeGreaterThan(0);
    expect(result.freightTrips.some((trip) => trip.source === 'LOCAL_PRODUCTION')).toBe(true);
  });

  it('detects an industrial district with no external road connection', () => {
    const grid = makeGrid(false);
    const result = simulateLogistics(grid, buildRoadGraph(grid));

    expect(result.connectedIndustries).toBe(0);
    expect(result.freightReliability).toBe(0);
    expect(result.industrialAccess).toBe(0);
  });

  it('uses a powered warehouse as an inventory buffer and distribution leg', () => {
    const grid = makeGrid(true);
    grid[0][3] = createTile(3, 0, { type: TileType.WAREHOUSE, powered: true });
    const result = simulateLogistics(grid, buildRoadGraph(grid), { '3,0': 40 });

    expect(result.warehouses).toBe(1);
    expect(result.warehouseCapacity).toBe(80);
    expect(result.warehouseInventory['3,0']).toBeGreaterThan(0);
    expect(result.freightTrips.some((trip) => trip.source === 'WAREHOUSE_DISTRIBUTION')).toBe(true);
  });

  it('uses a powered cargo terminal as an import gateway with finite throughput', () => {
    const grid = makeGrid(true);
    grid[0][3] = createTile(3, 0, { type: TileType.CARGO_TERMINAL, powered: true });
    const result = simulateLogistics(grid, buildRoadGraph(grid));

    expect(result.cargoTerminals).toBe(1);
    expect(result.cargoThroughput).toBe(8);
    expect(result.freightTrips.some((trip) => trip.source === 'IMPORT')).toBe(true);
  });

  it('tracks resource-based commodity supply separately from aggregate freight', () => {
    const grid = makeGrid(true);
    grid[0][2].resource = 'ore';

    const result = simulateLogistics(grid, buildRoadGraph(grid));

    expect(result.commoditySupply.MATERIALS).toBeGreaterThan(0);
    expect(result.commodityDemand.MATERIALS).toBeGreaterThan(0);
    expect(result.commodityStock.MATERIALS).toBeGreaterThan(0);
    expect(result.freightTrips.some((trip) => trip.commodity === 'MATERIALS')).toBe(true);
  });

  it('couples industrial output to recipe inputs and gateway support', () => {
    const grid = makeGrid(true);
    const result = simulateLogistics(grid, buildRoadGraph(grid));

    expect(result.productionInputDemand.MATERIALS).toBeGreaterThan(0);
    expect(result.productionInputDemand.FUEL).toBeGreaterThan(0);
    expect(result.productionEfficiency).toBeGreaterThan(0);
    expect(result.productionEfficiency).toBeLessThanOrEqual(1);
  });

  it('imports missing commodity categories even when aggregate freight is sufficient', () => {
    const grid = makeGrid(true);
    grid[0][2].resource = 'fertile';

    const result = simulateLogistics(grid, buildRoadGraph(grid));

    expect(result.commoditySupply.FOOD).toBeGreaterThan(0);
    expect(result.freightTrips.some((trip) => trip.source === 'IMPORT')).toBe(true);
    expect(Math.min(...Object.values(result.commodityStock))).toBeGreaterThan(0);
  });

  it('writes company telemetry for specialized industry, commerce, and offices', () => {
    const grid = makeGrid(true);
    grid[0][2].resource = 'fertile';
    grid[0][3] = createTile(3, 0, { type: TileType.OFFICE, level: 2, jobs: 24 });

    simulateLogistics(grid, buildRoadGraph(grid));

    expect(grid[0][2].companySector).toBe('SPECIALIZED_FOOD');
    expect(grid[0][2].companyEfficiency).toBeGreaterThan(0);
    expect(grid[0][2].companyProfit).toBeDefined();
    expect(grid[0][4].companySector).toBe('RETAIL_SERVICES');
    expect(grid[0][3].companySector).toBe('OFFICE_SERVICES');
    expect(grid[0][3].companyProfit).toBeDefined();
  });
});
