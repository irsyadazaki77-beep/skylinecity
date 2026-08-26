import React, { useState, useEffect } from 'react';
import { X, Sliders, Shield, Laptop, HelpCircle, Accessibility, Download, RotateCcw } from 'lucide-react';
import { CityState, GameSettings } from '../../types';
import { createDiagnosticBundle, downloadDiagnosticBundle, recordDiagnosticError } from '../../releaseReadiness';
import { useModalFocus } from './useModalFocus';

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
    <div className="settings-modal fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div ref={dialogRef} className="bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] text-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            <Sliders size={20} className="text-blue-400" />
            <h2 id="settings-title" className="text-white font-bold text-lg">Game Settings</h2>
          </div>
          <button type="button" aria-label="Tutup pengaturan" onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 bg-black/10 border-b border-white/10">
          <TabButton active={activeTab === 'gameplay'} onClick={() => setActiveTab('gameplay')} label="Gameplay" icon={<Shield size={16} />} />
          <TabButton active={activeTab === 'graphics'} onClick={() => setActiveTab('graphics')} label="Graphics" icon={<Laptop size={16} />} />
          <TabButton active={activeTab === 'audio'} onClick={() => setActiveTab('audio')} label="Audio" icon={<Sliders size={16} />} />
          <TabButton active={activeTab === 'controls'} onClick={() => setActiveTab('controls')} label="Controls" icon={<HelpCircle size={16} />} />
          <TabButton active={activeTab === 'accessibility'} onClick={() => setActiveTab('accessibility')} label="Aksesibilitas" icon={<Accessibility size={16} />} />
        </div>

        {/* Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {activeTab === 'gameplay' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Gameplay Rules</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label="Difficulty"
                  value={localSettings.difficulty}
                  onChange={(val) => saveSettings({ ...localSettings, difficulty: val as any })}
                  options={[
                    { value: 'easy', label: 'Easy (Bonus Funds & Growth)' },
                    { value: 'normal', label: 'Normal (Standard Balance)' },
                    { value: 'hard', label: 'Hard (Strict Utility & Demands)' },
                  ]}
                />
                <ToggleField
                  label="Auto-Save Game"
                  checked={localSettings.autosave}
                  onChange={(val) => saveSettings({ ...localSettings, autosave: val })}
                />
              </div>
            </div>
          )}

          {activeTab === 'graphics' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Graphics Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label="Shadow Quality"
                  value={localSettings.shadowQuality}
                  onChange={(val) => saveSettings({ ...localSettings, shadowQuality: val as any })}
                  options={[
                    { value: 'low', label: 'Low (Performance)' },
                    { value: 'medium', label: 'Medium (Balanced)' },
                    { value: 'high', label: 'High (Cinematic)' },
                  ]}
                />
                <ToggleField
                  label="Anti-Aliasing"
                  checked={localSettings.antialiasing}
                  onChange={(val) => saveSettings({ ...localSettings, antialiasing: val })}
                />
                <SelectField
                  label="Render Scale"
                  value={localSettings.renderScale.toString()}
                  onChange={(val) => saveSettings({ ...localSettings, renderScale: parseInt(val) })}
                  options={[
                    { value: '50', label: '50% (High Speed)' },
                    { value: '75', label: '75%' },
                    { value: '100', label: '100% (Native)' },
                    { value: '120', label: '120% (Crisp Visuals)' },
                  ]}
                />
                <SelectField
                  label="Day/Night Cycle"
                  value={localSettings.dayNightCycle}
                  onChange={(val) => saveSettings({ ...localSettings, dayNightCycle: val as any })}
                  options={[
                    { value: 'enabled', label: 'Dynamic Loop' },
                    { value: 'disabled', label: 'Static Afternoon' },
                    { value: 'locked_day', label: 'Lock Day' },
                    { value: 'locked_night', label: 'Lock Night' },
                  ]}
                />
                <SelectField
                  label="Traffic Density"
                  value={localSettings.trafficDensity}
                  onChange={(val) => saveSettings({ ...localSettings, trafficDensity: val as any })}
                  options={[
                    { value: 'low', label: 'Low (Optimized)' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High (Immersive)' },
                  ]}
                />
                <SelectField
                  label="Vegetation Density"
                  value={localSettings.vegetationDensity}
                  onChange={(val) => saveSettings({ ...localSettings, vegetationDensity: val as any })}
                  options={[
                    { value: 'low', label: 'Low (Fast)' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High (Lush)' },
                  ]}
                />
                <ToggleField
                  label="V-Sync & Frame Cap"
                  checked={localSettings.vsync}
                  onChange={(val) => saveSettings({ ...localSettings, vsync: val })}
                />
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Audio Settings</h3>
              <div className="space-y-4">
                <SliderField
                  label="Master Volume"
                  value={localSettings.volume}
                  onChange={(v) => saveSettings({ ...localSettings, volume: v })}
                />
                <SliderField
                  label="Music Volume"
                  value={localSettings.musicVolume}
                  onChange={(v) => saveSettings({ ...localSettings, musicVolume: v })}
                />
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Keyboard Bindings</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm font-mono border border-white/5 p-4 rounded-xl bg-black/10">
                <div className="text-gray-400">WASD / Arrows</div>
                <div className="text-white text-right">Camera Pan</div>
                
                <div className="text-gray-400">Mouse Wheel</div>
                <div className="text-white text-right">Zoom In / Out</div>
                
                <div className="text-gray-400">Middle Mouse / Q-E</div>
                <div className="text-white text-right">Orbit / Rotate</div>

                <div className="text-gray-400">Camera Toolbar</div>
                <div className="text-white text-right">2D/3D, zoom, focus, reset</div>

                <div className="text-gray-400">F / Home</div>
                <div className="text-white text-right">Focus selected / reset camera</div>
                
                <div className="text-gray-400">Right Click</div>
                <div className="text-white text-right">Cancel Placement / tool</div>
                
                <div className="text-gray-400">Space / Key 0</div>
                <div className="text-white text-right">Pause / Resume</div>
                
                <div className="text-gray-400">Keys 1, 2, 3, 4</div>
                <div className="text-white text-right">Adjust Speed Rate</div>
                
                <div className="text-gray-400">Key T</div>
                <div className="text-white text-right">Tech Tree</div>
                
                <div className="text-gray-400">Key P</div>
                <div className="text-white text-right">Policies Panel</div>
                
                <div className="text-gray-400">Key M</div>
                <div className="text-white text-right">Missions / Objectives</div>
                
                <div className="text-gray-400">Key B</div>
                <div className="text-white text-right">Toggle Bulldozer</div>
                
                <div className="text-gray-400">Escape</div>
                <div className="text-white text-right">Close Modals / Deselect</div>
              </div>
            </div>
          )}

          {activeTab === 'accessibility' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Aksesibilitas & Dukungan</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SelectField
                  label="Bahasa"
                  value={localSettings.language ?? 'id'}
                  onChange={(val) => saveSettings({ ...localSettings, language: val as GameSettings['language'] })}
                  options={[{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English (fallback)' }]}
                />
                <SelectField
                  label="Ukuran UI"
                  value={localSettings.uiScale ?? 'medium'}
                  onChange={(val) => saveSettings({ ...localSettings, uiScale: val as GameSettings['uiScale'] })}
                  options={[{ value: 'small', label: 'Kecil' }, { value: 'medium', label: 'Sedang' }, { value: 'large', label: 'Besar' }]}
                />
                <ToggleField
                  label="Kurangi Animasi"
                  checked={localSettings.reducedMotion ?? false}
                  onChange={(val) => saveSettings({ ...localSettings, reducedMotion: val })}
                />
                <ToggleField
                  label="Adaptive Quality"
                  checked={localSettings.adaptiveQuality ?? true}
                  onChange={(val) => saveSettings({ ...localSettings, adaptiveQuality: val })}
                />
                <ToggleField
                  label="Fitur Experimental"
                  checked={localSettings.experimentalFeatures ?? false}
                  onChange={(val) => saveSettings({ ...localSettings, experimentalFeatures: val })}
                />
                <ToggleField
                  label="Kontras Tinggi"
                  checked={localSettings.highContrast ?? false}
                  onChange={(val) => saveSettings({ ...localSettings, highContrast: val })}
                />
                <SelectField
                  label="Bantuan Penglihatan Warna"
                  value={localSettings.colorblindMode ?? 'none'}
                  onChange={(val) => saveSettings({ ...localSettings, colorblindMode: val as GameSettings['colorblindMode'] })}
                  options={[
                    { value: 'none', label: 'Tidak ada' },
                    { value: 'deuteranopia', label: 'Deuteranopia' },
                    { value: 'protanopia', label: 'Protanopia' },
                    { value: 'tritanopia', label: 'Tritanopia' },
                  ]}
                />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-gray-300 space-y-2">
                <p>Adaptive Quality menurunkan detail visual saat frame rate turun. Hasil simulasi dan angka ekonomi tidak berubah.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => gameState && downloadDiagnosticBundle(createDiagnosticBundle(gameState, localSettings))} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-cyan-200 hover:bg-cyan-500/20">
                    <Download size={14} /> Export Diagnostic Report
                  </button>
                  <button type="button" onClick={() => saveSettings(DEFAULT_SETTINGS)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-gray-300 hover:bg-white/10">
                    <RotateCcw size={14} /> Reset Settings
                  </button>
                  <button type="button" onClick={() => window.dispatchEvent(new Event('skyline:reset-onboarding'))} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-gray-300 hover:bg-white/10">
                    <HelpCircle size={14} /> Ulangi Panduan
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
            Apply & Close
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
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
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
