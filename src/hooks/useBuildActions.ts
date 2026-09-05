import { useState, useRef, useCallback } from 'react';
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
  const [brushSize, setBrushSize] = useState(1);
  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [hoveredPos, setHoveredPos] = useState<[number, number] | null>(null);
  const [transitLineDraft, setTransitLineDraft] = useState<[number, number][]>([]);
  const [districtPlacementConfig, setDistrictPlacementConfig] = useState<{
    name: string;
    policy: DistrictPolicy;
    radius: number;
  } | null>(null);

  const undoStack = useRef<CityState[]>([]);
  const redoStack = useRef<CityState[]>([]);

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
  }, [gameState, pendingSimulationCommit, setGameState, setSelectedTile]);

  const redoEdit = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(cloneCityState(gameState));
    pendingSimulationCommit.current = null;
    setGameState(next);
    setSelectedTile(null);
  }, [gameState, pendingSimulationCommit, setGameState, setSelectedTile]);

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
