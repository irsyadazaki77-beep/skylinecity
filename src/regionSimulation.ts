import { CityState, RegionState, TileType } from './types';
import { REGION_SIZE, getRegionCoord, getRegionKey } from './mapGenerator';

export function createRegionState(rx: number, ry: number, active = false, day = 1): RegionState {
  return {
    key: getRegionKey(rx, ry),
    rx,
    ry,
    active,
    loaded: active,
    simulationLevel: active ? 'FULL' : 'BACKGROUND',
    lastSimulatedDay: day,
    residentCount: 0,
    jobCount: 0,
    trafficLoad: 0,
    freightLoad: 0,
    waterDepth: 0,
  };
}

function hasRegionActivity(region: RegionState): boolean {
  return region.residentCount > 0
    || region.jobCount > 0
    || region.trafficLoad > 0
    || region.freightLoad > 0
    || region.waterDepth > 0;
}

function hasActiveEmergencyInRegion(state: CityState, key: string): boolean {
  const [rx, ry] = key.split(',').map(Number);
  if (!Number.isFinite(rx) || !Number.isFinite(ry)) return false;
  return [...(state.incidents ?? []), ...(state.disasters ?? [])].some((event) => {
    const x = 'x' in event ? event.x : event.centerX;
    const y = 'y' in event ? event.y : event.centerY;
    const coord = getRegionCoord(x, y);
    return getRegionKey(coord.rx, coord.ry) === key;
  });
}

/**
 * Regions with no residents, jobs, network load, water, or active emergency
 * stay FROZEN. They retain their persisted aggregate state but do not consume
 * a background simulation pass until something can affect them again.
 */
export function getRegionSimulationLevel(state: CityState, region: RegionState, active: boolean): RegionState['simulationLevel'] {
  if (active) return 'FULL';
  return hasRegionActivity(region) || hasActiveEmergencyInRegion(state, region.key) ? 'BACKGROUND' : 'FROZEN';
}

export function calculateRegionTelemetry(state: CityState, activeRegionKeys = state.activeRegionKeys ?? state.unlockedRegions ?? []): Record<string, RegionState> {
  const regions: Record<string, RegionState> = {};
  const active = new Set(activeRegionKeys);
  for (const key of state.unlockedRegions ?? []) {
    const [rx, ry] = key.split(',').map(Number);
    if (!Number.isFinite(rx) || !Number.isFinite(ry)) continue;
    const previous = state.regions?.[key];
    regions[key] = previous && !active.has(key)
      ? {
        ...previous,
        active: false,
        loaded: false,
        simulationLevel: getRegionSimulationLevel(state, previous, false),
        lastSimulatedDay: previous.lastSimulatedDay,
      }
      : createRegionState(rx, ry, active.has(key), state.day);
  }
  for (const row of state.grid) {
    for (const tile of row) {
      const { rx, ry } = getRegionCoord(tile.x, tile.y);
      const key = getRegionKey(rx, ry);
      const region = regions[key] ?? createRegionState(rx, ry, active.has(key), state.day);
      // Unloaded regions use their aggregate snapshot until they become active.
      // This prevents streaming from resetting long-running background growth.
      if (!region.active && state.regions?.[key]) continue;
      if (tile.type === TileType.RESIDENTIAL) region.residentCount += tile.population || 0;
      if (tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL) region.jobCount += tile.jobs || 0;
      if (tile.type === TileType.ROAD) region.trafficLoad += tile.traffic || 0;
      region.waterDepth += tile.waterDepth || 0;
      regions[key] = region;
    }
  }
  for (const region of Object.values(regions)) {
    const previous = state.regions?.[region.key];
    if (region.active && previous) {
      region.residentCount = Math.max(region.residentCount, previous.residentCount);
      region.jobCount = Math.max(region.jobCount, previous.jobCount);
    }
    region.waterDepth = Math.round((region.waterDepth / (REGION_SIZE * REGION_SIZE)) * 100) / 100;
    if (region.active || region.simulationLevel === 'BACKGROUND') region.lastSimulatedDay = state.day;
  }
  return regions;
}

/** Returns only the region keys that should receive full-detail rendering/simulation. */
export function getActiveRegionKeys(state: CityState, focus?: { x: number; y: number }): string[] {
  const fallback = state.activeRegionKeys ?? state.unlockedRegions ?? ['1,1'];
  if (!focus) return fallback;
  const center = getRegionCoord(focus.x, focus.y);
  return (state.unlockedRegions ?? fallback).filter((key) => {
    const [rx, ry] = key.split(',').map(Number);
    return Math.abs(rx - center.rx) <= 1 && Math.abs(ry - center.ry) <= 1;
  });
}

export function advanceBackgroundRegions(state: CityState, activeRegionKeys = state.activeRegionKeys ?? []): CityState {
  const active = new Set(activeRegionKeys);
  const regions = { ...(state.regions ?? calculateRegionTelemetry(state, activeRegionKeys)) };
  for (const region of Object.values(regions)) {
    region.active = active.has(region.key);
    region.loaded = region.active;
    region.simulationLevel = getRegionSimulationLevel(state, region, region.active);
    if (!region.active) {
      if (region.simulationLevel === 'FROZEN') continue;
      // Background simulation is intentionally aggregate and deterministic.
      region.residentCount = Math.max(0, Math.round(region.residentCount * 1.002));
      region.jobCount = Math.max(0, Math.round(region.jobCount * 1.0015));
      region.trafficLoad = Math.max(0, Math.round(region.trafficLoad * 0.98));
      region.freightLoad = Math.max(0, Math.round(region.freightLoad * 0.99));
      region.lastSimulatedDay = state.day;
    }
  }
  return { ...state, regions };
}
