import { getRoadClass, TileData, TileType } from './types';
import { CityDistrict, getDistrictAt } from './districts';
import type { Household } from './citizenSimulation/types';

export function aggregateHomeSatisfaction(households: Pick<Household, 'residence' | 'citizenIds' | 'satisfaction'>[] = []): Record<string, number> {
  const sums = new Map<string, { sum: number; count: number }>();
  for (const household of households) {
    if (!Number.isFinite(household.satisfaction) || household.citizenIds.length === 0) continue;
    const key = `${household.residence.x},${household.residence.y}`;
    const entry = sums.get(key) ?? { sum: 0, count: 0 };
    entry.sum += household.satisfaction * household.citizenIds.length;
    entry.count += household.citizenIds.length;
    sums.set(key, entry);
  }
  return Object.fromEntries([...sums].map(([key, entry]) => [key, entry.sum / entry.count]));
}

export function getOverlayColor(tile: TileData, overlay: string, districts: CityDistrict[], satisfaction: Record<string, number> = {}): string | null {
  if (overlay === 'NONE') return null;
  if (['WASTE', 'HEALTH', 'FIRE', 'NOISE'].includes(overlay)) {
    if (tile.water || tile.type === TileType.EMPTY || tile.type === TileType.ROAD) return null;
    if (overlay === 'NOISE') return tile.noise > 60 ? '#ef4444' : tile.noise > 30 ? '#eab308' : '#22c55e';
    const covered = overlay === 'WASTE' ? tile.wasteCovered : overlay === 'HEALTH' ? tile.healthCovered : tile.fireCovered;
    return covered ? '#22c55e' : '#ef4444';
  }

  if (overlay === 'DISTRICTS') return getDistrictAt(districts, tile.x, tile.y)?.color ?? null;

  if (overlay === 'NATURAL_RESOURCES') {
    if (tile.water) return null;
    if (tile.resource === 'fertile') return '#84cc16'; // Lime green
    if (tile.resource === 'forest') return '#15803d';  // Rich green
    if (tile.resource === 'ore') return '#b45309';     // Bronze/Copper orange
    if (tile.resource === 'oil') return '#1e1b4b';     // Dark oil midnight-blue
    return null;
  }

  if (overlay === 'TRAFFIC') {
    if (tile.type !== TileType.ROAD) return null;
    const t = tile.traffic || 0;
    if (t <= 30) return '#22c55e';
    if (t <= 70) return '#eab308';
    return '#ef4444';
  }

  if (overlay === 'ROAD_CONDITION') {
    if (tile.type !== TileType.ROAD) return null;
    const condition = tile.roadCondition ?? 100;
    if (condition < 40) return '#ef4444';
    if (condition < 70) return '#f59e0b';
    return '#22c55e';
  }

  if (overlay === 'ROAD_HIERARCHY') {
    if (tile.type !== TileType.ROAD) return null;
    if (getRoadClass(tile) === 'HIGHWAY') return '#f59e0b';
    if (getRoadClass(tile) === 'ARTERIAL') return '#38bdf8';
    return '#64748b';
  }

  if (overlay === 'TRANSIT') {
    if (tile.type === TileType.BUS_DEPOT) return '#22d3ee';
    if (tile.type === TileType.TRAM_STATION) return '#a78bfa';
    if (tile.type === TileType.BUS_STOP) return '#67e8f9';
    if (tile.type === TileType.TRAM_STOP) return '#c4b5fd';
    if (tile.type === TileType.ROAD) return tile.transitCovered ? '#06b6d4' : '#334155';
    if (tile.type === TileType.RESIDENTIAL) return tile.transitCovered ? '#22c55e' : '#ef4444';
    return null;
  }

  if (overlay === 'SERVICE_RESPONSE') {
    if (tile.type === TileType.EMPTY || tile.type === TileType.ROAD || tile.water) return null;
    const responseTimes = Object.values(tile.serviceResponseTimes ?? {}).filter((value): value is number => Number.isFinite(value));
    if (responseTimes.length === 0) return '#7f1d1d';
    const fastestResponse = Math.min(...responseTimes);
    if (fastestResponse <= 5) return '#22c55e';
    if (fastestResponse <= 10) return '#eab308';
    if (fastestResponse <= 20) return '#f97316';
    return '#ef4444';
  }

  if (overlay === 'POWER') {
    if (tile.type === TileType.EMPTY || tile.type === TileType.ROAD) return null;
    return tile.powered ? '#06b6d4' : '#ef4444';
  }

  if (overlay === 'WATER') {
    if (tile.type === TileType.EMPTY || tile.type === TileType.ROAD) return null;
    return tile.watered ? '#3b82f6' : '#ef4444';
  }

  if (overlay === 'HYDROLOGY') {
    if (tile.water) return '#0ea5e9';
    const depth = tile.waterDepth ?? 0;
    if (depth >= 0.78) return '#1d4ed8';
    if (depth >= 0.48) return '#2563eb';
    if (depth >= 0.2) return '#60a5fa';
    if (Math.abs(tile.flowDx ?? 0) + Math.abs(tile.flowDy ?? 0) > 0) return '#bae6fd';
    return null;
  }

  if (overlay === 'POLLUTION') {
    const p = tile.pollution || 0;
    if (p < 10) return '#22c55e';
    if (p < 30) return '#f59e0b';
    return '#ef4444';
  }

  if (overlay === 'LAND_VALUE') {
    const v = tile.landValue ?? 35;
    if (v > 60) return '#10b981';
    if (v > 30) return '#eab308';
    return '#64748b';
  }

  if (overlay === 'CRIME' || overlay === 'POLICE') {
    const c = tile.crime || 0;
    if (c > 30) return '#a855f7';
    if (c > 10) return '#f59e0b';
    return '#22c55e';
  }

  if (overlay === 'EDUCATION') {
    const ed = tile.education || 0;
    if (ed > 50) return '#38bdf8';
    if (ed > 20) return '#f59e0b';
    return '#64748b';
  }

  if (overlay === 'HAPPINESS') {
    if (tile.type === TileType.RESIDENTIAL) {
      const value = satisfaction[`${tile.x},${tile.y}`];
      return value === undefined ? '#64748b' : value >= 60 ? '#22c55e' : value >= 35 ? '#eab308' : '#ef4444';
    }
  }

  if (overlay === 'INCIDENTS') {
    const severity = tile.incidentSeverity ?? 0;
    if (severity >= 3) return '#ef4444';
    if (severity === 2) return '#f97316';
    if (severity === 1) return '#facc15';
    return null;
  }

  if (overlay === 'DISASTERS') {
    const severity = tile.disasterSeverity ?? 0;
    if (severity >= 3) return '#dc2626';
    if (severity === 2) return '#f97316';
    if (severity === 1) return '#facc15';
    return null;
  }

  return null;
}
