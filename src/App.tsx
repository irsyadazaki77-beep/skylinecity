import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { City3DCanvas } from './components/world/City3DCanvas';
import { Sidebar } from './components/Sidebar';
import { GameHUD } from './components/ui/GameHUD';
import { CityInformationPanel } from './components/ui/CityInformationPanel';
import { InfoViewsToolbar } from './components/ui/InfoViewsToolbar';
import { NotificationCenter, NotificationItem } from './components/ui/NotificationCenter';
import { NotificationToast } from './components/NotificationToast';
import { SaveLoadModal } from './components/SaveLoadModal';
import { TreasuryModal } from './components/TreasuryModal';
import { TechTreeModal } from './components/TechTreeModal';
import { PoliciesModal } from './components/PoliciesModal';
import { MissionsModal } from './components/MissionsModal';
import { DistrictsModal } from './components/DistrictsModal';
import { SettingsModal, DEFAULT_SETTINGS } from './components/ui/SettingsModal';
import { StarterTutorial } from './components/ui/StarterTutorial';
import { BuildingInspector } from './components/ui/BuildingInspector';
import { BottomToolbar } from './components/ui/BottomToolbar';
import { CameraToolbar } from './components/ui/CameraToolbar';
import { ActiveTool, BUILD_COSTS, CityState, createTile, getRoadClass, GameSettings, IntersectionControl, OverlayMode, ROAD_BUILD_COSTS, RoadClass, SignalTimingMode, TileData, TileType, TransitLine, TERRAFORM_COST, TUNNEL_BUILD_COST, TurnMovement, ZoneDensity } from './types';
import { FreightCommodity } from './logistics';
import { GAME_CONFIG } from './config';
import { createInitialCityState, getLastSimulationPhaseTimings, simulateTick, unlockRegion } from './engine';
import { isTileInUnlockedRegion, canUnlockRegion } from './mapGenerator';
import { TECH_NODES } from './progression';
import { saveGameAsync } from './saveSystem';
import { createStarterGrid } from './starterCity';
import { applyTerrainTool, getTerrainBrushTiles, isTerrainTool } from './terrain';
import { DistrictPolicy, createDistrict, getDistrictAt } from './districts';
import { repairRoadCondition } from './roadMaintenance';
import { createSimulationCommand, queueSimulationCommand } from './simulationCommands';
import { createRecoveryProject } from './recoveryProjects';
import { recordDiagnosticError } from './releaseReadiness';
import { PerformanceOverlay } from './components/ui/PerformanceOverlay';
import { CityPulse } from './components/ui/CityPulse';
import type { CityPulseDelta } from './components/ui/CityPulse';
import { getOrthogonalRoadPath } from './roadTools';
import { StartScreen } from './components/ui/StartScreen';
import { saveRepository } from './saveSystem';
import { getNightFactor } from './components/world/DayNightSky';
import { getServiceUpgrade } from './serviceUpgrades';
import { calculateTransitLineInsights } from './transitInsights';
import { calculateServiceDispatchInsights } from './serviceDispatchInsights';
import { createRuntimeAuditScenario } from './runtimeAuditScenario';
import { createSimulationSchedulerState, observeSimulationTick, SimulationSchedulerTelemetry } from './simulationScheduler';
import { getCoreLoopAdvice } from './coreLoopAdvisor';
import { calculateBuildForecast } from './buildForecast';
import { playUiSound, type UiSound } from './audio';
import { createLocalizationCatalog, translate } from './localization';

function createNewState(difficulty: 'easy' | 'normal' | 'hard' = 'normal'): CityState {
  const state = createInitialCityState(createStarterGrid(), 2088, difficulty);
  return isRuntimeAuditScenarioRequested() ? createRuntimeAuditScenario(state) : state;
}

function isRuntimeAuditScenarioRequested(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get('debug') === '1' || Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
  return debugEnabled && params.get('audit') === 'transit-dispatch';
}

function cloneGrid(grid: TileData[][]): TileData[][] {
  return grid.map((row) => row.map((tile) => ({ ...tile })));
}

function cloneCityState(state: CityState): CityState {
  try {
    return structuredClone(state);
  } catch {
    return { ...state, grid: cloneGrid(state.grid) };
  }
}

const ROAD_CLASS_ORDER: RoadClass[] = ['LOCAL', 'ARTERIAL', 'HIGHWAY'];

interface SimulationCommit {
  previous: CityState;
  next: CityState;
}

function roadClassRank(roadClass: RoadClass): number {
  return ROAD_CLASS_ORDER.indexOf(roadClass);
}

function isZoningTool(tool: ActiveTool): boolean {
  return tool === TileType.RESIDENTIAL || tool === 'RESIDENTIAL_MEDIUM' || tool === 'RESIDENTIAL_HIGH' || tool === TileType.COMMERCIAL || tool === TileType.OFFICE || tool === TileType.INDUSTRIAL;
}

function zoningPlacement(tool: ActiveTool): { type: TileType; density?: ZoneDensity } | null {
  if (tool === 'RESIDENTIAL_MEDIUM') return { type: TileType.RESIDENTIAL, density: 'MEDIUM' };
  if (tool === 'RESIDENTIAL_HIGH') return { type: TileType.RESIDENTIAL, density: 'HIGH' };
  if (tool === TileType.RESIDENTIAL) return { type: TileType.RESIDENTIAL, density: 'LOW' };
  if (tool === TileType.COMMERCIAL || tool === TileType.OFFICE || tool === TileType.INDUSTRIAL) return { type: tool };
  return null;
}

function zoningToolCost(tool: ActiveTool): number {
  return tool === 'RESIDENTIAL_MEDIUM' ? BUILD_COSTS[TileType.RESIDENTIAL] + 20 : tool === 'RESIDENTIAL_HIGH' ? BUILD_COSTS[TileType.RESIDENTIAL] + 45 : BUILD_COSTS[tool as TileType] ?? 60;
}

