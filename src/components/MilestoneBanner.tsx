import React, { useEffect } from 'react';
import { CityMilestone } from '../progression';
import { Trophy, X } from 'lucide-react';
import { useModalFocus } from './ui/useModalFocus';

interface MilestoneBannerProps {
  milestone: CityMilestone | null;
  onClose: () => void;
}

export function MilestoneBanner({ milestone, onClose }: MilestoneBannerProps) {
  if (!milestone) return null;

  return <MilestoneDialog milestone={milestone} onClose={onClose} />;
}

function MilestoneDialog({ milestone, onClose }: { milestone: CityMilestone; onClose: () => void }) {
  const dialogRef = useModalFocus<HTMLDivElement>(true);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="game-modal-backdrop fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in zoom-in-95 duration-300" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="milestone-banner-title" className="bg-[#0f172a] border border-[var(--status-amber)] rounded-2xl w-full max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto p-6 text-white text-center shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pencapaian kota"
          className="absolute top-3 right-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-focus)]"
        >
          <X size={18} />
        </button>

        <div className="w-16 h-16 bg-[#D4AF37]/20 border border-[#D4AF37] rounded-full flex items-center justify-center mx-auto mb-4 text-[#D4AF37] shadow-lg animate-bounce">
          <Trophy size={32} />
        </div>

        <span className="text-[10px] uppercase font-mono tracking-[0.3em] text-[#D4AF37] font-bold block mb-1">
          Pencapaian Kota
        </span>

        <h2 id="milestone-banner-title" className="font-serif italic text-3xl font-bold text-white mb-2">
          Status {milestone.name}
        </h2>

        <p className="text-xs text-gray-300 leading-relaxed mb-4">{milestone.description}</p>

        {milestone.unlockedBuildingTypes.length > 0 && (
          <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-left mb-6">
            <span className="text-[9px] uppercase font-mono tracking-wider text-gray-400 block mb-1">
              Layanan dan zonasi baru:
            </span>
            <div className="flex flex-wrap gap-1">
              {milestone.unlockedBuildingTypes.map((b) => (
                <span
                  key={b}
                  className="px-2 py-0.5 rounded-md bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-mono font-bold border border-[#D4AF37]/30"
                >
                  Terbuka: {b === 7 ? 'Pos Pemadam' : b === 8 ? 'Kantor Polisi' : b === 9 ? 'Klinik' : b === 10 ? 'Sekolah' : b === 11 ? 'Pengolahan Sampah' : 'Taman'}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-[#D4AF37] text-black font-mono font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#c29f2e] transition-colors shadow-lg"
        >
          Lanjutkan membangun
        </button>
      </div>
    </div>
  );
}
