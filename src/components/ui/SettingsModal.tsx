import React, { useState, useEffect } from 'react';
import { X, Sliders, Shield, Laptop, HelpCircle, Accessibility, Download, RotateCcw } from 'lucide-react';
import { CityState, GameSettings } from '../../types';
import { createDiagnosticBundle, downloadDiagnosticBundle, recordDiagnosticError } from '../../releaseReadiness';
import { useModalFocus } from './useModalFocus';
import { createLocalizationCatalog, translate } from '../../localization';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onUpdateSettings: (settings: GameSettings) => void;
  gameState?: CityState;
}

export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'normal',
  autosave: true,
  shadowQuality: 'medium',
  antialiasing: true,
  renderScale: 100,
  trafficDensity: 'medium',
  vegetationDensity: 'medium',
  dayNightCycle: 'enabled',
  vsync: true,
  volume: 75,
  musicVolume: 50,
  language: 'id',
  reducedMotion: false,
  uiScale: 'medium',
  adaptiveQuality: true,
  experimentalFeatures: false,
  highContrast: false,
  colorblindMode: 'none',
};

export function SettingsModal({ isOpen, onClose, settings, onUpdateSettings, gameState }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'gameplay' | 'graphics' | 'audio' | 'controls' | 'accessibility'>('gameplay');
  const [localSettings, setLocalSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS, ...settings });
  const catalog = createLocalizationCatalog(localSettings.language ?? 'id');
  const dialogRef = useModalFocus<HTMLDivElement>(isOpen);

  useEffect(() => {
    setLocalSettings({ ...DEFAULT_SETTINGS, ...settings });
  }, [settings, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const saveSettings = (updated: GameSettings) => {
    const normalized = { ...DEFAULT_SETTINGS, ...updated };
    setLocalSettings(normalized);
    onUpdateSettings(normalized);
    try {
      localStorage.setItem('skyline_settings', JSON.stringify(normalized));
    } catch (e) {
      recordDiagnosticError(e, 'SETTINGS_WRITE_ERROR');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-24px)] sm:max-h-[85vh] text-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-blue-400" />
            <h2 id="settings-title" className="text-white font-bold text-lg">{translate(catalog, 'settings.title')}</h2>
          </div>
          <button type="button" aria-label="Tutup pengaturan" onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-focus)]">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 bg-black/10 border-b border-white/10 overflow-x-auto" role="tablist">
          <TabButton active={activeTab === 'gameplay'} onClick={() => setActiveTab('gameplay')} label={translate(catalog, 'settings.gameplay')} icon={<Shield size={16} />} />
          <TabButton active={activeTab === 'graphics'} onClick={() => setActiveTab('graphics')} label={translate(catalog, 'settings.graphics')} icon={<Laptop size={16} />} />
          <TabButton active={activeTab === 'audio'} onClick={() => setActiveTab('audio')} label={translate(catalog, 'settings.audio')} icon={<Sliders size={16} />} />
          <TabButton active={activeTab === 'controls'} onClick={() => setActiveTab('controls')} label={translate(catalog, 'settings.controls')} icon={<HelpCircle size={16} />} />
          <TabButton active={activeTab === 'accessibility'} onClick={() => setActiveTab('accessibility')} label={translate(catalog, 'settings.accessibility')} icon={<Accessibility size={16} />} />
        </div>

        {/* Content Container */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {activeTab === 'gameplay' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{translate(catalog, 'settings.rules')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label={translate(catalog, 'settings.difficulty')}
                  value={localSettings.difficulty}
                  onChange={(val) => saveSettings({ ...localSettings, difficulty: val as any })}
                  options={[
                    { value: 'easy', label: translate(catalog, 'settings.easy') },
                    { value: 'normal', label: translate(catalog, 'settings.normal') },
                    { value: 'hard', label: translate(catalog, 'settings.hard') },
                  ]}
                />
                <ToggleField
                  label={translate(catalog, 'settings.autosave')}
                  checked={localSettings.autosave}
                  onChange={(val) => saveSettings({ ...localSettings, autosave: val })}
                />
              </div>
            </div>
          )}

          {activeTab === 'graphics' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{translate(catalog, 'settings.graphicsTitle')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label={translate(catalog, 'settings.shadowQuality')}
                  value={localSettings.shadowQuality}
                  onChange={(val) => saveSettings({ ...localSettings, shadowQuality: val as any })}
                  options={[
                    { value: 'low', label: 'Rendah (Performa)' },
                    { value: 'medium', label: 'Sedang (Seimbang)' },
                    { value: 'high', label: 'Tinggi (Sinematik)' },
                  ]}
                />
                <ToggleField
                  label={translate(catalog, 'settings.antiAliasing')}
                  checked={localSettings.antialiasing}
                  onChange={(val) => saveSettings({ ...localSettings, antialiasing: val })}
                />
                <SelectField
                  label={translate(catalog, 'settings.renderScale')}
                  value={localSettings.renderScale.toString()}
                  onChange={(val) => saveSettings({ ...localSettings, renderScale: parseInt(val) })}
                  options={[
                    { value: '50', label: localSettings.language === 'en' ? '50% (High speed)' : '50% (Performa tinggi)' },
                    { value: '75', label: '75%' },
                    { value: '100', label: localSettings.language === 'en' ? '100% (Native)' : '100% (Asli)' },
                    { value: '120', label: localSettings.language === 'en' ? '120% (Crisp visuals)' : '120% (Visual tajam)' },
                  ]}
                />
                <SelectField
                  label={translate(catalog, 'settings.dayNightCycle')}
                  value={localSettings.dayNightCycle}
                  onChange={(val) => saveSettings({ ...localSettings, dayNightCycle: val as any })}
                  options={[
                    { value: 'enabled', label: 'Siklus Dinamis' },
                    { value: 'disabled', label: 'Sore Statis' },
                    { value: 'locked_day', label: 'Kunci Siang' },
                    { value: 'locked_night', label: 'Kunci Malam' },
                  ]}
                />
                <SelectField
                  label={translate(catalog, 'settings.trafficDensity')}
                  value={localSettings.trafficDensity}
                  onChange={(val) => saveSettings({ ...localSettings, trafficDensity: val as any })}
                  options={[
                    { value: 'low', label: 'Rendah (Optimal)' },
                    { value: 'medium', label: 'Sedang' },
                    { value: 'high', label: 'Tinggi (Imersif)' },
                  ]}
                />
                <SelectField
                  label={translate(catalog, 'settings.vegetationDensity')}
                  value={localSettings.vegetationDensity}
                  onChange={(val) => saveSettings({ ...localSettings, vegetationDensity: val as any })}
                  options={[
                    { value: 'low', label: 'Rendah (Cepat)' },
                    { value: 'medium', label: 'Sedang' },
                    { value: 'high', label: 'Tinggi (Rimbun)' },
                  ]}
                />
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-[11px] text-gray-400 md:col-span-2">
                  <div className="font-semibold text-gray-300">{translate(catalog, 'settings.vsyncTitle')}</div>
                  <div className="mt-1">{translate(catalog, 'settings.vsyncInfo')}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{translate(catalog, 'settings.audioTitle')}</h3>
              <div className="space-y-4">
                <SliderField
                  label={translate(catalog, 'settings.sfxVolume')}
                  value={localSettings.volume}
                  onChange={(v) => saveSettings({ ...localSettings, volume: v })}
                />
                <SliderField
                  label={translate(catalog, 'settings.musicVolume')}
                  value={localSettings.musicVolume}
                  onChange={(v) => saveSettings({ ...localSettings, musicVolume: v })}
                />
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] text-gray-400">
                  <div className="font-semibold text-cyan-300">{translate(catalog, 'settings.soundscapeTitle')}</div>
                  <div className="mt-1">{translate(catalog, 'settings.soundscapeInfo')}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{translate(catalog, 'settings.controlsTitle')}</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm font-mono border border-white/5 p-4 rounded-xl bg-black/10">
                <div className="text-gray-400">WASD / Arah Panah</div>
                <div className="text-white text-right">Geser Kamera</div>
                
                <div className="text-gray-400">Roda Mouse</div>
                <div className="text-white text-right">Perbesar / Perkecil</div>
                
                <div className="text-gray-400">Klik Tengah / Q-E</div>
                <div className="text-white text-right">Putar Sudut Pandang</div>

                <div className="text-gray-400">Toolbar Kamera</div>
                <div className="text-white text-right">2D/3D, zoom, fokus, reset</div>

                <div className="text-gray-400">F / Home</div>
                <div className="text-white text-right">Fokus petak / reset kamera</div>
                
                <div className="text-gray-400">Klik Kanan</div>
                <div className="text-white text-right">Batalkan alat / pilihan</div>
                
                <div className="text-gray-400">Spasi / Angka 0</div>
                <div className="text-white text-right">Jeda / Lanjutkan</div>
                
                <div className="text-gray-400">Angka 1 / 2 / 3 / 4</div>
                <div className="text-white text-right">Jeda / normal / cepat / ultra</div>
                
                <div className="text-gray-400">Tombol T</div>
                <div className="text-white text-right">Pohon Teknologi</div>
                
                <div className="text-gray-400">Tombol P</div>
                <div className="text-white text-right">Panel Kebijakan</div>
                
                <div className="text-gray-400">Tombol M</div>
                <div className="text-white text-right">Misi & Objektif</div>
                
                <div className="text-gray-400">Tombol B</div>
                <div className="text-white text-right">Aktifkan Alat Gusur</div>
                
                <div className="text-gray-400">Escape</div>
                <div className="text-white text-right">Tutup Dialog / Batal Pilih</div>
              </div>
            </div>
          )}

          {activeTab === 'accessibility' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{translate(catalog, 'settings.accessibilityTitle')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label={translate(catalog, 'settings.language')}
                  value={localSettings.language ?? 'id'}
                  onChange={(val) => saveSettings({ ...localSettings, language: val as GameSettings['language'] })}
                  options={[{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English (fallback)' }]}
                />
                <SelectField
                  label={translate(catalog, 'settings.uiScale')}
                  value={localSettings.uiScale ?? 'medium'}
                  onChange={(val) => saveSettings({ ...localSettings, uiScale: val as GameSettings['uiScale'] })}
                  options={[{ value: 'small', label: 'Kecil' }, { value: 'medium', label: 'Sedang' }, { value: 'large', label: 'Besar' }]}
                />
                <ToggleField
                  label={translate(catalog, 'settings.reducedMotion')}
                  checked={localSettings.reducedMotion ?? false}
                  onChange={(val) => saveSettings({ ...localSettings, reducedMotion: val })}
                />
                <ToggleField
                  label={translate(catalog, 'settings.adaptiveQuality')}
                  checked={localSettings.adaptiveQuality ?? true}
                  onChange={(val) => saveSettings({ ...localSettings, adaptiveQuality: val })}
                />
                <ToggleField
                  label={translate(catalog, 'settings.experimental')}
                  checked={localSettings.experimentalFeatures ?? false}
                  onChange={(val) => saveSettings({ ...localSettings, experimentalFeatures: val })}
                />
                <ToggleField
                  label={translate(catalog, 'settings.highContrast')}
                  checked={localSettings.highContrast ?? false}
                  onChange={(val) => saveSettings({ ...localSettings, highContrast: val })}
                />
                <SelectField
                  label={translate(catalog, 'settings.colorblind')}
                  value={localSettings.colorblindMode ?? 'none'}
                  onChange={(val) => saveSettings({ ...localSettings, colorblindMode: val as GameSettings['colorblindMode'] })}
                  options={[
                    { value: 'none', label: translate(catalog, 'settings.none') },
                    { value: 'deuteranopia', label: 'Deuteranopia' },
                    { value: 'protanopia', label: 'Protanopia' },
                    { value: 'tritanopia', label: 'Tritanopia' },
                  ]}
                />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300 space-y-2">
                <p>{translate(catalog, 'settings.qualityNote')}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => gameState && downloadDiagnosticBundle(createDiagnosticBundle(gameState, localSettings))} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-cyan-200 hover:bg-cyan-500/20">
                    <Download size={14} /> {translate(catalog, 'settings.exportDiagnostic')}
                  </button>
                  <button type="button" onClick={() => saveSettings(DEFAULT_SETTINGS)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-gray-300 hover:bg-white/10">
                    <RotateCcw size={14} /> {translate(catalog, 'settings.reset')}
                  </button>
                  <button type="button" onClick={() => window.dispatchEvent(new Event('skyline:reset-onboarding'))} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-gray-300 hover:bg-white/10">
                    <HelpCircle size={14} /> {translate(catalog, 'settings.repeatTutorial')}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {translate(catalog, 'settings.applyClose')}
          </button>
        </div>

      </div>
    </div>
  );
}

// --- Inner Helper UI Components ---

function TabButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
        active
          ? 'bg-blue-500/20 text-blue-300 font-semibold shadow-inner'
          : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = `settings-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg">
      <span className="text-sm font-semibold text-gray-300">{label}</span>
      <button
        type="button"
        aria-pressed={checked}
        aria-label={`${label}: ${checked ? 'aktif' : 'nonaktif'}`}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full p-0.5 transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-700'}`}
      >
        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center text-sm font-semibold">
        <span className="text-gray-300">{label}</span>
        <span className="text-white">{value}%</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-blue-500"
      />
    </div>
  );
}
