import { useState, useRef, useCallback, useEffect } from 'react';
import { ActiveTool, RoadClass, TileData, CityState } from '../types';
import { DistrictPolicy } from '../districts';
import type { SimulationCommit } from './useSimulationControls';

function cloneValue<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) result[key] = cloneValue(entry);
    return result as T;
  }
}

export function cloneCityState(state: CityState): CityState {
  return cloneValue(state);
}

/**
 * A reversible edit is a domain snapshot, not a JSON/grid diff. The grid is
 * copied once when an edit starts and once when it completes, while change
 * detection uses container revisions/references and scalar domain fields.
 */
export interface ReversibleCitySnapshot {
  grid: TileData[][];
  money: number;
  unlockedUpgrades: string[];
  activePolicies: string[];
  transitLines?: CityState['transitLines'];
  districts?: CityState['districts'];
  signalStates?: CityState['signalStates'];
  unlockedRegions: string[];
  activeRegionKeys?: string[];
  serviceMaintenanceOrders?: CityState['serviceMaintenanceOrders'];
  serviceDepotCondition?: CityState['serviceDepotCondition'];
  serviceBayQueues?: CityState['serviceBayQueues'];
  recoveryProjects?: CityState['recoveryProjects'];
  disasterPreparationState?: CityState['disasterPreparationState'];
  policyConsequences?: CityState['policyConsequences'];
  regions?: CityState['regions'];
  commandQueue?: CityState['commandQueue'];
  residentialTaxRate: number;
  commercialTaxRate: number;
  industrialTaxRate: number;
  municipalDebt?: number;
  capitalBudget?: number;
}

export interface BuildHistoryAction {
  domain: 'BUILD' | 'ZONE' | 'BULLDOZE' | 'TERRAFORM' | 'TRANSIT' | 'INTERSECTION' | 'DISTRICT' | 'POLICY' | 'SERVICE' | 'REGION' | 'TECH' | 'DISASTER' | 'OTHER';
  before: ReversibleCitySnapshot;
  after: ReversibleCitySnapshot;
}

interface SnapshotReferences {
  grid: TileData[][];
  unlockedUpgrades: string[];
  activePolicies: string[];
  transitLines?: CityState['transitLines'];
  districts?: CityState['districts'];
  signalStates?: CityState['signalStates'];
  unlockedRegions: string[];
  activeRegionKeys?: string[];
  serviceMaintenanceOrders?: CityState['serviceMaintenanceOrders'];
  serviceDepotCondition?: CityState['serviceDepotCondition'];
  serviceBayQueues?: CityState['serviceBayQueues'];
  recoveryProjects?: CityState['recoveryProjects'];
  disasterPreparationState?: CityState['disasterPreparationState'];
  policyConsequences?: CityState['policyConsequences'];
  regions?: CityState['regions'];
  commandQueue?: CityState['commandQueue'];
}

interface PendingEdit {
  snapshot: ReversibleCitySnapshot;
  references: SnapshotReferences;
  domain: BuildHistoryAction['domain'];
}

export function captureHistorySnapshot(state: CityState): ReversibleCitySnapshot {
  return cloneValue({
    grid: state.grid,
    money: state.money,
    unlockedUpgrades: state.unlockedUpgrades,
    activePolicies: state.activePolicies,
    transitLines: state.transitLines,
    districts: state.districts,
    signalStates: state.signalStates,
    unlockedRegions: state.unlockedRegions,
    activeRegionKeys: state.activeRegionKeys,
    serviceMaintenanceOrders: state.serviceMaintenanceOrders,
    serviceDepotCondition: state.serviceDepotCondition,
    serviceBayQueues: state.serviceBayQueues,
    recoveryProjects: state.recoveryProjects,
    disasterPreparationState: state.disasterPreparationState,
    policyConsequences: state.policyConsequences,
    regions: state.regions,
    commandQueue: state.commandQueue,
    residentialTaxRate: state.residentialTaxRate,
    commercialTaxRate: state.commercialTaxRate,
    industrialTaxRate: state.industrialTaxRate,
    municipalDebt: state.municipalDebt,
    capitalBudget: state.capitalBudget,
  });
}

function captureReferences(state: CityState): SnapshotReferences {
  return {
    grid: state.grid,
    unlockedUpgrades: state.unlockedUpgrades,
    activePolicies: state.activePolicies,
    transitLines: state.transitLines,
    districts: state.districts,
    signalStates: state.signalStates,
    unlockedRegions: state.unlockedRegions,
    activeRegionKeys: state.activeRegionKeys,
    serviceMaintenanceOrders: state.serviceMaintenanceOrders,
    serviceDepotCondition: state.serviceDepotCondition,
    serviceBayQueues: state.serviceBayQueues,
    recoveryProjects: state.recoveryProjects,
    disasterPreparationState: state.disasterPreparationState,
    policyConsequences: state.policyConsequences,
    regions: state.regions,
    commandQueue: state.commandQueue,
  };
}

