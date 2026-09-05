import React, { useEffect, useState } from 'react';
import { TECH_NODES, MILESTONES, TechNode } from '../progression';
import { X, Cpu, Check, Lock, Zap, Layers, DollarSign, Trees, Grid, Coins } from 'lucide-react';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../localization';
import { useModalFocus } from './ui/useModalFocus';

interface TechTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  money: number;
  unlockedUpgrades: string[];
  milestoneLevel: number;
  onUnlockTech: (id: string, cost: number) => void;
  language?: SupportedLanguage;
}

export function TechTreeModal({
  isOpen,
  onClose,
  money,
  unlockedUpgrades,
  milestoneLevel,
  onUnlockTech,
  language = 'id',
}: TechTreeModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<
    'Infrastructure' | 'Utilities' | 'Zoning' | 'Economy' | 'Environment'
  >('Infrastructure');
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

  const filteredNodes = TECH_NODES.filter((n) => n.category === selectedCategory);

  const categories = [
    { id: 'Infrastructure', label: 'Infrastruktur', icon: <Grid size={15} aria-hidden="true" /> },
    { id: 'Utilities', label: 'Utilitas', icon: <Zap size={15} aria-hidden="true" /> },
    { id: 'Zoning', label: 'Zonasi', icon: <Layers size={15} aria-hidden="true" /> },
    { id: 'Economy', label: 'Ekonomi', icon: <DollarSign size={15} aria-hidden="true" /> },
    { id: 'Environment', label: 'Lingkungan', icon: <Trees size={15} aria-hidden="true" /> },
  ];

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
        aria-labelledby="tech-tree-title"
        className="bg-[#0d1420] border border-[var(--border-subtle)] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--accent-cyan)]/15 border border-[var(--accent-cyan)]/30 rounded-xl text-[var(--accent-cyan)]">
              <Cpu size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="tech-tree-title" className="text-lg font-bold text-white tracking-tight">
                {translate(catalog, 'tech.title')}
              </h2>
              <p className="text-xs text-slate-400">
                {translate(catalog, 'tech.subtitle')}: {MILESTONES[milestoneLevel]?.name || 'Desa Perintis'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup jendela riset teknologi"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Category Tabs Bar */}
        <div className="flex items-center gap-1.5 px-5 sm:px-6 py-2.5 border-b border-white/5 bg-black/30 overflow-x-auto shrink-0" role="tablist">
          {categories.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`min-h-[44px] px-3.5 rounded-xl flex items-center gap-2 text-xs font-semibold transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[var(--accent-cyan)] text-slate-950 font-bold shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Tech Tree Nodes List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" role="tabpanel">
            {filteredNodes.map((node) => {
              const isUnlocked = unlockedUpgrades.includes(node.id);
              const prereqMet = !node.prerequisiteId || unlockedUpgrades.includes(node.prerequisiteId);
              const milestoneMet = milestoneLevel >= node.requiredMilestoneLevel;
              const canAfford = money >= node.cost;

              const prereqNode = node.prerequisiteId ? TECH_NODES.find((t) => t.id === node.prerequisiteId) : null;
              const milestoneName = MILESTONES[node.requiredMilestoneLevel]?.name || 'Desa';

              return (
                <div
                  key={node.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                    isUnlocked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100'
                      : prereqMet && milestoneMet
                      ? 'bg-white/[0.04] border-white/10 text-white'
                      : 'bg-black/40 border-white/5 text-slate-500 opacity-60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {isUnlocked ? (
                          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                            <Check size={16} aria-hidden="true" />
                          </div>
                        ) : !prereqMet || !milestoneMet ? (
                          <div className="p-2 bg-slate-800 rounded-lg text-slate-400">
                            <Lock size={16} aria-hidden="true" />
                          </div>
                        ) : (
                          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                            <Cpu size={16} aria-hidden="true" />
                          </div>
                        )}
                        <div>
                          <h3 className="text-sm font-bold text-white">{node.name}</h3>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {categories.find((c) => c.id === node.category)?.label ?? node.category}
                          </span>
                        </div>
                      </div>

                      <span className="font-mono text-xs font-bold text-amber-300 flex items-center gap-1">
                        <Coins size={12} aria-hidden="true" />
                        ${node.cost.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{node.description}</p>

                    {/* Prerequisite & Milestone Badges */}
                    <div className="flex flex-wrap gap-2 text-[10px] pt-1">
                      {prereqNode && (
                        <div
                          className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
                            unlockedUpgrades.includes(node.prerequisiteId!)
                              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                              : 'bg-red-950/40 border-red-500/30 text-red-300'
                          }`}
                        >
                          {translate(catalog, 'tech.requires')}: {prereqNode.name}
                        </div>
                      )}

                      <div
                        className={`px-2.5 py-1 rounded-lg border ${
                          milestoneMet
                            ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
                            : 'bg-red-950/40 border-red-500/30 text-red-300'
                        }`}
                      >
                        {translate(catalog, 'tech.requires')}: Milestone {milestoneName}
                      </div>
                    </div>
                  </div>

                  {/* Unlock Button */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
                    {isUnlocked ? (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Check size={14} aria-hidden="true" /> {translate(catalog, 'tech.researched')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!prereqMet || !milestoneMet || !canAfford}
                        onClick={() => onUnlockTech(node.id, node.cost)}
                        className={`min-h-[44px] px-4 rounded-xl text-xs font-bold transition-all ${
                          prereqMet && milestoneMet && canAfford
                            ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-md cursor-pointer'
                            : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        {!prereqMet
                          ? translate(catalog, 'tech.prerequisiteLocked')
                          : !milestoneMet
                          ? translate(catalog, 'tech.milestoneLocked')
                          : !canAfford
                          ? translate(catalog, 'tech.insufficientFunds')
                          : translate(catalog, 'tech.research')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
