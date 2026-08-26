import React, { useState } from 'react';
import { X, MapPinned, Trash2 } from 'lucide-react';
import { CityDistrict, DISTRICT_POLICIES, DistrictPolicy } from '../districts';

interface DistrictsModalProps {
  isOpen: boolean;
  onClose: () => void;
  districts: CityDistrict[];
  onStartPlacement: (config: { name: string; policy: DistrictPolicy; radius: number }) => void;
  onRemoveDistrict: (districtId: string) => void;
}

export function DistrictsModal({ isOpen, onClose, districts, onStartPlacement, onRemoveDistrict }: DistrictsModalProps) {
  const [name, setName] = useState('');
  const [policy, setPolicy] = useState<DistrictPolicy>('GREEN');
  const [radius, setRadius] = useState(4);

  if (!isOpen) return null;

  const selectedPolicy = DISTRICT_POLICIES.find((item) => item.id === policy) ?? DISTRICT_POLICIES[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-violet-500/10 border border-violet-400/30 rounded-xl text-violet-300"><MapPinned size={22} /></div>
            <div>
              <h2 className="font-serif italic text-xl text-violet-200">District Planner</h2>
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">Spatial identity & local policy</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-violet-200">Create district</div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px] gap-3">
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Riverside Quarter" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Local policy</span>
                <select value={policy} onChange={(event) => setPolicy(event.target.value as DistrictPolicy)} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60">
                  {DISTRICT_POLICIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-slate-400">Radius</span>
                <select value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="w-full rounded-lg border border-white/10 bg-[#111827] px-3 py-2 text-sm text-white outline-none focus:border-violet-400/60">
                  {[3, 4, 5, 6, 8].map((value) => <option key={value} value={value}>{value} tiles</option>)}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400 max-w-xl">{selectedPolicy.description} Klik peta setelah menekan tombol untuk memilih pusat distrik.</p>
              <button type="button" onClick={() => onStartPlacement({ name, policy, radius })} className="shrink-0 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white hover:bg-violet-400 transition-colors">Place on Map</button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><div className="text-xs font-bold uppercase tracking-widest text-slate-300">Existing districts</div><div className="font-mono text-[10px] text-slate-500">{districts.length} total</div></div>
            {districts.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">Belum ada distrik. Buat satu untuk memberi identitas dan kebijakan lokal pada kawasan kota.</div>}
            {districts.map((district) => {
              const definition = DISTRICT_POLICIES.find((item) => item.id === district.policy) ?? DISTRICT_POLICIES[0];
              return (
                <div key={district.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: district.color }} />{district.name}</div><div className="text-[10px] text-slate-500">{definition.name} · center ({district.center[0]},{district.center[1]}) · {district.tiles.length} tiles</div></div>
                  <button type="button" aria-label={`Delete ${district.name}`} onClick={() => onRemoveDistrict(district.id)} className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
