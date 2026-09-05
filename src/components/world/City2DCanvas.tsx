import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Droplet,
  Flame,
  HeartPulse,
  HelpCircle,
  Home,
  Info,
  Layers,
  MapPin,
  Route,
  Shield,
  Trees,
  Zap,
  ZapOff,
} from 'lucide-react';
import { ActiveTool, OverlayMode, RoadClass, TileData, TileType } from '../../types';
import {
  computeRoadRecommendations,
  computeUtilityRecommendations,
  computeZoningRecommendations,
} from '../../tutorialPathfinder';

interface City2DCanvasProps {
  grid: TileData[][];
  activeTool: ActiveTool;
  focusTile?: [number, number] | null;
  tutorialHighlight?: 'highway' | 'zoning' | 'utilities' | 'mission' | null;
  activeOverlay?: OverlayMode | 'NATURAL_RESOURCES';
  unlockedRegions?: string[];
  onTileClick: (x: number, y: number) => void;
  onTilePointerEnter: (x: number, y: number) => void;
  onTilePointerLeave?: () => void;
}

export function get2DTileClass(tile: TileData): string {
  if (tile.type === TileType.ROAD) {
    if (tile.roadStructure === 'BRIDGE' || tile.water) return 'bridge';
    if (tile.roadClass === 'HIGHWAY') return 'highway';
    if (tile.roadClass === 'ARTERIAL') return 'arterial';
    return 'road';
  }
  if (tile.water) return 'water';
  if (tile.type === TileType.RESIDENTIAL) return 'residential';
  if (tile.type === TileType.COMMERCIAL) return 'commercial';
  if (tile.type === TileType.OFFICE) return 'office';
  if (tile.type === TileType.INDUSTRIAL) return 'industrial';
  if (tile.type === TileType.POWER_PLANT) return 'power';
  if (tile.type === TileType.WATER_PUMP) return 'pump';
  if (tile.type === TileType.CLINIC || tile.type === TileType.FIRE_STATION || tile.type === TileType.POLICE_STATION || tile.type === TileType.SCHOOL) return 'emergency';
  if (tile.type === TileType.PARK) return 'park';
  if (tile.type === TileType.PARKING) return 'parking';
  if (tile.type === TileType.FLOOD_BARRIER) return 'barrier';
  if (tile.type === TileType.WATER_RESERVOIR) return 'reservoir';
  return tile.type === TileType.EMPTY ? 'empty' : 'service';
}

export function get2DOverlayStyle(tile: TileData, overlay: OverlayMode | 'NATURAL_RESOURCES' | undefined): string | null {
  if (!overlay || overlay === 'NONE') return null;
  if (overlay === 'TRAFFIC' && tile.type === TileType.ROAD) {
    const tr = tile.traffic ?? 0;
    return tr > 70 ? 'bg-red-500/60' : tr > 30 ? 'bg-amber-400/50' : 'bg-emerald-400/40';
  }
  if (overlay === 'ROAD_CONDITION' && tile.type === TileType.ROAD) {
    const condition = tile.roadCondition ?? 100;
    return condition < 40 ? 'bg-red-500/60' : condition < 70 ? 'bg-amber-400/50' : 'bg-emerald-400/35';
  }
  if (overlay === 'POWER' && tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD && !tile.water) {
    return tile.powered ? 'bg-emerald-400/35' : 'bg-rose-500/60';
  }
  if (overlay === 'WATER' && tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD && !tile.water) {
    return tile.watered ? 'bg-cyan-400/35' : 'bg-rose-500/60';
  }
  if (overlay === 'INCIDENTS' && (tile.incidentSeverity ?? 0) > 0) {
    return (tile.incidentSeverity ?? 0) >= 3 ? 'bg-red-500/70' : 'bg-orange-400/55';
  }
  if (overlay === 'DISASTERS' && (tile.disasterSeverity ?? 0) > 0) {
    return (tile.disasterSeverity ?? 0) >= 3 ? 'bg-fuchsia-600/70' : 'bg-violet-500/50';
  }
  if (overlay === 'POLLUTION') {
    const pol = tile.pollution ?? 0;
    return pol > 50 ? 'bg-purple-600/50' : pol > 20 ? 'bg-amber-600/40' : null;
  }
  if (overlay === 'LAND_VALUE') {
    const lv = tile.landValue ?? 0;
    return lv > 60 ? 'bg-emerald-500/50' : lv > 30 ? 'bg-cyan-500/40' : null;
  }
  if (overlay === 'POLICE') {
    const cr = tile.crime ?? 0;
    return cr > 40 ? 'bg-rose-600/50' : null;
  }
  if (overlay === 'NATURAL_RESOURCES' && !tile.water) {
    if (tile.resource === 'fertile') return 'bg-lime-500/40';
    if (tile.resource === 'forest') return 'bg-emerald-700/40';
    if (tile.resource === 'ore') return 'bg-amber-700/40';
    if (tile.resource === 'oil') return 'bg-indigo-900/50';
  }
  return null;
}

