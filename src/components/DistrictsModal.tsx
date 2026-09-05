import React, { useEffect, useState } from 'react';
import { X, MapPinned, Trash2, Plus } from 'lucide-react';
import { CityDistrict, DISTRICT_POLICIES, DistrictPolicy } from '../districts';
import type { NeighborhoodIdentity } from '../neighborhoodIdentity';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../localization';
import { useModalFocus } from './ui/useModalFocus';

interface DistrictsModalProps {
  isOpen: boolean;
  onClose: () => void;
  districts: CityDistrict[];
  onStartPlacement: (config: { name: string; policy: DistrictPolicy; radius: number }) => void;
  onRemoveDistrict: (districtId: string) => void;
  identities?: NeighborhoodIdentity[];
  language?: SupportedLanguage;
}

export function DistrictsModal({ isOpen, onClose, districts, onStartPlacement, onRemoveDistrict, identities = [], language = 'id' }: DistrictsModalProps) {
  const [name, setName] = useState('');
  const [policy, setPolicy] = useState<DistrictPolicy>('GREEN');
  const [radius, setRadius] = useState(4);
  const catalog = createLocalizationCatalog(language);
  const dialogRef = useModalFocus<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedPolicy = DISTRICT_POLICIES.find((item) => item.id === policy) ?? DISTRICT_POLICIES[0];

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="districts-modal-title"
        className="bg-[#0d1420] border border-[var(--border-subtle)] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[88vh]"
      >
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--accent-cyan)]/15 border border-[var(--accent-cyan)]/30 rounded-xl text-[var(--accent-cyan)]">
              <MapPinned size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="districts-modal-title" className="text-lg font-bold text-white tracking-tight">
                {translate(catalog, 'districts.title')}
              </h2>
              <p className="text-xs text-slate-400">
                {translate(catalog, 'districts.subtitle')}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            aria-label="Tutup jendela distrik" 
            onClick={onClose} 
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          <div className="rounded-2xl border border-[var(--accent-cyan)]/20 bg-[var(--accent-cyan)]/5 p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-bold text-[var(--accent-cyan)] uppercase tracking-wider">
              {translate(catalog, 'districts.create')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px] gap-3">
              <label className="space-y-1 block">
                <span className="text-xs font-medium text-slate-300">{translate(catalog, 'districts.name')}</span>
                <input 
                  value={name} 
                  onChange={(event) => setName(event.target.value)} 
                  placeholder="cth. Kawasan Tepi Sungai" 
                  className="w-full h-11 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[var(--accent-cyan)] focus:ring-1 focus:ring-[var(--accent-cyan)]" 
                />
              </label>
              <label className="space-y-1 block">
                <span className="text-xs font-medium text-slate-300">{translate(catalog, 'districts.localPolicy')}</span>
                <select 
                  value={policy} 
                  onChange={(event) => setPolicy(event.target.value as DistrictPolicy)} 
                  className="w-full h-11 rounded-xl border border-white/10 bg-[#101826] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent-cyan)]"
                >
                  {DISTRICT_POLICIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 block">
                <span className="text-xs font-medium text-slate-300">{translate(catalog, 'districts.radius')}</span>
                <select 
                  value={radius} 
                  onChange={(event) => setRadius(Number(event.target.value))} 
                  className="w-full h-11 rounded-xl border border-white/10 bg-[#101826] px-3 py-2 text-sm text-white outline-none focus:border-[var(--accent-cyan)]"
                >
                  {[3, 4, 5, 6, 8].map((value) => <option key={value} value={value}>{value} petak</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-400 max-w-lg leading-relaxed">
                {selectedPolicy.description} Klik peta setelah menekan tombol untuk memilih pusat distrik.
              </p>
              <button 
                type="button" 
                onClick={() => onStartPlacement({ name, policy, radius })} 
                className="shrink-0 min-h-[44px] px-4 rounded-xl bg-[var(--accent-cyan)] text-slate-950 font-bold text-xs hover:opacity-90 transition-opacity shadow-md flex items-center gap-1.5"
              >
                <Plus size={15} aria-hidden="true" />
                <span>{translate(catalog, 'districts.place')}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                {translate(catalog, 'districts.existing')}
              </h3>
              <span className="font-mono text-xs text-slate-400">
                {districts.length} {translate(catalog, 'districts.total')}
              </span>
            </div>
            {districts.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
                {translate(catalog, 'districts.empty')}
              </div>
            )}
            {districts.map((district) => {
              const definition = DISTRICT_POLICIES.find((item) => item.id === district.policy) ?? DISTRICT_POLICIES[0];
              const identity = identities.find((item) => item.districtId === district.id);
              return (
                <div key={district.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <span className="h-3 w-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: district.color }} />
                      <span>{district.name}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {definition.name} · Pusat ({district.center[0]}, {district.center[1]}) · {district.tiles.length} petak
                    </div>
                    {identity && (
                      <div className="mt-1 text-xs text-cyan-300 font-medium">
                        <b>{identity.type.replaceAll('_', ' ')}</b> · Kepercayaan {identity.confidence}% · {identity.reasons.slice(1).join(' · ')}
                      </div>
                    )}
                  </div>
                  <button 
                    type="button" 
                    aria-label={`Hapus distrik ${district.name}`} 
                    onClick={() => onRemoveDistrict(district.id)} 
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
