import React from 'react';
import { User, Home, Briefcase, Clock, Heart, AlertCircle, Eye, X, Navigation } from 'lucide-react';
import { CitizenProfile } from '../../citizenIdentity';

interface CitizenProfileModalProps {
  profile: CitizenProfile | null;
  onClose: () => void;
  onFollowCitizen?: (coords: { x: number; y: number }) => void;
  isFollowing?: boolean;
}

export function CitizenProfileModal({
  profile,
  onClose,
  onFollowCitizen,
  isFollowing = false,
}: CitizenProfileModalProps) {
  if (!profile) return null;

  const incomeTier = profile.income > 180 ? 'Tinggi (High)' : profile.income > 100 ? 'Menengah (Middle)' : 'Dasar (Low)';
  const incomeTierColor = profile.income > 180 ? 'text-emerald-400' : profile.income > 100 ? 'text-cyan-400' : 'text-amber-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-white/15 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-md text-slate-100 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg">
              <User size={22} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-cyan-400">Profil Warga (Representative Citizen)</div>
              <h2 className="text-lg font-bold text-white tracking-tight">{profile.name}</h2>
              <div className="text-xs text-slate-400">{profile.householdName} · {profile.age} tahun ({profile.stageLabel})</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Tutup profil warga"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Briefcase size={13} className="text-cyan-400" />
              <span>Pekerjaan & Karir</span>
            </div>
            <div className="font-semibold text-slate-100">{profile.occupation}</div>
            <div className="text-[10px] text-slate-400">{profile.educationLabel}</div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Heart size={13} className="text-rose-400" />
              <span>Kepuasan & Kesehatan</span>
            </div>
            <div className="flex items-center gap-3 font-mono font-semibold">
              <span className={profile.happiness >= 60 ? 'text-emerald-400' : profile.happiness >= 40 ? 'text-amber-400' : 'text-rose-400'}>
                {profile.happiness}% Senang
              </span>
              <span className="text-cyan-400">{profile.health}% Sehat</span>
            </div>
            <div className={`text-[10px] font-mono ${incomeTierColor}`}>Tier: {incomeTier} (${profile.income}/hr)</div>
          </div>
        </div>

        {/* Transit & Commute Info */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Clock size={14} className="text-amber-400" />
              <span>Perjalanan & Komuter</span>
            </div>
            <span className="font-mono text-amber-300 font-semibold">{profile.commuteTimeMinutes} menit</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <Home size={12} className="text-slate-400" />
              <span>Rumah: ({profile.homeCoords.x}, {profile.homeCoords.y})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Navigation size={12} className="text-slate-400" />
              <span>Moda: <strong className="text-cyan-300">{profile.transportMode}</strong></span>
            </div>
          </div>
          {profile.workplaceCoords && (
            <div className="text-[11px] text-slate-400">
              Tempat kerja berada di petak ({profile.workplaceCoords.x}, {profile.workplaceCoords.y})
            </div>
          )}
        </div>

        {/* Complaints & Needs */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-amber-200">
            <AlertCircle size={15} className="shrink-0 text-amber-400" />
            <div>
              <span className="font-semibold text-amber-300">Keluhan utama: </span>
              {profile.majorComplaint}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 px-1">
            Kebutuhan prioritas saat ini: <span className="text-slate-200">{profile.majorNeed}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {onFollowCitizen && (
            <button
              onClick={() => onFollowCitizen(profile.homeCoords)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-md transition-all ${
                isFollowing
                  ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                  : 'bg-white/10 text-white hover:bg-white/15'
              }`}
            >
              <Eye size={15} />
              <span>{isFollowing ? 'Mengikuti Warga (Following)' : 'Ikuti Warga (Follow Citizen)'}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
