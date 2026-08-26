import { CityState, createTile, IntersectionControl, MixedUseFloorProgram, ParcelOwnership, ParcelStatus, ResourceType, RoadClass, SignalPhaseState, SignalStage, SignalTimingMode, TileData, TileType, RoadStructure, TurnMovement, ZoneDensity } from './types';
import { RELEASE_BUILD_ID, RELEASE_GAME_VERSION, recordDiagnosticError } from './releaseReadiness';
import { 
  createInitialCitizenSimulationState, 
  serializeCitizenSimulation, 
  createCitizen, 
  createHousehold, 
  EducationLevel, 
  SeededRandom 
} from './citizenSimulation';

export interface SaveData {
  version: number;
  schemaVersion: number;
  gameVersion: string;
  seed: number;
  id: string;
  cityName: string;
  timestamp: number;
  gameState: CityState;
  /** Alias used by the portable envelope format. */
  state?: CityState;
  buildId?: string;
  featureSet?: 'stable' | 'experimental';
}

export interface SaveEnvelope {
  schemaVersion: number;
  gameVersion: string;
  buildId: string;
  featureSet: 'stable' | 'experimental';
  seed: number;
  state: CityState;
}

export interface SaveSlotInfo {
  slotId: string;
  cityName: string;
  timestamp: number;
  population: number;
  money: number;
  day: number;
  hasData: boolean;
  isAutosave?: boolean;
  featureSet?: 'stable' | 'experimental';
  backupCount?: number;
}

const SAVE_KEY_PREFIX = 'skyline_sim_save_';
export const CURRENT_SAVE_VERSION = 13;
export const CURRENT_GAME_VERSION = RELEASE_GAME_VERSION;
export const CURRENT_CITY_SCHEMA_VERSION = 1;

type RawState = Record<string, unknown>;
type SaveMigration = (state: RawState) => RawState;

const VALID_SIGNAL_STAGES: SignalStage[] = ['GREEN', 'YELLOW', 'ALL_RED', 'PEDESTRIAN_CROSSING', 'PERMISSIVE'];

/**
 * Normalizes the signal envelope at the save boundary. Signal states are
 * derived simulation data, so malformed or missing values must fall back to
 * the same deterministic defaults instead of invalidating an otherwise valid
 * city save.
 */
function normalizeSignalStates(value: unknown): Record<string, SignalPhaseState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized: Record<string, SignalPhaseState> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const candidate = raw as Record<string, unknown>;
    const stage = VALID_SIGNAL_STAGES.includes(candidate.stage as SignalStage)
      ? candidate.stage as SignalStage
      : 'PERMISSIVE';
    const axis = candidate.axis === 'NORTH_SOUTH' || candidate.axis === 'EAST_WEST' || candidate.axis === 'ALL'
      ? candidate.axis
      : 'ALL';
    const finite = (field: string, fallback: number) => typeof candidate[field] === 'number' && Number.isFinite(candidate[field])
      ? candidate[field] as number
      : fallback;
    const cycleSeconds = Math.max(0, finite('cycleSeconds', stage === 'PERMISSIVE' ? 0 : 64));
    const greenSeconds = Math.max(0, Math.min(cycleSeconds / 2, finite('greenSeconds', cycleSeconds * 0.4)));
    const yellowSeconds = Math.max(0, Math.min(cycleSeconds / 2, finite('yellowSeconds', 4)));
    const allRedSeconds = Math.max(0, Math.min(cycleSeconds / 2, finite('allRedSeconds', 1)));
    const pedestrianSeconds = Math.max(0, Math.min(cycleSeconds / 2, finite('pedestrianSeconds', 1)));
    normalized[key] = {
      stage,
      axis,
      elapsedSeconds: Math.max(0, finite('elapsedSeconds', 0)),
      phaseElapsedSeconds: Math.max(0, finite('phaseElapsedSeconds', 0)),
      cycleSeconds,
      greenSeconds,
      yellowSeconds,
      allRedSeconds,
      pedestrianSeconds,
      pedestrianCrossing: Boolean(candidate.pedestrianCrossing) || stage === 'ALL_RED' || stage === 'PEDESTRIAN_CROSSING',
    };
  }
  return normalized;
}