export function isValid2DRoadPlacement(grid: TileData[][], tile: TileData): boolean {
  return tile.type === TileType.EMPTY && !tile.water && [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => {
    const neighbor = grid[tile.y + dy]?.[tile.x + dx];
    return neighbor?.type === TileType.ROAD && neighbor.roadClass === 'HIGHWAY';
  });
}

export function isConnected2DRoadPlacement(grid: TileData[][], tile: TileData): boolean {
  return tile.type === TileType.EMPTY && !tile.water && [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => (
    grid[tile.y + dy]?.[tile.x + dx]?.type === TileType.ROAD
  ));
}

export function isRecommended2DZoningTile(grid: TileData[][], tile: TileData): boolean {
  return tile.type === TileType.EMPTY && !tile.water && [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => grid[tile.y + dy]?.[tile.x + dx]?.type === TileType.ROAD);
}

export function get2DTileColor(tile: TileData): string {
  if (tile.type === TileType.ROAD) {
    if (tile.roadStructure === 'BRIDGE' || tile.water) return '#0284c7';
    if (tile.roadClass === 'HIGHWAY') return '#b45309';
    if (tile.roadClass === 'ARTERIAL') return '#d97706';
    return '#475569';
  }
  if (tile.water) return '#0891b2';
  if (tile.type === TileType.RESIDENTIAL) return '#15803d';
  if (tile.type === TileType.COMMERCIAL) return '#1d4ed8';
  if (tile.type === TileType.OFFICE) return '#0369a1';
  if (tile.type === TileType.INDUSTRIAL) return '#a16207';
  if (tile.type === TileType.POWER_PLANT) return '#0284c7';
  if (tile.type === TileType.WATER_PUMP) return '#0891b2';
  if (tile.type === TileType.CLINIC || tile.type === TileType.FIRE_STATION || tile.type === TileType.POLICE_STATION || tile.type === TileType.SCHOOL) return '#b91c1c';
  if (tile.type === TileType.PARK) return '#047857';
  if (tile.type === TileType.PARKING) return '#334155';
  if (tile.type === TileType.FLOOD_BARRIER) return '#0369a1';
  if (tile.type === TileType.WATER_RESERVOIR) return '#075985';
  return tile.type === TileType.EMPTY ? '#4a6854' : '#be123c';
}

