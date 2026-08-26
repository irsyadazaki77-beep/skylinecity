import React, { useState } from 'react';
import { MISSIONS, ACHIEVEMENTS, Mission, Achievement } from '../progression';
import { CityState } from '../types';
import { SCENARIO_DEFINITIONS } from '../contentRegistry';
import { evaluateScenario } from '../scenarioSystem';
import { X, Target, Award, Check, DollarSign } from 'lucide-react';

interface MissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: CityState;
  onClaimReward: (missionId: string, reward: number) => void;
  onStartScenario?: (scenarioId: string) => void;
}

export function MissionsModal({
  isOpen,
  onClose,
  gameState,
  onClaimReward,
  onStartScenario,
}: MissionsModalProps) {
  const [tab, setTab] = useState<'Missions' | 'Achievements' | 'Scenarios'>('Missions');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl text-[#D4AF37]">
              <Target size={22} />
            </div>
            <div>
              <h2 className="font-serif italic text-xl text-[#D4AF37]">City Objectives & Badges</h2>
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                Milestone Challenges & Achievements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 bg-black/30 shrink-0">
          <button
            onClick={() => setTab('Missions')}
            className={`px-4 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 ${
              tab === 'Missions' ? 'bg-[#D4AF37] text-black shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Target size={14} /> Objectives & Grants
          </button>
          <button
            onClick={() => setTab('Achievements')}
            className={`px-4 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 ${
              tab === 'Achievements' ? 'bg-[#D4AF37] text-black shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Award size={14} /> Civic Achievements
          </button>
          <button
            onClick={() => setTab('Scenarios')}
            className={`px-4 py-1.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 ${
              tab === 'Scenarios' ? 'bg-[#D4AF37] text-black shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Target size={14} /> Campaign Scenarios
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {tab === 'Missions' && (
            <div className="space-y-3">
              {MISSIONS.map((m) => {
                const isFulfilled = m.check(gameState);
                const isClaimed = gameState.completedMissions.includes(m.id);

                return (
                  <div
                    key={m.id}
                    className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                      isClaimed
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100 opacity-75'
                        : isFulfilled
                        ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-white shadow-lg animate-pulse'
                        : 'bg-white/5 border-white/10 text-gray-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-mono text-sm font-bold">{m.title}</h4>
                        <span className="text-[10px] font-mono text-[#D4AF37] font-bold">
                          +${m.rewardMoney.toLocaleString()} Grant
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{m.description}</p>
                    </div>

                    <div>
                      {isClaimed ? (
                        <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                          <Check size={14} /> Completed
                        </span>
                      ) : isFulfilled ? (
                        <button
                          onClick={() => onClaimReward(m.id, m.rewardMoney)}
                          className="px-4 py-2 bg-[#D4AF37] text-black font-bold font-mono text-xs rounded-xl hover:bg-[#c29f2e] transition-colors shadow-md"
                        >
                          Claim Reward
                        </button>
                      ) : (
                        <span className="text-xs font-mono text-gray-500">In Progress</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'Achievements' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ACHIEVEMENTS.map((a) => {
                const isUnlocked = a.check(gameState);

                return (
                  <div
                    key={a.id}
                    className={`p-4 rounded-xl border transition-all flex items-center gap-3 ${
                      isUnlocked
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                        : 'bg-black/40 border-white/5 text-gray-500 opacity-50'
                    }`}
                  >
                    <div className="p-2.5 rounded-xl bg-black/40 shrink-0">
                      <Award size={20} className={isUnlocked ? 'text-[#D4AF37]' : 'text-gray-600'} />
                    </div>
                    <div>
                      <h4 className="font-mono text-xs font-bold">{a.title}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">{a.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'Scenarios' && (
            <div className="space-y-3">
              {SCENARIO_DEFINITIONS.map((scenario) => {
                const progress = evaluateScenario(gameState, scenario);
                const active = gameState.activeScenarioId === scenario.id;
                return (
                  <div key={scenario.id} className={`rounded-xl border p-4 ${active ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-mono text-sm font-bold text-white">{scenario.name}</h4>
                        <p className="mt-1 text-xs text-gray-400">{scenario.description}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {scenario.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase text-slate-400">{tag}</span>)}
                        </div>
                      </div>
                      <button type="button" onClick={() => onStartScenario?.(scenario.id)} className="shrink-0 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-400/20">
                        {active ? (progress.completed ? 'Completed' : 'Active') : 'Start'}
                      </button>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {scenario.objectives.map((objective) => (
                        <div key={objective.id} className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{objective.label}</span>
                          <span className="font-mono text-slate-300">{progress.objectiveValues[objective.id] ?? 0} / {objective.target}</span>
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
