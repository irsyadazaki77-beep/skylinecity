import React, { useState } from 'react';
import { Download, FolderOpen, Settings, Sparkles } from 'lucide-react';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../../localization';

interface StartScreenProps {
  onNewCity: () => void;
  onContinue: () => Promise<void>;
  onLoad: () => void;
  onSettings: () => void;
  language?: SupportedLanguage;
  canContinue?: boolean;
}

export function StartScreen({ onNewCity, onContinue, onLoad, onSettings, language = 'id', canContinue = false }: StartScreenProps) {
  const [busy, setBusy] = useState(false);
  const catalog = createLocalizationCatalog(language);
  const continueCity = async () => {
    setBusy(true);
    await onContinue();
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#070b14]/95 p-6 backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="start-screen-title">
      <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#0f172a]/95 p-8 text-white shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-cyan-300"><Sparkles size={26} /></div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-cyan-300">Public Beta · Metropolis 3.0</p>
            <h1 id="start-screen-title" className="text-2xl font-bold">Skyline Simulator</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-slate-300">Bangun kota yang hidup, atur jaringan layanan, dan lihat keputusanmu membentuk masa depan metropolitan.</p>
        <div className="grid gap-3">
          <button type="button" disabled={busy || !canContinue} onClick={() => void continueCity()} className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-left text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50">
            <span><b className="block text-sm">{translate(catalog, 'app.continue')}</b><small className="text-xs text-emerald-200/70">{canContinue ? 'Buka autosave terakhir' : 'Belum ada autosave tersedia'}</small></span>
            <FolderOpen size={18} />
          </button>
          <button type="button" onClick={onNewCity} className="flex items-center justify-between rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 text-left text-cyan-100 hover:bg-cyan-500/25">
            <span><b className="block text-sm">{translate(catalog, 'app.newCity')}</b><small className="text-xs text-cyan-200/70">Mulai dengan tutorial walikota</small></span>
            <Sparkles size={18} />
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onLoad} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10"><Download size={15} /> Load / Import</button>
            <button type="button" onClick={onSettings} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10"><Settings size={15} /> Settings</button>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] text-slate-500">Desktop Chromium · Save tersimpan lokal di browser</p>
      </div>
    </div>
  );
}
