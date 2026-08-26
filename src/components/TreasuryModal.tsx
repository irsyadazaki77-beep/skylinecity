import React from 'react';
import { CityState, TileType, MAINTENANCE_COSTS } from '../types';
import { FreightCommodity } from '../logistics';
import { X, DollarSign, TrendingUp, TrendingDown, Percent, Landmark } from 'lucide-react';

interface TreasuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: CityState;
  setTaxRates: (res: number, com: number, ind: number) => void;
  onCreateTradeContract?: (commodity: FreightCommodity, direction: 'IMPORT' | 'EXPORT') => void;
  experimentalFeatures?: boolean;
}

export function TreasuryModal({ isOpen, onClose, gameState, setTaxRates, onCreateTradeContract, experimentalFeatures = false }: TreasuryModalProps) {
  if (!isOpen) return null;

  const {
    money,
    income,
    expenses,
    residentialTaxRate = 9,
    commercialTaxRate = 9,
    industrialTaxRate = 9,
    history = [],
    grid,
    tradeContracts = [],
  } = gameState;

  const netCashflow = income - expenses;

  // Calculate detailed upkeep expenses per sector
  let roadUpkeep = 0;
  let powerUpkeep = 0;
  let waterUpkeep = 0;
  let serviceUpkeep = 0;
  let logisticsUpkeep = 0;

  grid.forEach((row) => {
    row.forEach((tile) => {
      const upkeep = MAINTENANCE_COSTS[tile.type] || 0;
      if (tile.type === TileType.ROAD) roadUpkeep += upkeep;
      else if (tile.type === TileType.POWER_PLANT) powerUpkeep += upkeep;
      else if (tile.type === TileType.WATER_PUMP) waterUpkeep += upkeep;
      else if (
        tile.type === TileType.WAREHOUSE ||
        tile.type === TileType.CARGO_TERMINAL ||
        tile.type === TileType.PARKING
      ) logisticsUpkeep += upkeep;
      else if (
        tile.type === TileType.FIRE_STATION ||
        tile.type === TileType.POLICE_STATION ||
        tile.type === TileType.CLINIC ||
        tile.type === TileType.SCHOOL ||
        tile.type === TileType.WASTE_MANAGEMENT ||
        tile.type === TileType.PARK ||
        tile.type === TileType.FLOOD_BARRIER ||
        tile.type === TileType.WATER_RESERVOIR
      ) {
        serviceUpkeep += upkeep;
      }
    });
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-xl text-[#D4AF37]">
              <Landmark size={22} />
            </div>
            <div>
              <h2 className="font-serif italic text-xl text-[#D4AF37]">City Treasury & Budget</h2>
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest">
                Tax Policies & Financial Statement
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

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Main Financial Balance Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Total Treasury</span>
              <span className="font-mono text-2xl font-bold text-white mt-1">
                ${money.toLocaleString()}
              </span>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Tax Revenue / Day</span>
              <span className="font-mono text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <TrendingUp size={20} /> +${income.toLocaleString()}
              </span>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col">
              <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">Net Cashflow</span>
              <span
                className={`font-mono text-2xl font-bold mt-1 flex items-center gap-1 ${
                  netCashflow >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {netCashflow >= 0 ? '+' : ''}${netCashflow.toLocaleString()}
              </span>
            </div>
          </div>

          {history.length > 1 && (
            <div className="space-y-3 rounded-xl border border-white/5 bg-black/25 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-300">City Timeline</h3>
                <span className="text-[10px] font-mono text-slate-500">Last {Math.min(12, history.length)} days</span>
              </div>
              <div className="flex h-24 items-end gap-1.5">
                {history.slice(-12).map((record) => {
                  const maxPopulation = Math.max(1, ...history.slice(-12).map((item) => item.population));
                  const height = Math.max(4, Math.round((record.population / maxPopulation) * 100));
                  return (
                    <div key={record.day} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                      <div className="w-full rounded-t bg-cyan-400/60 transition-colors group-hover:bg-cyan-300" style={{ height: `${height}%` }} title={`Day ${record.day}: ${record.population} residents`} />
                      <span className="text-[8px] font-mono text-slate-500">{record.day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400">
                <span>Population <b className="text-cyan-200">{history.at(-1)?.population ?? 0}</b></span>
                <span>Traffic <b className="text-amber-200">{Math.round(history.at(-1)?.trafficAverage ?? 0)}%</b></span>
                <span>Happiness <b className="text-emerald-200">{Math.round(history.at(-1)?.happiness ?? 0)}%</b></span>
              </div>
            </div>
          )}

          {experimentalFeatures && <div className="space-y-3 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-violet-300">Persistent Trade Contracts</h3>
              <span className="text-[10px] font-mono text-slate-500">{tradeContracts.filter((contract) => contract.active).length} active</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['FOOD', 'GOODS', 'MATERIALS', 'FUEL'] as FreightCommodity[]).map((commodity) => (
                <div key={commodity} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-[10px] font-mono text-slate-300">{commodity}</div>
                  <div className="mt-1 flex gap-1">
                    <button type="button" onClick={() => onCreateTradeContract?.(commodity, 'IMPORT')} className="flex-1 rounded border border-cyan-300/20 px-1.5 py-1 text-[9px] text-cyan-200 hover:bg-cyan-400/10">Import</button>
                    <button type="button" onClick={() => onCreateTradeContract?.(commodity, 'EXPORT')} className="flex-1 rounded border border-emerald-300/20 px-1.5 py-1 text-[9px] text-emerald-200 hover:bg-emerald-400/10">Export</button>
                  </div>
                </div>
              ))}
            </div>
            {tradeContracts.filter((contract) => contract.active).slice(0, 4).map((contract) => (
              <div key={contract.id} className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{contract.direction} · {contract.commodity}</span>
                <span className="font-mono text-violet-200">{contract.remainingDays}d · {Math.round(contract.reliability)}%</span>
              </div>
            ))}
          </div>}
          {!experimentalFeatures && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
              Kontrak perdagangan lanjutan tersedia di <span className="text-fuchsia-200">Fitur Experimental</span> pada Settings.
            </div>
          )}

          {/* Tax Sliders Section */}
          <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/5">
            <h3 className="text-xs uppercase font-mono tracking-widest font-bold text-[#D4AF37] flex items-center gap-2">
              <Percent size={14} /> Sector Tax Rates
            </h3>

            <div className="space-y-3">
              {/* Residential Tax */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold">Residential Tax</span>
                  <span>{residentialTaxRate}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={residentialTaxRate}
                  onChange={(e) =>
                    setTaxRates(Number(e.target.value), commercialTaxRate, industrialTaxRate)
                  }
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                />
              </div>

              {/* Commercial Tax */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-blue-400 font-bold">Commercial Tax</span>
                  <span>{commercialTaxRate}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={commercialTaxRate}
                  onChange={(e) =>
                    setTaxRates(residentialTaxRate, Number(e.target.value), industrialTaxRate)
                  }
                  className="w-full accent-blue-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                />
              </div>

              {/* Industrial Tax */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-amber-400 font-bold">Industrial Tax</span>
                  <span>{industrialTaxRate}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={industrialTaxRate}
                  onChange={(e) =>
                    setTaxRates(residentialTaxRate, commercialTaxRate, Number(e.target.value))
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Detailed Expense Breakdown */}
          <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
            <h3 className="text-xs uppercase font-mono tracking-widest font-bold text-gray-300">
              City Operations Upkeep Breakdown
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="flex justify-between p-2 bg-black/20 rounded-lg">
                <span className="text-gray-400">Road Infrastructure</span>
                <span className="text-red-300">-${roadUpkeep}</span>
              </div>
              <div className="flex justify-between p-2 bg-black/20 rounded-lg">
                <span className="text-gray-400">Power Utilities</span>
                <span className="text-red-300">-${powerUpkeep}</span>
              </div>
              <div className="flex justify-between p-2 bg-black/20 rounded-lg">
                <span className="text-gray-400">Water Network</span>
                <span className="text-red-300">-${waterUpkeep}</span>
              </div>
              <div className="flex justify-between p-2 bg-black/20 rounded-lg">
                <span className="text-gray-400">Public Services & Parks</span>
                <span className="text-red-300">-${serviceUpkeep}</span>
              </div>
              <div className="flex justify-between p-2 bg-black/20 rounded-lg">
                <span className="text-gray-400">Logistics & Parking</span>
                <span className="text-red-300">-${logisticsUpkeep}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-black/40 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#D4AF37] text-black font-bold font-mono text-xs uppercase tracking-wider rounded-xl hover:bg-[#c29f2e] transition-colors"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
