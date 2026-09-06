import type { RoadGraph } from './traffic';
import { TileData, TileType } from './types';

/**
 * The simulation is intentionally still orchestrated by one deterministic
 * entry point, but its dependencies are explicit. This prevents an
 * optimization from accidentally moving a consumer ahead of the state it
 * reads.
 */
export const SIMULATION_PHASE_DEPENDENCIES = {
  INPUT: ['commandQueue', 'playerState'],
  WORLD_CLIMATE: ['day', 'seed', 'weather', 'season'],
  NETWORK: ['grid topology', 'road controls', 'unlockedUpgrades'],
  UTILITIES: ['NETWORK', 'grid utility facilities', 'events', 'climate'],
  LAND_ENVIRONMENT: ['NETWORK', 'UTILITIES', 'grid terrain', 'districts'],
  GROWTH: ['LAND_ENVIRONMENT', 'UTILITIES', 'services', 'demand', 'logistics'],
  POPULATION: ['GROWTH', 'NETWORK', 'transit availability', 'citizenState'],
  TRANSPORT: ['POPULATION', 'NETWORK', 'grid traffic inputs'],
  SERVICES: ['POPULATION', 'NETWORK', 'grid service facilities'],
  LOGISTICS: ['POPULATION', 'NETWORK', 'industrial/commercial tiles'],
  INCIDENTS: ['SERVICES', 'NETWORK', 'day', 'seed'],
  ECONOMY: ['POPULATION', 'SERVICES', 'LOGISTICS', 'TRANSIT', 'policies'],
  TELEMETRY: ['all authoritative phase outputs'],
} as const;

export type RenderChangeKind = 'TOPOLOGY' | 'BUILDING' | 'TERRAIN' | 'ROAD' | 'UTILITY';

export interface SimulationTileAggregates {
  buildingCount: number;
  reliableBuildingCount: number;
  population: number;
  jobs: number;
  officeJobs: number;
  residentialTiles: TileData[];
  commercialTiles: TileData[];
  officeTiles: TileData[];
  industrialTiles: TileData[];
  roadTiles: TileData[];
  utilityTiles: TileData[];
  serviceTiles: TileData[];
  developedTiles: TileData[];
}

export interface SimulationRenderRevisions {
  topologyRevision: number;
  buildingVisualRevision: number;
  terrainRevision: number;
  roadRevision: number;
  utilityRevision: number;
  dirtyChunkKeys: string[];
  chunkRevisions: Record<string, number>;
}

export interface SimulationTickContext {
  /** Derived graph is owned by this tick and is never persisted. */
  roadGraph: RoadGraph | null;
  tileAggregates: SimulationTileAggregates;
  changedTiles: Set<string>;
  dirtyChunkKeys: Set<string>;
  renderChanges: Set<RenderChangeKind>;
}

const RENDER_CHUNK_SIZE = 10;

function chunkKey(x: number, y: number): string {
  return `${Math.floor(x / RENDER_CHUNK_SIZE)},${Math.floor(y / RENDER_CHUNK_SIZE)}`;
}

function isBuilding(type: TileType): boolean {
  return type === TileType.RESIDENTIAL
    || type === TileType.COMMERCIAL
    || type === TileType.OFFICE
    || type === TileType.INDUSTRIAL;
}

function isUtility(type: TileType): boolean {
  return type === TileType.POWER_PLANT || type === TileType.WATER_PUMP;
}

function isService(type: TileType): boolean {
  return type === TileType.FIRE_STATION
    || type === TileType.POLICE_STATION
    || type === TileType.CLINIC
    || type === TileType.SCHOOL
    || type === TileType.WASTE_MANAGEMENT;
}

/** One deterministic grid pass shared by the phases that need these indexes. */
export function collectTileAggregates(grid: TileData[][]): SimulationTileAggregates {
  const result: SimulationTileAggregates = {
    buildingCount: 0,
    reliableBuildingCount: 0,
    population: 0,
    jobs: 0,
    officeJobs: 0,
    residentialTiles: [],
    commercialTiles: [],
    officeTiles: [],
    industrialTiles: [],
    roadTiles: [],
    utilityTiles: [],
    serviceTiles: [],
    developedTiles: [],
  };

  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (isBuilding(tile.type)) {
        result.buildingCount += 1;
        if (tile.powered && tile.watered) result.reliableBuildingCount += 1;
        result.jobs += tile.jobs || 0;
        if (tile.type === TileType.RESIDENTIAL) {
          result.residentialTiles.push(tile);
          result.population += tile.population || 0;
        } else if (tile.type === TileType.COMMERCIAL) {
          result.commercialTiles.push(tile);
        } else if (tile.type === TileType.OFFICE) {
          result.officeTiles.push(tile);
          result.officeJobs += tile.jobs || 0;
        } else {
          result.industrialTiles.push(tile);
        }
        if (!tile.abandoned && tile.type !== TileType.ROAD && (tile.population > 0 || tile.jobs > 0 || tile.level > 1)) {
          result.developedTiles.push(tile);
        }
      }
      if (tile.type === TileType.ROAD) result.roadTiles.push(tile);
      if (isUtility(tile.type)) result.utilityTiles.push(tile);
      if (isService(tile.type)) result.serviceTiles.push(tile);
    }
  }
  return result;
}