function referencesChanged(before: SnapshotReferences, after: CityState): boolean {
  return before.grid !== after.grid
    || before.unlockedUpgrades !== after.unlockedUpgrades
    || before.activePolicies !== after.activePolicies
    || before.transitLines !== after.transitLines
    || before.districts !== after.districts
    || before.signalStates !== after.signalStates
    || before.unlockedRegions !== after.unlockedRegions
    || before.activeRegionKeys !== after.activeRegionKeys
    || before.serviceMaintenanceOrders !== after.serviceMaintenanceOrders
    || before.serviceDepotCondition !== after.serviceDepotCondition
    || before.serviceBayQueues !== after.serviceBayQueues
    || before.recoveryProjects !== after.recoveryProjects
    || before.disasterPreparationState !== after.disasterPreparationState
    || before.policyConsequences !== after.policyConsequences
    || before.regions !== after.regions
    || before.commandQueue !== after.commandQueue;
}

export function restoreHistorySnapshot(current: CityState, snapshot: ReversibleCitySnapshot): CityState {
  const restored = cloneValue(snapshot);
  return {
    ...current,
    ...restored,
  };
}

interface UseBuildActionsOptions {
  gameState: CityState;
  setGameState: React.Dispatch<React.SetStateAction<CityState>>;
  setSelectedTile: (tile: TileData | null) => void;
  pendingSimulationCommit: React.MutableRefObject<SimulationCommit | null>;
}

export function useBuildActions({
  gameState,
  setGameState,
  setSelectedTile,
  pendingSimulationCommit,
}: UseBuildActionsOptions) {
  const [activeTool, setActiveTool] = useState<ActiveTool>('POINTER');
  const [activeRoadClass, setActiveRoadClass] = useState<RoadClass>('LOCAL');
  const [brushSize, setBrushSize] = useState<number>(1);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [hoveredPos, setHoveredPos] = useState<[number, number] | null>(null);
  const [transitLineDraft, setTransitLineDraft] = useState<[number, number][]>([]);
  const [districtPlacementConfig, setDistrictPlacementConfig] = useState<{
    name: string;
    policy: DistrictPolicy;
    radius: number;
  } | null>(null);

  const undoStack = useRef<BuildHistoryAction[]>([]);
  const redoStack = useRef<BuildHistoryAction[]>([]);
  const pendingPreEdit = useRef<PendingEdit | null>(null);
  const isUndoRedoActive = useRef(false);

  useEffect(() => {
    if (isUndoRedoActive.current) {
      isUndoRedoActive.current = false;
      return;
    }
    const pre = pendingPreEdit.current;
    if (!pre) return;
    pendingPreEdit.current = null;

    if (referencesChanged(pre.references, gameState)
      || pre.snapshot.money !== gameState.money
      || pre.snapshot.residentialTaxRate !== gameState.residentialTaxRate
      || pre.snapshot.commercialTaxRate !== gameState.commercialTaxRate
      || pre.snapshot.industrialTaxRate !== gameState.industrialTaxRate
      || pre.snapshot.municipalDebt !== gameState.municipalDebt
      || pre.snapshot.capitalBudget !== gameState.capitalBudget) {
      undoStack.current.push({
        domain: pre.domain,
        before: pre.snapshot,
        after: captureHistorySnapshot(gameState),
      });
      if (undoStack.current.length > 30) undoStack.current.shift();
      redoStack.current = [];
    }
  }, [gameState]);

  const recordEdit = useCallback((state: CityState, domain: BuildHistoryAction['domain'] = 'OTHER') => {
    pendingPreEdit.current = {
      snapshot: captureHistorySnapshot(state),
      references: captureReferences(state),
      domain,
    };
  }, []);

  const undoEdit = useCallback(() => {
    const action = undoStack.current.pop();
    if (!action) return;
    isUndoRedoActive.current = true;
    redoStack.current.push(action);
    pendingSimulationCommit.current = null;
    setGameState((current) => restoreHistorySnapshot(current, action.before));
    setSelectedTile(null);
  }, [pendingSimulationCommit, setGameState, setSelectedTile]);

  const redoEdit = useCallback(() => {
    const action = redoStack.current.pop();
    if (!action) return;
    isUndoRedoActive.current = true;
    undoStack.current.push(action);
    pendingSimulationCommit.current = null;
    setGameState((current) => restoreHistorySnapshot(current, action.after));
    setSelectedTile(null);
  }, [pendingSimulationCommit, setGameState, setSelectedTile]);

  const cancelTileInteraction = useCallback(() => {
    setActiveTool('POINTER');
    setTransitLineDraft([]);
    setDistrictPlacementConfig(null);
    setDragStart(null);
    setHoveredPos(null);
  }, []);

  return {
    activeTool,
    setActiveTool,
    activeRoadClass,
    setActiveRoadClass,
    brushSize,
    setBrushSize,
    dragStart,
    setDragStart,
    hoveredPos,
    setHoveredPos,
    transitLineDraft,
    setTransitLineDraft,
    districtPlacementConfig,
    setDistrictPlacementConfig,
    undoStack,
    redoStack,
    recordEdit,
    undoEdit,
    redoEdit,
    cancelTileInteraction,
  };
}