/** Versioned, additive migrations keep old local saves playable after major upgrades. */
export const SAVE_MIGRATIONS: Record<number, SaveMigration> = {
  10: (state) => ({
    ...state,
    schemaVersion: state.schemaVersion ?? CURRENT_CITY_SCHEMA_VERSION,
    activeRegionKeys: state.activeRegionKeys ?? state.unlockedRegions ?? ['1,1'],
    commandQueue: state.commandQueue ?? [],
    recentSimulationEvents: state.recentSimulationEvents ?? [],
    tradeContracts: state.tradeContracts ?? [],
    recoveryProjects: state.recoveryProjects ?? [],
    causalDiagnostics: state.causalDiagnostics ?? [],
    municipalDebt: state.municipalDebt ?? 0,
    capitalBudget: state.capitalBudget ?? state.money ?? 0,
    operatingBudget: state.operatingBudget ?? 0,
    specialization: state.specialization ?? 'BALANCED',
    featureSet: state.featureSet ?? 'stable',
  }),
  11: (state) => ({
    ...state,
    officeDemand: state.officeDemand ?? 0,
    officeUtilization: state.officeUtilization ?? 0,
    grid: Array.isArray(state.grid)
      ? (state.grid as unknown[]).map((row) => Array.isArray(row) ? row.map((tile) => {
        const value = tile as Record<string, unknown>;
        return value.type === 'RESIDENTIAL' ? { ...value, zoneDensity: value.zoneDensity ?? 'LOW' } : value;
      }) : row)
      : state.grid,
  }),
  // Version 13 introduces serializable signal clocks. Empty state is safe for
  // old cities; intersections rebuild their deterministic clock on the next
  // traffic phase without changing the rest of the save envelope.
  12: (state) => ({
    ...state,
    signalStates: normalizeSignalStates(state.signalStates),
  }),
};

export function migrateSaveState(state: CityState, fromVersion: number): CityState {
  let migrated = state as unknown as RawState;
  for (let version = Math.max(1, fromVersion); version < CURRENT_SAVE_VERSION; version += 1) {
    const migration = SAVE_MIGRATIONS[version];
    if (migration) migrated = migration(migrated);
  }
  return migrated as unknown as CityState;
}

type CompactTile = [
  TileType, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, ResourceType, number, RoadClass,
  RoadStructure?, number?, number?, IntersectionControl?, string?, SignalTimingMode?, number?,
  string?, ParcelOwnership?, ParcelStatus?, number?, number?, number?, number?, number?,
  MixedUseFloorProgram?, number?, number?, number?, number?, ZoneDensity?, number?, number?, number?, string?, string?, number?, number?, number?,
];

type CompactCityState = Omit<CityState, 'grid'> & { grid: CompactTile[][] };

function compactTile(tile: TileData): CompactTile {
  return [
    tile.type, tile.level, tile.population || 0, tile.jobs || 0, tile.traffic || 0,
    tile.powered ? 1 : 0, tile.watered ? 1 : 0, tile.productivity || 100,
    tile.abandoned ? 1 : 0, tile.fireCovered ? 1 : 0, tile.policeCovered ? 1 : 0,
    tile.healthCovered ? 1 : 0, tile.schoolCovered ? 1 : 0, tile.wasteCovered ? 1 : 0,
    tile.landValue || 30, tile.pollution || 0, tile.noise || 0, tile.crime || 0, tile.health || 50, tile.education || 0,
    tile.upgradeProgress || 0, tile.elevation || 0, tile.resource || 'none', tile.water ? 1 : 0,
    tile.roadClass || 'LOCAL',
    tile.roadStructure,
    tile.roadCondition ?? 100,
    tile.disasterImpact ?? 0,
    tile.intersectionControl,
    tile.prohibitedTurns?.join('|'),
    tile.signalTimingMode,
    tile.signalOffsetHours,
    tile.parcelId,
    tile.parcelOwnership,
    tile.parcelStatus,
    tile.parcelSeed,
    tile.parcelWidth,
    tile.parcelHeight,
    tile.parcelIndex,
    tile.reservoirLevel,
    tile.mixedUseProgram,
    tile.mixedUseFloorCount,
    tile.mixedUseRetailFloors,
    tile.mixedUseOfficeFloors,
    tile.mixedUseResidentialFloors,
    tile.zoneDensity,
    tile.rent,
    tile.rentPressure,
    tile.affordability,
    tile.serviceUpgrades?.join('|'),
    tile.companySector,
    tile.companyEfficiency,
    tile.companyProfit,
    tile.inputShortage,
  ];
}

