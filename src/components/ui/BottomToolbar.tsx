import React from 'react';
import { 
  Pause, 
  Map, 
  Sun, 
  Undo2, 
  Redo2,
  SlidersHorizontal,
} from 'lucide-react';
import { CityEventData } from '../../types';

interface BottomToolbarProps {
  speed: 0 | 1 | 2 | 3;
  setSpeed: (speed: 0 | 1 | 2 | 3) => void;
  day: number;
  income: number;
  expenses: number;
  unlockedRegionsCount: number;
  mapExpansionMode: boolean;
  onToggleExpansionMode: () => void;
  brushSize: number;
  onSetBrushSize: (size: number) => void;
  activeEvents?: CityEventData[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function BottomToolbar({
  speed,
  setSpeed,
  unlockedRegionsCount,
  mapExpansionMode,
  onToggleExpansionMode,
  brushSize,
  onSetBrushSize,
  activeEvents = [],
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: BottomToolbarProps) {
  const [showToolsContext, setShowToolsContext] = React.useState(false);

  return (
    <div className="simulation-toolbar select-none">
      {/* Active Events Notification Pill */}
      {activeEvents.length > 0 && (
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-[#1e1505]/90 text-amber-200 text-xs shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2"
          role="status"
          aria-live="polite"
        >
          <Sun size={14} className="text-amber-400 animate-spin" style={{ animationDuration: '8s' }} aria-hidden="true" />
          <span className="font-semibold">{activeEvents[0].name}:</span>
          <span className="text-amber-100/90">{activeEvents[0].description} ({activeEvents[0].remainingDays} hari tersisa)</span>
        </div>
      )}

      {/* Contextual Accessory (Brush size & Region Expansion) */}
      {(showToolsContext || mapExpansionMode) && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-[#0d1420]/95 shadow-xl backdrop-blur-md text-xs text-white animate-in fade-in slide-in-from-bottom-1">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px] font-medium mr-1">Kuas:</span>
            {[1, 2, 3].map((size) => (
              <button
                key={size}
                type="button"
                aria-label={`Ukuran kuas ${size} petak`}
                aria-pressed={brushSize === size}
                onClick={() => onSetBrushSize(size)}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-mono font-semibold transition-all ${
                  brushSize === size
                    ? 'bg-[var(--accent-cyan)] text-slate-950 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {size}x{size}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <button
            type="button"
            onClick={onToggleExpansionMode}
            aria-pressed={mapExpansionMode}
            aria-label="Mode perluasan wilayah"
            className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all border ${
              mapExpansionMode
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-sm'
                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Map size={14} aria-hidden="true" />
            <span>Wilayah ({unlockedRegionsCount}/9)</span>
          </button>
        </div>
      )}

      {/* Main Simulation Control Bar */}
      <div 
        className="simulation-toolbar-main flex items-center gap-1 sm:gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[#0d1420]/95 p-1.5 shadow-2xl backdrop-blur-xl text-white"
        role="toolbar"
        aria-label="Kontrol simulasi waktu dan riwayat"
      >
        {/* Speed Controls Segmented Group */}
        <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-xl border border-white/5">
          <button
            type="button"
            aria-label="Jeda simulasi"
            aria-pressed={speed === 0}
            onClick={() => setSpeed(0)}
            title="Jeda (Spasi / 1)"
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
              speed === 0 
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Pause size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Kecepatan normal 1x"
            aria-pressed={speed === 1}
            onClick={() => setSpeed(1)}
            title="Kecepatan normal (2)"
            className={`min-w-[44px] min-h-[44px] px-2 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-all ${
              speed === 1 
                ? 'bg-[var(--accent-teal)] text-slate-950 shadow-md font-bold' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            1×
          </button>
          <button
            type="button"
            aria-label="Kecepatan cepat 2x"
            aria-pressed={speed === 2}
            onClick={() => setSpeed(2)}
            title="Kecepatan cepat (3)"
            className={`min-w-[44px] min-h-[44px] px-2 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-all ${
              speed === 2 
                ? 'bg-[var(--accent-cyan)] text-slate-950 shadow-md font-bold' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            2×
          </button>
          <button
            type="button"
            aria-label="Kecepatan sangat cepat 3x"
            aria-pressed={speed === 3}
            onClick={() => setSpeed(3)}
            title="Kecepatan ultra (4)"
            className={`min-w-[44px] min-h-[44px] px-2 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-all ${
              speed === 3 
                ? 'bg-[var(--accent-teal)] text-slate-950 shadow-md font-bold' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            3×
          </button>
        </div>

        <div className="w-px h-6 bg-white/10 mx-0.5" aria-hidden="true" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-black/40 p-0.5 rounded-xl border border-white/5">
          <button 
            type="button" 
            aria-label="Batalkan aksi (Undo)" 
            title="Batalkan (Ctrl/Cmd+Z)" 
            disabled={!canUndo} 
            onClick={onUndo} 
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Undo2 size={16} aria-hidden="true" />
          </button>
          <button 
            type="button" 
            aria-label="Ulangi aksi (Redo)" 
            title="Ulangi (Ctrl/Cmd+Y)" 
            disabled={!canRedo} 
            onClick={onRedo} 
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Redo2 size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="w-px h-6 bg-white/10 mx-0.5" aria-hidden="true" />

        {/* Context Accessories Toggle (Brush & Region) */}
        <button
          type="button"
          aria-label="Pengaturan kuas dan wilayah"
          aria-pressed={showToolsContext}
          title="Pengaturan kuas & wilayah"
          onClick={() => setShowToolsContext((prev) => !prev)}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all border ${
            showToolsContext || mapExpansionMode
              ? 'bg-[var(--accent-cyan)]/20 border-[var(--accent-cyan)]/40 text-[var(--accent-cyan)]'
              : 'bg-black/40 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