export function get2DOverlayColor(tile: TileData, overlay: OverlayMode | 'NATURAL_RESOURCES' | undefined): string | null {
  if (!overlay || overlay === 'NONE') return null;
  if (overlay === 'TRAFFIC' && tile.type === TileType.ROAD) {
    const tr = tile.traffic ?? 0;
    return tr > 70 ? 'rgba(239, 68, 68, 0.6)' : tr > 30 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(52, 211, 153, 0.4)';
  }
  if (overlay === 'ROAD_CONDITION' && tile.type === TileType.ROAD) {
    const condition = tile.roadCondition ?? 100;
    return condition < 40 ? 'rgba(239, 68, 68, 0.6)' : condition < 70 ? 'rgba(251, 191, 36, 0.5)' : 'rgba(52, 211, 153, 0.35)';
  }
  if (overlay === 'POWER' && tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD && !tile.water) {
    return tile.powered ? 'rgba(52, 211, 153, 0.35)' : 'rgba(244, 63, 94, 0.6)';
  }
  if (overlay === 'WATER' && tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD && !tile.water) {
    return tile.watered ? 'rgba(34, 211, 238, 0.35)' : 'rgba(244, 63, 94, 0.6)';
  }
  if (overlay === 'INCIDENTS' && (tile.incidentSeverity ?? 0) > 0) {
    return (tile.incidentSeverity ?? 0) >= 3 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(251, 146, 60, 0.55)';
  }
  if (overlay === 'DISASTERS' && (tile.disasterSeverity ?? 0) > 0) {
    return (tile.disasterSeverity ?? 0) >= 3 ? 'rgba(192, 38, 211, 0.7)' : 'rgba(139, 92, 246, 0.5)';
  }
  if (overlay === 'POLLUTION') {
    const pol = tile.pollution ?? 0;
    return pol > 50 ? 'rgba(147, 51, 234, 0.5)' : pol > 20 ? 'rgba(217, 119, 6, 0.4)' : null;
  }
  if (overlay === 'LAND_VALUE') {
    const lv = tile.landValue ?? 0;
    return lv > 60 ? 'rgba(16, 185, 129, 0.5)' : lv > 30 ? 'rgba(6, 182, 212, 0.4)' : null;
  }
  if (overlay === 'POLICE') {
    const cr = tile.crime ?? 0;
    return cr > 40 ? 'rgba(225, 29, 72, 0.5)' : null;
  }
  if (overlay === 'NATURAL_RESOURCES' && !tile.water) {
    if (tile.resource === 'fertile') return 'rgba(132, 204, 22, 0.4)';
    if (tile.resource === 'forest') return 'rgba(21, 128, 61, 0.4)';
    if (tile.resource === 'ore') return 'rgba(180, 83, 9, 0.4)';
    if (tile.resource === 'oil') return 'rgba(30, 27, 75, 0.5)';
  }
  return null;
}

/**
 * Enhanced 2D canvas with scalable HTML5 canvas rendering, full status indicators,
 * and a roving-tabindex accessibility cursor preserving screen reader & keyboard navigation.
 */
