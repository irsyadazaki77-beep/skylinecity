import React from 'react';
import { 
  Pause, 
  Play, 
  FastForward, 
  Zap, 
  Map, 
  Layers, 
  Sun, 
  AlertCircle,
  TrendingUp,
  TrendingDown
  ,Undo2, Redo2
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
  day,
  income,
  expenses,
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
  const netIncome = income - expenses;

  return (
    <div className="simulation-toolbar fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-auto select-none">
      {/* Active Events Banner (if any) */}
      {activeEvents.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-950/80 text-amber-200 text-xs shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <Sun size={14} className="text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span className="font-bold">{activeEvents[0].name}:</span>
          <span>{activeEvents[0].description} ({activeEvents[0].remainingDays} hari tersisa)</span>
        </div>
      )}

      {/* Main Bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-[#0f172a]/95 p-1.5 shadow-2xl backdrop-blur-xl text-white">
        
        {/* Speed Controls */}
        <div className="flex items-center gap-0.5 bg-black/40 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            aria-label="Pause simulasi"
            onClick={() => setSpeed(0)}
            title="Pause (Space / 1)"
            className={`p-2 rounded-lg transition-all ${
              speed === 0 ? 'bg-amber-500 text-black font-bold shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Pause size={15} />
          </button>
          <button
            type="button"
            aria-label="Kecepatan normal"
            onClick={() => setSpeed(1)}
            title="Normal Speed (Space / 2)"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              speed === 1 ? 'bg-emerald-500 text-black font-bold shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            1×
          </button>
          <button
            type="button"
            aria-label="Kecepatan cepat"
            onClick={() => setSpeed(2)}
            title="Fast Speed (3)"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              speed === 2 ? 'bg-cyan-500 text-black font-bold shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            2×
          </button>
          <button
            type="button"
            aria-label="Kecepatan ultra"
            onClick={() => setSpeed(3)}
            title="Ultra Fast (4)"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              speed === 3 ? 'bg-purple-500 text-white font-bold shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            3×
          </button>
        </div>

        <div className="w-px h-6 bg-white/10" />

        <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-black/40 p-1">
          <button type="button" aria-label="Undo perubahan" title="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={onUndo} className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"><Undo2 size={14} /></button>
          <button type="button" aria-label="Redo perubahan" title="Redo (Ctrl/Cmd+Y)" disabled={!canRedo} onClick={onRedo} className="rounded-lg p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"><Redo2 size={14} /></button>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Day & Net Cashflow Indicator */}
        <div className="flex items-center gap-3 px-2">
          <div className="text-left font-mono">
            <div className="text-[9px] uppercase tracking-wider text-gray-400">Waktu Kota</div>
            <div className="text-xs font-bold text-white">Hari {day}</div>
          </div>
          <div className="text-left font-mono">
            <div className="text-[9px] uppercase tracking-wider text-gray-400">Arus Kas / Hari</div>
            <div className={`text-xs font-bold flex items-center gap-0.5 ${netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netIncome >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {netIncome >= 0 ? '+' : ''}${netIncome}
            </div>
          </div>
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Brush Size Selector */}
        <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-xl border border-white/5">
          <span className="text-[9px] uppercase tracking-wider text-gray-400 font-mono mr-1">Brush:</span>
          {[1, 2, 3].map((size) => (
            <button
              key={size}
              type="button"
              aria-label={`Ukuran brush ${size}`}
              aria-pressed={brushSize === size}
              onClick={() => onSetBrushSize(size)}
              className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all ${
                brushSize === size
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {size}×
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-white/10" />

        {/* Region Expansion Mode Button */}
        <button
          onClick={onToggleExpansionMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
            mapExpansionMode
              ? 'bg-amber-500 border-amber-400 text-black font-bold shadow-lg shadow-amber-500/20 animate-pulse'
              : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Map size={15} />
          <span>Wilayah ({unlockedRegionsCount}/9)</span>
        </button>

      </div>
    </div>
  );
}
