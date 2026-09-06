import React, { useState, useEffect } from 'react';
import { Camera, EyeOff, Sun, Sliders, Download, X } from 'lucide-react';
import { SupportedLanguage } from '../../localization';

interface PhotoModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeOfDay: number;
  onTimeOfDayChange: (tod: number) => void;
  language?: SupportedLanguage;
}

export function formatFovLabel(fov: number): string {
  if (fov <= 35) return 'Telephoto (Detail)';
  if (fov >= 65) return 'Ultra-Wide (Panorama)';
  return 'Standard';
}

export function calculateCameraDistanceForFov(fov: number, baseDistance = 22): number {
  const standardFov = 45;
  return baseDistance * (Math.tan((standardFov * Math.PI) / 360) / Math.tan((Math.max(20, Math.min(85, fov)) * Math.PI) / 360));
}

export function PhotoModeModal({
  isOpen,
  onClose,
  timeOfDay,
  onTimeOfDayChange,
  language = 'id',
}: PhotoModeModalProps) {
  const [hideUI, setHideUI] = useState(false);
  const [fov, setFov] = useState(45);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hideUI) {
          setHideUI(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hideUI, onClose]);

  if (!isOpen) return null;

  const takeScreenshot = () => {
    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `skyline-city-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setCaptured(true);
      setTimeout(() => setCaptured(false), 2000);
    } catch (err) {
      console.warn('Screenshot capture failed', err);
    }
  };

  if (hideUI) {
    return (
      <div 
        className="fixed inset-0 z-50 cursor-pointer bg-transparent"
        onClick={() => setHideUI(false)}
        title={language === 'en' ? 'Click anywhere or press ESC to reveal UI' : 'Klik di mana saja atau tekan ESC untuk membuka menu'}
      >
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/60 px-4 py-1.5 text-xs text-white backdrop-blur-md animate-pulse">
          {language === 'en' ? 'Photo Mode · Click to return' : 'Mode Foto · Klik untuk kembali'}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-80 rounded-2xl border border-cyan-400/30 bg-[#0d1420]/95 p-4 text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200 select-none">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2 text-cyan-300">
          <Camera size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">
            {language === 'en' ? 'Photo Mode' : 'Mode Foto Kota'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Tutup Mode Foto"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 space-y-3 text-xs">
        {/* Time of Day */}
        <div>
          <div className="flex items-center justify-between text-slate-300 mb-1">
            <span className="flex items-center gap-1.5">
              <Sun size={13} className="text-amber-300" />
              {language === 'en' ? 'Time of Day' : 'Waktu Kota'}
            </span>
            <span className="font-mono text-cyan-300">{Math.floor(timeOfDay)}:00</span>
          </div>
          <input
            type="range"
            min="0"
            max="23"
            step="1"
            value={Math.floor(timeOfDay)}
            onChange={(e) => onTimeOfDayChange(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>

        {/* FOV Slider */}
        <div>
          <div className="flex items-center justify-between text-slate-300 mb-1">
            <span className="flex items-center gap-1.5">
              <Sliders size={13} className="text-sky-300" />
              {language === 'en' ? 'Focal View' : 'Sudut Pandang (FOV)'}
            </span>
            <span className="font-mono text-cyan-300">{fov}°</span>
          </div>
          <input
            type="range"
            min="25"
            max="75"
            step="5"
            value={fov}
            onChange={(e) => setFov(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          <button
            type="button"
            onClick={() => setHideUI(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-slate-200 hover:bg-white/10 transition-colors"
          >
            <EyeOff size={14} />
            <span>{language === 'en' ? 'Hide UI' : 'Sembunyikan UI'}</span>
          </button>
          <button
            type="button"
            onClick={takeScreenshot}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-500/20 py-2 text-cyan-200 font-semibold hover:bg-cyan-500/30 transition-colors"
          >
            <Download size={14} />
            <span>{captured ? (language === 'en' ? 'Saved!' : 'Tersimpan!') : (language === 'en' ? 'Capture' : 'Ambil Foto')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
