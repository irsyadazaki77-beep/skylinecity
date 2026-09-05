import React, { useEffect } from 'react';
import { 
  Home,
  X, 
  Sparkles, 
  AlertTriangle, 
  Zap, 
  Droplet, 
  Compass, 
  Trash2, 
  ShieldAlert, 
  TreePine, 
  GraduationCap, 
  HeartPulse,
  DollarSign,
  TrendingUp,
  Activity,
  Route,
  Wrench,
  Crosshair,
  Timer,
} from 'lucide-react';
import { BUILD_COSTS, getRoadClass, IntersectionControl, SignalTimingMode, TileData, TileType, TurnMovement } from '../../types';
import { getDensityLabel, getZoneDensity } from '../../zoning';
import { GAME_CONFIG } from '../../config';
import { getServiceUpgradesFor, serviceUpgradeStats } from '../../serviceUpgrades';
import { evaluateBuildingEvolution } from '../../buildingEvolution';
import type { BuildingEvolutionContext, EvolutionStatus } from '../../buildingEvolution';
import { evaluateRoadJunction } from '../../trafficInsights';
import type { RoadJunctionInsight } from '../../trafficInsights';
import type { SupportedLanguage } from '../../localization';
import { useModalFocus } from './useModalFocus';

interface BuildingInspectorProps {
  tile: TileData | null;
  language?: SupportedLanguage;
  onClose: () => void;
  onFocus?: (x: number, y: number) => void;
  onDemolish: (x: number, y: number) => void;
  onUpdateRoadControl?: (x: number, y: number, patch: { intersectionControl?: IntersectionControl; signalTimingMode?: SignalTimingMode; signalOffsetHours?: number; prohibitedTurns?: TurnMovement[] }) => void;
  serviceDepotCondition?: number;
  maintenanceOrderActive?: boolean;
  onOrderMaintenance?: (x: number, y: number) => void;
  recoveryProjectActive?: boolean;
  onStartRecoveryProject?: (x: number, y: number) => void;
  onUpgradeService?: (x: number, y: number, upgradeId: string) => void;
  evolutionContext?: BuildingEvolutionContext;
  roadGrid?: TileData[][];
}

function evolutionStatusLabel(status: EvolutionStatus): string {
  return {
    INACTIVE: 'Layanan terputus',
    ABANDONED: 'Terbengkalai',
    BLOCKED: 'Tertahan',
    PROGRESSING: 'Sedang tumbuh',
    READY: 'Siap naik level',
    MAX_LEVEL: 'Batas level',
  }[status];
}

function evolutionStatusClass(status: EvolutionStatus): string {
  return status === 'READY' ? 'text-emerald-300' : status === 'PROGRESSING' ? 'text-cyan-300' : status === 'MAX_LEVEL' ? 'text-violet-300' : 'text-amber-300';
}

function tileTypeLabel(type: TileType): string {
  const labels: Partial<Record<TileType, string>> = {
    [TileType.EMPTY]: 'Kosong',
    [TileType.ROAD]: 'Jalan',
    [TileType.RESIDENTIAL]: 'Hunian',
    [TileType.COMMERCIAL]: 'Komersial',
    [TileType.OFFICE]: 'Kantor',
    [TileType.INDUSTRIAL]: 'Industri',
    [TileType.POWER_PLANT]: 'Pembangkit Listrik',
    [TileType.WATER_PUMP]: 'Pompa Air',
    [TileType.FIRE_STATION]: 'Pos Pemadam',
    [TileType.POLICE_STATION]: 'Kantor Polisi',
    [TileType.CLINIC]: 'Klinik',
    [TileType.SCHOOL]: 'Sekolah',
    [TileType.WASTE_MANAGEMENT]: 'Pengelolaan Limbah',
    [TileType.WAREHOUSE]: 'Gudang',
    [TileType.CARGO_TERMINAL]: 'Terminal Kargo',
    [TileType.PARK]: 'Taman',
    [TileType.PARKING]: 'Parkir',
    [TileType.FLOOD_BARRIER]: 'Tanggul Banjir',
    [TileType.WATER_RESERVOIR]: 'Waduk Air',
  };
  return labels[type] ?? type.replaceAll('_', ' ').toLowerCase();
}

function mixedUseProgramLabel(program: TileData['mixedUseProgram']): string {
  return {
    RETAIL_LIVING: 'Ritel & Hunian',
    CREATIVE_OFFICE: 'Kantor Kreatif',
    HOSPITALITY: 'Perhotelan',
    COMMUNITY_HUB: 'Pusat Komunitas',
  }[program ?? 'RETAIL_LIVING'];
}

