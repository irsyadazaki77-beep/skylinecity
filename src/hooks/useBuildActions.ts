import { useState, useRef, useCallback, useEffect } from 'react';
import { ActiveTool, RoadClass, TileData, CityState } from '../types';
import { DistrictPolicy } from '../districts';
import { SimulationCommit } from './useSimulationControls';

function cloneGrid(grid: TileData[][]): TileData[][] {
  return grid.map((row) => row.map((tile) => ({ ...tile })));
}

export function cloneCityState(state: CityState): CityState {
  try {
    return structuredClone(state);
  } catch {
    return { ...state, grid: cloneGrid(state.grid) };
  }
}

export interface TileDelta {
  x: number;
  y: number;
  previous: TileData;
  next: TileData;
}

export interface BuildHistoryAction {
  moneyDelta: number;
  tiles: TileDelta[];
  upgrades?: { before: string[]; after: string[] };
  policies?: { before: string[]; after: string[] };
}

function computeGridDelta(beforeGrid: TileData[][], afterGrid: TileData[][]): TileDelta[] {
  const deltas: TileDelta[] = [];
  const height = Math.min(beforeGrid.length, afterGrid.length);
  for (let y = 0; y < height; y++) {
    const bRow = beforeGrid[y];
    const aRow = afterGrid[y];
    const width = Math.min(bRow.length, aRow.length);
    for (let x = 0; x < width; x++) {
      const b = bRow[x];
      const a = aRow[x];
      if (
        b.type !== a.type ||
        b.level !== a.level ||
        b.elevation !== a.elevation ||
        b.roadClass !== a.roadClass ||
        b.roadStructure !== a.roadStructure ||
        b.roadCondition !== a.roadCondition ||
        b.zoneDensity !== a.zoneDensity ||
        b.abandoned !== a.abandoned ||
        b.parcelStatus !== a.parcelStatus ||
        (b.serviceUpgrades?.length ?? 0) !== (a.serviceUpgrades?.length ?? 0)
      ) {
        deltas.push({
          x,
          y,
          previous: { ...b },
          next: { ...a },
        });
      }
    }
  }
  return deltas;
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
  const pendingPreEdit = useRef<{
    grid: TileData[][];
    money: number;
    upgrades: string[];
    policies: string[];
  } | null>(null);

  const isUndoRedoActive = useRef(false);

  // When gameState changes after recordEdit was called, compute and store the inverse patch
  useEffect(() => {
    if (isUndoRedoActive.current) {
      isUndoRedoActive.current = false;
      return;
    }
    const pre = pendingPreEdit.current;
    if (!pre) return;
    pendingPreEdit.current = null;

    const deltas = computeGridDelta(pre.grid, gameState.grid);
    const moneyDelta = gameState.money - pre.money;
    const upgradeChanged = pre.upgrades.length !== gameState.unlockedUpgrades.length;
    const policyChanged = pre.policies.length !== gameState.activePolicies.length;

    if (deltas.length > 0 || moneyDelta !== 0 || upgradeChanged || policyChanged) {
      undoStack.current.push({
        moneyDelta,
        tiles: deltas,
        upgrades: upgradeChanged ? { before: [...pre.upgrades], after: [...gameState.unlockedUpgrades] } : undefined,
        policies: policyChanged ? { before: [...pre.policies], after: [...gameState.activePolicies] } : undefined,
      });
      if (undoStack.current.length > 30) undoStack.current.shift();
      redoStack.current = [];
    }
  }, [gameState]);

  const recordEdit = useCallback((state: CityState) => {
    pendingPreEdit.current = {
      grid: state.grid.map((row) => row.map((tile) => ({ ...tile }))),
      money: state.money,
      upgrades: [...state.unlockedUpgrades],
      policies: [...state.activePolicies],
    };
  }, []);

  const undoEdit = useCallback(() => {
    const action = undoStack.current.pop();
    if (!action) return;
    isUndoRedoActive.current = true;
    redoStack.current.push(action);
    pendingSimulationCommit.current = null;

    setGameState((current) => {
      const nextGrid = current.grid.map((row) => [...row]);
      for (const d of action.tiles) {
        nextGrid[d.y][d.x] = { ...d.previous };
      }
      return {
        ...current,
        grid: nextGrid,
        money: current.money - action.moneyDelta,
        unlockedUpgrades: action.upgrades ? [...action.upgrades.before] : current.unlockedUpgrades,
        activePolicies: action.policies ? [...action.policies.before] : current.activePolicies,
      };
    });
    setSelectedTile(null);
  }, [pendingSimulationCommit, setGameState, setSelectedTile]);

  const redoEdit = useCallback(() => {
    const action = redoStack.current.pop();
    if (!action) return;
    isUndoRedoActive.current = true;
    undoStack.current.push(action);
    pendingSimulationCommit.current = null;

    setGameState((current) => {
      const nextGrid = current.grid.map((row) => [...row]);
      for (const d of action.tiles) {
        nextGrid[d.y][d.x] = { ...d.next };
      }
      return {
        ...current,
        grid: nextGrid,
        money: current.money + action.moneyDelta,
        unlockedUpgrades: action.upgrades ? [...action.upgrades.after] : current.unlockedUpgrades,
        activePolicies: action.policies ? [...action.policies.after] : current.activePolicies,
      };
    });
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
