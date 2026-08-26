import { getRoadClass, TileData, TileType } from './types';
import { RoadGraph, getAdjacentRoadNodeKey } from './traffic';
import { findRoadPath } from './citizenSimulation/trips';

export type FreightTripSource = 'LOCAL_PRODUCTION' | 'IMPORT' | 'WAREHOUSE_DISTRIBUTION' | 'EXPORT';
export type FreightCommodity = 'FOOD' | 'GOODS' | 'MATERIALS' | 'FUEL';

export const FREIGHT_COMMODITIES: FreightCommodity[] = ['FOOD', 'GOODS', 'MATERIALS', 'FUEL'];

export interface ProductionRecipe {
  output: FreightCommodity;
  inputs: Partial<Record<FreightCommodity, number>>;
}

export interface ProductionChain {
  id: string;
  output: FreightCommodity;
  stages: Array<{
    id: string;
    inputs: Partial<Record<FreightCommodity, number>>;
    efficiency: number;
  }>;
}

/** Input recipes keep industrial output coupled to an actual supply chain. */
export const PRODUCTION_RECIPES: Record<FreightCommodity, ProductionRecipe> = {
  FOOD: { output: 'FOOD', inputs: { MATERIALS: 0.08, FUEL: 0.03 } },
  GOODS: { output: 'GOODS', inputs: { MATERIALS: 0.45, FUEL: 0.08 } },
  MATERIALS: { output: 'MATERIALS', inputs: { FUEL: 0.12 } },
  FUEL: { output: 'FUEL', inputs: { MATERIALS: 0.08 } },
};

/** Multi-stage recipes keep the original balance while exposing explicit intermediate production. */
export const PRODUCTION_CHAINS: Record<FreightCommodity, ProductionChain> = {
  FOOD: { id: 'food-chain', output: 'FOOD', stages: [{ id: 'farm-inputs', inputs: { MATERIALS: 0.05, FUEL: 0.02 }, efficiency: 1 }, { id: 'food-processing', inputs: { MATERIALS: 0.03, FUEL: 0.01 }, efficiency: 1 }] },
  GOODS: { id: 'goods-chain', output: 'GOODS', stages: [{ id: 'parts', inputs: { MATERIALS: 0.30, FUEL: 0.04 }, efficiency: 1 }, { id: 'assembly', inputs: { MATERIALS: 0.15, FUEL: 0.04 }, efficiency: 1 }] },
  MATERIALS: { id: 'materials-chain', output: 'MATERIALS', stages: [{ id: 'extraction', inputs: { FUEL: 0.12 }, efficiency: 1 }] },
  FUEL: { id: 'fuel-chain', output: 'FUEL', stages: [{ id: 'refining', inputs: { MATERIALS: 0.08 }, efficiency: 1 }] },
};

function inputsForProductionChain(commodity: FreightCommodity): Partial<Record<FreightCommodity, number>> {
  const chain = PRODUCTION_CHAINS[commodity];
  return chain.stages.reduce<Partial<Record<FreightCommodity, number>>>((total, stage) => {
    for (const [input, ratio] of Object.entries(stage.inputs) as [FreightCommodity, number][]) {
      total[input] = (total[input] ?? 0) + ratio / Math.max(0.1, stage.efficiency);
    }
    return total;
  }, {});
}

export interface FreightTrip {
  id: string;
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  path: [number, number][];
  cargo: number;
  travelTime: number;
  source: FreightTripSource;
  commodity?: FreightCommodity;
}

export interface LogisticsSimulationResult {
  freightDemand: number;
  freightCapacity: number;
  freightReliability: number;
  industrialAccess: number;
  commercialStock: number;
  connectedIndustries: number;
  freightTrips: FreightTrip[];
  warehouses: number;
  warehouseCapacity: number;
  warehouseInventory: Record<string, number>;
  warehouseBuffer: number;
  commodityDemand: Record<FreightCommodity, number>;
  commoditySupply: Record<FreightCommodity, number>;
  commodityStock: Record<FreightCommodity, number>;
  productionInputDemand: Record<FreightCommodity, number>;
  productionEfficiency: number;
  cargoTerminals: number;
  cargoThroughput: number;
}

function commodityForIndustry(tile: TileData): FreightCommodity {
  if (tile.resource === 'fertile') return 'FOOD';
  if (tile.resource === 'ore' || tile.resource === 'forest') return 'MATERIALS';
  if (tile.resource === 'oil') return 'FUEL';
  return 'GOODS';
}

