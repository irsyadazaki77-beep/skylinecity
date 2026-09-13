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

export interface SpatialRegistry {
  buildingsByChunk: Map<string, TileData[]>;
  roadsByChunk: Map<string, TileData[]>;
  zonesByType: Map<TileType, TileData[]>;
  servicesByChunk: Map<string, TileData[]>;
  dirtySimulationChunks: Set<string>;
  gridRef: TileData[][] | null;
  width: number;
  height: number;
}

export interface SimulationTickContext {
  /** Derived graph is owned by this tick and is never persisted. */
  roadGraph: RoadGraph | null;
  tileAggregates: SimulationTileAggregates;
  changedTiles: Set<string>;
  dirtyChunkKeys: Set<string>;
  renderChanges: Set<RenderChangeKind>;
  spatialRegistry: SpatialRegistry;
}

const RENDER_CHUNK_SIZE = 10;

export function getSimulationChunkKey(x: number, y: number): string {
  return `${Math.floor(x / RENDER_CHUNK_SIZE)},${Math.floor(y / RENDER_CHUNK_SIZE)}`;
}

function chunkKey(x: number, y: number): string {
  return getSimulationChunkKey(x, y);
}

export function isBuildingType(type: TileType): boolean {
  return type === TileType.RESIDENTIAL
    || type === TileType.COMMERCIAL
    || type === TileType.OFFICE
    || type === TileType.INDUSTRIAL;
}

function isBuilding(type: TileType): boolean {
  return isBuildingType(type);
}

export function isUtilityType(type: TileType): boolean {
  return type === TileType.POWER_PLANT || type === TileType.WATER_PUMP;
}

function isUtility(type: TileType): boolean {
  return isUtilityType(type);
}

export function isServiceType(type: TileType): boolean {
  return type === TileType.FIRE_STATION
    || type === TileType.POLICE_STATION
    || type === TileType.CLINIC
    || type === TileType.SCHOOL
    || type === TileType.WASTE_MANAGEMENT;
}

function isService(type: TileType): boolean {
  return isServiceType(type);
}

let cachedSpatialRegistry: SpatialRegistry | null = null;

export function createSpatialRegistry(grid: TileData[][]): SpatialRegistry {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const buildingsByChunk = new Map<string, TileData[]>();
  const roadsByChunk = new Map<string, TileData[]>();
  const zonesByType = new Map<TileType, TileData[]>();
  const servicesByChunk = new Map<string, TileData[]>();
  const dirtySimulationChunks = new Set<string>();

  for (let y = 0; y < height; y += 1) {
    const row = grid[y];
    for (let x = 0; x < width; x += 1) {
      const tile = row[x];
      const cKey = getSimulationChunkKey(x, y);

      let byType = zonesByType.get(tile.type);
      if (!byType) {
        byType = [];
        zonesByType.set(tile.type, byType);
      }
      byType.push(tile);

      if (isBuildingType(tile.type)) {
        let bList = buildingsByChunk.get(cKey);
        if (!bList) {
          bList = [];
          buildingsByChunk.set(cKey, bList);
        }
        bList.push(tile);
      } else if (tile.type === TileType.ROAD) {
        let rList = roadsByChunk.get(cKey);
        if (!rList) {
          rList = [];
          roadsByChunk.set(cKey, rList);
        }
        rList.push(tile);
      } else if (isServiceType(tile.type)) {
        let sList = servicesByChunk.get(cKey);
        if (!sList) {
          sList = [];
          servicesByChunk.set(cKey, sList);
        }
        sList.push(tile);
      }
    }
  }

  const registry: SpatialRegistry = {
    buildingsByChunk,
    roadsByChunk,
    zonesByType,
    servicesByChunk,
    dirtySimulationChunks,
    gridRef: grid,
    width,
    height,
  };
  cachedSpatialRegistry = registry;
  return registry;
}

export function getOrBuildSpatialRegistry(grid: TileData[][], forceRebuild = false): SpatialRegistry {
  if (
    !forceRebuild
    && cachedSpatialRegistry
    && cachedSpatialRegistry.gridRef === grid
    && cachedSpatialRegistry.height === grid.length
    && cachedSpatialRegistry.width === (grid[0]?.length ?? 0)
  ) {
    return cachedSpatialRegistry;
  }
  return createSpatialRegistry(grid);
}

