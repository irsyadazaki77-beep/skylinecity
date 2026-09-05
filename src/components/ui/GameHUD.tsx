import React from 'react';
import { Bell, Smile, Target, Calendar } from 'lucide-react';
import { MILESTONES } from '../../progression';
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
  language,
}: GameHUDProps) {
  const safePopulation = Math.max(0, isNaN(population) || !isFinite(population) ? 0 : population);
  const safeMoney = isNaN(money) || !isFinite(money) ? 0 : money;
  const netIncome = income - expenses;
  const safeNetIncome = isNaN(netIncome) || !isFinite(netIncome) ? 0 : netIncome;
  const currentMilestone = MILESTONES[milestoneLevel] || MILESTONES[0];
  const milestoneLabel = milestoneLevel === 0 ? 'Desa' : currentMilestone.name;

  return (
    <header className="game-hud absolute top-0 left-0 right-0 z-30 pointer-events-none p-3 md:p-4 flex justify-between items-start select-none">
      
      {/* TOP LEFT: City Designation & Milestone */}
      <div className="game-hud-left pointer-events-auto flex flex-col gap-2">
        <div className="flex flex-col">
          <h1 className="text-white font-bold text-base md:text-lg tracking-tight drop-shadow-sm">
            Skyline Simulator
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-md bg-cyan-950/70 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
              <Target size={12} className="text-cyan-400" />
              <span>{milestoneLabel}</span>
            </span>
          </div>
        </div>
      </div>

      {/* TOP CENTER: Exactly 3 Primary Metrics */}
      <div className="game-hud-center pointer-events-auto flex items-center bg-[#0c1424]/92 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 gap-4 md:gap-8 shadow-xl">
        {/* Metric 1: Population */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] md:text-[11px] text-slate-400 font-medium tracking-wide">
            Populasi
          </span>
          <span className="text-white font-bold font-mono text-sm md:text-base tabular-nums">
            {safePopulation.toLocaleString()}
          </span>
        </div>
        
        <div className="w-px h-7 bg-white/10" />
        
        {/* Metric 2: City Treasury & Daily Net Flow */}
        <button
          type="button"
          aria-label="Buka kas kota dan treasury"
          className="flex flex-col items-center cursor-pointer hover:bg-white/5 px-2.5 py-1 rounded-lg transition-colors min-h-[38px] justify-center"
          onClick={onOpenEconomy}
          title="Klik untuk membuka laporan kas dan pajak"
        >
          <span className="text-[10px] md:text-[11px] text-slate-400 font-medium tracking-wide">
            Kas Kota
          </span>
          <div className="flex items-center gap-1.5 font-mono text-sm md:text-base font-bold tabular-nums">
            <span className="text-amber-300">${safeMoney.toLocaleString()}</span>
            <span className={`text-[11px] font-bold ${safeNetIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {safeNetIncome >= 0 ? '+' : ''}${safeNetIncome.toLocaleString()}
            </span>
          </div>
        </button>

        <div className="w-px h-7 bg-white/10" />
        
        {/* Metric 3: Citizen Happiness */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] md:text-[11px] text-slate-400 font-medium tracking-wide">
            Kebahagiaan
          </span>
          <div className="flex items-center gap-1.5 font-mono text-sm md:text-base font-bold tabular-nums">
            <Smile
              size={15}
              className={happiness >= 70 ? 'text-emerald-400' : happiness >= 40 ? 'text-amber-400' : 'text-rose-400'}
            />
            <span className="text-white">{happiness}%</span>
          </div>
        </div>
      </div>

      {/* TOP RIGHT: Simulation Calendar, Notifications, Menu */}
      <div className="game-hud-right pointer-events-auto flex items-center gap-2">
        {/* Calendar Badge */}
        <div className="flex items-center gap-1.5 bg-[#0c1424]/92 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 shadow-md">
          <Calendar size={14} className="text-cyan-400" />
          <span className="font-mono tabular-nums">Hari {day} · {String(Math.floor(timeOfDay)).padStart(2, '0')}:00</span>
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