/**
 * Calculates a compact but real freight model. Industrial output and city
 * consumption need a road path to an external highway; local streets can feed
 * that path, while arterial/highway frontage improves the access score.
 */
export function simulateLogistics(
  grid: TileData[][],
  roadGraph: RoadGraph,
  previousWarehouseInventory: Record<string, number> = {},
  advanceInventory = true,
  contractImports: Partial<Record<FreightCommodity, number>> = {},
): LogisticsSimulationResult {
  const highwayKeys = [...roadGraph.nodes.values()]
    .filter((node) => node.roadClass === 'HIGHWAY')
    .map((node) => node.key);

  const distanceToHighway = new Map<string, number>();
  const queue: string[] = [];
  for (const key of highwayKeys) {
    distanceToHighway.set(key, 0);
    queue.push(key);
  }

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const key = queue[queueIndex++];
    const distance = distanceToHighway.get(key) ?? 0;
    const node = roadGraph.nodes.get(key);
    if (!node) continue;
    for (const neighbor of node.neighbors) {
      if (!distanceToHighway.has(neighbor)) {
        distanceToHighway.set(neighbor, distance + 1);
        queue.push(neighbor);
      }
    }
  }

  let industrialJobs = 0;
  let commercialJobs = 0;
  let population = 0;
  let industrialOutput = 0;
  let accessSum = 0;
  let connectedIndustries = 0;
  const commoditySupply: Record<FreightCommodity, number> = { FOOD: 0, GOODS: 0, MATERIALS: 0, FUEL: 0 };
  const productionInputDemand: Record<FreightCommodity, number> = { FOOD: 0, GOODS: 0, MATERIALS: 0, FUEL: 0 };
  const industrialFacilities: { x: number; y: number; roadKey: string; output: number; commodity: FreightCommodity; tile: TileData }[] = [];
  const commercialFacilities: { x: number; y: number; roadKey: string; demand: number; tile: TileData }[] = [];
  const officeFacilities: TileData[] = [];
  const warehouseFacilities: { x: number; y: number; roadKey: string; capacity: number }[] = [];
  const cargoTerminalFacilities: { x: number; y: number; roadKey: string; capacity: number }[] = [];
  const warehouseCapacityByLevel = [0, 80, 160, 300, 500, 800];
  const cargoCapacityByLevel = [0, 160, 320, 560, 900, 1400];

  for (const row of grid) {
    for (const tile of row) {
      if (tile.type === TileType.RESIDENTIAL) population += tile.population;
      if (tile.type === TileType.WAREHOUSE) {
        const warehouseRoadKey = getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph);
        if (warehouseRoadKey && tile.powered) {
          warehouseFacilities.push({
            x: tile.x,
            y: tile.y,
            roadKey: warehouseRoadKey,
            capacity: warehouseCapacityByLevel[Math.min(5, Math.max(1, tile.level))],
          });
        }
      }
      if (tile.type === TileType.CARGO_TERMINAL) {
        const terminalRoadKey = getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph);
        if (terminalRoadKey && tile.powered) {
          cargoTerminalFacilities.push({
            x: tile.x,
            y: tile.y,
            roadKey: terminalRoadKey,
            capacity: cargoCapacityByLevel[Math.min(5, Math.max(1, tile.level))],
          });
        }
      }
      if (tile.type === TileType.COMMERCIAL) {
        commercialJobs += tile.jobs;
        tile.companySector = 'RETAIL_SERVICES';
        const commercialRoadKey = getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph);
        if (commercialRoadKey && tile.jobs > 0) {
          commercialFacilities.push({
            x: tile.x,
            y: tile.y,
            roadKey: commercialRoadKey,
            demand: Math.max(1, tile.jobs * 0.65),
            tile,
          });
        }
      }
      if (tile.type === TileType.OFFICE) {
        officeFacilities.push(tile);
        tile.companySector = 'OFFICE_SERVICES';
        const capacity = Math.max(1, tile.level * 28);
        tile.companyEfficiency = Math.round(Math.min(1, tile.jobs / capacity) * 100) / 100;
        tile.inputShortage = 0;
      }
      if (tile.type !== TileType.INDUSTRIAL) continue;

      industrialJobs += tile.jobs;
      const roadKey = getAdjacentRoadNodeKey(tile.x, tile.y, roadGraph);
      const roadNode = roadKey ? roadGraph.nodes.get(roadKey) : undefined;
      const distance = roadKey ? distanceToHighway.get(roadKey) : undefined;
      if (roadNode && distance !== undefined) {
        connectedIndustries += 1;
        const distanceFactor = Math.max(0.2, 1 - distance / 80);
        const classFactor = getRoadClass(roadNode) === 'HIGHWAY'
          ? 1.12
          : getRoadClass(roadNode) === 'ARTERIAL' ? 1.04 : 0.92;
        const access = Math.min(1, distanceFactor * classFactor);
        const output = tile.jobs * 1.8 * access;
        industrialOutput += output;
        const commodity = commodityForIndustry(tile);
        commoditySupply[commodity] += output;
        accessSum += access;
        if (output > 0) industrialFacilities.push({ x: tile.x, y: tile.y, roadKey, output, commodity, tile });
      }
    }
  }

  // A highway segment provides an import/export gateway even before the city
  // has enough industry to satisfy its own commercial demand.
  const cargoThroughput = cargoTerminalFacilities.reduce((sum, terminal) => sum + terminal.capacity * 0.05, 0);
  const gatewayCapacity = highwayKeys.length * 1.5 + cargoThroughput;
  const commodityDemand: Record<FreightCommodity, number> = {
    FOOD: Math.round(population * 0.16 + commercialJobs * 0.28),
    GOODS: Math.round(population * 0.12 + commercialJobs * 0.34),
    MATERIALS: Math.round(industrialJobs * 0.22 + commercialJobs * 0.08),
    FUEL: Math.round(industrialJobs * 0.18 + commercialJobs * 0.08),
  };
  for (const industry of industrialFacilities) {
    const inputs = inputsForProductionChain(industry.commodity);
    for (const [commodity, ratio] of Object.entries(inputs) as [FreightCommodity, number][]) {
      productionInputDemand[commodity] += industry.output * ratio;
    }
  }
  for (const commodity of FREIGHT_COMMODITIES) {
    commodityDemand[commodity] += Math.round(productionInputDemand[commodity]);
    commoditySupply[commodity] += Math.max(0, contractImports[commodity] ?? 0);
  }

  // Resolve production inputs before generating freight runs. Local output is
  // still allowed to bootstrap a district, but only the fraction supported by
  // available local production plus the outside gateway can operate.
  const gatewayInputSupport = highwayKeys.length > 0 ? gatewayCapacity / FREIGHT_COMMODITIES.length : 0;
  const inputCoverage = FREIGHT_COMMODITIES
    .filter((commodity) => productionInputDemand[commodity] > 0)
    .map((commodity) => Math.min(1, (commoditySupply[commodity] + gatewayInputSupport) / productionInputDemand[commodity]));
  const productionEfficiency = inputCoverage.length > 0
    ? Math.round(Math.min(...inputCoverage) * 100) / 100
    : 1;
  if (productionEfficiency < 1) {
    for (const industry of industrialFacilities) industry.output *= productionEfficiency;
    for (const commodity of FREIGHT_COMMODITIES) commoditySupply[commodity] *= productionEfficiency;
    industrialOutput *= productionEfficiency;
  }

  // Persist company-level telemetry on the parcel so the inspector, save
  // system, and future UI overlays can explain why a company is thriving or
  // losing money instead of exposing only city-wide averages.
  for (const industry of industrialFacilities) {
    const inputShortage = Math.max(0, 1 - productionEfficiency);
    industry.tile.companySector = `SPECIALIZED_${industry.commodity}`;
    industry.tile.companyEfficiency = Math.round(Math.max(0, Math.min(1, productionEfficiency * (industry.output > 0 ? 1 : 0))) * 100) / 100;
    industry.tile.inputShortage = Math.round(inputShortage * 100) / 100;
    const revenue = industry.output * 2.25;
    const wages = industry.tile.jobs * 0.78;
    const logisticsCost = industry.output * (0.3 + inputShortage * 1.4);
    industry.tile.companyProfit = Math.round(revenue - wages - logisticsCost);
  }

  const productionInputTotal = Object.values(productionInputDemand).reduce((sum, value) => sum + value, 0);
  const freightDemand = Math.round(industrialJobs * 0.8 + commercialJobs * 0.65 + population * 0.18 + productionInputTotal * 0.35);
  const freightCapacity = Math.round(industrialOutput + gatewayCapacity);
  const baseFreightReliability = freightDemand > 0
    ? Math.round(Math.max(0, Math.min(100, (freightCapacity / freightDemand) * 100)))
    : 100;
  const industrialAccess = industrialJobs > 0
    ? Math.round(Math.max(0, Math.min(100, (accessSum / Math.max(1, connectedIndustries)) * 100)))
    : 100;

  const freightTrips: FreightTrip[] = [];
  const maxFreightTrips = 120;
  const orderedCommercial = [...commercialFacilities].sort((a, b) => a.x + a.y - (b.x + b.y));
  const deliveryTargets = warehouseFacilities.length > 0
    ? warehouseFacilities.map((warehouse) => ({
      ...warehouse,
      demand: Math.max(1, warehouse.capacity - (previousWarehouseInventory[`${warehouse.x},${warehouse.y}`] ?? 0)),
    }))
    : orderedCommercial;

  // Industrial output is converted into concrete delivery runs. We keep the
  // number of agents bounded while retaining the nearest-road path for every
  // run, so freight contributes to traffic and can be rendered as trucks.
  for (const industry of industrialFacilities) {
    if (freightTrips.length >= maxFreightTrips) break;
    const destinations = [...deliveryTargets]
      .sort((a, b) => (
        Math.abs(a.x - industry.x) + Math.abs(a.y - industry.y)
        - (Math.abs(b.x - industry.x) + Math.abs(b.y - industry.y))
      ))
      .slice(0, 2);
    for (const commercial of destinations) {
      if (freightTrips.length >= maxFreightTrips) break;
      const path = findRoadPath(industry.roadKey, commercial.roadKey, roadGraph);
      if (path.length < 2) continue;
      const cargo = Math.max(1, Math.round(Math.min(industry.output, commercial.demand) * 0.18));
      freightTrips.push({
        id: `freight-local-${industry.x}-${industry.y}-${commercial.x}-${commercial.y}`,
        origin: { x: industry.x, y: industry.y },
        destination: { x: commercial.x, y: commercial.y },
        path,
        cargo,
        travelTime: Math.max(1, Math.round(path.length * 1.4)),
        source: 'LOCAL_PRODUCTION',
        commodity: industry.commodity,
      });
    }
  }

  // When local production cannot cover commercial demand, add import runs
  // from the closest external highway entry. This makes the gateway useful as
  // a visible supply-chain source rather than only an aggregate capacity.
  // Aggregate capacity can be healthy while a specific commodity is absent
  // (for example, a fertile district can overproduce FOOD but have no FUEL or
  // MATERIALS). Imports therefore respond to the largest commodity deficits,
  // not only to the blended freight total.
  const commodityDeficit = FREIGHT_COMMODITIES.reduce(
    (sum, commodity) => sum + Math.max(0, commodityDemand[commodity] - commoditySupply[commodity]),
    0,
  );
  const importGap = Math.max(0, commercialJobs * 0.65 - industrialOutput, commodityDeficit * 0.4);
  const cargoGatewayNodes = cargoTerminalFacilities
    .map((terminal) => roadGraph.nodes.get(terminal.roadKey))
    .filter((node): node is NonNullable<typeof node> => Boolean(node));
  const gatewayNodes = [
    ...highwayKeys.map((key) => roadGraph.nodes.get(key)),
    ...cargoGatewayNodes,
  ].filter((node): node is NonNullable<typeof node> => Boolean(node));
  if (importGap > 0 && gatewayNodes.length > 0) {
    const gateway = gatewayNodes.sort((a, b) => a.x + a.y - (b.x + b.y))[0];
    if (gateway) {
      const importTargets = warehouseFacilities.length > 0 ? deliveryTargets : orderedCommercial;
      let remainingImportGap = importGap;
      for (const commercial of importTargets) {
        if (freightTrips.length >= maxFreightTrips) break;
        const path = findRoadPath(gateway.key, commercial.roadKey, roadGraph);
        if (path.length < 2) continue;
        for (let commodityPass = 0; commodityPass < FREIGHT_COMMODITIES.length; commodityPass += 1) {
          if (freightTrips.length >= maxFreightTrips) break;
          const commodity = FREIGHT_COMMODITIES
            .slice()
            .sort((a, b) => (commoditySupply[a] / Math.max(1, commodityDemand[a])) - (commoditySupply[b] / Math.max(1, commodityDemand[b])))[0];
          if (commodityDemand[commodity] <= commoditySupply[commodity] && remainingImportGap <= 0) break;
          const cargo = Math.max(1, Math.round(Math.min(Math.max(1, remainingImportGap), commercial.demand) * 0.12));
          commoditySupply[commodity] += cargo;
          remainingImportGap = Math.max(0, remainingImportGap - cargo);
          freightTrips.push({
            id: `freight-import-${gateway.x}-${gateway.y}-${commercial.x}-${commercial.y}-${commodity.toLowerCase()}`,
            origin: { x: gateway.x, y: gateway.y },
            destination: { x: commercial.x, y: commercial.y },
            path,
            cargo,
            travelTime: Math.max(1, Math.round(path.length * 1.5)),
            source: 'IMPORT',
            commodity,
          });
        }
      }
    }
  }

  // A powered cargo terminal can also move genuine surplus out of the city.
  // Exports are bounded by terminal throughput so one rich industrial tile
  // cannot create unbounded agents or silently erase local stock.
  if (cargoTerminalFacilities.length > 0) {
    for (const industry of industrialFacilities) {
      if (freightTrips.length >= maxFreightTrips) break;
      const surplus = Math.max(0, commoditySupply[industry.commodity] - commodityDemand[industry.commodity]);
      if (surplus < 1) continue;
      const terminal = [...cargoTerminalFacilities]
        .sort((a, b) => Math.abs(a.x - industry.x) + Math.abs(a.y - industry.y) - (Math.abs(b.x - industry.x) + Math.abs(b.y - industry.y)))[0];
      if (!terminal) continue;
      const path = findRoadPath(industry.roadKey, terminal.roadKey, roadGraph);
      if (path.length < 2) continue;
      const cargo = Math.max(1, Math.min(Math.round(terminal.capacity * 0.1), Math.round(surplus * 0.25)));
      commoditySupply[industry.commodity] = Math.max(0, commoditySupply[industry.commodity] - cargo);
      freightTrips.push({
        id: `freight-export-${industry.x}-${industry.y}-${terminal.x}-${terminal.y}-${industry.commodity.toLowerCase()}`,
        origin: { x: industry.x, y: industry.y },
        destination: { x: terminal.x, y: terminal.y },
        path,
        cargo,
        travelTime: Math.max(1, Math.round(path.length * 1.5)),
        source: 'EXPORT',
        commodity: industry.commodity,
      });
    }
  }

  const nextWarehouseInventory: Record<string, number> = {};
  const totalWarehouseCapacity = warehouseFacilities.reduce((sum, warehouse) => sum + warehouse.capacity, 0);
  const warehouseInflow = new Map<string, number>();
  for (const trip of freightTrips) {
    if (trip.source !== 'LOCAL_PRODUCTION' && trip.source !== 'IMPORT') continue;
    const key = `${trip.destination.x},${trip.destination.y}`;
    if (warehouseFacilities.some((warehouse) => `${warehouse.x},${warehouse.y}` === key)) {
      warehouseInflow.set(key, (warehouseInflow.get(key) ?? 0) + trip.cargo);
    }
  }

  const totalWarehouseDraw = Math.min(
    warehouseFacilities.reduce((sum, warehouse) => sum + warehouse.capacity, 0),
    Math.round(commercialJobs * 0.25),
  );
  for (const warehouse of warehouseFacilities) {
    const key = `${warehouse.x},${warehouse.y}`;
    const previous = Math.max(0, previousWarehouseInventory[key] ?? 0);
    const inflow = warehouseInflow.get(key) ?? 0;
    const drawShare = totalWarehouseCapacity > 0 ? totalWarehouseDraw * (warehouse.capacity / totalWarehouseCapacity) : 0;
    const rawInventory = advanceInventory ? previous + inflow - drawShare : previous;
    nextWarehouseInventory[key] = Math.max(0, Math.min(warehouse.capacity, Math.round(rawInventory)));
  }

  // Warehouses feed nearby commercial parcels as a second leg. This makes a
  // warehouse a buffer and a routing decision, rather than a decorative tile.
  if (warehouseFacilities.length > 0 && orderedCommercial.length > 0) {
    for (const warehouse of warehouseFacilities) {
      if (freightTrips.length >= maxFreightTrips) break;
      const key = `${warehouse.x},${warehouse.y}`;
      let available = nextWarehouseInventory[key] ?? 0;
      if (available <= 0) continue;
      const destinations = [...orderedCommercial]
        .sort((a, b) => (
          Math.abs(a.x - warehouse.x) + Math.abs(a.y - warehouse.y)
          - (Math.abs(b.x - warehouse.x) + Math.abs(b.y - warehouse.y))
        ))
        .slice(0, 2);
      for (const commercial of destinations) {
        if (freightTrips.length >= maxFreightTrips || available <= 0) break;
        const path = findRoadPath(warehouse.roadKey, commercial.roadKey, roadGraph);
        if (path.length < 2) continue;
        const cargo = Math.max(1, Math.min(available, Math.round(commercial.demand * 0.12)));
        freightTrips.push({
          id: `freight-warehouse-${warehouse.x}-${warehouse.y}-${commercial.x}-${commercial.y}`,
          origin: { x: warehouse.x, y: warehouse.y },
          destination: { x: commercial.x, y: commercial.y },
          path,
          cargo,
          travelTime: Math.max(1, Math.round(path.length * 1.3)),
          source: 'WAREHOUSE_DISTRIBUTION',
          commodity: 'GOODS',
        });
        available -= cargo;
      }
      nextWarehouseInventory[key] = available;
    }
  }

  const storedInventory = Object.values(nextWarehouseInventory).reduce((sum, value) => sum + value, 0);
  const warehouseBuffer = totalWarehouseCapacity > 0
    ? Math.round(Math.max(0, Math.min(100, (storedInventory / totalWarehouseCapacity) * 100)))
    : 0;
  const commodityStock: Record<FreightCommodity, number> = Object.fromEntries(
    FREIGHT_COMMODITIES.map((commodity) => [
      commodity,
      commodityDemand[commodity] > 0
        ? Math.round(Math.max(0, Math.min(100, (commoditySupply[commodity] / commodityDemand[commodity]) * 100)))
        : 100,
    ]),
  ) as Record<FreightCommodity, number>;
  const averageCommodityStock = Math.round(FREIGHT_COMMODITIES.reduce((sum, commodity) => sum + commodityStock[commodity], 0) / FREIGHT_COMMODITIES.length);
  const freightReliability = warehouseFacilities.length > 0
    ? Math.round(baseFreightReliability * 0.7 + warehouseBuffer * 0.3)
    : baseFreightReliability;
  const commercialStock = warehouseFacilities.length > 0
    ? Math.round(baseFreightReliability * 0.45 + warehouseBuffer * 0.2 + averageCommodityStock * 0.35)
    : Math.round(freightReliability * 0.65 + averageCommodityStock * 0.35);

  for (const commercial of commercialFacilities) {
    const efficiency = Math.max(0, Math.min(1, commercialStock / 100));
    commercial.tile.companyEfficiency = Math.round(efficiency * 100) / 100;
    commercial.tile.inputShortage = Math.round((1 - efficiency) * 100) / 100;
    commercial.tile.companyProfit = Math.round(commercial.tile.jobs * (0.72 + efficiency * 0.9) - commercial.tile.jobs * 0.62);
  }
  for (const office of officeFacilities) {
    const efficiency = office.companyEfficiency ?? 0;
    office.companyProfit = Math.round(office.jobs * (1.15 + efficiency * 1.1) - office.jobs * 0.95);
  }

  return {
    freightDemand,
    freightCapacity,
    freightReliability,
    industrialAccess,
    commercialStock,
    connectedIndustries,
    freightTrips,
    warehouses: warehouseFacilities.length,
    warehouseCapacity: totalWarehouseCapacity,
    warehouseInventory: nextWarehouseInventory,
    warehouseBuffer,
    commodityDemand,
    commoditySupply: Object.fromEntries(FREIGHT_COMMODITIES.map((commodity) => [commodity, Math.round(commoditySupply[commodity])])) as Record<FreightCommodity, number>,
    commodityStock,
    productionInputDemand: Object.fromEntries(FREIGHT_COMMODITIES.map((commodity) => [commodity, Math.round(productionInputDemand[commodity])])) as Record<FreightCommodity, number>,
    productionEfficiency,
    cargoTerminals: cargoTerminalFacilities.length,
    cargoThroughput: Math.round(cargoThroughput),
  };
}