export function updateSpatialRegistryTile(
  registry: SpatialRegistry,
  tile: TileData,
  prevType?: TileType,
): void {
  const cKey = getSimulationChunkKey(tile.x, tile.y);
  registry.dirtySimulationChunks.add(cKey);

  // If previous type is provided and different, remove from old collections
  if (prevType && prevType !== tile.type) {
    const oldList = registry.zonesByType.get(prevType);
    if (oldList) {
      const idx = oldList.findIndex((t) => t.x === tile.x && t.y === tile.y);
      if (idx !== -1) oldList.splice(idx, 1);
    }
    if (isBuildingType(prevType)) {
      const bList = registry.buildingsByChunk.get(cKey);
      if (bList) {
        const idx = bList.findIndex((t) => t.x === tile.x && t.y === tile.y);
        if (idx !== -1) bList.splice(idx, 1);
      }
    }
    if (prevType === TileType.ROAD) {
      const rList = registry.roadsByChunk.get(cKey);
      if (rList) {
        const idx = rList.findIndex((t) => t.x === tile.x && t.y === tile.y);
        if (idx !== -1) rList.splice(idx, 1);
      }
    }
    if (isServiceType(prevType)) {
      const sList = registry.servicesByChunk.get(cKey);
      if (sList) {
        const idx = sList.findIndex((t) => t.x === tile.x && t.y === tile.y);
        if (idx !== -1) sList.splice(idx, 1);
      }
    }
  }

  // Add to new collections
  let newList = registry.zonesByType.get(tile.type);
  if (!newList) {
    newList = [];
    registry.zonesByType.set(tile.type, newList);
  }
  if (!newList.some((t) => t.x === tile.x && t.y === tile.y)) {
    newList.push(tile);
  }

  if (isBuildingType(tile.type)) {
    let bList = registry.buildingsByChunk.get(cKey);
    if (!bList) {
      bList = [];
      registry.buildingsByChunk.set(cKey, bList);
    }
    if (!bList.some((t) => t.x === tile.x && t.y === tile.y)) {
      bList.push(tile);
    }
  } else if (tile.type === TileType.ROAD) {
    let rList = registry.roadsByChunk.get(cKey);
    if (!rList) {
      rList = [];
      registry.roadsByChunk.set(cKey, rList);
    }
    if (!rList.some((t) => t.x === tile.x && t.y === tile.y)) {
      rList.push(tile);
    }
  } else if (isServiceType(tile.type)) {
    let sList = registry.servicesByChunk.get(cKey);
    if (!sList) {
      sList = [];
      registry.servicesByChunk.set(cKey, sList);
    }
    if (!sList.some((t) => t.x === tile.x && t.y === tile.y)) {
      sList.push(tile);
    }
  }
}

/** One deterministic pass using spatial registry when available to avoid full grid scan. */
export function collectTileAggregates(grid: TileData[][], registry?: SpatialRegistry): SimulationTileAggregates {
  const reg = registry ?? getOrBuildSpatialRegistry(grid);
  const residentialTiles = reg.zonesByType.get(TileType.RESIDENTIAL) ?? [];
  const commercialTiles = reg.zonesByType.get(TileType.COMMERCIAL) ?? [];
  const officeTiles = reg.zonesByType.get(TileType.OFFICE) ?? [];
  const industrialTiles = reg.zonesByType.get(TileType.INDUSTRIAL) ?? [];
  const roadTiles = reg.zonesByType.get(TileType.ROAD) ?? [];
  const powerTiles = reg.zonesByType.get(TileType.POWER_PLANT) ?? [];
  const waterTiles = reg.zonesByType.get(TileType.WATER_PUMP) ?? [];
  const utilityTiles = [...powerTiles, ...waterTiles];

  const serviceTiles: TileData[] = [];
  for (const sList of reg.servicesByChunk.values()) {
    for (let i = 0; i < sList.length; i += 1) serviceTiles.push(sList[i]);
  }

  let population = 0;
  let jobs = 0;
  let officeJobs = 0;
  let reliableBuildingCount = 0;
  const developedTiles: TileData[] = [];

  for (let i = 0; i < residentialTiles.length; i += 1) {
    const tile = residentialTiles[i];
    population += tile.population || 0;
    if (tile.powered && tile.watered) reliableBuildingCount += 1;
    if (!tile.abandoned && (tile.population > 0 || tile.level > 1)) developedTiles.push(tile);
  }
  for (let i = 0; i < commercialTiles.length; i += 1) {
    const tile = commercialTiles[i];
    jobs += tile.jobs || 0;
    if (tile.powered && tile.watered) reliableBuildingCount += 1;
    if (!tile.abandoned && (tile.jobs > 0 || tile.level > 1)) developedTiles.push(tile);
  }
  for (let i = 0; i < officeTiles.length; i += 1) {
    const tile = officeTiles[i];
    const j = tile.jobs || 0;
    jobs += j;
    officeJobs += j;
    if (tile.powered && tile.watered) reliableBuildingCount += 1;
    if (!tile.abandoned && (tile.jobs > 0 || tile.level > 1)) developedTiles.push(tile);
  }
  for (let i = 0; i < industrialTiles.length; i += 1) {
    const tile = industrialTiles[i];
    jobs += tile.jobs || 0;
    if (tile.powered && tile.watered) reliableBuildingCount += 1;
    if (!tile.abandoned && (tile.jobs > 0 || tile.level > 1)) developedTiles.push(tile);
  }

  const buildingCount = residentialTiles.length + commercialTiles.length + officeTiles.length + industrialTiles.length;

  return {
    buildingCount,
    reliableBuildingCount,
    population,
    jobs,
    officeJobs,
    residentialTiles,
    commercialTiles,
    officeTiles,
    industrialTiles,
    roadTiles,
    utilityTiles,
    serviceTiles,
    developedTiles,
  };
}

export function createSimulationTickContext(grid: TileData[][]): SimulationTickContext {
  const spatialRegistry = getOrBuildSpatialRegistry(grid);
  return {
    roadGraph: null,
    tileAggregates: collectTileAggregates(grid, spatialRegistry),
    changedTiles: new Set<string>(),
    dirtyChunkKeys: new Set<string>(),
    renderChanges: new Set<RenderChangeKind>(),
    spatialRegistry,
  };
}

export function refreshTileAggregates(context: SimulationTickContext, grid: TileData[][]): void {
  context.spatialRegistry = getOrBuildSpatialRegistry(grid);
  context.tileAggregates = collectTileAggregates(grid, context.spatialRegistry);
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
