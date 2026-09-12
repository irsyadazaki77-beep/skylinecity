import React from 'react';
import { Camera, Focus, RotateCcw, RotateCw, ZoomIn, ZoomOut, ArrowLeft, EyeOff, Eye, MoreHorizontal, X } from 'lucide-react';

interface CameraToolbarProps {
  viewMode: '2D' | '3D';
  zoom: number;
  rotation: number;
  hasFocus: boolean;
  hasCameraFocus?: boolean;
  onViewModeChange: (mode: '2D' | '3D') => void;
  onZoomChange: (zoom: number) => void;
  onRotationChange: (rotation: number) => void;
  onFocusSelected: () => void;
  onCancelFocus?: () => void;
  onReset: () => void;
  cleanCityView?: boolean;
  onToggleCleanCityView?: () => void;
}

function clampZoom(value: number): number {
  return Math.max(0.75, Math.min(1.8, Number(value.toFixed(2))));
}

function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function CameraToolbar({
  viewMode,
  zoom,
  rotation,
  hasFocus,
  hasCameraFocus = false,
  onViewModeChange,
  onZoomChange,
  onRotationChange,
  onFocusSelected,
  onCancelFocus,
  onReset,
  cleanCityView = false,
  onToggleCleanCityView,
}: CameraToolbarProps) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div 
      className="camera-toolbar absolute right-3 top-[4.5rem] z-20 flex items-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[#0d1420]/95 p-1 text-white shadow-2xl backdrop-blur-xl" 
      role="toolbar" 
      aria-label="Kontrol kamera"
    >
      {/* Return to permukiman when camera is focused */}
      {hasCameraFocus && (
        <button
          type="button"
          aria-label="Kembali ke permukiman (Esc)"
          onClick={onCancelFocus ?? onReset}
          className="min-h-[44px] px-3 flex items-center gap-1.5 rounded-xl bg-[var(--accent-cyan)]/20 border border-[var(--accent-cyan)]/40 text-xs font-bold text-[var(--accent-cyan)] transition-colors hover:bg-[var(--accent-cyan)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
          title="Batalkan fokus kamera dan kembali ke permukiman (Esc)"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          <span>Kembali</span>
        </button>
      )}

      {/* Segmented Control 2D / 3D */}
      <div 
        className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/5" 
        role="group" 
        aria-label="Mode tampilan dimensi"
      >
        <button 
          type="button" 
          aria-label="Tampilan 2D" 
          aria-pressed={viewMode === '2D'} 
          onClick={() => onViewModeChange('2D')} 
          className={`min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
            viewMode === '2D' 
              ? 'bg-[var(--accent-cyan)] text-slate-950 shadow-md font-bold' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          2D
        </button>
        <button 
          type="button" 
          aria-label="Tampilan 3D" 
          aria-pressed={viewMode === '3D'} 
          onClick={() => onViewModeChange('3D')} 
          className={`min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
            viewMode === '3D' 
              ? 'bg-[var(--accent-cyan)] text-slate-950 shadow-md font-bold' 
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          3D
        </button>
      </div>

      <div className="h-6 w-px bg-white/10 mx-0.5" aria-hidden="true" />

      {/* Zoom Group */}
      <div 
        className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/5" 
        role="group" 
        aria-label="Kontrol zoom kamera"
      >
        <button 
          type="button" 
          aria-label="Perkecil kamera (Zoom Out)" 
          title="Perkecil zoom (-)" 
          onClick={() => onZoomChange(clampZoom(zoom - 0.15))} 
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ZoomOut size={16} aria-hidden="true" />
        </button>
        <span 
          className="min-w-[40px] text-center text-xs font-mono font-semibold tabular-nums text-slate-300 px-1 select-none" 
          aria-label={`Zoom saat ini ${Math.round(zoom * 100)} persen`}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button 
          type="button" 
          aria-label="Perbesar kamera (Zoom In)" 
          title="Perbesar zoom (+)" 
          onClick={() => onZoomChange(clampZoom(zoom + 0.15))} 
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <ZoomIn size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Secondary controls live behind a single disclosure. */}
      {expanded && <div className="camera-toolbar-secondary" role="group" aria-label="Kontrol kamera lanjutan">
      <div 
        className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/5" 
        role="group" 
        aria-label="Rotasi kamera"
      >
        <button 
          type="button" 
          aria-label="Putar kamera ke kiri" 
          title="Putar kiri (Q)" 
          onClick={() => onRotationChange(normalizeRotation(rotation - 15))} 
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        <button 
          type="button" 
          aria-label="Putar kamera ke kanan" 
          title="Putar kanan (E)" 
          onClick={() => onRotationChange(normalizeRotation(rotation + 15))} 
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <RotateCw size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Secondary Actions: Focus Selected & Reset (Subtle styling) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Preset kamera seluruh distrik"
          onClick={() => { onZoomChange(0.8); onRotationChange(45); }}
          className="camera-preset min-h-[44px] rounded-xl border border-white/5 bg-white/5 px-2.5 text-[10px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
          title="Lihat seluruh distrik"
        >
          Distrik
        </button>
        <button
          type="button"
          aria-label="Preset kamera skyline"
          onClick={() => { onZoomChange(1.15); onRotationChange(315); }}
          className="camera-preset min-h-[44px] rounded-xl border border-white/5 bg-white/5 px-2.5 text-[10px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
          title="Panorama kota"
        >
          Panorama
        </button>
        {onToggleCleanCityView && (
          <button
            type="button"
            aria-label={cleanCityView ? 'Tampilkan antarmuka kota' : 'Sembunyikan antarmuka kota'}
            aria-pressed={cleanCityView}
            onClick={onToggleCleanCityView}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border text-slate-300 transition-colors ${cleanCityView ? 'border-amber-300/60 bg-amber-300/15 text-amber-200' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:text-white'}`}
            title={cleanCityView ? 'Tampilkan antarmuka kota' : 'Sembunyikan antarmuka kota'}
          >
            {cleanCityView ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        )}
        <button 
          type="button" 
          aria-label="Fokus ke petak terpilih" 
          title="Fokus ke petak terpilih (F)" 
          disabled={!hasFocus} 
          onClick={onFocusSelected} 
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 transition-colors"
        >
          <Focus size={16} aria-hidden="true" />
        </button>
        <button 
          type="button" 
          aria-label="Reset sudut dan posisi kamera" 
          onClick={onReset} 
          title="Reset posisi kamera default" 
          className="min-h-[44px] px-2.5 flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/5 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Camera size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>
      </div>}
      <button
        type="button"
        aria-label={expanded ? 'Tutup kontrol kamera lanjutan' : 'Buka kontrol kamera lanjutan'}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="camera-overflow min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white"
        title="Kontrol kamera lanjutan"
      >
        {expanded ? <X size={17} /> : <MoreHorizontal size={18} />}
      </button>
    </div>
  );
}
