import { ActiveTool, RoadClass, ROAD_MAINTENANCE_COSTS, TileType } from './types';

export interface BuildForecast {
  capacity: number;
  jobs: number;
  households: number;
  powerDemand: number;
  waterDemand: number;
  trafficDemand: number;
  maintenance: number;
  estimatedTax: number;
  pollution: number;
  noise: number;
}

const EMPTY_FORECAST: BuildForecast = {
  capacity: 0,
  jobs: 0,
  households: 0,
  powerDemand: 0,
  waterDemand: 0,
  trafficDemand: 0,
  maintenance: 0,
  estimatedTax: 0,
  pollution: 0,
  noise: 0,
};

/**
 * Lightweight, deliberately labelled forecast for the placement preview. It
 * uses the same broad scale as the simulation constants but never mutates
 * CityState, so it is safe to call on every pointer move.
 */
export function calculateBuildForecast(tool: ActiveTool, validTiles: number, roadClass: RoadClass): BuildForecast | null {
  if (validTiles <= 0) return null;
  const forecast = { ...EMPTY_FORECAST };

  if (tool === TileType.ROAD || tool === 'TUNNEL_ROAD') {
    forecast.capacity = validTiles * (roadClass === 'HIGHWAY' ? 12 : roadClass === 'ARTERIAL' ? 8 : 4);
    forecast.trafficDemand = validTiles * (roadClass === 'HIGHWAY' ? 0 : 1);
    forecast.maintenance = validTiles * ROAD_MAINTENANCE_COSTS[roadClass];
    forecast.noise = validTiles * (roadClass === 'HIGHWAY' ? 3 : roadClass === 'ARTERIAL' ? 2 : 1);
    return forecast;
  }

  if (tool === TileType.RESIDENTIAL || tool === 'RESIDENTIAL_MEDIUM' || tool === 'RESIDENTIAL_HIGH') {
    forecast.capacity = validTiles * (tool === 'RESIDENTIAL_HIGH' ? 24 : tool === 'RESIDENTIAL_MEDIUM' ? 15 : 10);
    forecast.households = Math.max(1, Math.round(forecast.capacity / 2.2));
    forecast.powerDemand = validTiles;
    forecast.waterDemand = validTiles;
    forecast.trafficDemand = Math.max(1, Math.round(forecast.capacity * 0.18));
    forecast.estimatedTax = Math.max(1, Math.round(forecast.capacity * 0.35));
    forecast.noise = tool === 'RESIDENTIAL_HIGH' ? validTiles * 2 : validTiles;
    return forecast;
  }

  const jobsByType: Partial<Record<TileType, number>> = {
    [TileType.COMMERCIAL]: 8,
    [TileType.OFFICE]: 12,
    [TileType.INDUSTRIAL]: 10,
    [TileType.POWER_PLANT]: 4,
    [TileType.WATER_PUMP]: 2,
    [TileType.SCHOOL]: 2,
    [TileType.CLINIC]: 3,
    [TileType.FIRE_STATION]: 3,
    [TileType.POLICE_STATION]: 3,
  };
  const perTileJobs = jobsByType[tool as TileType] ?? 0;
  forecast.jobs = validTiles * perTileJobs;
  forecast.powerDemand = validTiles;
  forecast.waterDemand = validTiles;
  forecast.trafficDemand = Math.max(1, Math.round(forecast.jobs * 0.14));
  forecast.estimatedTax = Math.max(1, Math.round(forecast.jobs * (tool === TileType.INDUSTRIAL ? 0.8 : 1.1)));
  forecast.pollution = tool === TileType.INDUSTRIAL ? validTiles * 4 : tool === TileType.POWER_PLANT ? validTiles * 5 : 0;
  forecast.noise = tool === TileType.INDUSTRIAL || tool === TileType.POWER_PLANT ? validTiles * 4 : validTiles;
  return forecast;
}
