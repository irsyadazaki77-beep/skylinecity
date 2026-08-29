import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, 
  Zap, 
  Droplet, 
  Home, 
  Play, 
  ChevronRight, 
  CheckCircle2, 
  Sparkles,
  MapPin,
  X,
  AlertCircle
} from 'lucide-react';
import { ActiveTool, CityState, TileType } from '../../types';

interface StarterTutorialProps {
  gameState: CityState;
  speed: number;
  onSetSpeed: (speed: 0 | 1 | 2 | 3) => void;
  onSelectTool?: (tool: ActiveTool) => void;
}

interface TutorialStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  hint: string;
  isComplete: (state: CityState, speed: number) => boolean;
}

export function StarterTutorial({ gameState, speed, onSetSpeed, onSelectTool }: StarterTutorialProps) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('skyline_onboarding_v1') ?? 'null') as { dismissed?: boolean } | null;
      return stored?.dismissed !== true;
    } catch {
      return true;
    }
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('skyline_onboarding_v1') ?? 'null') as { currentStepIndex?: number } | null;
      return Math.max(0, Math.min(5, stored?.currentStepIndex ?? 0));
    } catch {
      return 0;
    }
  });
  const initialRoadCount = useRef<number | null>(null);
  if (initialRoadCount.current === null) {
    initialRoadCount.current = gameState.grid.flat().filter((tile) => tile.type === TileType.ROAD).length;
  }

  const steps: TutorialStep[] = [
    {
      id: 'step_road',
      title: '1. Jaringan Jalan Awal',
      subtitle: 'Hubungkan Kota ke Highway',
      description: 'Bangun jaringan jalan lokal dari jalan bebas hambatan regional (y=30). Semua bangunan dan utilitas mengalirkan energi melalui jalan.',
      icon: <Compass size={18} className="text-amber-400" />,
      hint: 'Pilih kategori "Roads" pada sidebar atau drag jalan di dekat jalan raya tengah.',
      isComplete: (state) => state.grid.flat().filter((t) => t.type === TileType.ROAD).length >= (initialRoadCount.current ?? 0) + 2,
    },
    {
      id: 'step_utilities',
      title: '2. Energi & Air Bersih',
      subtitle: 'Listrik & Pompa Air',
      description: 'Pastikan Power Plant dan Water Pump terpasang dan menyentuh jalan agar daya dan air mengalir ke seluruh distrik.',
      icon: <Zap size={18} className="text-cyan-400" />,
      hint: 'Power Plant dan Water Pump starter sudah tersedia. Tambahkan jika kapasitas kurang.',
      isComplete: (state) => state.powerCapacity > 0 && state.waterCapacity > 0,
    },
    {
      id: 'step_zoning',
      title: '3. Zonasi Pemukiman & Industri',
      subtitle: 'Tempat Tinggal & Lapangan Kerja',
      description: 'Zonasi area Residential (Hijau) untuk warga, dan Industrial (Kuning) / Commercial (Biru) untuk lapangan kerja.',
      icon: <Home size={18} className="text-emerald-400" />,
      hint: 'Gunakan brush size di toolbar bawah untuk zonasi petak 2x2 atau 3x3 dengan cepat.',
      isComplete: (state) => {
        const res = state.grid.flat().filter((t) => t.type === TileType.RESIDENTIAL).length;
        const comOrInd = state.grid.flat().filter((t) => t.type === TileType.COMMERCIAL || t.type === TileType.INDUSTRIAL).length;
        return res >= 4 && comOrInd >= 2;
      },
    },
    {
      id: 'step_unpause',
      title: '4. Jalankan Simulasi',
      subtitle: 'Buka Gerbang Kota',
      description: 'Game saat ini dalam keadaan PAUSE. Tekan Space atau tombol 1x Speed untuk memulai simulasi pertumbuhan kota.',
      icon: <Play size={18} className="text-purple-400" />,
      hint: 'Tekan tombol "1x" di bar bawah atau tekan tombol Space.',
      isComplete: (_, currentSpeed) => currentSpeed > 0,
    },
    {
      id: 'step_growth',
      title: '5. Warga Pertama Tiba',
      subtitle: 'Capai Populasi 25 Warga',
      description: 'Warga baru akan pindah ke zona residensial yang teraliri listrik dan air bersih. Perhatikan indeks kebahagiaan!',
      icon: <Sparkles size={18} className="text-yellow-400" />,
      hint: 'Jika bangunan tidak tumbuh, klik petak dengan Select tool untuk memeriksa diagnosa masalah.',
      isComplete: (state) => state.population >= 25,
    },
    {
      id: 'step_expansion',
      title: '6. Ekspansi Wilayah',
      subtitle: 'Buka Region Baru (3x3)',
      description: 'Buka petak region adjacent untuk memperluas batas kota metropolitanmu.',
      icon: <MapPin size={18} className="text-rose-400" />,
      hint: 'Buka mode Ekspansi Wilayah di toolbar bawah untuk membuka region dengan dana kota.',
      isComplete: (state) => (state.unlockedRegions?.length ?? 1) >= 2 || state.population >= 30,
    },
  ];

  useEffect(() => {
    try {
      localStorage.setItem('skyline_onboarding_v1', JSON.stringify({ dismissed: !isOpen, currentStepIndex }));
    } catch {
      // Tutorial state is a convenience; gameplay must continue if storage is unavailable.
    }
  }, [currentStepIndex, isOpen]);

  useEffect(() => {
    const resetTutorial = () => {
      setCurrentStepIndex(0);
      setIsOpen(true);
    };
    window.addEventListener('skyline:reset-onboarding', resetTutorial);
    return () => window.removeEventListener('skyline:reset-onboarding', resetTutorial);
  }, []);

  // Auto-advance step if completed
  useEffect(() => {
    const current = steps[currentStepIndex];
    if (current && current.isComplete(gameState, speed)) {
      if (currentStepIndex < steps.length - 1) {
        const timer = setTimeout(() => {
          setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [gameState, speed, currentStepIndex]);

  const activeStep = steps[currentStepIndex];
  const allCompleted = steps.every((s) => s.isComplete(gameState, speed));
  const closeTutorial = () => {
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="starter-tutorial fixed top-20 left-32 z-[45] flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-[#0f172a]/90 text-cyan-300 shadow-xl backdrop-blur-md hover:bg-cyan-950/50 transition-all text-xs font-semibold"
      >
        <Sparkles size={14} className="text-yellow-400 animate-pulse" />
        <span>Panduan Walikota ({currentStepIndex + 1}/{steps.length})</span>
      </button>
    );
  }

  return (
    <div className="starter-tutorial fixed top-20 left-32 z-[45] w-84 max-w-[calc(100vw-10rem)] rounded-2xl border border-white/15 bg-[#0f172a]/95 text-white shadow-2xl backdrop-blur-xl p-4 animate-in fade-in slide-in-from-left-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
            <Sparkles size={16} />
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
              Panduan Walikota Baru
            </h3>
            <span className="text-[10px] text-gray-400">
              Langkah {currentStepIndex + 1} dari {steps.length}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={closeTutorial}
          className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Tutup panduan"
          title="Tutup panduan"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/10 h-1.5 rounded-full my-3 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500 rounded-full"
          style={{ width: `${((currentStepIndex + (activeStep?.isComplete(gameState, speed) ? 1 : 0)) / steps.length) * 100}%` }}
        />
      </div>

      {/* Current Step Body */}
      {activeStep && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 mt-0.5">
              {activeStep.icon}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                {activeStep.title}
                {activeStep.isComplete(gameState, speed) && (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                )}
              </h4>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                {activeStep.description}
              </p>
            </div>
          </div>

          {/* Hint alert */}
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
            <AlertCircle size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <span>{activeStep.hint}</span>
          </div>

          {/* Quick Actions */}
          {activeStep.id === 'step_unpause' && speed === 0 && (
            <button
              onClick={() => onSetSpeed(1)}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Play size={14} />
              <span>Mulai Waktu Simulasi (1×)</span>
            </button>
          )}

          {activeStep.id === 'step_road' && onSelectTool && (
            <button type="button" onClick={() => onSelectTool(TileType.ROAD)} className="w-full py-2 rounded-xl border border-amber-400/30 bg-amber-500/10 text-xs font-bold text-amber-200 hover:bg-amber-500/20">
              Pilih Road Tool
            </button>
          )}
          {activeStep.id === 'step_zoning' && onSelectTool && (
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => onSelectTool(TileType.RESIDENTIAL)} className="rounded-lg bg-emerald-500/15 px-2 py-1.5 text-[10px] font-bold text-emerald-200 hover:bg-emerald-500/25">Residential</button>
              <button type="button" onClick={() => onSelectTool(TileType.COMMERCIAL)} className="rounded-lg bg-sky-500/15 px-2 py-1.5 text-[10px] font-bold text-sky-200 hover:bg-sky-500/25">Commercial</button>
              <button type="button" onClick={() => onSelectTool(TileType.INDUSTRIAL)} className="rounded-lg bg-amber-500/15 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/25">Industrial</button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-gray-400">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
              className="px-2 py-1 rounded hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              Sebelumnya
            </button>
            <button
              type="button"
              disabled={currentStepIndex === steps.length - 1}
              onClick={() => setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
              className="flex items-center gap-1 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-30"
            >
              <span>Selanjutnya</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {allCompleted && (
        <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs text-center font-semibold">
          🎉 Selamat! Fondasi kota dasar telah siap. Bangun kotamu menuju Megacity!
        </div>
      )}
    </div>
  );
}