function parcelStatusLabel(status: TileData['parcelStatus']): string {
  return { ZONED: 'Terzonasi', DEVELOPING: 'Berkembang', ACTIVE: 'Aktif', ABANDONED: 'Terbengkalai' }[status ?? 'ZONED'];
}

function parcelOwnershipLabel(ownership: TileData['parcelOwnership']): string {
  return ownership === 'PRIVATE' ? 'Swasta' : 'Kota';
}

function signalStageLabel(stage: TileData['signalStage']): string {
  return { GREEN: 'Hijau', YELLOW: 'Kuning', ALL_RED: 'Semua merah', PEDESTRIAN_CROSSING: 'Penyeberangan', PERMISSIVE: 'Mengalir' }[stage ?? 'PERMISSIVE'];
}

const SERVICE_UPGRADE_COPY: Record<string, { id: [string, string]; en: [string, string] }> = {
  fire_engine_bay: { id: ['Teluk Mesin Tambahan', 'Menambah kapasitas respons pemadam.'], en: ['Extra Engine Bay', 'Adds fire response capacity.'] },
  fire_training: { id: ['Pusat Pelatihan', 'Meningkatkan keandalan dan jangkauan respons pemadam.'], en: ['Training Center', 'Improves fire response reliability and reach.'] },
  ambulance_wing: { id: ['Sayap Ambulans', 'Menambah kapasitas pasien dan keadaan darurat.'], en: ['Ambulance Wing', 'Adds patient and emergency capacity.'] },
  clinic_specialist: { id: ['Unit Spesialis', 'Meningkatkan kualitas cakupan layanan kesehatan.'], en: ['Specialist Unit', 'Improves healthcare coverage quality.'] },
  police_patrol_garage: { id: ['Garasi Patroli', 'Menambah kapasitas patroli polisi.'], en: ['Patrol Garage', 'Adds police patrol capacity.'] },
  police_traffic_unit: { id: ['Unit Lalu Lintas', 'Meningkatkan respons insiden di jalan padat.'], en: ['Traffic Unit', 'Improves incident response on congested roads.'] },
  school_classroom_wing: { id: ['Gedung Kelas', 'Menambah kapasitas siswa.'], en: ['Classroom Wing', 'Adds student capacity.'] },
  school_playground: { id: ['Taman Bermain', 'Meningkatkan pendidikan lokal dan kesejahteraan.'], en: ['Playground', 'Improves local education and wellbeing.'] },
  waste_recycling_line: { id: ['Lini Daur Ulang', 'Menambah kapasitas pengolahan sampah dan mengurangi tekanan lingkungan.'], en: ['Recycling Line', 'Adds waste processing capacity and reduces environmental pressure.'] },
};

function serviceUpgradeCopy(id: string, fallback: string, language: SupportedLanguage | undefined, field: 0 | 1): string {
  const copy = SERVICE_UPGRADE_COPY[id];
  if (!copy) return fallback;
  return copy[language === 'en' ? 'en' : 'id'][field];
}