function expandTile(compact: CompactTile, x: number, y: number): TileData {
  const [type, level, population, jobs, traffic, powered, watered, productivity, abandoned, fireCovered, policeCovered, healthCovered, schoolCovered, wasteCovered, landValue, pollution, noise, crime, health, education, upgradeProgress, elevation, resource, water, roadClass, roadStructure, roadCondition, disasterImpact, intersectionControl, prohibitedTurns, signalTimingMode, signalOffsetHours, parcelId, parcelOwnership, parcelStatus, parcelSeed, parcelWidth, parcelHeight, parcelIndex, reservoirLevel, mixedUseProgram, mixedUseFloorCount, mixedUseRetailFloors, mixedUseOfficeFloors, mixedUseResidentialFloors, zoneDensity, rent, rentPressure, affordability, serviceUpgrades, companySector, companyEfficiency, companyProfit, inputShortage] = compact;
  return createTile(x, y, {
    type: type as TileData['type'], level, population, jobs, traffic,
    powered: Boolean(powered), watered: Boolean(watered), productivity,
    abandoned: Boolean(abandoned), fireCovered: Boolean(fireCovered), policeCovered: Boolean(policeCovered),
    healthCovered: Boolean(healthCovered), schoolCovered: Boolean(schoolCovered), wasteCovered: Boolean(wasteCovered),
    landValue, pollution, noise, crime, health, education, upgradeProgress, elevation,
    resource: resource as TileData['resource'], water: Boolean(water),
    roadClass: roadClass === 'ARTERIAL' || roadClass === 'HIGHWAY' ? roadClass : 'LOCAL',
    roadStructure: roadStructure === 'BRIDGE' || roadStructure === 'TUNNEL' ? roadStructure as RoadStructure : 'GROUND',
    roadCondition: typeof roadCondition === 'number' && Number.isFinite(roadCondition) ? roadCondition : 100,
    disasterImpact: typeof disasterImpact === 'number' && Number.isFinite(disasterImpact) ? disasterImpact : 0,
    intersectionControl: intersectionControl === 'SIGNAL' || intersectionControl === 'STOP' || intersectionControl === 'ROUNDABOUT'
      ? intersectionControl as IntersectionControl
      : 'AUTO',
    prohibitedTurns: typeof prohibitedTurns === 'string'
      ? prohibitedTurns.split('|').filter((movement): movement is TurnMovement => ['STRAIGHT', 'LEFT', 'RIGHT', 'U_TURN'].includes(movement))
      : [],
    signalTimingMode: signalTimingMode === 'FIXED_NS' || signalTimingMode === 'FIXED_EW'
      ? signalTimingMode as SignalTimingMode
      : 'ADAPTIVE',
    signalOffsetHours: typeof signalOffsetHours === 'number' && Number.isFinite(signalOffsetHours)
      ? Math.max(0, Math.min(5, signalOffsetHours))
      : 0,
    parcelId: typeof parcelId === 'string' ? parcelId : undefined,
    parcelOwnership: parcelOwnership === 'PRIVATE' || parcelOwnership === 'CITY' ? parcelOwnership as ParcelOwnership : undefined,
    parcelStatus: parcelStatus === 'ZONED' || parcelStatus === 'DEVELOPING' || parcelStatus === 'ACTIVE' || parcelStatus === 'ABANDONED'
      ? parcelStatus as ParcelStatus
      : undefined,
    parcelSeed: typeof parcelSeed === 'number' && Number.isFinite(parcelSeed) ? parcelSeed : undefined,
    parcelWidth: typeof parcelWidth === 'number' && Number.isFinite(parcelWidth) ? Math.max(1, Math.min(2, Math.round(parcelWidth))) : undefined,
    parcelHeight: typeof parcelHeight === 'number' && Number.isFinite(parcelHeight) ? Math.max(1, Math.min(2, Math.round(parcelHeight))) : undefined,
    parcelIndex: typeof parcelIndex === 'number' && Number.isFinite(parcelIndex) ? Math.max(0, Math.round(parcelIndex)) : undefined,
    reservoirLevel: typeof reservoirLevel === 'number' && Number.isFinite(reservoirLevel) ? Math.max(0, Math.min(1, reservoirLevel)) : undefined,
    mixedUseProgram: ['RETAIL_LIVING', 'CREATIVE_OFFICE', 'HOSPITALITY', 'COMMUNITY_HUB'].includes(String(mixedUseProgram))
      ? mixedUseProgram as MixedUseFloorProgram
      : undefined,
    mixedUseFloorCount: typeof mixedUseFloorCount === 'number' && Number.isFinite(mixedUseFloorCount) ? Math.max(1, Math.round(mixedUseFloorCount)) : undefined,
    mixedUseRetailFloors: typeof mixedUseRetailFloors === 'number' && Number.isFinite(mixedUseRetailFloors) ? Math.max(0, Math.round(mixedUseRetailFloors)) : undefined,
    mixedUseOfficeFloors: typeof mixedUseOfficeFloors === 'number' && Number.isFinite(mixedUseOfficeFloors) ? Math.max(0, Math.round(mixedUseOfficeFloors)) : undefined,
    mixedUseResidentialFloors: typeof mixedUseResidentialFloors === 'number' && Number.isFinite(mixedUseResidentialFloors) ? Math.max(0, Math.round(mixedUseResidentialFloors)) : undefined,
    zoneDensity: zoneDensity === 'LOW' || zoneDensity === 'MEDIUM' || zoneDensity === 'HIGH' ? zoneDensity as ZoneDensity : undefined,
    rent: typeof rent === 'number' && Number.isFinite(rent) ? Math.max(0, rent) : undefined,
    rentPressure: typeof rentPressure === 'number' && Number.isFinite(rentPressure) ? Math.max(0, rentPressure) : undefined,
    affordability: typeof affordability === 'number' && Number.isFinite(affordability) ? Math.max(0, Math.min(100, affordability)) : undefined,
    serviceUpgrades: typeof serviceUpgrades === 'string' ? serviceUpgrades.split('|').filter(Boolean) : undefined,
    companySector: typeof companySector === 'string' ? companySector : undefined,
    companyEfficiency: typeof companyEfficiency === 'number' && Number.isFinite(companyEfficiency) ? Math.max(0, Math.min(1, companyEfficiency)) : undefined,
    companyProfit: typeof companyProfit === 'number' && Number.isFinite(companyProfit) ? companyProfit : undefined,
    inputShortage: typeof inputShortage === 'number' && Number.isFinite(inputShortage) ? Math.max(0, Math.min(1, inputShortage)) : undefined,
  });
}