export function City2DCanvas({
  grid,
  activeTool,
  focusTile,
  tutorialHighlight,
  activeOverlay = 'NONE',
  unlockedRegions = ['1,1'],
  onTileClick,
  onTilePointerEnter,
  onTilePointerLeave,
}: City2DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const focusBtnRef = useRef<HTMLButtonElement | null>(null);
  const [inspectedTile, setInspectedTile] = useState<TileData | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [isRoadDragging, setIsRoadDragging] = useState(false);
  const [cursorPos, setCursorPos] = useState<[number, number]>(focusTile ?? [0, 0]);

  const height = grid.length;
  const width = grid[0]?.length ?? 1;
  const tileSize = 24;
  const isRoadTool = activeTool === TileType.ROAD || activeTool === 'TUNNEL_ROAD';

  const roadRec = useMemo(() => {
    if (tutorialHighlight !== 'highway') return null;
    return computeRoadRecommendations(grid, unlockedRegions);
  }, [grid, unlockedRegions, tutorialHighlight]);

  const utilityRec = useMemo(() => {
    if (tutorialHighlight !== 'utilities') return null;
    return computeUtilityRecommendations(grid, unlockedRegions);
  }, [grid, unlockedRegions, tutorialHighlight]);

  const zoningRec = useMemo(() => {
    if (tutorialHighlight !== 'zoning') return null;
    return computeZoningRecommendations(grid, unlockedRegions);
  }, [grid, unlockedRegions, tutorialHighlight]);

  const roadBestPathSet = useMemo(() => new Set((roadRec?.bestPath || []).map(([x, y]) => `${x},${y}`)), [roadRec]);
  const roadValidSet = useMemo(() => new Set((roadRec?.validTiles || []).map(([x, y]) => `${x},${y}`)), [roadRec]);
  const roadBlockedSet = useMemo(() => new Set((roadRec?.blockedTiles || []).map(([x, y]) => `${x},${y}`)), [roadRec]);
  const zoningRecSet = useMemo(() => new Set((zoningRec?.recommendedTiles || []).map(([x, y]) => `${x},${y}`)), [zoningRec]);
  const utilityTargetSet = useMemo(() => {
    const s = new Set<string>();
    if (utilityRec?.powerTile) s.add(`${utilityRec.powerTile[0]},${utilityRec.powerTile[1]}`);
    if (utilityRec?.pumpTile) s.add(`${utilityRec.pumpTile[0]},${utilityRec.pumpTile[1]}`);
    return s;
  }, [utilityRec]);

  useEffect(() => {
    if (focusTile) {
      setCursorPos(focusTile);
      focusBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }, [focusTile]);

  // Redraw canvas whenever grid, overlay, or highlights change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width * tileSize, height * tileSize);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const px = x * tileSize;
        const py = y * tileSize;

        // Base tile
        ctx.fillStyle = get2DTileColor(tile);
        ctx.fillRect(px, py, tileSize, tileSize);

        // Tile border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);

        // Overlay
        const overlayColor = get2DOverlayColor(tile, activeOverlay);
        if (overlayColor) {
          ctx.fillStyle = overlayColor;
          ctx.fillRect(px, py, tileSize, tileSize);
        }

        const coordKey = `${x},${y}`;
        const isBestRoadPath = roadBestPathSet.has(coordKey);
        const isValidRoadTile = roadValidSet.has(coordKey);
        const isBlockedRoadTile = roadBlockedSet.has(coordKey);
        const isRecZoning = zoningRecSet.has(coordKey);
        const isTargetUtil = utilityTargetSet.has(coordKey);

        const isHighwayHighlight = tutorialHighlight === 'highway' && (isBestRoadPath || isValidRoadTile || (tile.type === TileType.ROAD && tile.roadClass === 'HIGHWAY'));
        const isZoningHighlight = tutorialHighlight === 'zoning' && isRecZoning;
        const isUtilityHighlight = tutorialHighlight === 'utilities' && isTargetUtil;
        const isMissionHighlight = tutorialHighlight === 'mission' && tile.type !== TileType.EMPTY && !tile.water;

        if (isBestRoadPath) {
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        } else if (isHighwayHighlight) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        } else if (isZoningHighlight) {
          ctx.strokeStyle = '#6ee7b7';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        } else if (isUtilityHighlight) {
          ctx.strokeStyle = '#fcd34d';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        } else if (isMissionHighlight) {
          ctx.strokeStyle = '#e879f9';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        } else if (isBlockedRoadTile) {
          ctx.fillStyle = 'rgba(69, 10, 10, 0.7)';
          ctx.fillRect(px, py, tileSize, tileSize);
        }

        // Utility badges
        const needsUtilities = tile.type === TileType.RESIDENTIAL || tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL || tile.type === TileType.OFFICE;
        if (needsUtilities && !tile.powered) {
          ctx.font = 'bold 10px sans-serif';
          ctx.fillStyle = '#fde047';
          ctx.fillText('⚡', px + 6, py + 16);
        } else if (needsUtilities && !tile.watered) {
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = '#93c5fd';
          ctx.fillText('💧', px + 7, py + 16);
        }

        // Traffic indicator
        if (tile.type === TileType.ROAD && (tile.traffic ?? 0) > 40) {
          ctx.beginPath();
          ctx.arc(px + 12, py + 12, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#f43f5e';
          ctx.fill();
        }
      }
    }
  }, [grid, activeOverlay, tutorialHighlight, roadBestPathSet, roadValidSet, roadBlockedSet, zoningRecSet, utilityTargetSet, width, height]);

  const getTileFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.floor((e.clientX - rect.left) / tileSize);
    const y = Math.floor((e.clientY - rect.top) / tileSize);
    if (x >= 0 && x < width && y >= 0 && y < height) {
      return [x, y];
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getTileFromEvent(e);
    if (!coords) return;
    const [x, y] = coords;
    setCursorPos([x, y]);
    focusBtnRef.current?.focus();
    if (isRoadTool && e.button === 0) {
      setIsRoadDragging(true);
    }
    onTileClick(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getTileFromEvent(e);
    if (!coords) return;
    const [x, y] = coords;
    const tile = grid[y]?.[x];
    if (tile && (!inspectedTile || inspectedTile.x !== x || inspectedTile.y !== y)) {
      setInspectedTile(tile);
      onTilePointerEnter(x, y);
      if (isRoadDragging && isRoadTool) {
        onTileClick(x, y);
      }
    }
  };

  const handlePointerUp = () => {
    setIsRoadDragging(false);
  };

  const currentCursorTile = grid[cursorPos[1]]?.[cursorPos[0]] ?? grid[0]?.[0];

  return (
    <section className="city-2d-canvas relative flex flex-col h-full w-full overflow-hidden bg-slate-950 select-none" aria-label="Peta kota mode 2D" onPointerLeave={onTilePointerLeave}>
      {/* Top Bar: 2D Status & Legend Toggle */}
      <div className="absolute top-2 left-2 z-30 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/90 px-2.5 py-1 text-[10px] font-mono text-cyan-300 shadow-md backdrop-blur">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Mode 2D Taktis</span>
          <span className="text-slate-500">·</span>
          <span>Tool: {activeTool}</span>
          {activeOverlay !== 'NONE' && <><span className="text-slate-500">·</span><span>Overlay: {activeOverlay}</span></>}
        </div>
        <button
          type="button"
          onClick={() => setShowLegend((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10"
        >
          <Layers size={12} /> {showLegend ? 'Tutup Legenda' : 'Buka Legenda'}
        </button>
      </div>

      {/* Floating Color Legend */}
      {showLegend && (
        <div className="absolute top-10 left-2 z-30 flex flex-col gap-1 rounded-xl border border-white/10 bg-slate-950/92 p-2.5 text-[10px] text-slate-200 shadow-2xl backdrop-blur-md max-w-xs animate-fadeIn">
          <div className="font-semibold text-slate-100 flex items-center justify-between pb-1 border-b border-white/10">
            <span>Legenda Warna & Simbol</span>
            <span className="text-[9px] text-cyan-400">2D</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-[9px]">
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-600 inline-block border border-white/20" /> Hunian (Hijau)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-600 inline-block border border-white/20" /> Komersial (Biru)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-violet-600 inline-block border border-white/20" /> Kantor (Ungu)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-600 inline-block border border-white/20" /> Industri (Kuning)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-600 inline-block border border-white/20" /> Jalan Lokal (Abu)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-500 inline-block border border-white/20" /> Jalan Tol (Emas)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-sky-400 inline-block border border-white/20" /> Jembatan (Sky)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-cyan-700 inline-block border border-white/20" /> Badan Air (Cyan)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-600 inline-block border border-white/20" /> Darurat (Merah)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500 inline-block border border-white/20" /> Taman (Hijau Muda)</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-purple-700 inline-block border border-white/20" /> Utilitas Listrik</div>
            <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-cyan-500 inline-block border border-white/20" /> Utilitas Air</div>
            <div className="flex items-center gap-1.5"><span className="text-amber-400 font-bold">⚡</span> Listrik Mati</div>
            <div className="flex items-center gap-1.5"><span className="text-blue-400 font-bold">💧</span> Air Mati</div>
          </div>
        </div>
      )}

      {/* Grid Canvas Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <div
          className="city-2d-grid relative border border-white/10 rounded-lg bg-slate-900/50 shadow-inner"
          style={{ width: width * tileSize, height: height * tileSize }}
        >
          <canvas
            ref={canvasRef}
            width={width * tileSize}
            height={height * tileSize}
            className="block cursor-pointer"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
          {/* Accessible Roving Focus Tile element maintaining keyboard and screen reader parity */}
          {(() => {
            const tile = currentCursorTile;
            if (!tile) return null;
            return (
              <button
                ref={focusBtnRef}
                type="button"
                className="city-2d-tile roving-focus absolute w-6 h-6 ring-2 ring-cyan-400 ring-offset-1 pointer-events-none focus:outline-none"
                style={{
                  left: tile.x * tileSize,
                  top: tile.y * tileSize,
                }}
                aria-label={`Petak ${tile.x + 1}, ${tile.y + 1}; ${tile.type}`}
                title={`(${tile.x + 1}, ${tile.y + 1}) ${tile.type}`}
                data-coord={`${tile.x},${tile.y}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onTileClick(tile.x, tile.y);
                    return;
                  }
                  let targetX = tile.x;
                  let targetY = tile.y;
                  if (event.key === 'ArrowUp') targetY = Math.max(0, tile.y - 1);
                  else if (event.key === 'ArrowDown') targetY = Math.min(height - 1, tile.y + 1);
                  else if (event.key === 'ArrowLeft') targetX = Math.max(0, tile.x - 1);
                  else if (event.key === 'ArrowRight') targetX = Math.min(width - 1, tile.x + 1);
                  else return;

                  event.preventDefault();
                  setCursorPos([targetX, targetY]);
                  const nextTile = grid[targetY]?.[targetX];
                  if (nextTile) {
                    setInspectedTile(nextTile);
                    onTilePointerEnter(targetX, targetY);
                  }
                }}
              />
            );
          })()}
        </div>
      </div>

      {/* Bottom Inspector Bar */}
      <footer className="w-full border-t border-white/10 bg-slate-950/90 px-4 py-2 text-[11px] text-slate-300 flex items-center justify-between backdrop-blur">
        {inspectedTile ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono font-bold text-cyan-300">
              Petak ({inspectedTile.x + 1}, {inspectedTile.y + 1})
            </span>
            <span>Tipe: <b className="text-white">{inspectedTile.type}</b></span>
            {inspectedTile.roadClass && <span>Kelas: <b className="text-amber-300">{inspectedTile.roadClass}</b></span>}
            {inspectedTile.population !== undefined && inspectedTile.population > 0 && (
              <span>Populasi: <b className="text-emerald-300">{inspectedTile.population}</b></span>
            )}
            {inspectedTile.jobs !== undefined && inspectedTile.jobs > 0 && (
              <span>Pekerjaan: <b className="text-blue-300">{inspectedTile.jobs}</b></span>
            )}
            <span>Listrik: <b className={inspectedTile.powered ? 'text-emerald-400' : 'text-rose-400'}>{inspectedTile.powered ? 'Tersambung' : 'Mati'}</b></span>
            <span>Air: <b className={inspectedTile.watered ? 'text-emerald-400' : 'text-rose-400'}>{inspectedTile.watered ? 'Tersambung' : 'Mati'}</b></span>
            {inspectedTile.type === TileType.ROAD && (
              <span>Beban Lalu Lintas: <b className={(inspectedTile.traffic ?? 0) > 50 ? 'text-rose-400' : 'text-slate-200'}>{inspectedTile.traffic ?? 0}%</b></span>
            )}
            {inspectedTile.landValue !== undefined && (
              <span>Nilai Tanah: <b className="text-emerald-300">${inspectedTile.landValue}</b></span>
            )}
          </div>
        ) : (
          <div className="text-slate-500 italic flex items-center gap-1.5">
            <Info size={13} /> Arahkan kursor ke petak kota atau klik untuk membangun/memeriksa.
          </div>
        )}
        <div className="text-[10px] text-slate-400">
          Klik untuk {activeTool === 'POINTER' ? 'memilih' : activeTool === 'BULLDOZER' ? 'menghapus' : `membangun ${activeTool}`}
        </div>
      </footer>
    </section>
  );
}