export function BuildingInspector({ tile, language = 'id', onClose, onFocus, onDemolish, onUpdateRoadControl, serviceDepotCondition, maintenanceOrderActive = false, onOrderMaintenance, recoveryProjectActive = false, onStartRecoveryProject, onUpgradeService, evolutionContext, roadGrid }: BuildingInspectorProps) {
  const dialogRef = useModalFocus<HTMLElement>(Boolean(tile));

  useEffect(() => {
    if (!tile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tile, onClose]);

  if (!tile) return null;

  const isZoned = tile.type === TileType.RESIDENTIAL || tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE || tile.type === TileType.INDUSTRIAL;
  const isRoad = tile.type === TileType.ROAD;
  const isTransit = tile.type === TileType.BUS_DEPOT || tile.type === TileType.TRAM_STATION || tile.type === TileType.BUS_STOP || tile.type === TileType.TRAM_STOP;
  const isWarehouse = tile.type === TileType.WAREHOUSE;
  const isCargoTerminal = tile.type === TileType.CARGO_TERMINAL;
  const isFloodBarrier = tile.type === TileType.FLOOD_BARRIER;
  const isReservoir = tile.type === TileType.WATER_RESERVOIR;
  const isFleetDepot = tile.type === TileType.FIRE_STATION || tile.type === TileType.POLICE_STATION || tile.type === TileType.CLINIC;
  const depotCondition = serviceDepotCondition ?? 100;
  const maintenanceCost = Math.max(25, Math.ceil((100 - depotCondition) * 4));
  const roadClass = getRoadClass(tile);
  const roadProfile = GAME_CONFIG.ROAD_CLASSES[roadClass];
  const isService = [
    TileType.POWER_PLANT,
    TileType.WATER_PUMP,
    TileType.FIRE_STATION,
    TileType.POLICE_STATION,
    TileType.CLINIC,
    TileType.SCHOOL,
    TileType.WASTE_MANAGEMENT,
    TileType.BUS_DEPOT,
    TileType.TRAM_STATION,
    TileType.BUS_STOP,
    TileType.TRAM_STOP,
    TileType.WAREHOUSE,
    TileType.CARGO_TERMINAL,
    TileType.PARK,
  ].includes(tile.type);
  const serviceUpgradeOptions = isService ? getServiceUpgradesFor(tile.type) : [];
  const serviceStats = isService ? serviceUpgradeStats(tile.type, tile.serviceUpgrades) : null;

  const baseCost = BUILD_COSTS[tile.type] || 0;
  const refundAmount = Math.round(baseCost * 0.5);

  // Diagnostic reason why building might be struggling or not growing
  const getGrowthDiagnostics = () => {
    if (!isZoned && !isTransit && !isWarehouse && !isCargoTerminal) return null;

    const reasons: { icon: React.ReactNode; text: string; severity: 'critical' | 'warning' | 'good' }[] = [];

    if (!tile.powered) {
      reasons.push({
        icon: <Zap size={14} className="text-rose-400" />,
        text: 'Tidak ada aliran listrik. Hubungkan jalan ke pembangkit listrik terdekat.',
        severity: 'critical',
      });
    }
    if (isZoned && !tile.watered) {
      reasons.push({
        icon: <Droplet size={14} className="text-rose-400" />,
        text: 'Tidak ada pasokan air. Hubungkan jalan ke pompa air aktif.',
        severity: 'critical',
      });
    }
    if (tile.abandoned) {
      reasons.push({
        icon: <AlertTriangle size={14} className="text-amber-400" />,
        text: 'Bangunan terbengkalai. Pastikan listrik, air, dan akses jalan pulih untuk mengaktifkannya kembali.',
        severity: 'critical',
      });
    }
    if ((tile.pollution ?? 0) > 60) {
      reasons.push({
        icon: <AlertTriangle size={14} className="text-amber-400" />,
        text: 'Tingkat polusi terlalu tinggi, menghambat kebahagiaan dan upgrade.',
        severity: 'warning',
      });
    }
    if ((tile.crime ?? 0) > 40) {
      reasons.push({
        icon: <ShieldAlert size={14} className="text-amber-400" />,
        text: 'Tingkat kriminalitas tinggi. Bangun kantor polisi terdekat.',
        severity: 'warning',
      });
    }

    if (isTransit && tile.powered) {
      reasons.push({
        icon: <Activity size={14} className="text-cyan-400" />,
        text: 'Fasilitas transit aktif. Coverage dan ridership jaringan dihitung pada tick simulasi berikutnya.',
        severity: 'good',
      });
    }

    if (isWarehouse && tile.powered) {
      reasons.push({
        icon: <Activity size={14} className="text-orange-300" />,
        text: 'Gudang aktif. Buffer inventori dan arus pengiriman dihitung oleh sistem logistik.',
        severity: 'good',
      });
    }

    if (isCargoTerminal && tile.powered) {
      reasons.push({
        icon: <Activity size={14} className="text-cyan-300" />,
        text: 'Terminal kargo aktif. Arus gateway dan ekspor surplus dihitung oleh sistem logistik.',
        severity: 'good',
      });
    }

    if (reasons.length === 0 && tile.powered && tile.watered) {
      reasons.push({
        icon: <Sparkles size={14} className="text-emerald-400" />,
        text: 'Bangunan beroperasi optimal dan berkembang dengan baik sesuai permintaan kota.',
        severity: 'good',
      });
    }

    return reasons;
  };

  const diagnostics = getGrowthDiagnostics();
  const evolution = isZoned && evolutionContext ? evaluateBuildingEvolution(tile, evolutionContext) : null;
  const roadInsight: RoadJunctionInsight | null = isRoad && roadGrid ? evaluateRoadJunction(tile, roadGrid) : null;
  const serviceResponseValues = Object.values(tile.serviceResponseTimes ?? {}).filter((value): value is number => Number.isFinite(value));
  const fastestServiceResponse = serviceResponseValues.length > 0 ? Math.min(...serviceResponseValues) : null;

  return (
    <aside 
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="inspector-tile-title"
      className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-5 z-40 max-h-[calc(100vh-6rem)] w-auto sm:w-80 overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[#0d1420]/95 p-4 text-white shadow-2xl backdrop-blur-xl custom-scrollbar animate-in fade-in slide-in-from-bottom-3 duration-200 select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--accent-cyan)] font-semibold">
            Inspeksi Petak ({tile.x + 1}, {tile.y + 1})
          </div>
          <h3 id="inspector-tile-title" className="text-base font-bold text-white mt-0.5 tracking-tight">
            {tileTypeLabel(tile.type)}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onFocus && (
            <button
              type="button"
              onClick={() => onFocus(tile.x, tile.y)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-cyan-300 transition-colors hover:bg-cyan-400/15 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
              aria-label="Fokus ke petak terpilih"
              title="Fokus ke petak terpilih (F)"
            >
              <Crosshair size={18} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]"
            aria-label="Tutup inspeksi petak"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isRoad && onUpdateRoadControl && (
        <div className="my-3 rounded-xl border border-sky-400/20 bg-sky-500/10 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-sky-100">Pengaturan Simpang</span>
            <select
              aria-label="Pengaturan simpang"
              value={tile.intersectionControl ?? 'AUTO'}
              onChange={(event) => onUpdateRoadControl(tile.x, tile.y, { intersectionControl: event.target.value as IntersectionControl })}
              className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-white"
            >
              <option value="AUTO">Otomatis</option>
              <option value="SIGNAL">Sinyal</option>
              <option value="STOP">Rambu Berhenti</option>
              <option value="ROUNDABOUT">Bundaran</option>
            </select>
          </div>
          <div className="text-[10px] leading-tight text-slate-400">Kontrol aktif pada petak yang terdeteksi sebagai simpang 3+ arah.</div>
          {(tile.intersectionControl ?? 'AUTO') !== 'STOP' && (tile.intersectionControl ?? 'AUTO') !== 'ROUNDABOUT' && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-300">Waktu sinyal</span>
              <select
                aria-label="Mode waktu sinyal"
                value={tile.signalTimingMode ?? 'ADAPTIVE'}
                onChange={(event) => onUpdateRoadControl(tile.x, tile.y, { signalTimingMode: event.target.value as SignalTimingMode })}
                className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-white"
              >
                <option value="ADAPTIVE">Tekanan adaptif</option>
                <option value="FIXED_NS">Tetap U-S</option>
                <option value="FIXED_EW">Tetap T-B</option>
              </select>
            </div>
          )}
          {(tile.intersectionControl ?? 'AUTO') !== 'STOP' && (tile.intersectionControl ?? 'AUTO') !== 'ROUNDABOUT' && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-300">Offset fase</span>
              <select
                aria-label="Offset fase sinyal"
                value={tile.signalOffsetHours ?? 0}
                onChange={(event) => onUpdateRoadControl(tile.x, tile.y, { signalOffsetHours: Number(event.target.value) })}
                className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-[11px] text-white"
              >
                {[0, 1, 2, 3, 4, 5].map((hour) => <option key={hour} value={hour}>+{hour} jam</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {(['STRAIGHT', 'LEFT', 'RIGHT', 'U_TURN'] as TurnMovement[]).map((movement) => {
              const restricted = (tile.prohibitedTurns ?? []).includes(movement);
              return (
                <button
                  key={movement}
                  type="button"
                  aria-pressed={restricted}
                  onClick={() => onUpdateRoadControl(tile.x, tile.y, {
                    prohibitedTurns: restricted
                      ? (tile.prohibitedTurns ?? []).filter((item) => item !== movement)
                      : [...(tile.prohibitedTurns ?? []), movement],
                  })}
                  className={`rounded-md border px-2 py-1 text-[10px] font-mono transition-colors ${restricted ? 'border-rose-400/40 bg-rose-500/20 text-rose-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                >
                  {movement === 'U_TURN' ? 'U-turn' : movement[0] + movement.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {roadInsight && (
        <div className="my-3 rounded-xl border border-orange-400/20 bg-orange-500/[0.06] p-3 space-y-2" aria-label="Advisor lalu lintas jalan">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-orange-300 font-mono">Penasihat Lalu Lintas / Simpang</div>
              <div className="text-xs font-semibold text-slate-100">{roadInsight.isIntersection ? `Simpang ${roadInsight.approachCount} arah` : 'Segmen koridor'}</div>
            </div>
            <span className={`text-[10px] font-semibold ${roadInsight.status === 'CRITICAL' ? 'text-rose-300' : roadInsight.status === 'BUSY' ? 'text-amber-300' : 'text-emerald-300'}`}>{roadInsight.status}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <div className="rounded-lg border border-white/10 bg-black/20 p-1.5"><span className="block text-slate-500">Lalu lintas</span><span className="font-mono text-slate-100">{Math.round(roadInsight.trafficPercent)}%</span></div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-1.5"><span className="block text-slate-500">Antrean</span><span className="font-mono text-amber-200">{Math.round(roadInsight.queuePressure)}%</span></div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-1.5"><span className="block text-slate-500">Lajur</span><span className="font-mono text-slate-100">{Math.round(roadInsight.laneUtilization)}%</span></div>
          </div>
          <div className="text-[9px] text-slate-500">Approach: {roadInsight.approaches.length ? roadInsight.approaches.join(' · ') : 'tidak terhubung'} · Kelas: {roadInsight.connectedClasses.join(' / ') || '—'} · Kondisi {Math.round(roadInsight.roadCondition)}%</div>
          <div className="space-y-1 border-t border-white/10 pt-2">
            {roadInsight.recommendations.slice(0, 3).map((recommendation) => <div key={recommendation} className="flex gap-1.5 text-[10px] leading-relaxed text-orange-100"><span className="mt-0.5 text-orange-300">•</span><span>{recommendation}</span></div>)}
          </div>
        </div>
      )}

      {/* Tingkat & progres kapasitas */}
      {isZoned && (
        <div className="my-3 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Tingkat Bangunan</span>
            <span className="font-mono font-bold text-amber-400">Tingkat {tile.level} / 5</span>
          </div>
          <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${tile.upgradeProgress ?? 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
            <span>Progres evolusi</span>
            <span>{tile.upgradeProgress ?? 0}%</span>
          </div>
        </div>
      )}

      {evolution && (
        <div className="my-3 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] p-3 space-y-2" aria-label="Advisor evolusi bangunan">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-cyan-300 font-mono">Advisor Pertumbuhan</div>
              <div className="text-xs font-semibold text-slate-100">
                {evolution.nextLevel ? `Target tingkat ${evolution.nextLevel}` : `Tingkat ${evolution.currentLevel}`}
              </div>
            </div>
            <span className={`text-[10px] font-semibold ${evolutionStatusClass(evolution.status)}`}>{evolutionStatusLabel(evolution.status)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
            <div className="rounded-lg border border-white/10 bg-black/20 p-1.5"><span className="block text-slate-500">Okupansi</span><span className="font-mono text-slate-100">{Math.round(evolution.occupancyPercent)}% / 75%</span></div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-1.5"><span className="block text-slate-500">Permintaan</span><span className={`font-mono ${evolution.demand > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{evolution.demand > 0 ? '+' : ''}{Math.round(evolution.demand)}</span></div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-1.5"><span className="block text-slate-500">Kapasitas</span><span className="font-mono text-slate-100">{evolution.capacity}</span></div>
          </div>
          {evolution.blockers.length > 0 ? (
            <div className="space-y-1">
              {evolution.blockers.slice(0, 4).map((blocker) => <div key={blocker} className="flex gap-1.5 text-[10px] leading-relaxed text-amber-200"><span className="mt-0.5 text-amber-400">•</span><span>{blocker}</span></div>)}
              {evolution.blockers.length > 4 && <div className="text-[9px] text-slate-500">+{evolution.blockers.length - 4} syarat lain di bawah</div>}
            </div>
          ) : <div className="text-[10px] leading-relaxed text-emerald-200">Semua syarat terpenuhi. Jalankan simulasi untuk menyelesaikan progres evolusi.</div>}
          {evolution.requirements.length > 0 && (
            <div className="grid grid-cols-2 gap-1 border-t border-white/10 pt-2">
              {evolution.requirements.map((requirement) => <div key={requirement.key} className={`rounded-md px-1.5 py-1 text-[9px] ${requirement.met ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}><span>{requirement.met ? '✓' : '×'} {requirement.label}</span><span className="ml-1 font-mono opacity-80">{requirement.current}/{requirement.target}</span></div>)}
            </div>
          )}
        </div>
      )}

      {isZoned && tile.parcelId && (
        <div className="my-3 rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 space-y-1.5">
          <div className="text-[9px] uppercase tracking-wider text-violet-300 font-mono">Kavling Persisten</div>
          <div className="flex items-center justify-between text-[10px] text-slate-300">
            <span>ID Kavling</span>
            <span className="font-mono text-violet-200">{tile.parcelId.slice(-14)}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-300">
            <span>Status</span>
            <span className="font-mono text-emerald-200">{parcelStatusLabel(tile.parcelStatus)}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-300">
            <span>Kepemilikan</span>
            <span className="font-mono text-amber-200">{parcelOwnershipLabel(tile.parcelOwnership)}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-300">
            <span>Subdivisi</span>
            <span className="font-mono text-cyan-200">{tile.parcelWidth ?? 1}×{tile.parcelHeight ?? 1} · {((tile.parcelWidth ?? 1) * (tile.parcelHeight ?? 1))} petak</span>
          </div>
        </div>
      )}

      {tile.mixedUseProgram && (
        <div className="my-3 rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3 space-y-1.5">
              <div className="text-[9px] uppercase tracking-wider text-fuchsia-300 font-mono">Program Lantai Campuran</div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">Program</span>
            <span className="font-mono font-bold text-fuchsia-200">{mixedUseProgramLabel(tile.mixedUseProgram)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-300">
            <span>Ritel {tile.mixedUseRetailFloors ?? 1}L</span>
            <span>Kantor {tile.mixedUseOfficeFloors ?? 0}L</span>
            <span>Hunian {tile.mixedUseResidentialFloors ?? 0}L</span>
          </div>
        </div>
      )}

      {isTransit && (
        <div className="my-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Kapasitas Transit</span>
            <span className="font-mono font-bold text-cyan-300">
              {tile.type === TileType.BUS_DEPOT ? 80 : 150} penumpang
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
            <span>Jangkauan layanan jalan</span>
            <span>{tile.type === TileType.BUS_DEPOT ? 18 : 28} petak</span>
          </div>
        </div>
      )}

      {isWarehouse && (
        <div className="my-3 p-3 rounded-xl bg-orange-500/10 border border-orange-400/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Buffer Gudang</span>
            <span className="font-mono font-bold text-orange-300">Tingkat {tile.level} · aktif</span>
          </div>
          <div className="text-[10px] text-gray-400 font-mono">Menyimpan barang lokal dan impor untuk menahan gangguan supply chain.</div>
        </div>
      )}

      {isCargoTerminal && (
        <div className="my-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-400/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Arus Kargo</span>
            <span className="font-mono font-bold text-cyan-300">Tingkat {tile.level} · aktif</span>
          </div>
          <div className="text-[10px] text-gray-400 font-mono">Gateway import dan export surplus industri melalui akses jalan kota.</div>
        </div>
      )}

      {isFloodBarrier && (
        <div className="my-3 p-3 rounded-xl bg-sky-500/10 border border-sky-400/20 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Tanggul Banjir</span>
            <span className="font-mono font-bold text-sky-300">BLOKIR ALIRAN</span>
          </div>
          <div className="text-[10px] text-gray-400 font-mono">Menghentikan propagation air pada koridor ini; air masih dapat mencari rute alternatif di sekitar barrier.</div>
        </div>
      )}

      {isReservoir && (
        <div className="my-3 p-3 rounded-xl bg-blue-500/10 border border-blue-400/20 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Penyimpanan Waduk</span>
            <span className="font-mono font-bold text-blue-300">{Math.round((tile.reservoirLevel ?? 0) * 100)}%</span>
          </div>
          <div className="text-[10px] text-gray-400 font-mono">Menahan limpasan di dekat sumber air dan mengurangi penyebaran flood downstream.</div>
        </div>
      )}

      {isFleetDepot && onOrderMaintenance && (
        <div className="my-3 rounded-xl border border-orange-400/20 bg-orange-500/10 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300 font-medium">Perawatan Depot</span>
            <span className={`font-mono font-bold ${depotCondition >= 70 ? 'text-emerald-300' : 'text-rose-300'}`}>{depotCondition.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/30">
            <div className={`h-full rounded-full ${depotCondition >= 70 ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${depotCondition}%` }} />
          </div>
          <button
            type="button"
            disabled={maintenanceOrderActive || depotCondition >= 99.5}
            onClick={() => onOrderMaintenance(tile.x, tile.y)}
            className="min-h-[44px] w-full rounded-lg border border-orange-300/30 bg-orange-400/10 px-2 py-1.5 text-[10px] font-semibold text-orange-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {maintenanceOrderActive ? 'Perawatan berjalan (2 tick)' : depotCondition >= 99.5 ? 'Depot siap' : `Pesan perbaikan · $${maintenanceCost}`}
          </button>
        </div>
      )}

      {/* Core Stats Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        {isRoad && (
          <>
            <StatBox label="Kelas Jalan" value={roadClass} icon={<Route size={14} className="text-sky-300" />} />
            <StatBox label="Lajur" value={`${roadProfile.LANES} lajur`} icon={<Route size={14} className="text-cyan-300" />} />
            <StatBox label="Beban lajur puncak" value={`${Math.round(tile.laneUtilization ?? 0)}%`} icon={<Activity size={14} className="text-orange-300" />} />
            <StatBox label="Tekanan pindah lajur" value={`${Math.round(tile.laneChangePressure ?? 0)}%`} icon={<Activity size={14} className="text-fuchsia-300" />} />
            <StatBox label="Tekanan antrean" value={`${Math.round(tile.queuePressure ?? 0)}%`} icon={<Activity size={14} className="text-rose-300" />} />
            {(tile.signalStage ?? 'PERMISSIVE') !== 'PERMISSIVE' && (
              <StatBox
                label="Tahap sinyal"
                value={`${signalStageLabel(tile.signalStage)}${tile.pedestrianCrossing ? ' · Pejalan melintas' : ''}`}
                icon={<Activity size={14} className={tile.signalStage === 'GREEN' ? 'text-emerald-300' : tile.signalStage === 'YELLOW' ? 'text-amber-300' : 'text-rose-300'} />}
              />
            )}
            <StatBox label="Kapasitas" value={`${roadProfile.CAPACITY} kendaraan`} icon={<Activity size={14} className="text-amber-300" />} />
            <StatBox label="Kondisi Jalan" value={`${Math.round(tile.roadCondition ?? 100)}%`} icon={<Activity size={14} className={(tile.roadCondition ?? 100) < 60 ? 'text-rose-300' : 'text-emerald-300'} />} />
          </>
        )}
        {tile.type === TileType.RESIDENTIAL && (
          <>
            <StatBox label="Penghuni" value={`${tile.population} Jiwa`} icon={<Home size={14} className="text-emerald-400" />} />
            <StatBox label="Kepadatan" value={getDensityLabel(getZoneDensity(tile))} icon={<Home size={14} className="text-teal-300" />} />
            <StatBox label="Sewa" value={`$${tile.rent ?? 0}/hari`} icon={<DollarSign size={14} className="text-amber-300" />} />
          </>
        )}
        {isZoned && (
          <StatBox label="Kesesuaian Lahan" value={`${tile.suitability ?? tile.landValue ?? 0}/100`} icon={<Sparkles size={14} className="text-cyan-300" />} />
        )}
        {(tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE || tile.type === TileType.INDUSTRIAL) && (
          <StatBox label="Pekerjaan" value={`${tile.jobs} Pekerja`} icon={<TrendingUp size={14} className="text-blue-400" />} />
        )}
        {(tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE || tile.type === TileType.INDUSTRIAL) && (
          <>
            <StatBox label="Sektor" value={tile.companySector?.replaceAll('_', ' ') ?? 'Menunggu tick'} icon={<TrendingUp size={14} className="text-violet-300" />} />
            <StatBox label="Efisiensi" value={`${Math.round((tile.companyEfficiency ?? 0) * 100)}%`} icon={<Activity size={14} className="text-emerald-300" />} />
            <StatBox label="Profit / hari" value={`$${tile.companyProfit ?? 0}`} icon={<DollarSign size={14} className={(tile.companyProfit ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'} />} />
            {tile.type === TileType.INDUSTRIAL && <StatBox label="Kekurangan input" value={`${Math.round((tile.inputShortage ?? 0) * 100)}%`} icon={<AlertTriangle size={14} className={(tile.inputShortage ?? 0) > 0.2 ? 'text-rose-300' : 'text-amber-300'} />} />}
          </>
        )}
        <StatBox label="Nilai Lahan" value={`${tile.landValue ?? 30}/100`} icon={<DollarSign size={14} className="text-amber-400" />} />
        <StatBox label="Polusi" value={`${tile.pollution ?? 0}%`} icon={<AlertTriangle size={14} className={(tile.pollution ?? 0) > 30 ? 'text-rose-400' : 'text-emerald-400'} />} />
        <StatBox label="Lalu Lintas" value={`${Math.round(tile.traffic ?? 0)}%`} icon={<Activity size={14} className="text-purple-400" />} />
        <StatBox label="Kesehatan" value={`${tile.health ?? 50}%`} icon={<HeartPulse size={14} className="text-teal-400" />} />
        {fastestServiceResponse !== null && <StatBox label="Respons tercepat" value={`${fastestServiceResponse.toFixed(1)} mnt`} icon={<Timer size={14} className={fastestServiceResponse <= 5 ? 'text-emerald-300' : fastestServiceResponse <= 10 ? 'text-amber-300' : 'text-rose-300'} />} />}
      </div>

      {isRoad && (tile.roadCondition ?? 100) < 96 && onStartRecoveryProject && (
        <div className="mb-3 rounded-xl border border-orange-400/20 bg-orange-500/10 p-3">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-orange-200">Pemulihan Jalan Bertahap</span>
            <span className="font-mono text-orange-300">{Math.round(tile.roadCondition ?? 100)}%</span>
          </div>
          <div className="mt-1 text-[10px] leading-relaxed text-slate-400">Jadwalkan pekerjaan beberapa hari agar kondisi ruas pulih bertahap dan dampak bencana berkurang.</div>
          <button type="button" disabled={recoveryProjectActive} onClick={() => onStartRecoveryProject(tile.x, tile.y)} className="mt-2 min-h-[44px] w-full rounded-lg border border-orange-300/30 bg-orange-400/10 px-2 py-1.5 text-[10px] font-semibold text-orange-200 disabled:cursor-not-allowed disabled:opacity-40">
            {recoveryProjectActive ? 'Pemulihan berjalan' : 'Mulai proyek pemulihan'}
          </button>
        </div>
      )}

      {isService && serviceUpgradeOptions.length > 0 && (
        <div className="mb-3 rounded-xl border border-violet-400/20 bg-violet-500/10 p-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-violet-200">
            <span>Peningkatan layanan</span>
            <span className="font-mono text-violet-300">+{Math.round(((serviceStats?.capacityMultiplier ?? 1) - 1) * 100)}% kapasitas</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">Peningkatan menambah kapasitas/jangkauan, tetapi biaya perawatan harian ikut naik.</div>
          <div className="mt-2 space-y-1.5">
            {serviceUpgradeOptions.map((upgrade) => {
              const owned = tile.serviceUpgrades?.includes(upgrade.id);
              return <button key={upgrade.id} type="button" disabled={owned || !onUpgradeService} onClick={() => onUpgradeService?.(tile.x, tile.y, upgrade.id)} className="min-h-[44px] flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-left text-[10px] text-slate-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-focus)]"><span><span className="font-semibold">{owned ? '✓ ' : ''}{serviceUpgradeCopy(upgrade.id, upgrade.name, language, 0)}</span><span className="block text-slate-500">{serviceUpgradeCopy(upgrade.id, upgrade.description, language, 1)}</span></span><span className="ml-2 shrink-0 font-mono text-violet-300">{owned ? 'AKTIF' : `$${upgrade.buildCost}`}</span></button>;
            })}
          </div>
        </div>
      )}

      {/* Utility Connection Badges */}
      <div className="flex items-center gap-2 p-2 rounded-xl bg-black/30 border border-white/5 mb-3 text-xs">
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${tile.powered ? 'bg-cyan-500/20 text-cyan-300' : 'bg-rose-500/20 text-rose-300'}`}>
          <Zap size={13} />
          <span>{tile.powered ? 'Listrik Aktif' : 'Tanpa Listrik'}</span>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${tile.watered ? 'bg-blue-500/20 text-blue-300' : 'bg-rose-500/20 text-rose-300'}`}>
          <Droplet size={13} />
          <span>{tile.watered ? 'Air Bersih' : 'Tanpa Air'}</span>
        </div>
      </div>

      {/* Diagnostics Section */}
      {diagnostics && diagnostics.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <div className="text-[9px] uppercase tracking-wider text-gray-400 font-mono">Diagnosa Pertumbuhan</div>
          {diagnostics.map((diag, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-2 rounded-xl text-xs ${
                diag.severity === 'critical'
                  ? 'bg-rose-500/15 border border-rose-500/20 text-rose-200'
                  : diag.severity === 'warning'
                  ? 'bg-amber-500/15 border border-amber-500/20 text-amber-200'
                  : 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-200'
              }`}
            >
              <span className="shrink-0 mt-0.5">{diag.icon}</span>
              <span className="leading-tight">{diag.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Demolish & Refund Button */}
      {tile.type !== TileType.EMPTY && !tile.water && (
        <button
          type="button"
          onClick={() => onDemolish(tile.x, tile.y)}
          aria-label={`Gusur Petak ${tile.x + 1}, ${tile.y + 1} dengan pengembalian ${refundAmount} dolar`}
          className="w-full min-h-[44px] py-2.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 active:bg-rose-500/40 text-rose-200 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Trash2 size={16} aria-hidden="true" />
          <span>Gusur Petak ({tile.x + 1}, {tile.y + 1}) (+${refundAmount} Pengembalian)</span>
        </button>
      )}
    </aside>
  );
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center gap-2">
      <div className="p-1 rounded-lg bg-black/20">{icon}</div>
      <div>
        <div className="text-[9px] uppercase text-gray-400">{label}</div>
        <div className="font-mono font-bold text-white text-xs">{value}</div>
      </div>
    </div>
  );
}