function compactState(state: CityState): CompactCityState {
  return { ...state, grid: state.grid.map((row) => row.map(compactTile)) };
}

/**
 * Rehydrates and migrates legacy saves (Version 1–3) up to Version 4.
 */
function expandState(state: CityState | CompactCityState, saveVersion = CURRENT_SAVE_VERSION): CityState {
  state = migrateSaveState(state as CityState, saveVersion) as CityState | CompactCityState;
  const unlockedRegions: string[] = (state as any).unlockedRegions ?? ['1,1'];
  
  let grid: TileData[][];
  if (Array.isArray(state.grid?.[0]?.[0])) {
    const compactGrid = state.grid as unknown as CompactTile[][];
    grid = compactGrid.map((row, y) => row.map((tile, x) => expandTile(tile, x, y)));
  } else {
    grid = (state as CityState).grid;
  }

  const baseState: CityState = {
    ...(state as Omit<CityState, 'grid'>),
    grid,
    unlockedRegions,
    schemaVersion: (state as CityState).schemaVersion ?? CURRENT_CITY_SCHEMA_VERSION,
    activeRegionKeys: (state as CityState).activeRegionKeys ?? unlockedRegions,
    commandQueue: (state as CityState).commandQueue ?? [],
    recentSimulationEvents: (state as CityState).recentSimulationEvents ?? [],
    tradeContracts: (state as CityState).tradeContracts ?? [],
    recoveryProjects: (state as CityState).recoveryProjects ?? [],
    causalDiagnostics: (state as CityState).causalDiagnostics ?? [],
    municipalDebt: (state as CityState).municipalDebt ?? 0,
    capitalBudget: (state as CityState).capitalBudget ?? Math.max(0, state.money ?? 0),
    operatingBudget: (state as CityState).operatingBudget ?? 0,
    specialization: (state as CityState).specialization ?? 'BALANCED',
    signalStates: normalizeSignalStates((state as CityState).signalStates),
  };

  // Migration for saves without serialized citizenState (Version 1 & 2)
  if (!baseState.citizenState || saveVersion < 3) {
    const seed = baseState.seed || 2088;
    const prng = new SeededRandom(seed);
    const initialSim = createInitialCitizenSimulationState(seed);
    let nextCId = 1;
    let nextHId = 1;

    // Synthesize initial citizens and households for existing populated residential tiles
    for (const row of grid) {
      for (const tile of row) {
        if (tile.type === TileType.RESIDENTIAL && (tile.population || 0) > 0 && !tile.abandoned) {
          const pop = tile.population;
          const hCitizens = [];
          const hId = `household-${nextHId++}`;
          const resPos = { x: tile.x, y: tile.y };

          for (let i = 0; i < pop; i++) {
            const age = i === 0 ? prng.nextInt(25, 55) : prng.nextInt(6, 45);
            const edu = prng.chance(0.25) ? EducationLevel.UNIVERSITY : prng.chance(0.6) ? EducationLevel.HIGH_SCHOOL : EducationLevel.UNEDUCATED;
            const citizen = createCitizen(`citizen-${nextCId++}`, hId, resPos, age, edu, prng);
            hCitizens.push(citizen);
            initialSim.citizens.set(citizen.id, citizen);
          }

          const household = createHousehold(hId, resPos, 20, hCitizens, 300);
          initialSim.households.set(household.id, household);
        }
      }
    }

    initialSim.nextCitizenId = nextCId;
    initialSim.nextHouseholdId = nextHId;
    initialSim.demographics.totalCitizens = initialSim.citizens.size;
    initialSim.demographics.totalHouseholds = initialSim.households.size;

    baseState.citizenState = serializeCitizenSimulation(initialSim);
    baseState.demographics = initialSim.demographics;
    baseState.population = initialSim.citizens.size;
  }

  return baseState;
}

const inMemoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const v = sessionStorage.getItem(key);
      if (v) return v;
    }
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(key);
      if (v) return v;
    }
  } catch {}
  return inMemoryStorage.get(key) ?? null;
}

function setStorageItem(key: string, value: string): boolean {
  let saved = false;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      saved = true;
    }
  } catch {}
  if (!saved) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, value);
        saved = true;
      }
    } catch {}
  }
  inMemoryStorage.set(key, value);
  return true;
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {}
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
  } catch {}
  inMemoryStorage.delete(key);
}

export function saveGame(slotId: string, state: CityState, cityName = 'Skyline City'): boolean {
  try {
    const featureSet = state.featureSet ?? 'stable';
    const compactedState = compactState({ ...state, featureSet }) as unknown as CityState;
    const saveData: SaveData = {
      version: CURRENT_SAVE_VERSION,
      schemaVersion: state.schemaVersion ?? CURRENT_CITY_SCHEMA_VERSION,
      gameVersion: CURRENT_GAME_VERSION,
      seed: state.seed ?? 2088,
      buildId: RELEASE_BUILD_ID,
      featureSet,
      id: slotId,
      cityName,
      timestamp: Date.now(),
      gameState: compactedState,
      state: compactedState,
    };
    const json = JSON.stringify(saveData);
    return setStorageItem(SAVE_KEY_PREFIX + slotId, json);
  } catch (err) {
    recordDiagnosticError(err, 'SAVE_WRITE_ERROR');
    return false;
  }
}

export function createSaveEnvelope(state: CityState): SaveEnvelope {
  const featureSet = state.featureSet ?? 'stable';
  return {
    schemaVersion: state.schemaVersion ?? CURRENT_CITY_SCHEMA_VERSION,
    gameVersion: CURRENT_GAME_VERSION,
    buildId: RELEASE_BUILD_ID,
    featureSet,
    seed: state.seed ?? 2088,
    state: compactState({ ...state, featureSet }) as unknown as CityState,
  };
}

export function loadGame(slotId: string): SaveData | null {
  try {
    const json = getStorageItem(SAVE_KEY_PREFIX + slotId);
    if (!json) return null;
    const saveData: SaveData = JSON.parse(json);
    
    // Validate structural integrity
    const rawState = saveData?.gameState ?? saveData?.state;
    if (!saveData || !rawState || !isValidRawCityState(rawState)) {
      quarantineLegacySave(slotId, json);
      return null;
    }

    const version = saveData.version || 1;
    saveData.gameState = expandState(rawState, version);
    saveData.schemaVersion = saveData.schemaVersion ?? saveData.gameState.schemaVersion ?? CURRENT_CITY_SCHEMA_VERSION;
    saveData.gameVersion = saveData.gameVersion ?? 'legacy';
    saveData.seed = saveData.seed ?? saveData.gameState.seed ?? 2088;
    saveData.buildId = saveData.buildId ?? 'legacy';
    saveData.featureSet = saveData.featureSet ?? saveData.gameState.featureSet ?? 'stable';
    saveData.gameState.featureSet = saveData.featureSet;
    if (!isValidExpandedCityState(saveData.gameState)) {
      quarantineLegacySave(slotId, json);
      return null;
    }
    saveData.state = saveData.gameState;
    saveData.version = CURRENT_SAVE_VERSION;
    
    return saveData;
  } catch (err) {
    const raw = getStorageItem(SAVE_KEY_PREFIX + slotId);
    if (raw) quarantineLegacySave(slotId, raw);
    recordDiagnosticError(err, 'SAVE_READ_ERROR');
    return null;
  }
}

