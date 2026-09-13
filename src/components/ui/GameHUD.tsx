import React from 'react';
import { Bell, Smile, Target, Calendar, Infinity as InfinityIcon } from 'lucide-react';
import { getNextLivingCityUnlock, MILESTONES } from '../../progression';
import { GameMenu } from './GameMenu';
import type { SupportedLanguage } from '../../localization';

interface GameHUDProps {
  population: number;
  money: number;
  income: number;
  expenses: number;
  day: number;
  timeOfDay?: number;
  milestoneLevel: number;
  happiness: number;
  unreadNotificationsCount: number;
  onToggleNotifications: () => void;
  onOpenCityInfo: () => void;
  onOpenEconomy: () => void;
  onOpenTech: () => void;
  onOpenPolicies: () => void;
  onOpenDistricts: () => void;
  onOpenObjectives: () => void;
  onOpenSaveLoad: () => void;
  onOpenSettings: () => void;
  onNewGame: () => void;
  language?: SupportedLanguage;
  unlimitedMoney?: boolean;
}

export function GameHUD({
  population,
  money,
  income,
  expenses,
  day,
  timeOfDay = 6,
  milestoneLevel,
  happiness,
  unreadNotificationsCount,
  onToggleNotifications,
  onOpenCityInfo,
  onOpenEconomy,
  onOpenTech,
  onOpenPolicies,
  onOpenDistricts,
  onOpenObjectives,
  onOpenSaveLoad,
  onOpenSettings,
  onNewGame,
  language = 'id',
  unlimitedMoney = false,
}: GameHUDProps) {
  const safePopulation = Math.max(0, isNaN(population) || !isFinite(population) ? 0 : population);
  const safeMoney = isNaN(money) || !isFinite(money) ? 0 : money;
  const netIncome = income - expenses;
  const safeNetIncome = isNaN(netIncome) || !isFinite(netIncome) ? 0 : netIncome;
  const currentMilestone = MILESTONES[milestoneLevel] || MILESTONES[0];
  const milestoneLabel = milestoneLevel === 0 ? (language === 'en' ? 'Settlement' : 'Desa') : currentMilestone.name;
  const nextUnlock = getNextLivingCityUnlock({ population: safePopulation });

  // Dynamic Delta Ticker for Money and Population
  const prevMoneyRef = React.useRef(safeMoney);
  const prevPopRef = React.useRef(safePopulation);
  const [moneyDelta, setMoneyDelta] = React.useState<number | null>(null);
  const [popDelta, setPopDelta] = React.useState<number | null>(null);

  React.useEffect(() => {
    const diff = safeMoney - prevMoneyRef.current;
    if (Math.abs(diff) >= 1) {
      setMoneyDelta(diff);
      const timer = setTimeout(() => setMoneyDelta(null), 1800);
      prevMoneyRef.current = safeMoney;
      return () => clearTimeout(timer);
    }
    prevMoneyRef.current = safeMoney;
  }, [safeMoney]);

  React.useEffect(() => {
    const diff = safePopulation - prevPopRef.current;
    if (diff !== 0) {
      setPopDelta(diff);
      const timer = setTimeout(() => setPopDelta(null), 2000);
      prevPopRef.current = safePopulation;
      return () => clearTimeout(timer);
    }
    prevPopRef.current = safePopulation;
  }, [safePopulation]);

  const unlockProgress = nextUnlock?.populationRequired
    ? Math.min(100, Math.round((safePopulation / nextUnlock.populationRequired) * 100))
    : 100;

  return (
    <header className="game-hud" data-ui-layer="top-hud" data-city-day={day} data-city-population={safePopulation} aria-label="Ringkasan kota">
      
      {/* TOP LEFT: City Designation & Milestone */}
      <div className="game-hud-left pointer-events-auto flex flex-col gap-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-white font-bold text-sm sm:text-base tracking-tight">
              Skyline <span className="font-medium text-slate-400">/ {milestoneLabel}</span>
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md bg-cyan-950/70 border border-cyan-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-200">
              <Target size={11} className="text-cyan-400" />
              <span>Tk.{milestoneLevel}</span>
            </span>
          </div>

          {nextUnlock?.populationRequired && (
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5" title={nextUnlock.worldChange}>
              <span className="truncate max-w-[130px] sm:max-w-none">{nextUnlock.title}</span>
              <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/10 hidden sm:block">
                <div className="bg-cyan-400 h-full rounded-full transition-all duration-300" style={{ width: `${unlockProgress}%` }} />
              </div>
              <span className="font-mono text-cyan-300 text-[9px]">{unlockProgress}%</span>
            </div>
          )}
        </div>
      </div>

      {/* TOP CENTER: Exactly 3 Primary Metrics with Floating Visual Cues */}
      <div className="game-hud-center pointer-events-auto relative" aria-label="Metrik utama kota">
        {/* Metric 1: Population */}
        <div className="hud-metric flex flex-col items-center relative" aria-label={`Populasi ${safePopulation.toLocaleString()}`}>
          <span className="text-[10px] md:text-[11px] text-slate-400 font-medium tracking-wide">
            {language === 'en' ? 'Population' : 'Populasi'}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-white font-bold font-mono text-sm md:text-base tabular-nums">
              {safePopulation.toLocaleString()}
            </span>
            {popDelta !== null && (
              <span className={`floating-ticker absolute -top-3 right-0 text-[10px] font-bold ${popDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {popDelta > 0 ? `+${popDelta}` : popDelta}
              </span>
            )}
          </div>
          <span className="hud-trend hud-trend-neutral text-[9px]" aria-label="Tren populasi stabil">• stabil</span>
        </div>
        
        <div className="w-px h-7 bg-white/10" />
        
        {/* Metric 2: City Treasury & Daily Net Flow */}
        <button
          type="button"
          aria-label="Buka kas kota dan treasury"
          className="hud-metric flex flex-col items-center cursor-pointer hover:bg-white/5 px-2.5 py-0.5 rounded-lg transition-colors min-h-[38px] justify-center relative"
          onClick={onOpenEconomy}
          title={language === 'en' ? 'Click to open Treasury & Tax overview' : 'Klik untuk membuka laporan kas dan pajak'}
        >
          <span className="text-[10px] md:text-[11px] text-slate-400 font-medium tracking-wide flex items-center gap-1">
            {language === 'en' ? 'Treasury' : 'Kas Kota'}
            {unlimitedMoney && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-1 rounded font-bold uppercase tracking-wider">
                ∞
              </span>
            )}
          </span>
          <div className="flex items-center gap-1.5 font-mono text-sm md:text-base font-bold tabular-nums">
            {unlimitedMoney ? (
              <span className="text-amber-300 flex items-center gap-1">
                $<InfinityIcon size={16} className="inline stroke-[2.5]" />
              </span>
            ) : (
              <span className="text-amber-300">${safeMoney.toLocaleString()}</span>
            )}
            <span className={`text-[10px] sm:text-[11px] font-bold ${safeNetIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {safeNetIncome >= 0 ? '+' : ''}${safeNetIncome.toLocaleString()}
            </span>
            {moneyDelta !== null && !unlimitedMoney && (
              <span className={`floating-ticker absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-bold ${moneyDelta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {moneyDelta > 0 ? `+$${moneyDelta.toLocaleString()}` : `-$${Math.abs(moneyDelta).toLocaleString()}`}
              </span>
            )}
          </div>
          <span className={`hud-trend ${safeNetIncome >= 0 ? 'hud-trend-positive text-emerald-400' : 'hud-trend-negative text-rose-400'}`} aria-label={`Tren kas ${safeNetIncome >= 0 ? 'naik' : 'turun'}`}>
            {safeNetIncome >= 0 ? '↗ surplus' : '↘ defisit'}
          </span>
        </button>

        <div className="w-px h-7 bg-white/10" />
        
        {/* Metric 3: Citizen Happiness */}
        <div className="hud-metric flex flex-col items-center" aria-label={`Kebahagiaan ${happiness}%`}>
          <span className="text-[10px] md:text-[11px] text-slate-400 font-medium tracking-wide">
            {language === 'en' ? 'Happiness' : 'Kebahagiaan'}
          </span>
          <div className="flex items-center gap-1.5 font-mono text-sm md:text-base font-bold tabular-nums">
            <Smile
              size={15}
              className={happiness >= 70 ? 'text-emerald-400' : happiness >= 40 ? 'text-amber-400' : 'text-rose-400'}
            />
            <span className="text-white">{happiness}%</span>
          </div>
          <span className={`hud-trend ${happiness >= 60 ? 'hud-trend-positive text-emerald-400' : 'hud-trend-negative text-amber-400'}`} aria-label={`Tren kebahagiaan ${happiness >= 60 ? 'stabil positif' : 'perlu perhatian'}`}>
            {happiness >= 70 ? '• sejahtera' : happiness >= 50 ? '• stabil' : '• perhatian'}
          </span>
        </div>
      </div>

      {/* TOP RIGHT: Simulation Calendar, Notifications, Menu */}
      <div className="game-hud-right pointer-events-auto" aria-label="Waktu, notifikasi, dan menu kota">
        {/* Calendar Badge */}
        <div className="flex items-center gap-1.5 bg-[#0c1424]/92 backdrop-blur-xl border border-white/10 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-200 shadow-md">
          <Calendar size={13} className="text-cyan-400" />
          <span className="font-mono tabular-nums">{language === 'en' ? 'Day' : 'Hari'} {day} · {String(Math.floor(timeOfDay)).padStart(2, '0')}:00</span>
        </div>

        {/* Notifications Button (Min 44x44px Touch Target) */}
        <button
          type="button"
          onClick={onToggleNotifications}
          aria-label={`Notifikasi kota${unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount} belum dibaca)` : ''}`}
          title="Buka notifikasi kota"
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#0c1424]/92 backdrop-blur-xl border border-white/10 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-all relative shadow-md ${
            unreadNotificationsCount > 0 ? 'text-cyan-300 border-cyan-500/40' : ''
          }`}
        >
          <Bell size={18} className={unreadNotificationsCount > 0 ? 'animate-bounce text-cyan-400' : ''} />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-cyan-500 text-slate-950 text-[10px] font-mono font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-[#070b14]">
              {unreadNotificationsCount}
            </span>
          )}
        </button>
        
        {/* Game Management Menu */}
        <GameMenu
          onOpenCityInfo={onOpenCityInfo}
          onOpenEconomy={onOpenEconomy}
          onOpenTech={onOpenTech}
          onOpenPolicies={onOpenPolicies}
          onOpenDistricts={onOpenDistricts}
          onOpenObjectives={onOpenObjectives}
          onOpenSaveLoad={onOpenSaveLoad}
          onOpenSettings={onOpenSettings}
          onNewGame={onNewGame}
          language={language}
        />
      </div>

    </header>
  );
}
