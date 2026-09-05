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

/**
 * Enhanced 2D canvas with full building, zoning, utility status indicators,
 * traffic load indicators, color legend, and detailed tile inspection HUD.
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
  const focusRef = useRef<HTMLButtonElement | null>(null);
  const [inspectedTile, setInspectedTile] = useState<TileData | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [isRoadDragging, setIsRoadDragging] = useState(false);
  const cells = useMemo(() => grid.flat(), [grid]);
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

  useEffect(() => {
    focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [focusTile]);

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

      {/* Grid Container */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
        <div
          className="city-2d-grid border border-white/10 rounded-lg bg-slate-900/50 shadow-inner"
          style={{ gridTemplateColumns: `repeat(${grid[0]?.length ?? 1}, 24px)` }}
        >
          {cells.map((tile) => {
            const isFocus = focusTile?.[0] === tile.x && focusTile?.[1] === tile.y;
            const overlayBg = get2DOverlayStyle(tile, activeOverlay);

            // Pathfinding tutorial highlights
            const isBestRoadPath = Boolean(roadRec?.bestPath.some(([px, py]) => px === tile.x && py === tile.y));
            const isValidRoadTile = Boolean(roadRec?.validTiles.some(([px, py]) => px === tile.x && py === tile.y));
            const isBlockedRoadTile = Boolean(roadRec?.blockedTiles.some(([px, py]) => px === tile.x && py === tile.y));

            const isRecZoning = Boolean(zoningRec?.recommendedTiles.some(([px, py]) => px === tile.x && py === tile.y));
            const isTargetUtil = Boolean((utilityRec?.powerTile?.[0] === tile.x && utilityRec?.powerTile?.[1] === tile.y) || (utilityRec?.pumpTile?.[0] === tile.x && utilityRec?.pumpTile?.[1] === tile.y));

            const isHighwayHighlight = tutorialHighlight === 'highway' && (isBestRoadPath || isValidRoadTile || (tile.type === TileType.ROAD && tile.roadClass === 'HIGHWAY'));
            const isZoningHighlight = tutorialHighlight === 'zoning' && isRecZoning;
            const isUtilityHighlight = tutorialHighlight === 'utilities' && isTargetUtil;
            const isMissionHighlight = tutorialHighlight === 'mission' && tile.type !== TileType.EMPTY && !tile.water;

            const needsUtilities = tile.type === TileType.RESIDENTIAL || tile.type === TileType.COMMERCIAL || tile.type === TileType.INDUSTRIAL || tile.type === TileType.OFFICE;
            const isUnpowered = needsUtilities && !tile.powered;
            const isUnwatered = needsUtilities && !tile.watered;
            const hasHeavyTraffic = tile.type === TileType.ROAD && (tile.traffic ?? 0) > 40;

            const isRoadCandidate = isRoadTool && isConnected2DRoadPlacement(grid, tile);

            return (
              <button
                key={`${tile.x}-${tile.y}`}
                ref={isFocus ? focusRef : undefined}
                type="button"
                className={`city-2d-tile relative flex items-center justify-center ${get2DTileClass(tile)} ${overlayBg ?? ''} ${isFocus ? 'ring-2 ring-cyan-400 ring-offset-1 z-20' : ''} ${isBestRoadPath ? 'ring-2 ring-cyan-300 z-10' : isHighwayHighlight ? 'tutorial-highlight' : ''} ${isZoningHighlight ? 'tutorial-zoning ring-2 ring-emerald-300' : ''} ${isUtilityHighlight ? 'tutorial-utility ring-2 ring-amber-300' : ''} ${isMissionHighlight ? 'tutorial-mission' : ''} ${isRoadCandidate ? 'ring-1 ring-emerald-300/80' : ''} ${isBlockedRoadTile ? 'opacity-40 bg-red-950/80' : ''}`}
                aria-label={`Petak ${tile.x + 1}, ${tile.y + 1}; ${tile.type}`}
                title={`(${tile.x + 1}, ${tile.y + 1}) ${tile.type}${tile.population ? ` · Pop: ${tile.population}` : ''}`}
                onPointerEnter={() => {
                  setInspectedTile(tile);
                  onTilePointerEnter(tile.x, tile.y);
                }}
                onPointerDown={(event) => {
                  if (!isRoadTool || event.button !== 0) return;
                  setIsRoadDragging(true);
                  onTileClick(tile.x, tile.y);
                }}
                onPointerUp={(event) => {
                  if (!isRoadTool || event.button !== 0 || !isRoadDragging) return;
                  onTileClick(tile.x, tile.y);
                  setIsRoadDragging(false);
                }}
                onPointerCancel={() => setIsRoadDragging(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onTileClick(tile.x, tile.y);
                    return;
                  }
                  let targetX = tile.x;
                  let targetY = tile.y;
                  if (event.key === 'ArrowUp') targetY = Math.max(0, tile.y - 1);
                  else if (event.key === 'ArrowDown') targetY = Math.min(grid.length - 1, tile.y + 1);
                  else if (event.key === 'ArrowLeft') targetX = Math.max(0, tile.x - 1);
                  else if (event.key === 'ArrowRight') targetX = Math.min((grid[0]?.length ?? 1) - 1, tile.x + 1);
                  else return;

                  event.preventDefault();
                  const targetBtn = document.querySelector<HTMLButtonElement>(`button[data-coord="${targetX},${targetY}"]`);
                  targetBtn?.focus();
                  onTilePointerEnter(targetX, targetY);
                }}
                data-coord={`${tile.x},${tile.y}`}
                onClick={() => {
                  if (!isRoadTool) onTileClick(tile.x, tile.y);
                }}
              >
                {/* Traffic Heat Dot */}
                {hasHeavyTraffic && (
                  <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-rose-500 animate-ping opacity-75" />
                )}

                {/* Utility disconnection badges */}
                {isUnpowered && (
                  <span className="text-[9px] text-amber-300 font-extrabold leading-none drop-shadow">⚡</span>
                )}
                {!isUnpowered && isUnwatered && (
                  <span className="text-[8px] text-blue-300 leading-none drop-shadow">💧</span>
                )}
              </button>
            );
          })}
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
