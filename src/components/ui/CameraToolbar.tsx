import React from 'react';
import { Camera, Focus, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

interface CameraToolbarProps {
  viewMode: '2D' | '3D';
  zoom: number;
  rotation: number;
  hasFocus: boolean;
  onViewModeChange: (mode: '2D' | '3D') => void;
  onZoomChange: (zoom: number) => void;
  onRotationChange: (rotation: number) => void;
  onFocusSelected: () => void;
  onReset: () => void;
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
  onViewModeChange,
  onZoomChange,
  onRotationChange,
  onFocusSelected,
  onReset,
}: CameraToolbarProps) {
  return (
    <div className="camera-toolbar absolute right-3 top-[5.5rem] z-50 flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1.5 text-white shadow-xl backdrop-blur-md" role="toolbar" aria-label="Kontrol kamera">
      <button type="button" aria-label="Tampilan 2D" aria-pressed={viewMode === '2D'} onClick={() => onViewModeChange('2D')} className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${viewMode === '2D' ? 'bg-cyan-400/20 text-cyan-200' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>2D</button>
      <button type="button" aria-label="Tampilan 3D" aria-pressed={viewMode === '3D'} onClick={() => onViewModeChange('3D')} className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${viewMode === '3D' ? 'bg-cyan-400/20 text-cyan-200' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>3D</button>
      <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden="true" />
      <button type="button" aria-label="Perkecil kamera" onClick={() => onZoomChange(clampZoom(zoom - 0.15))} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"><ZoomOut size={14} /></button>
      <span className="min-w-[2.5rem] text-center text-[10px] tabular-nums text-slate-300" aria-label={`Zoom ${Math.round(zoom * 100)} persen`}>{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="Perbesar kamera" onClick={() => onZoomChange(clampZoom(zoom + 0.15))} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"><ZoomIn size={14} /></button>
      <span className="mx-0.5 h-5 w-px bg-white/10" aria-hidden="true" />
      <button type="button" aria-label="Putar kamera ke kiri" onClick={() => onRotationChange(normalizeRotation(rotation - 15))} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"><RotateCcw size={14} /></button>
      <button type="button" aria-label="Putar kamera ke kanan" onClick={() => onRotationChange(normalizeRotation(rotation + 15))} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"><RotateCw size={14} /></button>
      <button type="button" aria-label="Fokus ke tile terpilih" disabled={!hasFocus} onClick={onFocusSelected} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"><Focus size={14} /></button>
      <button type="button" aria-label="Reset kamera" onClick={onReset} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"><Camera size={14} /><RotateCcw size={9} className="-ml-2 -mt-2" /></button>
    </div>
  );
}
