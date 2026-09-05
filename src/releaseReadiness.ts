import { CityState, GameSettings } from './types';

export type FeatureGate = 'stable' | 'experimental' | 'hidden';

export type ReleaseFeature =
  | 'core-city'
  | 'regional-streaming'
  | 'advanced-trade'
  | 'data-modding'
  | 'diagnostics';

const EXPERIMENTAL_RELEASE_FEATURES = new Set<ReleaseFeature>([
  'regional-streaming',
  'advanced-trade',
  'data-modding',
]);

const HIDDEN_RELEASE_FEATURES = new Set<ReleaseFeature>();

export const RELEASE_GAME_VERSION = '3.1.0-beta.1';
export const RELEASE_BUILD_ID = (() => {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
    return String(env?.VITE_BUILD_ID || RELEASE_GAME_VERSION);
  } catch {
    return RELEASE_GAME_VERSION;
  }
})();

export function getFeatureGate(feature: ReleaseFeature, experimentalEnabled = false): FeatureGate {
  if (HIDDEN_RELEASE_FEATURES.has(feature)) return 'hidden';
  if (EXPERIMENTAL_RELEASE_FEATURES.has(feature)) return experimentalEnabled ? 'experimental' : 'hidden';
  return 'stable';
}

export function isFeatureEnabled(feature: ReleaseFeature, experimentalEnabled = false): boolean {
  return getFeatureGate(feature, experimentalEnabled) !== 'hidden';
}

export interface PerformanceSnapshot {
  capturedAt: number;
  fps: number;
  frameTimeMs: number;
  frameTimeP95Ms?: number;
  simulationTickMs?: number;
  entityCount?: number;
  activeRegionCount?: number;
  memoryUsedMb?: number;
}

export interface DiagnosticError {
  id: string;
  message: string;
  stack?: string;
  timestamp: number;
}

export interface DiagnosticBundle {
  reportVersion: 1;
  gameVersion: string;
  buildId: string;
  generatedAt: number;
  browser: {
    userAgent: string;
    language: string;
    devicePixelRatio: number;
    webgl: boolean;
  };
  settings: Partial<GameSettings>;
  performance: PerformanceSnapshot[];
  errors: DiagnosticError[];
  city?: {
    width: number;
    height: number;
    population: number;
    day: number;
    activeRegionCount: number;
    featureSet: 'stable' | 'experimental';
    stateHash: string;
  };
}

const diagnosticErrors: DiagnosticError[] = [];
const performanceSnapshots: PerformanceSnapshot[] = [];

export function recordDiagnosticError(error: unknown, id = 'APP_ERROR'): DiagnosticError {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const entry: DiagnosticError = {
    id,
    message: normalized.message,
    stack: normalized.stack,
    timestamp: Date.now(),
  };
  diagnosticErrors.unshift(entry);
  if (diagnosticErrors.length > 30) diagnosticErrors.length = 30;
  return entry;
}

export function recordPerformanceSnapshot(snapshot: Omit<PerformanceSnapshot, 'capturedAt'>): void {
  performanceSnapshots.push({ ...snapshot, capturedAt: Date.now() });
  if (performanceSnapshots.length > 120) performanceSnapshots.splice(0, performanceSnapshots.length - 120);
}

export function getPerformanceSnapshots(): PerformanceSnapshot[] {
  return [...performanceSnapshots];
}

function stableHash(value: unknown): string {
  const json = JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) return 0;
    return item;
  });
  let hash = 2166136261;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getStateHash(state: CityState): string {
  // This is a diagnostic authoritative-state snapshot, not a compact replay
  // checksum. Keep simulation inputs, derived state used by later ticks, and
  // command queues explicit so regressions in policy, services, incidents,
  // economy, transit, or disasters cannot be hidden by an unchanged grid.
  return stableHash({
    seed: state.seed,
    day: state.day,
    money: state.money,
    income: state.income,
    expenses: state.expenses,
    operatingBudget: state.operatingBudget,
    municipalDebt: state.municipalDebt,
    population: state.population,
    happiness: state.happiness,
    healthIndex: state.healthIndex,
    congestionIndex: state.congestionIndex,
    averageCommuteTime: state.averageCommuteTime,
    activePolicies: state.activePolicies,
    incidents: state.incidents,
    disasters: state.disasters,
    serviceResponseQuality: state.serviceResponseQuality,
    healthcareCoverage: state.healthcareCoverage,
    educationCoverage: state.educationCoverage,
    fireSafety: state.fireSafety,
    crimeRate: state.crimeRate,
    wasteCoverage: state.wasteCoverage,
    transitLines: state.transitLines,
    transitVehicles: state.transitVehicles,
    activeTrips: state.activeTrips,
    transitActiveLines: state.transitActiveLines,
    transitActiveVehicles: state.transitActiveVehicles,
    transitRidership: state.transitRidership,
    transitCoverage: state.transitCoverage,
    grid: state.grid,
    commandQueue: state.commandQueue,
    tradeContracts: state.tradeContracts,
    recoveryProjects: state.recoveryProjects,
  });
}

export function hasWebGLSupport(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function createDiagnosticBundle(state: CityState | undefined, settings: GameSettings): DiagnosticBundle {
  const navigatorValue = typeof navigator !== 'undefined' ? navigator : undefined;
  const memory = typeof performance !== 'undefined' && 'memory' in performance
    ? (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    : undefined;
  const bundle: DiagnosticBundle = {
    reportVersion: 1,
    gameVersion: RELEASE_GAME_VERSION,
    buildId: RELEASE_BUILD_ID,
    generatedAt: Date.now(),
    browser: {
      userAgent: navigatorValue?.userAgent ?? 'unknown',
      language: navigatorValue?.language ?? 'unknown',
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      webgl: hasWebGLSupport(),
    },
    settings: {
      difficulty: settings.difficulty,
      shadowQuality: settings.shadowQuality,
      renderScale: settings.renderScale,
      trafficDensity: settings.trafficDensity,
      vegetationDensity: settings.vegetationDensity,
      reducedMotion: settings.reducedMotion,
      uiScale: settings.uiScale,
      adaptiveQuality: settings.adaptiveQuality,
      experimentalFeatures: settings.experimentalFeatures,
    },
    performance: getPerformanceSnapshots(),
    errors: [...diagnosticErrors],
  };
  if (memory && bundle.performance.length > 0) {
    bundle.performance[bundle.performance.length - 1].memoryUsedMb = Math.round(memory.usedJSHeapSize / 1024 / 1024);
  }
  if (state) {
    bundle.city = {
      width: state.grid[0]?.length ?? 0,
      height: state.grid.length,
      population: Number.isFinite(state.population) ? state.population : 0,
      day: state.day,
      activeRegionCount: state.activeRegionKeys?.length ?? state.unlockedRegions?.length ?? 0,
      featureSet: state.featureSet ?? 'stable',
      stateHash: getStateHash(state),
    };
  }
  return bundle;
}

export function downloadDiagnosticBundle(bundle: DiagnosticBundle): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `skyline-diagnostic-${new Date(bundle.generatedAt).toISOString().replace(/[:.]/g, '-')}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
