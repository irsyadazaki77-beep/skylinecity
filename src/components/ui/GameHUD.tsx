import React from 'react';
import { Play, Pause, FastForward, Bell, Smile, Target, Calendar } from 'lucide-react';
import { MILESTONES } from '../../progression';
import { GameMenu } from './GameMenu';

interface GameHUDProps {
  population: number;
  money: number;
  income: number;
  expenses: number;
  speed: number;
  setSpeed: (s: number) => void;
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
}

export function GameHUD({
  population,
  money,
  income,
  expenses,
  speed,
  setSpeed,
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
}: GameHUDProps) {
  const safePopulation = Math.max(0, isNaN(population) || !isFinite(population) ? 0 : population);
  const safeMoney = isNaN(money) || !isFinite(money) ? 0 : money;
  const netIncome = income - expenses;
  const safeNetIncome = isNaN(netIncome) || !isFinite(netIncome) ? 0 : netIncome;
  const currentMilestone = MILESTONES[milestoneLevel] || MILESTONES[0];

  return (
    <div className="game-hud absolute top-0 left-0 right-0 z-40 pointer-events-none p-4 flex justify-between items-start select-none">
      
      {/* TOP LEFT: City Name & Milestone */}
      <div className="game-hud-left pointer-events-auto flex flex-col gap-1">
        <h1 className="text-white font-bold text-xl drop-shadow-md">Skyline Simulator</h1>
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-white text-xs shadow-sm w-max">
          <Target size={14} className="text-blue-400" />
          <span className="font-semibold">{currentMilestone.name}</span>
        </div>
      </div>

      {/* TOP CENTER: Core Stats */}
      <div className="game-hud-center pointer-events-auto flex items-center bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-6 py-2 gap-8 shadow-md">
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Population</span>
          <span className="text-white font-bold text-sm">{safePopulation.toLocaleString()}</span>
        </div>
        
        <div className="w-[1px] h-6 bg-white/10"></div>
        
        <button type="button" aria-label="Buka informasi treasury" className="flex flex-col items-center cursor-pointer hover:bg-white/5 px-2 rounded transition-colors" onClick={onOpenCityInfo}>
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Treasury</span>
          <div className="flex items-center gap-1">
            <span className="text-white font-bold text-sm">${safeMoney.toLocaleString()}</span>
            <span className={`text-[10px] font-bold ${safeNetIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {safeNetIncome >= 0 ? '+' : ''}${safeNetIncome.toLocaleString()}
            </span>
          </div>
        </button>

        <div className="w-[1px] h-6 bg-white/10"></div>
        
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Happiness</span>
          <div className="flex items-center gap-1">
            <Smile size={14} className={happiness >= 70 ? 'text-emerald-400' : happiness >= 40 ? 'text-yellow-400' : 'text-red-400'} />
            <span className="text-white font-bold text-sm">{happiness}%</span>
          </div>
        </div>
      </div>

      {/* TOP RIGHT: Controls & Time */}
      <div className="game-hud-right pointer-events-auto flex flex-col gap-2 items-end">
        <div className="flex items-center bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 gap-2 shadow-md">
          <div className="flex items-center gap-2 text-white font-mono text-xs font-semibold mr-2">
            <Calendar size={14} className="text-gray-400" />
            <span>Day {day} · {String(Math.floor(timeOfDay)).padStart(2, '0')}:00</span>
          </div>
          <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
          <div className="flex items-center gap-1">
            <button aria-label="Pause simulasi" title="Pause (Space / 1)" onClick={() => setSpeed(0)} className={`p-1.5 rounded-full transition-colors ${speed === 0 ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
              <Pause size={14} />
            </button>
            <button aria-label="Kecepatan normal" title="Normal Speed (Space / 2)" onClick={() => setSpeed(1)} className={`p-1.5 rounded-full transition-colors ${speed === 1 ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
              <Play size={14} />
            </button>
            <button aria-label="Kecepatan cepat" title="Fast Speed (3)" onClick={() => setSpeed(2)} className={`p-1.5 rounded-full transition-colors ${speed === 2 ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
              <FastForward size={14} />
            </button>
            <button aria-label="Kecepatan ultra" title="Ultra Fast (4)" onClick={() => setSpeed(3)} className={`p-1.5 rounded-full transition-colors ${speed === 3 ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
              <FastForward size={14} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-1">
          <button
            onClick={onToggleNotifications}
            aria-label={`Notifikasi${unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount} belum dibaca)` : ''}`}
            title="Buka notifikasi"
            className={`p-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-full text-gray-400 hover:text-white transition-all relative ${
              unreadNotificationsCount > 0 ? 'text-blue-400' : ''
            }`}
          >
            <Bell size={16} className={unreadNotificationsCount > 0 ? 'animate-bounce text-blue-400' : ''} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center border border-[#0f172a]">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
          
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
          />
        </div>
      </div>

    </div>
  );
}
