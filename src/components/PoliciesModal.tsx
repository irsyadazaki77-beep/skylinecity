import React, { useEffect } from 'react';
import { POLICIES, MILESTONES } from '../progression';
import { X, Landmark, Check, Lock } from 'lucide-react';
import { POLICY_CONTRACTS } from '../policyConsequences';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../localization';
import { useModalFocus } from './ui/useModalFocus';

interface PoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneLevel: number;
  activePolicies: string[];
  onTogglePolicy: (policyId: string) => void;
  language?: SupportedLanguage;
}

export function PoliciesModal({
  isOpen,
  onClose,
  milestoneLevel,
  activePolicies,
  onTogglePolicy,
  language = 'id',
}: PoliciesModalProps) {
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
        aria-labelledby="policies-modal-title"
        className="bg-[#0d1420] border border-[var(--border-subtle)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--accent-cyan)]/15 border border-[var(--accent-cyan)]/30 rounded-xl text-[var(--accent-cyan)]">
              <Landmark size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="policies-modal-title" className="text-lg font-bold text-white tracking-tight">
                {translate(catalog, 'policies.title')}
              </h2>
              <p className="text-xs text-slate-400">
                {translate(catalog, 'policies.subtitle')}: {activePolicies.length} aktif
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup jendela kebijakan kota"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Policies List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1">
          {POLICIES.map((policy) => {
            const isActive = activePolicies.includes(policy.id);
            const isUnlocked = milestoneLevel >= policy.unlockedMilestoneLevel;
            const milestoneName = MILESTONES[policy.unlockedMilestoneLevel]?.name || 'Desa';
            const impacts = POLICY_CONTRACTS[policy.id];

            return (
              <div
                key={policy.id}
                className={`p-4 rounded-xl border transition-all flex flex-col gap-3 ${
                  isActive
                    ? 'bg-emerald-950/25 border-emerald-500/50 text-white shadow-lg'
                    : isUnlocked
                    ? 'bg-white/[0.04] border-white/10 text-slate-200'
                    : 'bg-black/40 border-white/5 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white truncate">{policy.name}</h3>
                      {policy.dailyUpkeep > 0 ? (
                        <span className="text-[11px] font-mono font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                          -${policy.dailyUpkeep}/hari
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                          {translate(catalog, 'policies.free')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{policy.description}</p>
                    {!isUnlocked && (
                      <span className="text-xs text-rose-400 flex items-center gap-1 mt-1 font-medium">
                        <Lock size={12} aria-hidden="true" /> Membutuhkan Milestone {milestoneName}
                      </span>
                    )}
                  </div>

                  {/* Toggle Switch Button */}
                  <button
                    type="button"
                    disabled={!isUnlocked}
                    aria-pressed={isActive}
                    onClick={() => onTogglePolicy(policy.id)}
                    className={`min-h-[44px] px-4 rounded-xl text-xs font-bold transition-all shrink-0 self-start sm:self-center flex items-center justify-center gap-1.5 ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-bold'
                        : isUnlocked
                        ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
                        : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    {isActive && <Check size={14} aria-hidden="true" />}
                    <span>{isActive ? 'Aktif' : isUnlocked ? translate(catalog, 'policies.apply') : translate(catalog, 'policies.locked')}</span>
                  </button>
                </div>

                {/* Engine-backed trade-off contract */}
                {impacts && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                    <div className="rounded-lg bg-black/30 p-2.5 border border-white/5">
                      <span className="text-emerald-300 font-semibold">{translate(catalog, 'policies.benefits')}:</span>
                      <p className="text-slate-300 text-[11px] mt-0.5">{impacts.beneficiary}</p>
                      <span className="mt-1.5 block text-rose-300 font-semibold">{translate(catalog, 'policies.costBearer')}:</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">{impacts.disadvantaged}</p>
                    </div>
                    <div className="rounded-lg bg-cyan-950/20 p-2.5 border border-cyan-500/20">
                      <span className="text-cyan-300 font-semibold">{translate(catalog, 'policies.ruleEffect')}:</span>
                      <p className="text-slate-300 text-[11px] mt-0.5">{impacts.shortTerm}</p>
                      <div className="text-[11px] text-slate-400 mt-1">{translate(catalog, 'policies.longTerm')}: {impacts.longTerm}</div>
                      <div className="text-[11px] font-mono text-amber-300 mt-1 font-semibold">{translate(catalog, 'policies.metric')}: {impacts.measuredMetric} ({impacts.expectedDirection})</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
