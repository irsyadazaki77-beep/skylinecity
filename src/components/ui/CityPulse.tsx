import React from 'react';
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BookOpen, Crosshair, Info, Siren } from 'lucide-react';
import { CausalDiagnostic } from '../../types';
import type { CitizenStory } from '../../citizenStories';
import { createLocalizationCatalog, SupportedLanguage, translate } from '../../localization';

export interface CityPulseDelta {
  population: number;
  money: number;
  income: number;
  expenses: number;
  happiness: number;
  congestion: number;
  commute: number;
}

interface CityPulseProps {
  day: number;
  diagnostics: CausalDiagnostic[];
  citizenStory?: CitizenStory;
  delta: CityPulseDelta;
  onOpenInfo: () => void;
  onFocusLocation: (location: { x: number; y: number }) => void;
  language?: SupportedLanguage;
}

function CitizenStoryCard({ story, onFocusLocation }: { story: CitizenStory; onFocusLocation: CityPulseProps['onFocusLocation'] }) {
  const resolved = story.status === 'RESOLVED';
  return (
    <article className={`rounded-xl border p-2.5 ${resolved ? 'border-emerald-400/20 bg-emerald-500/[0.06]' : 'border-sky-400/20 bg-sky-500/[0.06]'}`}>
      <div className="flex items-start gap-2">
        <BookOpen size={14} className={`mt-0.5 shrink-0 ${resolved ? 'text-emerald-300' : 'text-sky-300'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-semibold text-slate-100">{story.title}</h3>
            <span className="font-mono text-[8px] uppercase text-slate-500">Kisah warga · {story.status}</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-300">{story.summary}</p>
          <p className="mt-1 text-[9px] italic text-slate-400">Penyebab: {story.cause}</p>
          <p className="mt-1 text-[9px] text-amber-100">Dampak: {story.impact}</p>
          <p className="mt-1 rounded-md border border-white/10 bg-black/10 px-2 py-1 text-[9px] leading-relaxed text-cyan-100">Pilihan: {story.choice}</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[8.5px]">
            <span className="text-emerald-300">Biaya: {story.estimatedCost === 0 ? 'Tidak langsung' : `~$${story.estimatedCost.toLocaleString()}`}</span>
            <span className="text-sky-200">Perkiraan: {story.projectedOutcome}</span>
            <button type="button" onClick={() => onFocusLocation(story.location)} className="inline-flex items-center gap-1 rounded-md border border-sky-300/25 bg-sky-400/10 px-2 py-1 font-semibold text-sky-200 hover:bg-sky-400/20">
              <Crosshair size={10} /> Fokus ({story.location.x},{story.location.y})
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatSigned(value: number, digits = 0): string {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(digits)}`;
}

function DeltaChip({ label, value, digits = 0, inverse = false }: { label: string; value: number; digits?: number; inverse?: boolean }) {
  const positive = value > 0.001;
  const negative = value < -0.001;
  const favorable = inverse ? negative : positive;
  const color = positive || negative
    ? favorable ? 'text-emerald-300' : 'text-rose-300'
    : 'text-slate-400';
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 flex items-center gap-1 font-mono text-[11px] font-semibold ${color}`}>
        {positive ? <ArrowUpRight size={11} /> : negative ? <ArrowDownRight size={11} /> : null}
        {formatSigned(value, digits)}
      </div>
    </div>
  );
}

function DiagnosticCard({ diagnostic, onFocusLocation, onOpenInfo, language }: {
  diagnostic: CausalDiagnostic;
  onFocusLocation: CityPulseProps['onFocusLocation'];
  onOpenInfo: CityPulseProps['onOpenInfo'];
  language: SupportedLanguage;
}) {
  const catalog = createLocalizationCatalog(language);
  const isCritical = diagnostic.severity === 'CRITICAL';
  const severityColor = isCritical ? 'text-rose-300' : diagnostic.severity === 'WARNING' ? 'text-amber-300' : 'text-cyan-300';
  const borderColor = isCritical ? 'border-rose-400/25 bg-rose-500/[0.07]' : diagnostic.severity === 'WARNING' ? 'border-amber-400/20 bg-amber-500/[0.06]' : 'border-cyan-400/20 bg-cyan-500/[0.05]';
  return (
    <div className={`rounded-xl border p-2.5 ${borderColor}`}>
      <div className="flex items-start gap-2">
        {isCritical ? <Siren size={14} className={`${severityColor} mt-0.5 shrink-0`} /> : <AlertTriangle size={14} className={`${severityColor} mt-0.5 shrink-0`} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate text-[11px] font-semibold ${severityColor}`}>{diagnostic.title}</span>
            <span className="shrink-0 font-mono text-[8px] uppercase text-slate-500">{diagnostic.category}</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-300">{diagnostic.explanation}</p>
          {diagnostic.cause && (
            <p className="mt-1 text-[9px] text-slate-400 italic">
              Penyebab: {diagnostic.cause}
            </p>
          )}
          {diagnostic.recommendation && (
            <p className="mt-1 rounded-md border border-white/10 bg-black/10 px-2 py-1 text-[9px] leading-relaxed text-cyan-100">
              {translate(catalog, 'pulse.next')}: {diagnostic.recommendation}
            </p>
          )}
          {(diagnostic.estimatedCost !== undefined || diagnostic.projectedImpact) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[8.5px]">
              {diagnostic.estimatedCost !== undefined && (
                <span className="rounded bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 font-mono text-emerald-300">
                  Biaya: {diagnostic.estimatedCost === 0 ? 'Gratis / Kebijakan' : `~$${diagnostic.estimatedCost.toLocaleString()}`}
                </span>
              )}
              {diagnostic.projectedImpact && (
                <span className="rounded bg-cyan-950/60 border border-cyan-500/30 px-1.5 py-0.5 text-cyan-200">
                  Dampak: {diagnostic.projectedImpact}
                </span>
              )}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] text-slate-500">
              Nilai {Number.isFinite(diagnostic.value) ? diagnostic.value.toFixed(diagnostic.value % 1 === 0 ? 0 : 1) : '—'}{diagnostic.threshold !== undefined ? ` · batas ${diagnostic.threshold}` : ''}
            </span>
            {diagnostic.location ? (
              <button type="button" onClick={() => onFocusLocation(diagnostic.location!)} className="inline-flex items-center gap-1 rounded-md border border-cyan-300/25 bg-cyan-400/10 px-2 py-1 text-[9px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20" aria-label={`Fokus ${diagnostic.title}`}>
                <Crosshair size={11} /> {translate(catalog, 'pulse.focus')} ({diagnostic.location.x},{diagnostic.location.y})
              </button>
            ) : (
              <button type="button" onClick={onOpenInfo} className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-semibold text-slate-200 transition-colors hover:bg-white/10">
                <Info size={11} /> {translate(catalog, 'pulse.detail')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CityPulse({ day, diagnostics, citizenStory, delta, onOpenInfo, onFocusLocation, language = 'id' }: CityPulseProps) {
  const catalog = createLocalizationCatalog(language);
  const visibleDiagnostics = diagnostics.slice(0, 5);
  const criticalCount = diagnostics.filter((diagnostic) => diagnostic.severity === 'CRITICAL').length;
  const hasDelta = day > 1 && [delta.population, delta.money, delta.income, delta.expenses, delta.happiness, delta.congestion, delta.commute].some((value) => Math.abs(value) > 0.001);

  return (
    <section className="city-pulse fixed left-[9.5rem] top-20 z-30 w-[min(26rem,calc(100vw-11rem))] rounded-2xl border border-white/15 bg-[#0f172a]/94 p-3 text-white shadow-2xl backdrop-blur-xl" aria-label={translate(catalog, 'pulse.title')} aria-live="polite">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className={`grid h-7 w-7 place-items-center rounded-lg ${criticalCount > 0 ? 'bg-rose-500/15 text-rose-300' : diagnostics.length > 0 ? 'bg-amber-500/15 text-amber-300' : 'bg-cyan-500/15 text-cyan-300'}`}>
            {criticalCount > 0 ? <Siren size={15} /> : <Activity size={15} />}
          </span>
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-100">{translate(catalog, 'pulse.title')}</h2>
            <div className="text-[9px] text-slate-500">Perubahan sejak tick terakhir · Hari {day}</div>
          </div>
        </div>
        <button type="button" onClick={onOpenInfo} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white">{translate(catalog, 'pulse.cityInfo')}</button>
      </div>

      {hasDelta && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <DeltaChip label="Warga" value={delta.population} />
          <DeltaChip label="Kas" value={delta.money} />
          <DeltaChip label="Bahagia" value={delta.happiness} digits={1} />
          <DeltaChip label="Macet" value={delta.congestion} digits={1} inverse />
        </div>
      )}

      <div className="mt-2 space-y-2">
        {citizenStory && <CitizenStoryCard story={citizenStory} onFocusLocation={onFocusLocation} />}
        {visibleDiagnostics.length > 0 ? visibleDiagnostics.map((diagnostic) => (
          <DiagnosticCard key={diagnostic.id} diagnostic={diagnostic} onFocusLocation={onFocusLocation} onOpenInfo={onOpenInfo} language={language} />
        )) : (
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] p-2.5 text-[10px] leading-relaxed text-emerald-100">
            {translate(catalog, 'pulse.stable')}
          </div>
        )}
      </div>
    </section>
  );
}