function quarantineLegacySave(slotId: string, rawJson: string): void {
  try {
    setStorageItem(`${SAVE_KEY_PREFIX}quarantine-${slotId}-${Date.now()}`, rawJson);
    removeStorageItem(SAVE_KEY_PREFIX + slotId);
  } catch (error) {
    recordDiagnosticError(error, 'SAVE_QUARANTINE_ERROR');
  }
}

export function deleteSave(slotId: string): void {
  try {
    removeStorageItem(SAVE_KEY_PREFIX + slotId);
  } catch (err) {
    recordDiagnosticError(err, 'SAVE_DELETE_ERROR');
  }
}

export function listSaveSlots(): SaveSlotInfo[] {
  const slots = ['autosave', 'slot_1', 'slot_2', 'slot_3'];
  return slots.map((slotId) => {
    const data = loadGame(slotId);
    if (data) {
      return {
        slotId,
        cityName: data.cityName || 'Skyline City',
        timestamp: data.timestamp,
        population: data.gameState?.population || 0,
        money: data.gameState?.money || 0,
        day: data.gameState?.day || 1,
        hasData: true,
        isAutosave: slotId === 'autosave',
      };
    }
    return {
      slotId,
      cityName: 'Empty Slot',
      timestamp: 0,
      population: 0,
      money: 0,
      day: 0,
      hasData: false,
      isAutosave: slotId === 'autosave',
    };
  });
}

export function exportSaveJson(slotId: string): string | null {
  const data = loadGame(slotId);
  if (!data) return null;
  return JSON.stringify(data, null, 2);
}

export function importSaveJson(slotId: string, jsonStr: string): boolean {
  try {
    const parsed: SaveData = JSON.parse(jsonStr);
    const importedState = parsed.gameState ?? parsed.state;
    if (!importedState || typeof importedState.money !== 'number') {
      return false;
    }
    saveGame(slotId, expandState(importedState, parsed.version || 1), parsed.cityName || 'Imported City');
    return true;
  } catch (err) {
    recordDiagnosticError(err, 'SAVE_IMPORT_ERROR');
    return false;
  }
}

/**
 * IndexedDB-backed repository for browser saves. The synchronous functions
 * above remain as a compatibility mirror for old fixtures and legacy browsers;
 * the release UI uses the async repository as its primary source of truth.
 */
export interface SaveRepository {
  listSlots(): Promise<SaveSlotInfo[]>;
  save(slotId: string, state: CityState, cityName?: string): Promise<boolean>;
  load(slotId: string): Promise<SaveData | null>;
  delete(slotId: string): Promise<void>;
  export(slotId: string): Promise<string | null>;
  importPreview(json: string): SaveImportPreview;
  import(slotId: string, json: string): Promise<SaveImportPreview>;
  quarantineCorruptSave(slotId: string, rawJson?: string): Promise<void>;
  restoreBackup(index?: number): Promise<boolean>;
}

export interface SaveImportPreview {
  valid: boolean;
  reason?: string;
  cityName?: string;
  population?: number;
  money?: number;
  day?: number;
  featureSet?: 'stable' | 'experimental';
  state?: CityState;
}

interface IndexedSaveRecord {
  slotId: string;
  json: string;
  timestamp: number;
  kind: 'save' | 'backup' | 'quarantine';
}

const SAVE_DB_NAME = 'skyline-simulator-release';
const SAVE_DB_VERSION = 1;
const SAVE_STORE_NAME = 'saves';
const AUTOSAVE_BACKUPS = 3;

function openSaveDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(SAVE_DB_NAME, SAVE_DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SAVE_STORE_NAME)) {
          database.createObjectStore(SAVE_STORE_NAME, { keyPath: 'slotId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readIndexedRecord(database: IDBDatabase, slotId: string): Promise<IndexedSaveRecord | null> {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(SAVE_STORE_NAME, 'readonly');
      const request = transaction.objectStore(SAVE_STORE_NAME).get(slotId);
      request.onsuccess = () => resolve((request.result as IndexedSaveRecord | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function writeIndexedRecord(database: IDBDatabase, record: IndexedSaveRecord): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(SAVE_STORE_NAME, 'readwrite');
      transaction.objectStore(SAVE_STORE_NAME).put(record);
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function deleteIndexedRecord(database: IDBDatabase, slotId: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const transaction = database.transaction(SAVE_STORE_NAME, 'readwrite');
      transaction.objectStore(SAVE_STORE_NAME).delete(slotId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function createSaveData(state: CityState, slotId: string, cityName: string): SaveData {
  const featureSet = state.featureSet ?? 'stable';
  const compactedState = compactState({ ...state, featureSet }) as unknown as CityState;
  return {
    version: CURRENT_SAVE_VERSION,
    schemaVersion: state.schemaVersion ?? CURRENT_CITY_SCHEMA_VERSION,
    gameVersion: CURRENT_GAME_VERSION,
    buildId: RELEASE_BUILD_ID,
    featureSet,
    seed: state.seed ?? 2088,
    id: slotId,
    cityName,
    timestamp: Date.now(),
    gameState: compactedState,
    state: compactedState,
  };
}

function parseSaveData(json: string): SaveData | null {
  try {
    const parsed = JSON.parse(json) as SaveData;
    const importedState = parsed?.gameState ?? parsed?.state;
    if (!parsed || !importedState || !isValidRawCityState(importedState)) {
      return null;
    }
    const version = parsed.version || 1;
    const expandedState = expandState(importedState, version);
    const featureSet = parsed.featureSet === 'experimental' || expandedState.featureSet === 'experimental'
      ? 'experimental'
      : 'stable';
    expandedState.featureSet = featureSet;
    if (!isValidExpandedCityState(expandedState)) return null;
    return {
      ...parsed,
      gameState: expandedState,
      state: expandedState,
      version: CURRENT_SAVE_VERSION,
      schemaVersion: parsed.schemaVersion ?? expandedState.schemaVersion ?? CURRENT_CITY_SCHEMA_VERSION,
      gameVersion: parsed.gameVersion ?? 'legacy',
      buildId: parsed.buildId ?? 'legacy',
      featureSet,
      seed: parsed.seed ?? expandedState.seed ?? 2088,
    };
  } catch {
    return null;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidRawCityState(value: unknown): value is CityState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<CityState>;
  if (!Array.isArray(state.grid) || state.grid.length === 0 || state.grid.length > 120) return false;
  const width = Array.isArray(state.grid[0]) ? state.grid[0].length : 0;
  if (width === 0 || width > 120) return false;
  if (!state.grid.every((row) => Array.isArray(row) && row.length === width)) return false;
  if (!isFiniteNumber(state.money) || !isFiniteNumber(state.day) || state.day < 0) return false;
  if (state.population !== undefined && (!isFiniteNumber(state.population) || state.population < 0)) return false;
  return true;
}

function isValidExpandedCityState(state: CityState): boolean {
  return state.grid.length > 0
    && state.grid.every((row) => row.length === state.grid[0]?.length)
    && Number.isFinite(state.money)
    && Number.isFinite(state.day)
    && Number.isFinite(state.population)
    && state.grid.flat().every((tile) => (
      Number.isFinite(tile.x)
      && Number.isFinite(tile.y)
      && Number.isFinite(tile.level)
      && Number.isFinite(tile.population)
      && Number.isFinite(tile.jobs)
      && Number.isFinite(tile.elevation)
    ));
}

function createImportPreview(json: string): SaveImportPreview {
  const parsed = parseSaveData(json);
  if (!parsed) return { valid: false, reason: 'File save tidak memiliki struktur kota yang valid.' };
  return {
    valid: true,
    cityName: parsed.cityName ?? 'Imported City',
    population: parsed.gameState.population,
    money: parsed.gameState.money,
    day: parsed.gameState.day,
    featureSet: parsed.featureSet,
    state: parsed.gameState,
  };
}

async function saveToIndexedDb(slotId: string, state: CityState, cityName: string): Promise<boolean> {
  const database = await openSaveDatabase();
  if (!database) return false;
  const saveData = createSaveData(state, slotId, cityName);
  const json = JSON.stringify(saveData);
  const current = slotId === 'autosave' ? await readIndexedRecord(database, 'autosave') : null;
  const previousBackups: Array<{ index: number; record: IndexedSaveRecord | null }> = [];
  if (slotId === 'autosave') {
    for (let index = AUTOSAVE_BACKUPS; index >= 2; index -= 1) {
      const previous = await readIndexedRecord(database, `autosave_backup_${index - 1}`);
      previousBackups.push({ index, record: previous });
    }
  }
  const saved = await writeIndexedRecord(database, { slotId, json, timestamp: saveData.timestamp, kind: 'save' });
  if (saved && slotId === 'autosave') {
    for (const { index, record } of previousBackups) {
      if (record) await writeIndexedRecord(database, { ...record, slotId: `autosave_backup_${index}`, kind: 'backup' });
    }
    if (current) await writeIndexedRecord(database, { ...current, slotId: 'autosave_backup_1', kind: 'backup' });
  }
  database.close();
  if (saved) saveGame(slotId, state, cityName);
  return saved;
}

async function loadFromIndexedDb(slotId: string): Promise<SaveData | null> {
  const database = await openSaveDatabase();
  if (!database) return null;
  const record = await readIndexedRecord(database, slotId);
  database.close();
  if (!record) return null;
  const parsed = parseSaveData(record.json);
  if (!parsed) {
    await quarantineCorruptSaveRecord(slotId, record.json);
    return null;
  }
  return parsed;
}

async function quarantineCorruptSaveRecord(slotId: string, rawJson?: string): Promise<void> {
  const database = await openSaveDatabase();
  if (!database) return;
  const source = rawJson ?? (await readIndexedRecord(database, slotId))?.json;
  if (source) {
    await writeIndexedRecord(database, {
      slotId: `quarantine-${slotId}-${Date.now()}`,
      json: source,
      timestamp: Date.now(),
      kind: 'quarantine',
    });
  }
  await deleteIndexedRecord(database, slotId);
  database.close();
}

export async function saveGameAsync(slotId: string, state: CityState, cityName = 'Skyline City'): Promise<boolean> {
  try {
    return (await saveToIndexedDb(slotId, state, cityName)) || saveGame(slotId, state, cityName);
  } catch {
    return saveGame(slotId, state, cityName);
  }
}

export async function loadGameAsync(slotId: string): Promise<SaveData | null> {
  try {
    const indexed = await loadFromIndexedDb(slotId);
    return indexed ?? loadGame(slotId);
  } catch {
    return loadGame(slotId);
  }
}

export async function deleteSaveAsync(slotId: string): Promise<void> {
  const database = await openSaveDatabase();
  if (database) {
    await deleteIndexedRecord(database, slotId);
    database.close();
  }
  deleteSave(slotId);
}

export async function listSaveSlotsAsync(): Promise<SaveSlotInfo[]> {
  const slots = ['autosave', 'slot_1', 'slot_2', 'slot_3'];
  const result: SaveSlotInfo[] = [];
  for (const slotId of slots) {
    const data = await loadGameAsync(slotId);
    const backupCount = slotId === 'autosave'
      ? (await Promise.all([1, 2, 3].map((index) => loadGameAsync(`autosave_backup_${index}`)))).filter(Boolean).length
      : 0;
    result.push(data ? {
      slotId,
      cityName: data.cityName || 'Skyline City',
      timestamp: data.timestamp,
      population: data.gameState?.population || 0,
      money: data.gameState?.money || 0,
      day: data.gameState?.day || 1,
      hasData: true,
      isAutosave: slotId === 'autosave',
      featureSet: data.featureSet ?? data.gameState.featureSet ?? 'stable',
      backupCount,
    } : {
      slotId,
      cityName: 'Empty Slot',
      timestamp: 0,
      population: 0,
      money: 0,
      day: 0,
      hasData: false,
      isAutosave: slotId === 'autosave',
      backupCount,
    });
  }
  return result;
}

export async function exportSaveJsonAsync(slotId: string): Promise<string | null> {
  const data = await loadGameAsync(slotId);
  return data ? JSON.stringify(data, null, 2) : null;
}

export function importSavePreview(json: string): SaveImportPreview {
  return createImportPreview(json);
}

export async function importSaveJsonAsync(slotId: string, jsonStr: string): Promise<SaveImportPreview> {
  const preview = createImportPreview(jsonStr);
  if (!preview.valid || !preview.state) return preview;
  const saved = await saveGameAsync(slotId, preview.state, preview.cityName ?? 'Imported City');
  return saved ? preview : { valid: false, reason: 'Save gagal ditulis ke penyimpanan browser.' };
}

export async function quarantineCorruptSave(slotId: string): Promise<void> {
  await quarantineCorruptSaveRecord(slotId);
}

export async function restoreAutosaveBackup(index = 1): Promise<boolean> {
  const backup = await loadGameAsync(`autosave_backup_${Math.max(1, Math.min(AUTOSAVE_BACKUPS, index))}`);
  if (!backup) return false;
  return saveGameAsync('autosave', backup.gameState, backup.cityName ?? 'Skyline City');
}

export const saveRepository: SaveRepository = {
  listSlots: listSaveSlotsAsync,
  save: saveGameAsync,
  load: loadGameAsync,
  delete: deleteSaveAsync,
  export: exportSaveJsonAsync,
  importPreview: importSavePreview,
  import: importSaveJsonAsync,
  quarantineCorruptSave,
  restoreBackup: restoreAutosaveBackup,
};