export function createSimulationTickContext(grid: TileData[][]): SimulationTickContext {
  return {
    roadGraph: null,
    tileAggregates: collectTileAggregates(grid),
    changedTiles: new Set<string>(),
    dirtyChunkKeys: new Set<string>(),
    renderChanges: new Set<RenderChangeKind>(),
  };
}

export function refreshTileAggregates(context: SimulationTickContext, grid: TileData[][]): void {
  context.tileAggregates = collectTileAggregates(grid);
}

export function markTilesChanged(
  context: SimulationTickContext,
  coordinates: Iterable<readonly [number, number]>,
  kind: RenderChangeKind,
): void {
  context.renderChanges.add(kind);
  for (const [x, y] of coordinates) {
    context.changedTiles.add(`${x},${y}`);
    // Road connection visuals read one tile beyond their own chunk. Mark the
    // surrounding chunks so a changed edge/intersection cannot leave a stale
    // sidewalk or lane connection in the renderer.
    for (let chunkY = y - RENDER_CHUNK_SIZE; chunkY <= y + RENDER_CHUNK_SIZE; chunkY += RENDER_CHUNK_SIZE) {
      for (let chunkX = x - RENDER_CHUNK_SIZE; chunkX <= x + RENDER_CHUNK_SIZE; chunkX += RENDER_CHUNK_SIZE) {
        if (chunkX < 0 || chunkY < 0) continue;
        context.dirtyChunkKeys.add(chunkKey(chunkX, chunkY));
      }
    }
  }
}

export function markAllChunksChanged(
  context: SimulationTickContext,
  grid: TileData[][],
  kind: RenderChangeKind,
): void {
  context.renderChanges.add(kind);
  for (let y = 0; y < grid.length; y += RENDER_CHUNK_SIZE) {
    for (let x = 0; x < (grid[0]?.length ?? 0); x += RENDER_CHUNK_SIZE) {
      context.dirtyChunkKeys.add(chunkKey(x, y));
    }
  }
}

let renderRevisionClock = 0;
let lastRenderRevisions: SimulationRenderRevisions = {
  topologyRevision: 0,
  buildingVisualRevision: 0,
  terrainRevision: 0,
  roadRevision: 0,
  utilityRevision: 0,
  dirtyChunkKeys: [],
  chunkRevisions: {},
};

/** Finalizes render metadata outside CityState/save data. */
export function finalizeSimulationRenderRevisions(context: SimulationTickContext): SimulationRenderRevisions {
  const next = { ...lastRenderRevisions };
  for (const kind of context.renderChanges) {
    renderRevisionClock += 1;
    if (kind === 'TOPOLOGY') next.topologyRevision = renderRevisionClock;
    if (kind === 'BUILDING') next.buildingVisualRevision = renderRevisionClock;
    if (kind === 'TERRAIN') next.terrainRevision = renderRevisionClock;
    if (kind === 'ROAD') next.roadRevision = renderRevisionClock;
    if (kind === 'UTILITY') next.utilityRevision = renderRevisionClock;
  }
  next.dirtyChunkKeys = [...context.dirtyChunkKeys].sort();
  for (const key of next.dirtyChunkKeys) {
    renderRevisionClock += 1;
    next.chunkRevisions[key] = renderRevisionClock;
  }
  lastRenderRevisions = next;
  return { ...next, dirtyChunkKeys: [...next.dirtyChunkKeys], chunkRevisions: { ...next.chunkRevisions } };
}

export function createExternalRenderRevisions(grid?: TileData[][]): SimulationRenderRevisions {
  renderRevisionClock += 1;
  const dirtyChunkKeys: string[] = [];
  for (let y = 0; y < (grid?.length ?? 0); y += RENDER_CHUNK_SIZE) {
    for (let x = 0; x < (grid?.[0]?.length ?? 0); x += RENDER_CHUNK_SIZE) dirtyChunkKeys.push(chunkKey(x, y));
  }
  const chunkRevisions: Record<string, number> = {};
  for (const key of dirtyChunkKeys) chunkRevisions[key] = renderRevisionClock;
  lastRenderRevisions = {
    topologyRevision: renderRevisionClock,
    buildingVisualRevision: renderRevisionClock,
    terrainRevision: renderRevisionClock,
    roadRevision: renderRevisionClock,
    utilityRevision: renderRevisionClock,
    dirtyChunkKeys,
    chunkRevisions,
  };
  return { ...lastRenderRevisions, dirtyChunkKeys: [...lastRenderRevisions.dirtyChunkKeys], chunkRevisions: { ...lastRenderRevisions.chunkRevisions } };
}
