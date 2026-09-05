import React, { useEffect, useState } from 'react';
import { MISSIONS, ACHIEVEMENTS, Mission, Achievement } from '../progression';
import { CityState } from '../types';
import { SCENARIO_DEFINITIONS } from '../contentRegistry';
import { evaluateScenario } from '../scenarioSystem';
import { X, Target, Award, Check, Coins } from 'lucide-react';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../localization';
import { useModalFocus } from './ui/useModalFocus';

interface MissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: CityState;
  onClaimReward: (missionId: string, reward: number) => void;
  onStartScenario?: (scenarioId: string) => void;
  language?: SupportedLanguage;
}

export function MissionsModal({
  isOpen,
  onClose,
  gameState,
  onClaimReward,
  onStartScenario,
  language = 'id',
}: MissionsModalProps) {
  const [tab, setTab] = useState<'Missions' | 'Achievements' | 'Scenarios'>('Missions');
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
        aria-labelledby="missions-modal-title"
        className="bg-[#0d1420] border border-[var(--border-subtle)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--accent-cyan)]/15 border border-[var(--accent-cyan)]/30 rounded-xl text-[var(--accent-cyan)]">
              <Target size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="missions-modal-title" className="text-lg font-bold text-white tracking-tight">
                {translate(catalog, 'missions.title')}
              </h2>
              <p className="text-xs text-slate-400">
                {translate(catalog, 'missions.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup jendela target misi"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1.5 px-5 sm:px-6 py-2.5 border-b border-white/5 bg-black/30 shrink-0 overflow-x-auto" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'Missions'}
            onClick={() => setTab('Missions')}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              tab === 'Missions' ? 'bg-[var(--accent-cyan)] text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Target size={15} aria-hidden="true" /> 
            <span>{translate(catalog, 'missions.tab')}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'Achievements'}
            onClick={() => setTab('Achievements')}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              tab === 'Achievements' ? 'bg-[var(--accent-cyan)] text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Award size={15} aria-hidden="true" /> 
            <span>{translate(catalog, 'achievements.tab')}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'Scenarios'}
            onClick={() => setTab('Scenarios')}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              tab === 'Scenarios' ? 'bg-[var(--accent-cyan)] text-slate-950 font-bold shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Target size={15} aria-hidden="true" /> 
            <span>{translate(catalog, 'scenarios.tab')}</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
          {tab === 'Missions' && (
            <div className="space-y-3" role="tabpanel">
              {MISSIONS.map((m) => {
                const isFulfilled = m.check(gameState);
                const isClaimed = gameState.completedMissions.includes(m.id);

                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isClaimed
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100 opacity-80'
                        : isFulfilled
                        ? 'bg-[var(--accent-cyan)]/10 border-[var(--accent-cyan)]/40 text-white shadow-lg'
                        : 'bg-white/[0.03] border-white/10 text-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{m.title}</h3>
                        <span className="text-xs font-mono text-amber-300 font-semibold flex items-center gap-1">
                          <Coins size={12} aria-hidden="true" />
                          +${m.rewardMoney.toLocaleString()} {translate(catalog, 'missions.grant')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{m.description}</p>
                    </div>

                    <div className="shrink-0 self-end sm:self-center">
                      {isClaimed ? (
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <Check size={14} aria-hidden="true" /> {translate(catalog, 'missions.completed')}
                        </span>
                      ) : isFulfilled ? (
                        <button
                          type="button"
                          onClick={() => onClaimReward(m.id, m.rewardMoney)}
                          className="min-h-[44px] px-4 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition-colors shadow-md flex items-center gap-1.5"
                        >
                          <Coins size={14} aria-hidden="true" />
                          <span>{translate(catalog, 'missions.claim')}</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium px-2 py-1">{translate(catalog, 'missions.progress')}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'Achievements' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="tabpanel">
              {ACHIEVEMENTS.map((a) => {
                const isUnlocked = a.check(gameState);

                return (
                  <div
                    key={a.id}
                    className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      isUnlocked
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                        : 'bg-black/40 border-white/5 text-slate-500 opacity-60'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-black/40 shrink-0">
                      <Award size={20} className={isUnlocked ? 'text-[var(--accent-cyan)]' : 'text-slate-600'} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">{a.title}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{a.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'Scenarios' && (
            <div className="space-y-3" role="tabpanel">
              {SCENARIO_DEFINITIONS.map((scenario) => {
                const progress = evaluateScenario(gameState, scenario);
                const active = gameState.activeScenarioId === scenario.id;
                return (
                  <div key={scenario.id} className={`rounded-xl border p-4 ${active ? 'border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/10' : 'border-white/10 bg-white/[0.03]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">{scenario.name}</h3>
                        <p className="mt-1 text-xs text-slate-400">{scenario.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {scenario.tags.map((tag) => (
                            <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-slate-300">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => onStartScenario?.(scenario.id)} 
                        className="shrink-0 min-h-[44px] px-3.5 rounded-xl border border-[var(--accent-cyan)]/40 bg-[var(--accent-cyan)]/15 text-xs font-bold text-[var(--accent-cyan)] hover:bg-[var(--accent-cyan)]/25 transition-colors"
                      >
                        {active ? (progress.completed ? translate(catalog, 'missions.completed') : translate(catalog, 'scenario.active')) : translate(catalog, 'scenario.start')}
                      </button>
                    </div>
                    <div className="mt-3 space-y-1.5 border-t border-white/5 pt-2.5">
                      {scenario.objectives.map((objective) => (
                        <div key={objective.id} className="flex items-center justify-between text-xs text-slate-400">
                          <span>{objective.label}</span>
                          <span className="font-mono font-semibold text-slate-300">{progress.objectiveValues[objective.id] ?? 0} / {objective.target}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