export default function App() {
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('skyline_settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      recordDiagnosticError(e, 'SETTINGS_LOAD_ERROR');
    }
    return { ...DEFAULT_SETTINGS };
  });

  const [gameState, setGameState] = useState<CityState>(() => createNewState(settings.difficulty));
  const [activeTool, setActiveTool] = useState<ActiveTool>('POINTER');
  const [activeRoadClass, setActiveRoadClass] = useState<RoadClass>('LOCAL');
  const [activeOverlay, setActiveOverlay] = useState<OverlayMode>('NONE');
  // Game starts paused by requirement B
  const [speed, setSpeed] = useState<0 | 1 | 2 | 3>(0);
  const [selectedTile, setSelectedTile] = useState<TileData | null>(null);
  const [cameraFocus, setCameraFocus] = useState<[number, number] | null>(null);
  const [cameraViewMode, setCameraViewMode] = useState<'2D' | '3D'>('3D');
  const [cameraZoom, setCameraZoom] = useState(1.25);
  const [cameraRotation, setCameraRotation] = useState(0);
  const playSound = useCallback((sound: UiSound) => playUiSound(settings, sound), [settings.volume]);
  const [mapExpansionMode, setMapExpansionMode] = useState(false);
  const [brushSize, setBrushSize] = useState(1);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [hoveredPos, setHoveredPos] = useState<[number, number] | null>(null);
  const [transitLineDraft, setTransitLineDraft] = useState<[number, number][]>([]);
  const [districtPlacementConfig, setDistrictPlacementConfig] = useState<{ name: string; policy: DistrictPolicy; radius: number } | null>(null);
  const lastAutosaveDay = useRef(-1);
  const lastSimulationTickMs = useRef(0);
  const lastSimulationPhaseTimings = useRef<Record<string, number>>({});
  const simulationTickId = useRef(0);
  const simulationScheduler = useRef(createSimulationSchedulerState());
  const [schedulerTelemetry, setSchedulerTelemetry] = useState<SimulationSchedulerTelemetry>({
    budgetMs: 50,
    latestTickMs: 0,
    rollingP95Ms: 0,
    intervalMs: 1000,
    ticksPerInterval: 1,
    qualityTier: 'balanced',
    overloaded: false,
  });
  const pendingSimulationCommit = useRef<SimulationCommit | null>(null);
  const [cityPulseDelta, setCityPulseDelta] = useState<CityPulseDelta>({ population: 0, money: 0, income: 0, expenses: 0, happiness: 0, congestion: 0, commute: 0 });
  const undoStack = useRef<CityState[]>([]);
  const redoStack = useRef<CityState[]>([]);
  const [qualityTier, setQualityTier] = useState<'balanced' | 'reduced'>('balanced');
  const handleQualityHint = useCallback((tier: 'balanced' | 'reduced') => {
    setQualityTier((current) => current === tier ? current : tier);
  }, []);

  const recordEdit = useCallback((state: CityState) => {
    undoStack.current.push(cloneCityState(state));
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = [];
  }, []);

  const undoEdit = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(cloneCityState(gameState));
    pendingSimulationCommit.current = null;
    setGameState(previous);
    setSelectedTile(null);
  }, [gameState]);

  const redoEdit = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(cloneCityState(gameState));
    pendingSimulationCommit.current = null;
    setGameState(next);
    setSelectedTile(null);
  }, [gameState]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: 'welcome', type: 'milestone', title: 'Selamat Datang di Skyline Simulator 2.0', message: 'Kota dimulai dalam status PAUSED. Ikuti panduan walikota di sisi kiri layar.', timestamp: 'Hari 1', unread: true },
  ]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [panel, setPanel] = useState<'city' | 'treasury' | 'tech' | 'policies' | 'districts' | 'missions' | 'save' | 'settings' | null>(null);
  const [hasAutosave, setHasAutosave] = useState(false);
  const [showStartScreen, setShowStartScreen] = useState(() => {
    if (isRuntimeAuditScenarioRequested()) return false;
    try { return localStorage.getItem('skyline_release_intro_seen') !== 'true'; } catch { return true; }
  });
  const nightFactor = useMemo(() => {
    if (settings.dayNightCycle === 'locked_night') return 1;
    if (settings.dayNightCycle === 'locked_day' || settings.dayNightCycle === 'disabled') return 0;
    return getNightFactor(gameState.timeOfDay ?? 6);
  }, [gameState.timeOfDay, settings.dayNightCycle]);

  useEffect(() => {
    let active = true;
    void saveRepository.load('autosave')
      .then((save) => {
        if (active) setHasAutosave(Boolean(save?.gameState));
      })
      .catch(() => {
        if (active) setHasAutosave(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => recordDiagnosticError(event.error ?? event.message, 'WINDOW_ERROR');
    const handleRejection = (event: PromiseRejectionEvent) => recordDiagnosticError(event.reason, 'UNHANDLED_REJECTION');
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => {
    const featureSet = settings.experimentalFeatures ? 'experimental' : 'stable';
    setGameState((current) => current.featureSet === featureSet ? current : { ...current, featureSet });
  }, [settings.experimentalFeatures]);

  const commitTransitLine = useCallback(() => {
    if (activeTool !== 'TRANSIT_LINE' || transitLineDraft.length < 2) return;
    const first = gameState.grid[transitLineDraft[0][1]]?.[transitLineDraft[0][0]];
    const mode = first?.type === TileType.TRAM_STATION || first?.type === TileType.TRAM_STOP ? 'TRAM' : first?.type === TileType.BUS_DEPOT || first?.type === TileType.BUS_STOP ? 'BUS' : null;
    if (!mode) return;

    const line: TransitLine = {
      id: `line-${gameState.day}-${(gameState.transitLines?.length ?? 0) + 1}-${transitLineDraft.map(([x, y]) => `${x}-${y}`).join('_')}`,
      name: `${mode === 'BUS' ? 'Bus' : 'Tram'} Line ${(gameState.transitLines?.length ?? 0) + 1}`,
      mode,
      stops: transitLineDraft.map(([x, y]) => [x, y]),
      frequency: mode === 'TRAM' ? 6 : 8,
      active: true,
      serviceStartHour: 5,
      serviceEndHour: 24,
      peakStartHour: 7,
      peakEndHour: 9,
      peakFrequency: mode === 'TRAM' ? 4 : 5,
    };
    recordEdit(gameState);
    setGameState((current) => ({
      ...current,
      transitLines: [...(current.transitLines ?? []), line],
      commandQueue: [...(current.commandQueue ?? []), createSimulationCommand('CREATE_TRANSIT_LINE', current.day, { line })],
    }));
    setNotifications((items) => [{
      id: `line-created-${line.id}`,
      type: 'milestone' as const,
      title: 'Transit Line Dibuat',
      message: `${line.name} aktif dengan ${line.stops.length} stop.`,
      timestamp: `Hari ${gameState.day}`,
      unread: true,
    }, ...items].slice(0, 30));
    setTransitLineDraft([]);
    setActiveTool('POINTER');
  }, [activeTool, gameState.day, gameState.grid, gameState.transitLines, recordEdit, transitLineDraft]);

  const handleRemoveTransitLine = useCallback((lineId: string) => {
    if (!(gameState.transitLines ?? []).some((line) => line.id === lineId)) return;
    recordEdit(gameState);
    setGameState((current) => queueSimulationCommand({
      ...current,
      transitLines: (current.transitLines ?? []).filter((line) => line.id !== lineId),
    }, createSimulationCommand('REMOVE_TRANSIT_LINE', current.day, { lineId })));
    setNotifications((items) => [{
      id: `line-removed-${lineId}-${Date.now()}`,
      type: 'event' as const,
      title: 'Transit Line Dihapus',
      message: 'Jadwal line telah dihapus dari jaringan transit kota.',
      timestamp: `Hari ${gameState.day}`,
      unread: true,
    }, ...items].slice(0, 30));
  }, [gameState, recordEdit]);

  const handleToggleTransitLine = useCallback((lineId: string) => {
    if (!(gameState.transitLines ?? []).some((line) => line.id === lineId)) return;
    recordEdit(gameState);
    setGameState((current) => {
      const line = (current.transitLines ?? []).find((candidate) => candidate.id === lineId);
      const active = line ? !line.active : false;
      return queueSimulationCommand({
        ...current,
        transitLines: (current.transitLines ?? []).map((candidate) => (
          candidate.id === lineId ? { ...candidate, active } : candidate
        )),
      }, createSimulationCommand('TOGGLE_TRANSIT_LINE', current.day, { lineId, active }));
    });
  }, [gameState, recordEdit]);

  const handleUpdateTransitLine = useCallback((lineId: string, patch: Partial<TransitLine>) => {
    if (!(gameState.transitLines ?? []).some((line) => line.id === lineId)) return;
    recordEdit(gameState);
    setGameState((current) => queueSimulationCommand({
      ...current,
      transitLines: (current.transitLines ?? []).map((line) => line.id === lineId ? { ...line, ...patch } : line),
    }, createSimulationCommand('UPDATE_TRANSIT_LINE', current.day, { lineId, patch })));
  }, [gameState, recordEdit]);

  // Scheduler state stays outside CityState/save files. Under load it slows the
  // wall-clock cadence and requests reduced rendering before changing any
  // deterministic simulation rule.
  useEffect(() => {
    if (speed === 0) return undefined;
    let timer = 0;
    let cancelled = false;
    const runTick = () => {
      setGameState((current) => {
        const simulationStartedAt = performance.now();
        let next = current;
        const requestedTicks = schedulerTelemetry.ticksPerInterval;
        for (let i = 0; i < requestedTicks; i += 1) next = simulateTick(next, settings);
        const elapsedMs = performance.now() - simulationStartedAt;
        lastSimulationTickMs.current = elapsedMs;
        lastSimulationPhaseTimings.current = getLastSimulationPhaseTimings();
        const scheduled = observeSimulationTick(simulationScheduler.current, elapsedMs, next.population, speed);
        simulationScheduler.current = scheduled.state;
        setSchedulerTelemetry((previous) => (
          previous.rollingP95Ms === scheduled.telemetry.rollingP95Ms
            && previous.qualityTier === scheduled.telemetry.qualityTier
            && previous.intervalMs === scheduled.telemetry.intervalMs
            ? previous
            : scheduled.telemetry
        ));
        handleQualityHint(scheduled.telemetry.qualityTier);
        pendingSimulationCommit.current = { previous: current, next };
        return next;
      });
      if (!cancelled) timer = window.setTimeout(runTick, schedulerTelemetry.intervalMs);
    };
    timer = window.setTimeout(runTick, schedulerTelemetry.intervalMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [handleQualityHint, schedulerTelemetry.intervalMs, schedulerTelemetry.ticksPerInterval, settings, speed]);

  // React state updaters must stay pure. Process simulation side effects only
  // after the committed state is visible, which also prevents StrictMode from
  // duplicating notifications and autosaves.
  useEffect(() => {
    const commit = pendingSimulationCommit.current;
    if (!commit || commit.next !== gameState) return;
    pendingSimulationCommit.current = null;
    const { previous, next } = commit;
    simulationTickId.current += 1;
    setCityPulseDelta({
      population: next.population - previous.population,
      money: next.money - previous.money,
      income: next.income - previous.income,
      expenses: next.expenses - previous.expenses,
      happiness: next.happiness - previous.happiness,
      congestion: next.congestionIndex - previous.congestionIndex,
      commute: next.averageCommuteTime - previous.averageCommuteTime,
    });
    if (settings.autosave && next.day % 10 === 0 && lastAutosaveDay.current !== next.day) {
      lastAutosaveDay.current = next.day;
      void saveGameAsync('autosave', next, 'Skyline Metropolis').catch((error) => {
        recordDiagnosticError(error, 'AUTOSAVE_WRITE_ERROR');
      });
    }
    const addNotification = (item: NotificationItem) => {
      setNotifications((items) => items.some((existing) => existing.id === item.id)
        ? items
        : [item, ...items].slice(0, 30));
    };
    if (next.milestoneLevel > previous.milestoneLevel) {
      addNotification({
        id: `milestone-${next.milestoneLevel}-${next.day}`,
        type: 'milestone',
        title: 'Milestone Tercapai!',
        message: `Kota berhasil naik ke milestone level ${next.milestoneLevel}. Fasilitas dan teknologi baru tersedia!`,
        timestamp: `Hari ${next.day}`,
        unread: true,
      });
    }
    if (next.scenarioCompleted && !previous.scenarioCompleted && next.activeScenarioId) {
      addNotification({
        id: `scenario-complete-${next.activeScenarioId}-${next.day}`,
        type: 'milestone',
        title: 'Campaign Scenario Selesai',
        message: `Objective ${next.activeScenarioId} berhasil dicapai.`,
        timestamp: `Hari ${next.day}`,
        unread: true,
      });
    }
    const previousIncidentIds = new Set((previous.incidents ?? []).map((incident) => incident.id));
    const newIncidents = (next.incidents ?? []).filter((incident) => !previousIncidentIds.has(incident.id));
    for (const incident of newIncidents) {
      addNotification({
        id: `incident-${incident.id}`,
        type: 'event',
        title: `Dispatch ${incident.type}`,
        message: `Insiden severity ${incident.severity} terdeteksi di (${incident.x}, ${incident.y}). Unit layanan sedang merespons.`,
        timestamp: `Hari ${next.day}`,
        unread: true,
        location: { x: incident.x, y: incident.y },
      });
    }
    const previousDisasterIds = new Set((previous.disasters ?? []).map((disaster) => disaster.id));
    const newDisasters = (next.disasters ?? []).filter((disaster) => !previousDisasterIds.has(disaster.id));
    for (const disaster of newDisasters) {
      addNotification({
        id: `disaster-${disaster.id}`,
        type: 'event',
        title: `Bencana ${disaster.type}`,
        message: `Severity ${disaster.severity} berdampak di sekitar (${disaster.centerX}, ${disaster.centerY}). Tim pemulihan kota sedang bekerja.`,
        timestamp: `Hari ${next.day}`,
        unread: true,
        location: { x: disaster.centerX, y: disaster.centerY },
      });
    }
  }, [gameState, settings.autosave]);

  const cancelTileInteraction = useCallback(() => {
    setActiveTool('POINTER');
    setTransitLineDraft([]);
    setDistrictPlacementConfig(null);
    setDragStart(null);
    setHoveredPos(null);
  }, []);

  // Keyboard shortcut bindings
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;
      // Modal-specific handlers own keyboard input while a modal/start screen
      // is visible. This prevents shortcuts from changing the city underneath.
      if (panel !== null || showStartScreen) return;
      if (event.key === ' ' || event.key === '0') {
        event.preventDefault();
        setSpeed((value) => value === 0 ? 1 : 0);
      }
      if (event.key === '1') setSpeed(0);
      if (event.key === '2') setSpeed(1);
      if (event.key === '3') setSpeed(2);
      if (event.key === '4') setSpeed(3);
      if (event.key === 'Escape') {
        cancelTileInteraction();
        setPanel(null);
        setSelectedTile(null);
        setCameraFocus(null);
        setMapExpansionMode(false);
        setNotificationOpen(false);
      }
      if (event.key.toLowerCase() === 'f' && selectedTile) {
        event.preventDefault();
        setCameraFocus([selectedTile.x, selectedTile.y]);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setCameraFocus(null);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoEdit(); else undoEdit();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoEdit();
      }
      if (event.key === 'Enter' && activeTool === 'TRANSIT_LINE') {
        event.preventDefault();
        commitTransitLine();
      }
      if (event.key.toLowerCase() === 't') setPanel('tech');
      if (event.key.toLowerCase() === 'p') setPanel('policies');
      if (event.key.toLowerCase() === 'm') setPanel('missions');
      if (event.key.toLowerCase() === 'b') setActiveTool((tool) => tool === 'BULLDOZER' ? 'POINTER' : 'BULLDOZER');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, cancelTileInteraction, commitTransitLine, panel, redoEdit, selectedTile, showStartScreen, undoEdit]);

  const updateGrid = useCallback((updater: (grid: TileData[][]) => void) => {
    setGameState((current) => {
      const grid = cloneGrid(current.grid);
      updater(grid);
      return { ...current, grid };
    });
  }, []);

  // Compute road drag line tiles or zoning brush tiles
  const { previewTiles, previewColor, totalPlacementCost, previewValidCount, previewBlockedCount, previewReason } = useMemo(() => {
    if (!hoveredPos) return { previewTiles: [], previewColor: 'green', totalPlacementCost: 0, previewValidCount: 0, previewBlockedCount: 0, previewReason: '' };
    const [hx, hy] = hoveredPos;

    // 1. Road drag line calculation
    if ((activeTool === TileType.ROAD || activeTool === 'TUNNEL_ROAD') && dragStart) {
      const tiles = getOrthogonalRoadPath(dragStart, [hx, hy]);

      let valid = true;
      let cost = 0;
      let validCount = 0;
      let blockedCount = 0;
      let firstBlockedReason = '';
      for (const [tx, ty] of tiles) {
        const t = gameState.grid[ty]?.[tx];
        const unlocked = isTileInUnlockedRegion(tx, ty, gameState.unlockedRegions);
        const canBuildBridge = activeTool !== 'TUNNEL_ROAD' && activeRoadClass === 'HIGHWAY' && Boolean(t?.water);
        if (!unlocked || !t || (t.water && !canBuildBridge)) {
          valid = false;
          blockedCount += 1;
          if (!firstBlockedReason) firstBlockedReason = !unlocked ? 'Tile belum terbuka' : !t ? 'Di luar peta' : 'Air membutuhkan jalan jembatan Highway';
        } else {
          validCount += 1;
        }
        if (!unlocked || !t) continue;
        if (t.water) {
          if (!canBuildBridge) continue;
          if (t.type === TileType.ROAD && t.roadStructure === 'BRIDGE') {
            const currentClass = getRoadClass(t);
            if (roadClassRank(activeRoadClass) < roadClassRank(currentClass)) {
              valid = false;
              blockedCount += 1;
              validCount = Math.max(0, validCount - 1);
              if (!firstBlockedReason) firstBlockedReason = 'Tidak bisa downgrade kelas jalan';
            }
            else cost += Math.max(0, ROAD_BUILD_COSTS[activeRoadClass] - ROAD_BUILD_COSTS[currentClass]);
          } else if (t.type === TileType.EMPTY) {
            cost += Math.round(ROAD_BUILD_COSTS[activeRoadClass] * GAME_CONFIG.BRIDGE_COST_MULTIPLIER);
          } else {
            valid = false;
            blockedCount += 1;
            validCount = Math.max(0, validCount - 1);
            if (!firstBlockedReason) firstBlockedReason = 'Tile air tidak bisa menerima struktur ini';
          }
          continue;
        }
        if (t.type === TileType.EMPTY) {
          cost += activeTool === 'TUNNEL_ROAD' ? TUNNEL_BUILD_COST : ROAD_BUILD_COSTS[activeRoadClass];
        } else if (t.type === TileType.ROAD) {
          const currentClass = getRoadClass(t);
          if (roadClassRank(activeRoadClass) < roadClassRank(currentClass)) {
            valid = false;
            blockedCount += 1;
            validCount = Math.max(0, validCount - 1);
            if (!firstBlockedReason) firstBlockedReason = 'Tidak bisa downgrade kelas jalan';
          } else {
            cost += Math.max(0, ROAD_BUILD_COSTS[activeRoadClass] - ROAD_BUILD_COSTS[currentClass]);
          }
        } else {
          // A drag preview must never charge for a tile that cannot become a road.
          valid = false;
          blockedCount += 1;
          validCount = Math.max(0, validCount - 1);
          if (!firstBlockedReason) firstBlockedReason = 'Tile sudah ditempati bangunan/zona';
        }
      }
      if (gameState.money < cost) {
        valid = false;
        if (!firstBlockedReason) firstBlockedReason = 'Dana kota tidak mencukupi';
      }

      return {
        previewTiles: tiles,
        previewColor: valid ? 'green' : 'red',
        totalPlacementCost: cost,
        previewValidCount: validCount,
        previewBlockedCount: blockedCount,
        previewReason: valid ? 'Semua tile valid · endpoint tersambung' : firstBlockedReason,
      };
    }

    // 2. Multi-tile Zoning Brush
    const isZoning = isZoningTool(activeTool);
    if (isZoning && brushSize > 1) {
      const radius = brushSize - 1;
      const tiles: [number, number][] = [];
      let valid = true;
      let cost = 0;
      let validCount = 0;
      let blockedCount = 0;
      const unitCost = zoningToolCost(activeTool);

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = hx + dx;
          const ty = hy + dy;
          if (tx >= 0 && tx < 60 && ty >= 0 && ty < 60) {
            tiles.push([tx, ty]);
            const t = gameState.grid[ty]?.[tx];
            const unlocked = isTileInUnlockedRegion(tx, ty, gameState.unlockedRegions);
            if (!unlocked || !t || t.water || t.type !== TileType.EMPTY) {
              blockedCount += 1;
            } else {
              validCount += 1;
              cost += unitCost;
            }
          }
        }
      }
      if (blockedCount > 0) valid = false;
      if (gameState.money < cost || cost === 0) valid = false;

      return {
        previewTiles: tiles,
        previewColor: valid ? 'green' : 'red',
        totalPlacementCost: cost,
        previewValidCount: validCount,
        previewBlockedCount: blockedCount,
        previewReason: valid ? 'Semua tile kosong dan siap dizonasi' : blockedCount > 0 ? `${blockedCount} tile terhalang` : 'Dana kota tidak mencukupi',
      };
    }

    return { previewTiles: [], previewColor: 'green', totalPlacementCost: 0, previewValidCount: 0, previewBlockedCount: 0, previewReason: '' };
  }, [activeRoadClass, activeTool, dragStart, hoveredPos, brushSize, gameState.grid, gameState.money, gameState.unlockedRegions]);

  const previewForecast = useMemo(
    () => calculateBuildForecast(activeTool, previewValidCount, activeRoadClass),
    [activeTool, activeRoadClass, previewValidCount],
  );
  const singleBuildForecast = useMemo(() => {
    if (!hoveredPos || previewTiles.length > 0 || activeTool === 'POINTER' || activeTool === 'BULLDOZER' || activeTool === 'ROAD_REPAIR' || activeTool === 'TRANSIT_LINE' || activeTool === 'DISTRICT' || isTerrainTool(activeTool) || activeTool === TileType.ROAD || activeTool === 'TUNNEL_ROAD') return null;
    const [x, y] = hoveredPos;
    const tile = gameState.grid[y]?.[x];
    if (!tile || tile.water || tile.type !== TileType.EMPTY || !isTileInUnlockedRegion(x, y, gameState.unlockedRegions)) return null;
    return calculateBuildForecast(activeTool, 1, activeRoadClass);
  }, [activeRoadClass, activeTool, gameState.grid, gameState.unlockedRegions, hoveredPos, previewTiles.length]);
  const localizationCatalog = useMemo(() => createLocalizationCatalog(settings.language), [settings.language]);

  // Demolish handler with 50% refund
  const handleDemolish = useCallback((x: number, y: number) => {
    const tile = gameState.grid[y]?.[x];
    if (!tile || tile.type === TileType.EMPTY || tile.water) return;
    const baseCost = BUILD_COSTS[tile.type] ?? 0;
    const refund = Math.round(baseCost * 0.5);
    playSound('demolish');
    recordEdit(gameState);

    updateGrid((grid) => {
      grid[y][x] = createTile(x, y, { elevation: tile.elevation, resource: tile.resource });
    });
    setGameState((current) => queueSimulationCommand({ ...current, money: current.money + refund }, createSimulationCommand('DEMOLISH_TILE', current.day, { x, y, refund })));
    setSelectedTile(null);
  }, [gameState, playSound, recordEdit, updateGrid]);

  // Region unlock handler
  const handleUnlockRegion = useCallback((rx: number, ry: number) => {
    const res = unlockRegion(gameState, rx, ry);
    if (res.success) {
      playSound('success');
      recordEdit(gameState);
      setGameState(queueSimulationCommand({
        ...res.newState,
        activeRegionKeys: Array.from(new Set([...(res.newState.activeRegionKeys ?? ['1,1']), `${rx},${ry}`])),
      }, createSimulationCommand('UNLOCK_REGION', gameState.day, { rx, ry, cost: res.cost })));
      setNotifications((items) => [{
        id: `region-${rx}-${ry}-${Date.now()}`,
        type: 'milestone' as const,
        title: 'Wilayah Baru Terbuka!',
        message: `Sektor (${rx},${ry}) telah dibeli seharga $${res.cost}. Wilayah pembangunan kota diperluas!`,
        timestamp: `Hari ${gameState.day}`,
        unread: true,
      }, ...items].slice(0, 30));
    } else {
      setNotifications((items) => [{
        id: `region-err-${Date.now()}`,
        type: 'event' as const,
        title: 'Ekspansi Gagal',
        message: res.error || 'Wilayah tidak dapat dibuka.',
        timestamp: `Hari ${gameState.day}`,
        unread: true,
      }, ...items].slice(0, 30));
    }
  }, [gameState, playSound, recordEdit]);

  // Tile interaction handler
  const handleTileClick = useCallback((x: number, y: number) => {
    // Check if clicked in locked region
    const tileUnlocked = isTileInUnlockedRegion(x, y, gameState.unlockedRegions);

    if (mapExpansionMode) {
      if (tileUnlocked) return;
      const rx = Math.floor(x / 20);
      const ry = Math.floor(y / 20);
      handleUnlockRegion(rx, ry);
      return;
    }

    if (!tileUnlocked) return;
    const currentTile = gameState.grid[y]?.[x];
    if (!currentTile) return;

    if (activeTool === 'POINTER') {
      setSelectedTile(currentTile);
      return;
    }

    if (activeTool === 'BULLDOZER') {
      handleDemolish(x, y);
      return;
    }

    if (isTerrainTool(activeTool)) {
      const brushTiles = getTerrainBrushTiles(x, y, brushSize, gameState.grid[0]?.length ?? 0, gameState.grid.length);
      const editableTiles = brushTiles.filter(([tx, ty]) => !gameState.grid[ty][tx].water);
      const estimatedCost = editableTiles.length * TERRAFORM_COST;
      if (editableTiles.length === 0 || gameState.money < estimatedCost) return;

      const previewGrid = cloneGrid(gameState.grid);
      const changedTiles = applyTerrainTool(previewGrid, x, y, activeTool, brushSize);
      if (changedTiles === 0) return;
      const terrainChanges = brushTiles
        .map(([tx, ty]) => ({ x: tx, y: ty, elevation: previewGrid[ty][tx].elevation }))
        .filter((change) => change.elevation !== gameState.grid[change.y][change.x].elevation);
      playSound('build');
      recordEdit(gameState);
      updateGrid((grid) => {
        applyTerrainTool(grid, x, y, activeTool, brushSize);
      });
      setGameState((current) => queueSimulationCommand(
        { ...current, money: current.money - changedTiles * TERRAFORM_COST },
        createSimulationCommand('TERRAFORM', current.day, {
          changes: terrainChanges,
          cost: changedTiles * TERRAFORM_COST,
        }),
      ));
      setSelectedTile(null);
      return;
    }

      if (activeTool === 'DISTRICT') {
      if (!districtPlacementConfig) return;
      const occupied = getDistrictAt(gameState.districts ?? [], x, y);
      if (occupied) {
        setNotifications((items) => [{
          id: `district-overlap-${Date.now()}`,
          type: 'event' as const,
          title: 'District Tumpang Tindih',
          message: `Pusat berada di ${occupied.name}. Pilih kawasan yang belum memiliki distrik.`,
          timestamp: `Hari ${gameState.day}`,
          unread: true,
        }, ...items].slice(0, 30));
        return;
      }
      const district = createDistrict(gameState.grid, [x, y], {
        id: `district-${gameState.day}-${(gameState.districts?.length ?? 0) + 1}-${x}-${y}`,
        name: districtPlacementConfig.name,
        policy: districtPlacementConfig.policy,
        radius: districtPlacementConfig.radius,
        createdDay: gameState.day,
      });
      playSound('success');
      recordEdit(gameState);
      setGameState((current) => queueSimulationCommand(
        { ...current, districts: [...(current.districts ?? []), district] },
        createSimulationCommand('CREATE_DISTRICT', current.day, { district }),
      ));
      setNotifications((items) => [{
        id: `district-created-${district.id}`,
        type: 'milestone' as const,
        title: 'District Dibentuk',
        message: `${district.name} aktif dengan kebijakan ${district.policy.toLowerCase().replace('_', ' ')} dan ${district.tiles.length} tile.`,
        timestamp: `Hari ${gameState.day}`,
        unread: true,
      }, ...items].slice(0, 30));
      setDistrictPlacementConfig(null);
      setActiveTool('POINTER');
      return;
    }

    if (activeTool === 'TRANSIT_LINE') {
      const isBusStop = currentTile.type === TileType.BUS_DEPOT || currentTile.type === TileType.BUS_STOP;
      const isTramStop = currentTile.type === TileType.TRAM_STATION || currentTile.type === TileType.TRAM_STOP;
      if (!isBusStop && !isTramStop) {
        setNotifications((items) => [{
          id: `line-stop-${Date.now()}`,
          type: 'event' as const,
          title: 'Stop Transit Tidak Valid',
          message: 'Line Planner menerima depot/station utama atau halte mode yang sesuai sebagai stop.',
          timestamp: `Hari ${gameState.day}`,
          unread: true,
        }, ...items].slice(0, 30));
        return;
      }
      const requiredUpgrade = isBusStop ? 'bus_network' : 'tram_system';
      if (!gameState.unlockedUpgrades.includes(requiredUpgrade) || !currentTile.powered) {
        setNotifications((items) => [{
          id: `line-stop-unavailable-${Date.now()}`,
          type: 'event' as const,
          title: 'Stop Transit Belum Siap',
          message: 'Stop harus memakai teknologi yang sudah terbuka dan memiliki aliran listrik.',
          timestamp: `Hari ${gameState.day}`,
          unread: true,
        }, ...items].slice(0, 30));
        return;
      }
      const hasAdjacentRoad = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => (
        gameState.grid[y + dy]?.[x + dx]?.type === TileType.ROAD
      ));
      if (!hasAdjacentRoad) {
        setNotifications((items) => [{
          id: `line-stop-road-${Date.now()}`,
          type: 'event' as const,
          title: 'Stop Belum Terhubung Jalan',
          message: 'Setiap depot atau stasiun dalam line harus menyentuh jalan.',
          timestamp: `Hari ${gameState.day}`,
          unread: true,
        }, ...items].slice(0, 30));
        return;
      }
      if (transitLineDraft.some(([sx, sy]) => sx === x && sy === y)) return;
      if (transitLineDraft.length > 0) {
        const first = gameState.grid[transitLineDraft[0][1]]?.[transitLineDraft[0][0]];
        const firstIsBus = first?.type === TileType.BUS_DEPOT || first?.type === TileType.BUS_STOP;
        const currentIsBus = isBusStop;
        const modeMatches = firstIsBus === currentIsBus;
        if (!modeMatches) {
          setNotifications((items) => [{
            id: `line-mode-${Date.now()}`,
            type: 'event' as const,
            title: 'Mode Transit Berbeda',
            message: 'Satu line harus memakai stop bus atau stop tram yang konsisten.',
            timestamp: `Hari ${gameState.day}`,
            unread: true,
          }, ...items].slice(0, 30));
          return;
        }
      }
      setTransitLineDraft((stops) => [...stops, [x, y]]);
      return;
    }

    // Road placement with Drag Support
    if (activeTool === TileType.ROAD || activeTool === 'TUNNEL_ROAD') {
      if (!dragStart) {
        // Start road drag
        setDragStart([x, y]);
        return;
      } else {
        // Commit drag road path
        if (previewTiles.length > 0 && previewColor === 'green' && gameState.money >= totalPlacementCost) {
          playSound('build');
          recordEdit(gameState);
          updateGrid((grid) => {
            for (const [px, py] of previewTiles) {
              const t = grid[py]?.[px];
              const canBuildBridge = activeTool !== 'TUNNEL_ROAD' && t?.water && activeRoadClass === 'HIGHWAY';
              const canBuildTunnel = activeTool === 'TUNNEL_ROAD' && !t?.water;
              if (t && (canBuildBridge || canBuildTunnel || !t.water) && (t.type === TileType.EMPTY || (
                t.type === TileType.ROAD && roadClassRank(activeRoadClass) >= roadClassRank(getRoadClass(t))
              ))) {
                grid[py][px] = {
                  ...t,
                  type: TileType.ROAD,
                  roadClass: activeRoadClass,
                  level: 1,
                  abandoned: false,
                  upgradeProgress: 0,
                  roadStructure: canBuildBridge ? 'BRIDGE' : canBuildTunnel ? 'TUNNEL' : (t.roadStructure ?? 'GROUND'),
                };
              }
            }
          });
          setGameState((current) => {
            const next = { ...current, money: current.money - totalPlacementCost };
            return previewTiles.reduce((queued, [px, py]) => {
              const original = gameState.grid[py]?.[px];
              const structure = original?.water
                ? 'BRIDGE'
                : activeTool === 'TUNNEL_ROAD'
                  ? 'TUNNEL'
                  : (original?.roadStructure ?? 'GROUND');
              const tileCost = original?.type === TileType.ROAD
                ? Math.max(0, ROAD_BUILD_COSTS[activeRoadClass] - ROAD_BUILD_COSTS[getRoadClass(original)])
                : original?.water
                  ? Math.round(ROAD_BUILD_COSTS[activeRoadClass] * GAME_CONFIG.BRIDGE_COST_MULTIPLIER)
                  : activeTool === 'TUNNEL_ROAD' ? TUNNEL_BUILD_COST : ROAD_BUILD_COSTS[activeRoadClass];
              return queueSimulationCommand(
                queued,
                createSimulationCommand('BUILD_ROAD', current.day, {
                  x: px,
                  y: py,
                  roadClass: activeRoadClass,
                  roadStructure: structure,
                  cost: tileCost,
                }),
              );
            }, next);
          });
        }
        setDragStart(null);
        return;
      }
    }

    // Zoning Brush Placement (Residential, Commercial, Industrial)
    const isZoning = isZoningTool(activeTool);
    if (isZoning && brushSize > 1) {
      if (previewTiles.length > 0 && previewColor === 'green' && gameState.money >= totalPlacementCost) {
        playSound('build');
        recordEdit(gameState);
        const zoning = zoningPlacement(activeTool);
        if (!zoning) return;
        updateGrid((grid) => {
          for (const [px, py] of previewTiles) {
            const t = grid[py]?.[px];
            if (t && !t.water && t.type === TileType.EMPTY && isTileInUnlockedRegion(px, py, gameState.unlockedRegions)) {
              grid[py][px] = {
                ...t,
                type: zoning.type,
                zoneDensity: zoning.density,
                level: 1,
                population: 0,
                jobs: 0,
                abandoned: false,
                upgradeProgress: 0,
              };
            }
          }
        });
        setGameState((current) => {
          const next = { ...current, money: current.money - totalPlacementCost };
          return previewTiles.reduce(
            (queued, [px, py]) => queueSimulationCommand(
              queued,
              createSimulationCommand('ZONE_LAND', current.day, {
                x: px,
                y: py,
                type: zoning.type,
                zoneDensity: zoning.density,
                cost: zoningToolCost(activeTool),
              }),
            ),
            next,
          );
        });
      }
      return;
    }

    if (activeTool === 'ROAD_REPAIR') {
      const repair = repairRoadCondition(currentTile, gameState.money);
      if (!repair.success) {
        setNotifications((items) => [{
          id: `road-repair-failed-${Date.now()}`,
          type: 'event' as const,
          title: 'Road Works Tidak Tersedia',
          message: currentTile.type !== TileType.ROAD
            ? 'Pilih ruas jalan yang ingin diperbaiki.'
            : (currentTile.roadCondition ?? 100) >= 100
              ? 'Ruas ini masih dalam kondisi sempurna.'
              : 'Dana kota belum cukup untuk pekerjaan perbaikan ini.',
          timestamp: `Hari ${gameState.day}`,
          unread: true,
        }, ...items].slice(0, 30));
        return;
      }
      playSound('build');
      recordEdit(gameState);
      updateGrid((grid) => {
        grid[y][x] = repair.tile;
      });
      setGameState((current) => queueSimulationCommand(
        { ...current, money: current.money - repair.cost },
        createSimulationCommand('REPAIR_ROAD', current.day, {
          x,
          y,
          roadCondition: repair.tile.roadCondition ?? 100,
          cost: repair.cost,
        }),
      ));
      setNotifications((items) => [{
        id: `road-repair-${x}-${y}-${Date.now()}`,
        type: 'traffic' as const,
        title: 'Perbaikan Jalan Selesai',
        message: `Kondisi ruas ${getRoadClass(currentTile)} pulih ${repair.restoredCondition.toFixed(0)} poin dengan biaya $${repair.cost}.`,
        timestamp: `Hari ${gameState.day}`,
        unread: true,
      }, ...items].slice(0, 30));
      setSelectedTile(null);
      return;
    }

    // Single Tile Placement
    if (currentTile.type !== TileType.EMPTY || currentTile.water) return;
    const zoning = zoningPlacement(activeTool);
    const buildableTileType = zoning?.type ?? activeTool as TileType;
    const cost = zoning ? zoningToolCost(activeTool) : BUILD_COSTS[buildableTileType];
    if (!cost || gameState.money < cost) return;

    const requiredUpgrade = activeTool === TileType.BUS_DEPOT
      ? 'bus_network'
      : activeTool === TileType.BUS_STOP
        ? 'bus_network'
      : activeTool === TileType.TRAM_STATION
        ? 'tram_system'
        : activeTool === TileType.TRAM_STOP
          ? 'tram_system'
        : null;
    if (requiredUpgrade && !gameState.unlockedUpgrades.includes(requiredUpgrade)) {
      setNotifications((items) => [{
        id: `transit-lock-${Date.now()}`,
        type: 'event' as const,
        title: 'Teknologi Transit Terkunci',
        message: requiredUpgrade === 'bus_network'
          ? 'Unlock Bus Network di Tech Tree sebelum membangun depot bus.'
          : 'Unlock Tram System di Tech Tree sebelum membangun stasiun trem.',
        timestamp: `Hari ${gameState.day}`,
        unread: true,
      }, ...items].slice(0, 30));
      return;
    }

    // Every facility and zoning tile needs a direct road connection in this
    // simulation. Explain the constraint before spending money on a building
    // that would otherwise become abandoned on the next tick.
    const isFloodInfrastructure = activeTool === TileType.FLOOD_BARRIER || activeTool === TileType.WATER_RESERVOIR;
    const hasAdjacentRoad = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => (
      gameState.grid[y + dy]?.[x + dx]?.type === TileType.ROAD
    ));
    if (!isFloodInfrastructure && !hasAdjacentRoad) {
      setNotifications((items) => [{
        id: `road-access-${Date.now()}`,
        type: 'event' as const,
        title: 'Akses Jalan Diperlukan',
        message: 'Bangunan dan zona harus menyentuh jalan. Bangun jalan lokal terlebih dahulu agar utilitas dan warga dapat mengakses petak ini.',
        timestamp: `Hari ${gameState.day}`,
        unread: true,
      }, ...items].slice(0, 30));
      return;
    }

    // Water Pump validation: must touch water
    if (activeTool === TileType.WATER_PUMP) {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const touchesWater = dirs.some(([dx, dy]) => gameState.grid[y + dy]?.[x + dx]?.water);
      if (!touchesWater) {
        setNotifications((items) => [{
          id: `pump-warn-${Date.now()}`,
          type: 'event' as const,
          title: 'Lokasi Pompa Tidak Valid',
          message: 'Water Pump harus dibangun di daratan yang bersentuhan langsung dengan perairan/sungai.',
          timestamp: `Hari ${gameState.day}`,
          unread: true,
        }, ...items].slice(0, 30));
        return;
      }
    }

    if (isFloodInfrastructure) {
      const hasHydrologySite = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => {
        const neighbor = gameState.grid[y + dy]?.[x + dx];
        return Boolean(neighbor?.water || (neighbor?.waterDepth ?? 0) >= 0.2);
      });
      if (!hasHydrologySite) {
        setNotifications((items) => [{
          id: `hydrology-site-${Date.now()}`,
          type: 'event' as const,
          title: 'Infrastruktur Air Tidak Terhubung',
          message: activeTool === TileType.FLOOD_BARRIER
            ? 'Flood Barrier harus ditempatkan di tepi air atau koridor yang sedang tergenang.'
            : 'Reservoir harus ditempatkan di dekat air atau koridor limpasan agar dapat menampung air.',
          timestamp: `Hari ${gameState.day}`,
          unread: true,
        }, ...items].slice(0, 30));
        return;
      }
    }

    playSound('build');
    recordEdit(gameState);
    updateGrid((grid) => {
      grid[y][x] = {
        ...grid[y][x],
        type: buildableTileType,
        zoneDensity: zoning?.density,
        level: 1,
        population: 0,
        jobs: 0,
        abandoned: false,
        upgradeProgress: 0,
      };
    });
    setGameState((current) => queueSimulationCommand(
      { ...current, money: current.money - cost },
      createSimulationCommand('BUILD_TILE', current.day, {
        x,
        y,
        type: buildableTileType,
        cost,
        zoneDensity: zoning?.density,
      }),
    ));
    setSelectedTile(null);
  }, [activeRoadClass, activeTool, dragStart, previewTiles, previewColor, totalPlacementCost, brushSize, mapExpansionMode, transitLineDraft, districtPlacementConfig, gameState, handleDemolish, handleUnlockRegion, playSound, recordEdit, updateGrid]);

  const handlePointerEnter = useCallback((x: number, y: number) => {
    setHoveredPos([x, y]);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHoveredPos(null);
  }, []);

  const handleUpdateRoadControl = useCallback((x: number, y: number, patch: { intersectionControl?: IntersectionControl; signalTimingMode?: SignalTimingMode; signalOffsetHours?: number; prohibitedTurns?: TurnMovement[] }) => {
    const tile = gameState.grid[y]?.[x];
    if (!tile || tile.type !== TileType.ROAD) return;
    recordEdit(gameState);
    setGameState((current) => {
      const tile = current.grid[y]?.[x];
      if (!tile || tile.type !== TileType.ROAD) return current;
      const grid = cloneGrid(current.grid);
      grid[y][x] = {
        ...grid[y][x],
        ...patch,
        prohibitedTurns: patch.prohibitedTurns ?? grid[y][x].prohibitedTurns ?? [],
      };
      return {
        ...current,
        grid,
        commandQueue: [...(current.commandQueue ?? []), createSimulationCommand('SET_SIGNAL', current.day, { x, y, ...patch })],
      };
    });
  }, [gameState, recordEdit]);

  const handleOrderServiceMaintenance = useCallback((x: number, y: number) => {
    const tile = gameState.grid[y]?.[x];
    const fleetDepot = Boolean(tile && [TileType.FIRE_STATION, TileType.POLICE_STATION, TileType.CLINIC].includes(tile.type));
    if (!tile || !fleetDepot) return;
    const key = `${x},${y}`;
    const condition = gameState.serviceDepotCondition?.[key] ?? 100;
    const activeOrder = (gameState.serviceMaintenanceOrders ?? []).some((order) => `${order.facility.x},${order.facility.y}` === key);
    const cost = Math.max(25, Math.ceil((100 - condition) * 4));
    if (condition >= 99.5 || activeOrder || gameState.money < cost) return;
    recordEdit(gameState);
    setGameState((current) => {
      const tile = current.grid[y]?.[x];
      const fleetDepot = Boolean(tile && [TileType.FIRE_STATION, TileType.POLICE_STATION, TileType.CLINIC].includes(tile.type));
      if (!tile || !fleetDepot) return current;
      const key = `${x},${y}`;
      const condition = current.serviceDepotCondition?.[key] ?? 100;
      const activeOrder = (current.serviceMaintenanceOrders ?? []).some((order) => `${order.facility.x},${order.facility.y}` === key);
      const cost = Math.max(25, Math.ceil((100 - condition) * 4));
      if (condition >= 99.5 || activeOrder || current.money < cost) return current;
      const order = { id: `maintenance-${x}-${y}-${current.day}`, facility: { x, y }, remainingTicks: 2, cost, createdDay: current.day };
      return queueSimulationCommand({
        ...current,
        money: current.money - cost,
        serviceMaintenanceOrders: [
          ...(current.serviceMaintenanceOrders ?? []),
          order,
        ],
      }, createSimulationCommand('ORDER_SERVICE_MAINTENANCE', current.day, { order, cost }));
    });
  }, [gameState, recordEdit]);

  const handleUpgradeService = useCallback((x: number, y: number, upgradeId: string) => {
    const upgrade = getServiceUpgrade(upgradeId);
    if (!upgrade) return;
    recordEdit(gameState);
    setGameState((current) => {
      const tile = current.grid[y]?.[x];
      if (!tile || !upgrade.facilityTypes.includes(tile.type) || tile.serviceUpgrades?.includes(upgradeId) || current.money < upgrade.buildCost) return current;
      const grid = cloneGrid(current.grid);
      grid[y][x] = { ...grid[y][x], serviceUpgrades: [...(grid[y][x].serviceUpgrades ?? []), upgradeId] };
      return queueSimulationCommand(
        { ...current, grid, money: current.money - upgrade.buildCost },
        createSimulationCommand('UPGRADE_SERVICE', current.day, { x, y, upgradeId, cost: upgrade.buildCost }),
      );
    });
  }, [gameState, recordEdit]);

  const handleStartRecoveryProject = useCallback((x: number, y: number) => {
    const tile = gameState.grid[y]?.[x];
    if (!tile || tile.type !== TileType.ROAD || (tile.roadCondition ?? 100) >= 96) return;
    const active = (gameState.recoveryProjects ?? []).some((project) => project.active && project.tiles.some(([tx, ty]) => tx === x && ty === y));
    if (active) return;
    recordEdit(gameState);
    setGameState((current) => {
      const tile = current.grid[y]?.[x];
      if (!tile || tile.type !== TileType.ROAD || (tile.roadCondition ?? 100) >= 96) return current;
      const active = (current.recoveryProjects ?? []).some((project) => project.active && project.tiles.some(([tx, ty]) => tx === x && ty === y));
      if (active) return current;
      const project = createRecoveryProject(`road-recovery-${x}-${y}-${current.day}`, 'ROAD_REPAIR', `Road recovery (${x},${y})`, [[x, y]], Math.max(80, Math.round((100 - (tile.roadCondition ?? 100)) * 12)), 24, 6);
      return {
        ...current,
        recoveryProjects: [...(current.recoveryProjects ?? []), project],
        commandQueue: [...(current.commandQueue ?? []), createSimulationCommand('START_RECOVERY_PROJECT', current.day, { project })],
      };
    });
  }, [gameState, recordEdit]);

  const handleTaxChange = (type: 'residential' | 'commercial' | 'industrial', value: number) => {
    const nextRate = Math.max(1, Math.min(20, value));
    const currentRate = type === 'residential'
      ? gameState.residentialTaxRate
      : type === 'commercial'
        ? gameState.commercialTaxRate
        : gameState.industrialTaxRate;
    if (nextRate === currentRate) return;
    recordEdit(gameState);
    setGameState((current) => queueSimulationCommand(
      { ...current, [`${type}TaxRate`]: nextRate },
      createSimulationCommand('SET_TAX', current.day, { type, value: nextRate }),
    ));
  };

  const handleSetTaxRates = useCallback((residential: number, commercial: number, industrial: number) => {
    const rates: Array<['residential' | 'commercial' | 'industrial', number]> = [
      ['residential', Math.max(1, Math.min(20, residential))],
      ['commercial', Math.max(1, Math.min(20, commercial))],
      ['industrial', Math.max(1, Math.min(20, industrial))],
    ];
    if (rates.every(([type, value]) => {
      const current = type === 'residential' ? gameState.residentialTaxRate : type === 'commercial' ? gameState.commercialTaxRate : gameState.industrialTaxRate;
      return current === value;
    })) return;
    recordEdit(gameState);
    setGameState((current) => rates.reduce((next, [type, value]) => {
      const key = `${type}TaxRate` as 'residentialTaxRate' | 'commercialTaxRate' | 'industrialTaxRate';
      return queueSimulationCommand(
        { ...next, [key]: value },
        createSimulationCommand('SET_TAX', current.day, { type, value }),
      );
    }, current));
  }, [gameState, recordEdit]);

  const handleUnlockTech = (id: string, cost: number) => {
    if (gameState.money < cost || gameState.unlockedUpgrades.includes(id)) return;
    const node = TECH_NODES.find((item) => item.id === id);
    if (!node || gameState.milestoneLevel < node.requiredMilestoneLevel || (node.prerequisiteId && !gameState.unlockedUpgrades.includes(node.prerequisiteId))) return;
    recordEdit(gameState);
    setGameState((current) => queueSimulationCommand(
      { ...current, money: current.money - cost, unlockedUpgrades: [...current.unlockedUpgrades, id] },
      createSimulationCommand('UNLOCK_TECH', current.day, { id, cost }),
    ));
  };

  const handleTogglePolicy = (policyId: string) => {
    recordEdit(gameState);
    setGameState((current) => {
      const enabled = !current.activePolicies.includes(policyId);
      return queueSimulationCommand({
        ...current,
        activePolicies: enabled
          ? [...current.activePolicies, policyId]
          : current.activePolicies.filter((id) => id !== policyId),
      }, createSimulationCommand('SET_POLICY', current.day, { policyId, enabled }));
    });
  };

  const handleStartDistrictPlacement = (config: { name: string; policy: DistrictPolicy; radius: number }) => {
    setDistrictPlacementConfig(config);
    setPanel(null);
    setSelectedTile(null);
    setActiveTool('DISTRICT');
    setNotifications((items) => [{
      id: `district-place-${Date.now()}`,
      type: 'event' as const,
      title: 'District Placement Active',
      message: `Klik pusat kawasan untuk menempatkan ${config.name || 'district baru'}.`,
      timestamp: `Hari ${gameState.day}`,
      unread: true,
    }, ...items].slice(0, 30));
  };

  const handleRemoveDistrict = (districtId: string) => {
    if (!(gameState.districts ?? []).some((district) => district.id === districtId)) return;
    recordEdit(gameState);
    setGameState((current) => queueSimulationCommand(
      { ...current, districts: (current.districts ?? []).filter((district) => district.id !== districtId) },
      createSimulationCommand('REMOVE_DISTRICT', current.day, { districtId }),
    ));
  };

  const handleClaimMission = (missionId: string, reward: number) => {
    if (gameState.completedMissions.includes(missionId)) return;
    recordEdit(gameState);
    setGameState((current) => queueSimulationCommand(
      { ...current, money: current.money + reward, completedMissions: [...current.completedMissions, missionId] },
      createSimulationCommand('CLAIM_MISSION', current.day, { missionId, reward }),
    ));
  };

  const handleStartScenario = (scenarioId: string) => {
    recordEdit(gameState);
    setGameState((current) => queueSimulationCommand(
      { ...current, activeScenarioId: scenarioId, scenarioCompleted: false, scenarioObjectiveValues: {} },
      createSimulationCommand('START_SCENARIO', current.day, { scenarioId }),
    ));
    setNotifications((items) => [{
      id: `scenario-${scenarioId}-${Date.now()}`,
      type: 'milestone' as const,
      title: 'Campaign Scenario Dimulai',
      message: `Skenario ${scenarioId} aktif. Pantau objective di panel Missions.`,
      timestamp: `Hari ${gameState.day}`,
      unread: true,
    }, ...items].slice(0, 30));
  };

  const handleCreateTradeContract = useCallback((commodity: FreightCommodity, direction: 'IMPORT' | 'EXPORT') => {
    const fee = direction === 'IMPORT' ? 180 : 120;
    if (gameState.money < fee) return;
    recordEdit(gameState);
    setGameState((current) => {
      if (current.money < fee) return current;
      const contract = {
        id: `contract-${commodity.toLowerCase()}-${direction.toLowerCase()}-${current.day}-${(current.tradeContracts?.length ?? 0) + 1}`,
        commodity,
        direction,
        quantityPerDay: direction === 'IMPORT' ? 22 : 16,
        pricePerUnit: direction === 'IMPORT' ? 1.2 : 0.9,
        reliability: 90,
        remainingDays: 60,
        active: true,
      };
      return queueSimulationCommand(
        { ...current, money: current.money - fee, tradeContracts: [...(current.tradeContracts ?? []), contract] },
        createSimulationCommand('CREATE_TRADE_CONTRACT', current.day, { contract, fee }),
      );
    });
  }, [gameState, recordEdit]);

  const resetCity = () => {
    setGameState(createNewState(settings.difficulty));
    undoStack.current = [];
    redoStack.current = [];
    pendingSimulationCommit.current = null;
    setSelectedTile(null);
    setCameraFocus(null);
    setCameraViewMode('3D');
    setCameraZoom(1.25);
    setCameraRotation(0);
    setPanel(null);
    setDragStart(null);
    setHoveredPos(null);
    setTransitLineDraft([]);
    setDistrictPlacementConfig(null);
    setCityPulseDelta({ population: 0, money: 0, income: 0, expenses: 0, happiness: 0, congestion: 0, commute: 0 });
    setNotifications([{ id: `welcome-${Date.now()}`, type: 'milestone', title: 'Kota Baru Didirikan', message: 'Selamat datang, Walikota! Sandbox kotamu telah siap.', timestamp: 'Hari 1', unread: true }]);
    setShowStartScreen(false);
    try { localStorage.setItem('skyline_release_intro_seen', 'true'); } catch { /* continue without preference storage */ }
  };

  const dismissStartScreen = () => {
    setShowStartScreen(false);
    try { localStorage.setItem('skyline_release_intro_seen', 'true'); } catch { /* continue without preference storage */ }
  };

  const continueAutosave = async () => {
    const loaded = await saveRepository.load('autosave');
    if (loaded?.gameState) {
      setGameState({
        ...loaded.gameState,
        unlockedRegions: loaded.gameState.unlockedRegions ?? ['1,1'],
        activeRegionKeys: loaded.gameState.activeRegionKeys ?? loaded.gameState.unlockedRegions ?? ['1,1'],
        districts: loaded.gameState.districts ?? [],
      });
      undoStack.current = [];
      redoStack.current = [];
      pendingSimulationCommit.current = null;
      setSelectedTile(null);
      setCityPulseDelta({ population: 0, money: 0, income: 0, expenses: 0, happiness: 0, congestion: 0, commute: 0 });
      setSpeed(0);
      dismissStartScreen();
      return;
    }
    setNotifications((items) => [{
      id: `continue-missing-${Date.now()}`,
      type: 'event' as const,
      title: 'Autosave Tidak Ditemukan',
      message: 'Belum ada kota tersimpan. Mulai Kota Baru untuk melanjutkan.',
      timestamp: 'Sekarang',
      unread: true,
    }, ...items].slice(0, 30));
  };

  const markAllRead = () => setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
  const clearNotifications = () => setNotifications([]);
  const unreadNotifications = notifications.filter((item) => item.unread).length;
  const focusLocation = useCallback(({ x, y }: { x: number; y: number }) => {
    const tile = gameState.grid[y]?.[x];
    if (!tile) return;
    setSelectedTile(tile);
    setCameraFocus([x, y]);
    setActiveTool('POINTER');
    setNotificationOpen(false);
  }, [gameState.grid]);
  const selected = selectedTile ? gameState.grid[selectedTile.y]?.[selectedTile.x] ?? null : null;
  const selectedServiceKey = selected ? `${selected.x},${selected.y}` : '';
  const selectedDepotCondition = selected ? gameState.serviceDepotCondition?.[selectedServiceKey] ?? 100 : undefined;
  const selectedMaintenanceOrderActive = selected
    ? (gameState.serviceMaintenanceOrders ?? []).some((order) => `${order.facility.x},${order.facility.y}` === selectedServiceKey)
    : false;
  const selectedRecoveryProjectActive = selected
    ? (gameState.recoveryProjects ?? []).some((project) => project.active && project.tiles.some(([x, y]) => x === selected.x && y === selected.y))
    : false;

  const transitLineInsights = useMemo(() => calculateTransitLineInsights({
    grid: gameState.grid,
    lines: gameState.transitLines ?? [],
    vehicles: gameState.transitVehicles ?? [],
    totalPopulation: gameState.population,
    transitRidership: gameState.transitRidership ?? 0,
    transitCapacity: gameState.transitCapacity ?? 0,
    timeOfDay: gameState.timeOfDay ?? 6,
  }), [gameState]);

  const serviceDispatchInsights = useMemo(() => calculateServiceDispatchInsights({
    grid: gameState.grid,
    incidents: gameState.incidents ?? [],
    vehicles: gameState.serviceVehicles ?? [],
    serviceBayQueues: gameState.serviceBayQueues ?? {},
    serviceCapacity: {
      fire: gameState.fireServiceCapacity ?? 0,
      police: gameState.policeServiceCapacity ?? 0,
      healthcare: gameState.healthcareCapacity ?? 0,
    },
    responseQuality: gameState.serviceResponseQuality ?? 100,
  }), [gameState]);

  const cityInfoProps = useMemo(() => ({
    isOpen: panel === 'city',
    onClose: () => setPanel(null),
    language: settings.language,
    population: gameState.population,
    households: gameState.households,
    workers: gameState.workers,
    employment: gameState.employment,
    unemploymentRate: gameState.unemploymentRate,
    availableJobs: gameState.availableJobs,
    money: gameState.money,
    income: gameState.income,
    expenses: gameState.expenses,
    residentialTaxRate: gameState.residentialTaxRate,
    commercialTaxRate: gameState.commercialTaxRate,
    industrialTaxRate: gameState.industrialTaxRate,
    onTaxChange: handleTaxChange,
    powerDemand: gameState.powerDemand,
    powerCapacity: gameState.powerCapacity,
    waterDemand: gameState.waterDemand,
    waterCapacity: gameState.waterCapacity,
    wasteProduction: gameState.wasteProduction,
    wasteCapacity: gameState.wasteCapacity,
    wasteCoverage: gameState.wasteCoverage,
    fireServiceCapacity: gameState.fireServiceCapacity ?? 0,
    policeServiceCapacity: gameState.policeServiceCapacity ?? 0,
    healthcareCapacity: gameState.healthcareCapacity ?? 0,
    educationCapacity: gameState.educationCapacity ?? 0,
    serviceResponseQuality: gameState.serviceResponseQuality ?? 100,
    incidents: gameState.incidents ?? [],
    serviceVehicles: gameState.serviceVehicles ?? [],
    activeIncidents: gameState.activeIncidents ?? 0,
    incidentResponseLoad: gameState.incidentResponseLoad ?? 0,
    incidentsResolved: gameState.incidentsResolved ?? 0,
    incidentHappinessPenalty: gameState.incidentHappinessPenalty ?? 0,
    incidentDispatchedUnits: gameState.incidentDispatchedUnits ?? 0,
    incidentQueuedUnits: gameState.incidentQueuedUnits ?? 0,
    serviceFleetTotal: gameState.serviceFleetTotal ?? 0,
    serviceFleetActive: gameState.serviceFleetActive ?? 0,
    serviceFleetAvailable: gameState.serviceFleetAvailable ?? 0,
    serviceFleetOnScene: gameState.serviceFleetOnScene ?? 0,
    serviceFleetAverageCondition: gameState.serviceFleetAverageCondition ?? 100,
    serviceFleetMaintenanceCost: gameState.serviceFleetMaintenanceCost ?? 0,
    activeMaintenanceOrders: gameState.serviceMaintenanceOrders?.length ?? 0,
    serviceBayQueues: gameState.serviceBayQueues ?? {},
    parcelCount: gameState.parcelCount ?? 0,
    developedParcelCount: gameState.developedParcelCount ?? 0,
    privateParcelCount: gameState.privateParcelCount ?? 0,
    averageParcelSize: gameState.averageParcelSize ?? 0,
    mixedUseBlocks: gameState.mixedUseBlocks ?? 0,
    mixedUseFloorArea: gameState.mixedUseFloorArea ?? 0,
    mixedUseJobs: gameState.mixedUseJobs ?? 0,
    disasters: gameState.disasters ?? [],
    activeDisasters: gameState.activeDisasters ?? 0,
    disasterResponseLoad: gameState.disasterResponseLoad ?? 0,
    disastersResolved: gameState.disastersResolved ?? 0,
    disasterHappinessPenalty: gameState.disasterHappinessPenalty ?? 0,
    disasterRecoveryRate: gameState.disasterRecoveryRate ?? 0,
    trafficAverage: gameState.trafficAverage,
    averageCommuteTime: gameState.averageCommuteTime,
    congestionIndex: gameState.congestionIndex,
    averageQueuePressure: gameState.averageQueuePressure ?? 0,
    happiness: gameState.happiness,
    crimeRate: gameState.crimeRate,
    fireSafety: gameState.fireSafety,
    healthcareCoverage: gameState.healthcareCoverage,
    educationCoverage: gameState.educationCoverage,
    educationLevel: gameState.educationLevel,
    healthIndex: gameState.healthIndex,
    landValueAverage: gameState.landValueAverage,
    suitabilityAverage: gameState.suitabilityAverage ?? 50,
    pollutionAverage: gameState.pollutionAverage,
    noiseAverage: gameState.noiseAverage,
    desirability: gameState.desirability,
    residentialDemand: gameState.residentialDemand,
    commercialDemand: gameState.commercialDemand,
    industrialDemand: gameState.industrialDemand,
    officeDemand: gameState.officeDemand ?? 0,
    consumerDemand: gameState.consumerDemand ?? 0,
    retailSupply: gameState.retailSupply ?? 0,
    goodsDemand: gameState.goodsDemand ?? 0,
    goodsSupply: gameState.goodsSupply ?? 0,
    commercialUtilization: gameState.commercialUtilization ?? 0,
    officeUtilization: gameState.officeUtilization ?? 0,
    industrialUtilization: gameState.industrialUtilization ?? 0,
    marketHealth: gameState.marketHealth ?? 0,
    freightDemand: gameState.freightDemand ?? 0,
    freightCapacity: gameState.freightCapacity ?? 0,
    freightReliability: gameState.freightReliability ?? 100,
    industrialAccess: gameState.industrialAccess ?? 100,
    commercialStock: gameState.commercialStock ?? 100,
    commodityDemand: gameState.commodityDemand ?? {},
    commoditySupply: gameState.commoditySupply ?? {},
    commodityStock: gameState.commodityStock ?? {},
    productionInputDemand: gameState.productionInputDemand ?? {},
    productionEfficiency: gameState.productionEfficiency ?? 1,
    cargoTerminals: gameState.cargoTerminals ?? 0,
    cargoThroughput: gameState.cargoThroughput ?? 0,
    connectedIndustries: gameState.connectedIndustries ?? 0,
    freightActiveTrips: gameState.activeFreightTrips?.length ?? 0,
    warehouses: gameState.warehouses ?? 0,
    warehouseCapacity: gameState.warehouseCapacity ?? 0,
    warehouseBuffer: gameState.warehouseBuffer ?? 0,
    transitCapacity: gameState.transitCapacity ?? 0,
    transitRidership: gameState.transitRidership ?? 0,
    transitCoverage: gameState.transitCoverage ?? 0,
    transitBusDepots: gameState.transitBusDepots ?? 0,
    transitTramStations: gameState.transitTramStations ?? 0,
    transitActiveLines: gameState.transitActiveLines ?? 0,
    transitActiveVehicles: gameState.transitActiveVehicles ?? 0,
    transitAverageWait: gameState.transitAverageWait ?? 0,
    transitTransferOpportunities: gameState.transitTransferOpportunities ?? 0,
    transitPlatformCapacity: gameState.transitPlatformCapacity ?? 0,
    transitAverageDwell: gameState.transitAverageDwell ?? 0,
    transitFareRevenue: gameState.transitFareRevenue ?? 0,
    transitOperatingCost: gameState.transitOperatingCost ?? 0,
    floodedTiles: gameState.floodedTiles ?? 0,
    averageWaterDepth: gameState.averageWaterDepth ?? 0,
    peakWaterDepth: gameState.peakWaterDepth ?? 0,
    flowingWaterTiles: gameState.flowingWaterTiles ?? 0,
    reservoirStorage: gameState.reservoirStorage ?? 0,
    floodBarrierCount: gameState.floodBarrierCount ?? 0,
    parkingDemand: gameState.parkingDemand ?? 0,
    parkingSupply: gameState.parkingSupply ?? 0,
    parkingCoverage: gameState.parkingCoverage ?? 100,
    parkingPressure: gameState.parkingPressure ?? 0,
    transitLines: gameState.transitLines ?? [],
    transitVehicles: gameState.transitVehicles ?? [],
    transitLineInsights,
    serviceDispatchInsights,
    onFocusTransitStop: focusLocation,
    onRemoveTransitLine: handleRemoveTransitLine,
    onToggleTransitLine: handleToggleTransitLine,
    onUpdateTransitLine: handleUpdateTransitLine,
    timeOfDay: gameState.timeOfDay ?? 6,
    season: gameState.season,
    weather: gameState.weather,
    temperature: gameState.temperature,
    precipitation: gameState.precipitation,
    climateFireRisk: gameState.climateFireRisk,
    history: gameState.history,
    demographics: gameState.demographics,
    causalDiagnostics: gameState.causalDiagnostics ?? [],
    regions: gameState.regions ?? {},
    activeRegionKeys: gameState.activeRegionKeys ?? gameState.unlockedRegions ?? [],
    recoveryProjects: gameState.recoveryProjects ?? [],
    tradeContracts: gameState.tradeContracts ?? [],
    tradeImportCapacity: gameState.tradeImportCapacity,
    tradeExportCapacity: gameState.tradeExportCapacity,
    tradeExportRevenue: gameState.tradeExportRevenue,
    municipalDebt: gameState.municipalDebt ?? 0,
    activeScenarioId: gameState.activeScenarioId,
    scenarioCompleted: gameState.scenarioCompleted,
    specialization: gameState.specialization,
  }), [gameState, handleRemoveTransitLine, handleToggleTransitLine, handleUpdateTransitLine, panel, settings.language]);

  const nextAction = useMemo(() => getCoreLoopAdvice(gameState, speed), [gameState, speed]);
  const handleNextAction = useCallback((advice: ReturnType<typeof getCoreLoopAdvice>) => {
    if (advice.action.kind === 'SPEED') {
      setSpeed(advice.action.speed);
      return;
    }
    if (advice.action.kind === 'TOOL') {
      setActiveTool(advice.action.tool);
      setDragStart(null);
      setSelectedTile(null);
      return;
    }
    if (advice.action.kind === 'OBJECTIVES') {
      setPanel('missions');
      return;
    }
    if (advice.action.kind === 'TREASURY') {
      setPanel('treasury');
      return;
    }
    if (advice.action.kind === 'FOCUS_DIAGNOSTIC') {
      focusLocation(advice.action.location);
      setPanel('city');
      return;
    }
    setPanel('city');
  }, [focusLocation]);

  return (
    <main className={`app-shell ui-scale-${settings.uiScale ?? 'medium'} ${settings.reducedMotion ? 'reduced-motion' : ''} ${settings.highContrast ? 'accessibility-high-contrast' : ''} colorblind-${settings.colorblindMode ?? 'none'}`}>
      {showStartScreen && (
        <StartScreen
          onNewCity={resetCity}
          onContinue={continueAutosave}
          onLoad={() => { dismissStartScreen(); setPanel('save'); }}
          onSettings={() => { dismissStartScreen(); setPanel('settings'); }}
          language={settings.language}
          canContinue={hasAutosave}
        />
      )}
      <div className="app-world">
        <City3DCanvas
          grid={gameState.grid}
          activeTool={activeTool}
          activeRoadClass={activeRoadClass}
          money={gameState.money}
          activeOverlay={activeOverlay}
          speed={speed}
          timeOfDay={gameState.timeOfDay ?? 6}
          activeTrips={gameState.activeTrips}
          transitLines={gameState.transitLines}
          transitVehicles={gameState.transitVehicles}
          activeFreightTrips={gameState.activeFreightTrips}
          incidents={gameState.incidents}
          serviceVehicles={gameState.serviceVehicles}
          unlockedRegions={gameState.unlockedRegions}
          activeRegionKeys={gameState.activeRegionKeys}
          unlockedUpgrades={gameState.unlockedUpgrades}
          activePolicies={gameState.activePolicies}
          districts={gameState.districts ?? []}
          mapExpansionMode={mapExpansionMode}
          brushSize={brushSize}
          dragPreviewTiles={previewTiles}
          dragPreviewColor={previewColor}
          settings={settings}
          onTileClick={handleTileClick}
          onTilePointerEnter={handlePointerEnter}
          onTilePointerLeave={handlePointerLeave}
          onCancelInteraction={cancelTileInteraction}
          onUnlockRegion={handleUnlockRegion}
          nightFactor={nightFactor}
          focusTile={cameraFocus}
          qualityTier={qualityTier}
          viewMode={cameraViewMode}
          cameraZoom={cameraZoom}
          cameraRotation={cameraRotation}
          onCameraRotationChange={setCameraRotation}
        />
      </div>

      <div className="app-ui">
        <GameHUD
          population={gameState.population}
          money={gameState.money}
          income={gameState.income}
          expenses={gameState.expenses}
          speed={speed}
          setSpeed={(value) => setSpeed(Math.max(0, Math.min(3, value)) as 0 | 1 | 2 | 3)}
          day={gameState.day}
          timeOfDay={gameState.timeOfDay ?? 6}
          milestoneLevel={gameState.milestoneLevel}
          happiness={gameState.happiness}
          unreadNotificationsCount={unreadNotifications}
          onToggleNotifications={() => setNotificationOpen((value) => !value)}
          onOpenCityInfo={() => setPanel('city')}
          onOpenEconomy={() => setPanel('treasury')}
          onOpenTech={() => setPanel('tech')}
          onOpenPolicies={() => setPanel('policies')}
          onOpenDistricts={() => setPanel('districts')}
          onOpenObjectives={() => setPanel('missions')}
          onOpenSaveLoad={() => setPanel('save')}
          onOpenSettings={() => setPanel('settings')}
          onNewGame={resetCity}
          nextAction={gameState.day <= 1 ? nextAction : undefined}
          onNextAction={handleNextAction}
        />

        {activeTool === 'TRANSIT_LINE' && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 rounded-xl border border-emerald-400/30 bg-[#0f172a]/95 px-4 py-3 text-xs text-white shadow-xl backdrop-blur-md">
            <div className="font-bold text-emerald-300">Transit Line Planner</div>
            <div className="text-slate-300">Klik depot/station berurutan · Stop: {transitLineDraft.length} · Enter untuk simpan · Esc untuk batal</div>
            <button type="button" disabled={transitLineDraft.length < 2} onClick={commitTransitLine} className="mt-2 rounded-lg bg-emerald-500/20 px-3 py-1.5 font-semibold text-emerald-200 disabled:opacity-40">
              Simpan Line
            </button>
          </div>
        )}

        {previewTiles.length > 0 && (activeTool === TileType.ROAD || activeTool === 'TUNNEL_ROAD' || isZoningTool(activeTool)) && (
          <div className={`absolute bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-xl border px-3 py-2 text-[11px] shadow-xl backdrop-blur-md ${previewColor === 'green' ? 'border-emerald-400/30 bg-emerald-950/90 text-emerald-100' : 'border-red-400/30 bg-red-950/90 text-red-100'}`}>
            <div className="flex items-center gap-3">
              <span>{previewValidCount}/{previewTiles.length} tile valid</span>
              <span>Biaya <b>${totalPlacementCost.toLocaleString()}</b></span>
              <span>Kapasitas ±{previewValidCount * (activeTool === TileType.ROAD || activeTool === 'TUNNEL_ROAD' ? 4 : activeTool === 'RESIDENTIAL_HIGH' ? 24 : activeTool === 'RESIDENTIAL_MEDIUM' ? 15 : 10)}</span>
              <span className="font-bold">{previewColor === 'green' ? 'Siap dibangun' : 'Lokasi tidak valid'}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] opacity-85">
              {previewBlockedCount > 0 && <span>{previewBlockedCount} tile terhalang</span>}
              {previewReason && <span>{previewReason}</span>}
            </div>
            {previewForecast && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-white/10 pt-1 text-[9px] opacity-90">
                {previewForecast.capacity > 0 && <span>{translate(localizationCatalog, 'forecast.capacity')} +{previewForecast.capacity}</span>}
                {previewForecast.households > 0 && <span>{translate(localizationCatalog, 'forecast.households')} ±{previewForecast.households}</span>}
                {previewForecast.jobs > 0 && <span>{translate(localizationCatalog, 'forecast.jobs')} +{previewForecast.jobs}</span>}
                {previewForecast.trafficDemand > 0 && <span>{translate(localizationCatalog, 'forecast.traffic')} +{previewForecast.trafficDemand}</span>}
                {previewForecast.estimatedTax > 0 && <span>{translate(localizationCatalog, 'forecast.tax')} ±${previewForecast.estimatedTax}/hari</span>}
                {previewForecast.maintenance > 0 && <span>{translate(localizationCatalog, 'forecast.maintenance')} -${previewForecast.maintenance}/hari</span>}
                {previewForecast.pollution > 0 && <span>{translate(localizationCatalog, 'forecast.pollution')} +{previewForecast.pollution}</span>}
              </div>
            )}
          </div>
        )}
        {singleBuildForecast && (
          <div className="absolute bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-cyan-400/25 bg-slate-950/90 px-3 py-2 text-[10px] text-cyan-100 shadow-xl backdrop-blur-md">
            <div className="mb-1 font-semibold text-cyan-200">Forecast tile</div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {singleBuildForecast.capacity > 0 && <span>{translate(localizationCatalog, 'forecast.capacity')} +{singleBuildForecast.capacity}</span>}
              {singleBuildForecast.households > 0 && <span>{translate(localizationCatalog, 'forecast.households')} ±{singleBuildForecast.households}</span>}
              {singleBuildForecast.jobs > 0 && <span>{translate(localizationCatalog, 'forecast.jobs')} +{singleBuildForecast.jobs}</span>}
              {singleBuildForecast.estimatedTax > 0 && <span>{translate(localizationCatalog, 'forecast.tax')} ±${singleBuildForecast.estimatedTax}/hari</span>}
              {singleBuildForecast.maintenance > 0 && <span>{translate(localizationCatalog, 'forecast.maintenance')} -${singleBuildForecast.maintenance}/hari</span>}
            </div>
          </div>
        )}

        <Sidebar 
          activeTool={activeTool} 
          activeRoadClass={activeRoadClass}
          setActiveRoadClass={setActiveRoadClass}
          setActiveTool={(tool) => {
          setActiveTool(tool);
          setDragStart(null);
          if (tool !== 'TRANSIT_LINE') setTransitLineDraft([]);
          if (tool !== 'DISTRICT') setDistrictPlacementConfig(null);
          if (tool !== 'POINTER') setSelectedTile(null);
        }}
          unlockedUpgrades={gameState.unlockedUpgrades}
          language={settings.language}
        />
        <InfoViewsToolbar activeOverlay={activeOverlay} onSelectOverlay={setActiveOverlay} />
        <CameraToolbar
          viewMode={cameraViewMode}
          zoom={cameraZoom}
          rotation={cameraRotation}
          hasFocus={Boolean(selected)}
          onViewModeChange={setCameraViewMode}
          onZoomChange={setCameraZoom}
          onRotationChange={setCameraRotation}
          onFocusSelected={() => selected && setCameraFocus([selected.x, selected.y])}
          onReset={() => { setCameraFocus(null); setCameraViewMode('3D'); setCameraZoom(1.25); setCameraRotation(0); }}
        />
        <NotificationToast gameState={gameState} />
        <PerformanceOverlay
          state={gameState}
          speed={speed}
          simulationTickMs={lastSimulationTickMs.current}
          simulationTickId={simulationTickId.current}
          simulationPhaseTimings={lastSimulationPhaseTimings.current}
          schedulerTelemetry={schedulerTelemetry}
          adaptiveQuality={settings.adaptiveQuality ?? true}
          onQualityHint={handleQualityHint}
          enabled={Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) || new URLSearchParams(window.location.search).get('debug') === '1'}
        />
        {(gameState.day > 1 || (gameState.causalDiagnostics?.length ?? 0) > 0) && (
          <CityPulse
            day={gameState.day}
            diagnostics={gameState.causalDiagnostics ?? []}
            delta={cityPulseDelta}
            onOpenInfo={() => setPanel('city')}
            onFocusLocation={focusLocation}
            language={settings.language}
          />
        )}
        <NotificationCenter
          isOpen={notificationOpen}
          onClose={() => setNotificationOpen(false)}
          notifications={notifications}
          onMarkAllRead={markAllRead}
          onClearHistory={clearNotifications}
          onSelectLocation={({ x, y }) => {
            focusLocation({ x, y });
            setNotifications((items) => items.map((item) => item.location?.x === x && item.location?.y === y ? { ...item, unread: false } : item));
            setNotificationOpen(false);
          }}
        />

        {/* Step-by-Step Onboarding Starter Tutorial */}
        <StarterTutorial
          gameState={gameState}
          speed={speed}
          onSetSpeed={setSpeed}
          onSelectTool={setActiveTool}
        />

        {/* Bottom Simulation Bar */}
        <BottomToolbar
          speed={speed}
          setSpeed={setSpeed}
          day={gameState.day}
          income={gameState.income}
          expenses={gameState.expenses}
          unlockedRegionsCount={gameState.unlockedRegions?.length ?? 1}
          mapExpansionMode={mapExpansionMode}
          onToggleExpansionMode={() => setMapExpansionMode((v) => !v)}
          brushSize={brushSize}
          onSetBrushSize={setBrushSize}
          activeEvents={gameState.eventsData}
          onUndo={undoEdit}
          onRedo={redoEdit}
          canUndo={undoStack.current.length > 0}
          canRedo={redoStack.current.length > 0}
        />

        {/* Diagnostic Building & Tile Inspector */}
        <BuildingInspector
          tile={selected}
          onFocus={(x, y) => setCameraFocus([x, y])}
          serviceDepotCondition={selectedDepotCondition}
          maintenanceOrderActive={selectedMaintenanceOrderActive}
          onClose={() => setSelectedTile(null)}
          onDemolish={handleDemolish}
          onUpdateRoadControl={handleUpdateRoadControl}
          onOrderMaintenance={handleOrderServiceMaintenance}
          onUpgradeService={handleUpgradeService}
          recoveryProjectActive={selectedRecoveryProjectActive}
          onStartRecoveryProject={handleStartRecoveryProject}
          evolutionContext={{
            grid: gameState.grid,
            unlockedUpgrades: gameState.unlockedUpgrades,
            residentialDemand: gameState.residentialDemand,
            commercialDemand: gameState.commercialDemand,
            officeDemand: gameState.officeDemand ?? 0,
            industrialDemand: gameState.industrialDemand,
          }}
          roadGrid={gameState.grid}
        />
      </div>

      <CityInformationPanel {...cityInfoProps} />
      <TreasuryModal 
        isOpen={panel === 'treasury'} 
        onClose={() => setPanel(null)} 
        gameState={gameState} 
        setTaxRates={handleSetTaxRates}
        onCreateTradeContract={handleCreateTradeContract}
        experimentalFeatures={settings.experimentalFeatures ?? false}
      />
      <TechTreeModal 
        isOpen={panel === 'tech'} 
        onClose={() => setPanel(null)} 
        money={gameState.money} 
        unlockedUpgrades={gameState.unlockedUpgrades} 
        milestoneLevel={gameState.milestoneLevel} 
        onUnlockTech={handleUnlockTech} 
      />
      <PoliciesModal 
        isOpen={panel === 'policies'} 
        onClose={() => setPanel(null)} 
        milestoneLevel={gameState.milestoneLevel} 
        activePolicies={gameState.activePolicies} 
        onTogglePolicy={handleTogglePolicy} 
      />
      <DistrictsModal
        isOpen={panel === 'districts'}
        onClose={() => setPanel(null)}
        districts={gameState.districts ?? []}
        onStartPlacement={handleStartDistrictPlacement}
        onRemoveDistrict={handleRemoveDistrict}
      />
      <MissionsModal 
        isOpen={panel === 'missions'} 
        onClose={() => setPanel(null)} 
        gameState={gameState} 
        onClaimReward={handleClaimMission} 
        onStartScenario={handleStartScenario}
      />
      <SaveLoadModal 
        isOpen={panel === 'save'} 
        onClose={() => setPanel(null)} 
        gameState={gameState} 
        onLoadState={(state) => {
          undoStack.current = [];
          redoStack.current = [];
          setGameState({
            ...state,
            unlockedRegions: state.unlockedRegions ?? ['1,1'],
            activeRegionKeys: state.activeRegionKeys ?? state.unlockedRegions ?? ['1,1'],
            districts: state.districts ?? [],
          });
          setCityPulseDelta({ population: 0, money: 0, income: 0, expenses: 0, happiness: 0, congestion: 0, commute: 0 });
        }} 
        onNewGame={resetCity} 
      />
      <SettingsModal 
        isOpen={panel === 'settings'} 
        onClose={() => setPanel(null)} 
        settings={settings}
        onUpdateSettings={setSettings}
        gameState={gameState}
      />
    </main>
  );
}
