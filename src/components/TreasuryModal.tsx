import React, { useEffect } from 'react';
import { CityState, TileType, MAINTENANCE_COSTS } from '../types';
import { FreightCommodity } from '../logistics';
import { X, TrendingUp, Percent, Landmark } from 'lucide-react';
import { useModalFocus } from './ui/useModalFocus';

interface TreasuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: CityState;
  setTaxRates: (res: number, com: number, ind: number) => void;
  onCreateTradeContract?: (commodity: FreightCommodity, direction: 'IMPORT' | 'EXPORT') => void;
  experimentalFeatures?: boolean;
}

export function TreasuryModal({ isOpen, onClose, gameState, setTaxRates, onCreateTradeContract, experimentalFeatures = false }: TreasuryModalProps) {
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
  const operatingBudget = gameState.operatingBudget ?? netCashflow;
  const municipalDebt = gameState.municipalDebt ?? 0;
  const runwayDays = netCashflow < 0 ? Math.floor(Math.max(0, money) / Math.abs(netCashflow)) : Infinity;

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
        aria-labelledby="treasury-modal-title"
        className="bg-[#0d1420] border border-[var(--border-subtle)] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-white flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--accent-cyan)]/15 border border-[var(--accent-cyan)]/30 rounded-xl text-[var(--accent-cyan)]">
              <Landmark size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="treasury-modal-title" className="text-lg font-bold text-white tracking-tight">
                Kas & Anggaran Kota
              </h2>
              <p className="text-xs text-slate-400">
                Kebijakan Pajak & Laporan Keuangan
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup jendela anggaran kota"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Main Financial Balance Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="bg-white/[0.04] p-3.5 rounded-xl border border-white/10 flex flex-col">
              <span className="text-[11px] font-medium text-slate-400">Kas Kota</span>
              <span className="font-mono text-xl font-bold text-white mt-1">
                ${money.toLocaleString()}
              </span>
            </div>

            <div className="bg-white/[0.04] p-3.5 rounded-xl border border-white/10 flex flex-col">
              <span className="text-[11px] font-medium text-slate-400">Penerimaan / Hari</span>
              <span className="font-mono text-xl font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <TrendingUp size={16} aria-hidden="true" /> +${income.toLocaleString()}
              </span>
            </div>

            <div className="bg-white/[0.04] p-3.5 rounded-xl border border-white/10 flex flex-col">
              <span className="text-[11px] font-medium text-slate-400">Arus Kas Bersih</span>
              <span
                className={`font-mono text-xl font-bold mt-1 flex items-center gap-1 ${
                  netCashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {netCashflow >= 0 ? '+' : ''}${netCashflow.toLocaleString()}
              </span>
            </div>

            <div className="bg-white/[0.04] p-3.5 rounded-xl border border-white/10 flex flex-col">
              <span className="text-[11px] font-medium text-slate-400">Daya Tahan Kas</span>
              <span className={`font-mono text-xl font-bold mt-1 ${runwayDays < 7 ? 'text-rose-300' : runwayDays < 30 ? 'text-amber-300' : 'text-cyan-200'}`}>
                {Number.isFinite(runwayDays) ? `${runwayDays} hari` : 'Aman (∞)'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">{operatingBudget >= 0 ? 'Kas surplus' : 'Hari menuju defisit'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-black/25 p-3 text-xs text-slate-400 sm:grid-cols-4">
            <div>Anggaran operasional: <b className={`font-mono ${operatingBudget >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>${operatingBudget.toLocaleString()}</b></div>
            <div>Anggaran modal: <b className="font-mono text-cyan-200">${(gameState.capitalBudget ?? money).toLocaleString()}</b></div>
            <div>Utang kota: <b className="font-mono text-slate-300">${municipalDebt.toLocaleString()}</b></div>
            <div>Pajak wajar: <b className="font-mono text-emerald-300">9%</b></div>
          </div>

          {history.length > 1 && (
            <div className="space-y-3 rounded-xl border border-white/5 bg-black/25 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Linimasa Tren Populasi</h3>
                <span className="text-xs text-slate-500">{Math.min(12, history.length)} hari terakhir</span>
              </div>
              <div className="flex h-24 items-end gap-1.5 pt-2">
                {history.slice(-12).map((record) => {
                  const maxPopulation = Math.max(1, ...history.slice(-12).map((item) => item.population));
                  const height = Math.max(6, Math.round((record.population / maxPopulation) * 100));
                  return (
                    <div key={record.day} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                      <div className="w-full rounded-t bg-[var(--accent-cyan)]/70 transition-colors group-hover:bg-[var(--accent-cyan)]" style={{ height: `${height}%` }} title={`Hari ${record.day}: ${record.population} jiwa`} />
                      <span className="text-[9px] font-mono text-slate-500">{record.day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 pt-2 border-t border-white/5">
                <div>Populasi: <b className="font-mono text-cyan-200">{history.at(-1)?.population ?? 0}</b></div>
                <div>Kemacetan: <b className="font-mono text-amber-300">{Math.round(history.at(-1)?.trafficAverage ?? 0)}%</b></div>
                <div>Kebahagiaan: <b className="font-mono text-emerald-300">{Math.round(history.at(-1)?.happiness ?? 0)}%</b></div>
              </div>
            </div>
          )}

          {experimentalFeatures && (
            <div className="space-y-3 rounded-xl border border-[var(--accent-cyan)]/20 bg-[var(--accent-cyan)]/5 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-cyan)]">Kontrak Perdagangan Kota</h3>
                <span className="text-xs text-slate-400">{tradeContracts.filter((contract) => contract.active).length} aktif</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['FOOD', 'GOODS', 'MATERIALS', 'FUEL'] as FreightCommodity[]).map((commodity) => (
                  <div key={commodity} className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                    <div className="text-xs font-semibold text-slate-300">{commodity}</div>
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" onClick={() => onCreateTradeContract?.(commodity, 'IMPORT')} className="flex-1 min-h-[36px] rounded-lg border border-cyan-300/30 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-400/10 font-medium">Impor</button>
                      <button type="button" onClick={() => onCreateTradeContract?.(commodity, 'EXPORT')} className="flex-1 min-h-[36px] rounded-lg border border-emerald-300/30 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-400/10 font-medium">Ekspor</button>
                    </div>
                  </div>
                ))}
              </div>
              {tradeContracts.filter((contract) => contract.active).slice(0, 4).map((contract) => (
                <div key={contract.id} className="flex items-center justify-between text-xs text-slate-400">
                  <span>{contract.direction} · {contract.commodity}</span>
                  <span className="font-mono text-cyan-300">{contract.remainingDays} hari · {Math.round(contract.reliability)}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Tax Sliders Section */}
          <div className="space-y-4 bg-black/30 p-4 rounded-xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Percent size={14} aria-hidden="true" /> 
              <span>Tarif Pajak Sektoral</span>
            </h3>

            <div className="space-y-4">
              {/* Residential Tax */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-400 font-semibold">Pajak Pemukiman (Hunian)</span>
                  <span className="font-mono font-bold text-white">{residentialTaxRate}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  aria-label="Pajak Pemukiman"
                  value={residentialTaxRate}
                  onChange={(e) =>
                    setTaxRates(Number(e.target.value), commercialTaxRate, industrialTaxRate)
                  }
                  className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Commercial Tax */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-cyan-400 font-semibold">Pajak Komersial (Pertokoan)</span>
                  <span className="font-mono font-bold text-white">{commercialTaxRate}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  aria-label="Pajak Komersial"
                  value={commercialTaxRate}
                  onChange={(e) =>
                    setTaxRates(residentialTaxRate, Number(e.target.value), industrialTaxRate)
                  }
                  className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
              </div>

              {/* Industrial Tax */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-amber-400 font-semibold">Pajak Industri (Pabrik)</span>
                  <span className="font-mono font-bold text-white">{industrialTaxRate}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  aria-label="Pajak Industri"
                  value={industrialTaxRate}
                  onChange={(e) =>
                    setTaxRates(residentialTaxRate, commercialTaxRate, Number(e.target.value))
                  }
                  className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Revenue Streams Breakdown */}
          <div className="space-y-3 bg-white/[0.03] p-4 rounded-xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Rincian Sumber Penerimaan Kota
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Pajak Hunian ({residentialTaxRate}%)</span>
                <span className="font-mono font-semibold text-emerald-300">+${Math.round(gameState.population * (residentialTaxRate / 9) * 2)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Pajak Usaha & Industri</span>
                <span className="font-mono font-semibold text-emerald-300">+${Math.round((gameState.availableJobs || 0) * ((commercialTaxRate + industrialTaxRate) / 18) * 3)}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Tiket Transit Bus/Tram</span>
                <span className="font-mono font-semibold text-cyan-300">+${gameState.transitFareRevenue ?? 0}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Perdagangan & Wisata</span>
                <span className="font-mono font-semibold text-amber-300">+${Math.max(0, income - (gameState.transitFareRevenue ?? 0) - Math.round(gameState.population * (residentialTaxRate / 9) * 2))}</span>
              </div>
            </div>
          </div>

          {/* Detailed Expense Breakdown */}
          <div className="space-y-3 bg-white/[0.03] p-4 rounded-xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Rincian Biaya Operasional Kota
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Infrastruktur Jalan</span>
                <span className="font-mono font-semibold text-rose-300">-${roadUpkeep}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Utilitas Listrik</span>
                <span className="font-mono font-semibold text-rose-300">-${powerUpkeep}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Jaringan Air</span>
                <span className="font-mono font-semibold text-rose-300">-${waterUpkeep}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Layanan Publik & Fasilitas</span>
                <span className="font-mono font-semibold text-rose-300">-${serviceUpkeep}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Logistik & Parkir</span>
                <span className="font-mono font-semibold text-rose-300">-${logisticsUpkeep}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-black/20 rounded-lg">
                <span className="text-slate-400">Armada Layanan & Transit</span>
                <span className="font-mono font-semibold text-rose-300">-${gameState.transitOperatingCost ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Causal Fiscal Diagnostics */}
          <div className={`p-4 rounded-xl border text-xs leading-relaxed ${netCashflow < 0 ? 'bg-rose-950/20 border-rose-500/30 text-rose-200' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'}`}>
            <div className="font-bold mb-1 flex items-center justify-between">
              <span>{netCashflow < 0 ? '⚠️ Peringatan Defisit Fiskal' : '✓ Diagnosis Fiskal Kota'}</span>
              <span className="font-mono">{netCashflow < 0 ? `Daya Tahan: ${runwayDays === Infinity ? 'Aman' : `${runwayDays} hari`}` : 'Arus Kas Positif'}</span>
            </div>
            {netCashflow < 0 ? (
              <div className="space-y-1 text-slate-300 text-xs">
                <p><strong className="text-rose-300">Masalah:</strong> Pengeluaran operasional kota melampaui penerimaan sebesar -${Math.abs(netCashflow)}/hari.</p>
                <p><strong className="text-amber-300">Penyebab:</strong> Biaya pemeliharaan fasilitas (${expenses}/hari) lebih besar dari penerimaan pajak (${income}/hari).</p>
                <p><strong className="text-emerald-300">Rekomendasi:</strong> Naikkan pajak 1-2% atau perluas zona produktif agar tidak terjadi kebangkrutan kas.</p>
              </div>
            ) : (
              <div className="space-y-1 text-slate-300 text-xs">
                <p><strong className="text-emerald-300">Kondisi:</strong> Anggaran operasional menghasilkan surplus +${netCashflow}/hari.</p>
                <p><strong className="text-cyan-300">Potensi:</strong> Kas surplus dapat digunakan untuk memperluas jaringan jalan, fasilitas publik, atau riset teknologi.</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 sm:px-6 py-3 bg-black/40 border-t border-white/10 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl bg-[var(--accent-cyan)] text-slate-950 font-bold text-xs hover:opacity-90 transition-opacity shadow-md"
          >
            Terapkan & Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
