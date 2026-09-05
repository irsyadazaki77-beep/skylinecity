import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Bus,
  CheckCircle2,
  Compass,
  DollarSign,
  Droplet,
  Flame,
  HelpCircle,
  Home,
  Map,
  MapPin,
  Minimize2,
  Play,
  RotateCcw,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Wrench,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { ActiveTool, CityState, TileType } from '../../types';
import { createTutorialBaseline, hasActiveStarterUtilities, isTutorialStepComplete, TutorialStepId } from '../../tutorialFlow';
import {
  calculateFramedFocus,
  computeRoadRecommendations,
  computeUtilityRecommendations,
  computeZoningRecommendations,
  findSettlementCentroid,
} from '../../tutorialPathfinder';
import { NextActionModel } from '../../nextAction';

export type TutorialHighlightType = 'highway' | 'zoning' | 'utilities' | 'mission' | null;

export interface TutorialProgress {
  minimized?: boolean;
  currentStepIndex?: number;
  completedStepIds?: string[];
}

function tutorialStorageKey(sessionKey?: string): string {
  return sessionKey ? `skyline_onboarding_v4:${encodeURIComponent(sessionKey)}` : 'skyline_onboarding_v3';
}

export function readTutorialProgress(
  storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage,
  sessionKey?: string,
): TutorialProgress {
  try {
    const saved = sessionKey
      ? storage?.getItem(tutorialStorageKey(sessionKey))
      : storage?.getItem('skyline_onboarding_v3') ?? storage?.getItem('skyline_onboarding_v2');
    return saved ? (JSON.parse(saved) as TutorialProgress) : {};
  } catch {
    return {};
  }
}

export function writeTutorialProgress(
  progress: TutorialProgress,
  storage: Pick<Storage, 'setItem'> | undefined = typeof localStorage === 'undefined' ? undefined : localStorage,
  sessionKey?: string,
): void {
  try {
    storage?.setItem(tutorialStorageKey(sessionKey), JSON.stringify(progress));
  } catch {
    /* optional preference */
  }
}

interface StarterTutorialProps {
  gameState: CityState;
  speed: number;
  hasCameraFocus?: boolean;
  onSetSpeed: (speed: 0 | 1 | 2 | 3) => void;
  onSelectTool: (tool: ActiveTool) => void;
  onFocusTile: (tile: [number, number]) => void;
  onResetCamera?: () => void;
  onHighlightChange?: (highlight: TutorialHighlightType) => void;
  onEmergencyGrant?: () => void;
  onGuidanceMessage?: (message: string | null) => void;
  onOpenPolicies?: () => void;
  tutorialSessionKey?: string;
  nextAction?: NextActionModel;
  onNextAction?: (advice: NextActionModel) => void;
}

interface TutorialStep {
  id: TutorialStepId;
  title: string;
  reason: string;
  estimatedCost: string;
  expectedImpact: string;
  actionHint: string;
  highlightType: TutorialHighlightType;
  icon: React.ReactNode;
  tool?: ActiveTool;
  isComplete: (state: CityState, speed: number) => boolean;
}

export function StarterTutorial({
  gameState,
  speed,
  hasCameraFocus = false,
  onSetSpeed,
  onSelectTool,
  onFocusTile,
  onResetCamera,
  onHighlightChange,
  onEmergencyGrant,
  onGuidanceMessage,
  onOpenPolicies,
  tutorialSessionKey,
  nextAction,
  onNextAction,
}: StarterTutorialProps) {
  const saved = useMemo(() => readTutorialProgress(undefined, tutorialSessionKey), [tutorialSessionKey]);
  const [minimized, setMinimized] = useState(Boolean(saved.minimized));
  const [currentStepIndex, setCurrentStepIndex] = useState(() => Math.max(0, saved.currentStepIndex ?? 0));
  const [actionGuidance, setActionGuidance] = useState<string | null>(null);
  const baseline = useRef(createTutorialBaseline(gameState.grid));
  const baselineSessionKey = useRef(tutorialSessionKey);

  if (baselineSessionKey.current !== tutorialSessionKey) {
    baselineSessionKey.current = tutorialSessionKey;
    baseline.current = createTutorialBaseline(gameState.grid);
  }

  // 5 progressive, clearly sequenced onboarding steps
  const steps: TutorialStep[] = useMemo(() => {
    return [
      {
        id: 'road',
        title: 'Hubungkan Jalan ke Tol Regional',
        reason: 'Jalan lokal menghubungkan kota ke jalan tol kuning agar migran dan truk suplai dapat masuk.',
        estimatedCost: '~$60 - $120',
        expectedImpact: 'Membuka akses kendaraan dan jalur migrasi warga.',
        actionHint: 'Tarik jalan lokal dari settlement ke arah jalan tol terdekat, lalu klik untuk membangun.',
        highlightType: 'highway',
        icon: <Compass size={17} className="text-amber-300" />,
        tool: TileType.ROAD,
        isComplete: (state, currentSpeed) => isTutorialStepComplete('road', state, currentSpeed, baseline.current),
      },
      {
        id: 'utilities',
        title: 'Sediakan Listrik dan Air Bersih',
        reason: 'Pembangkit listrik dan pompa air wajib terhubung ke jalan agar daya dan pipa air menjangkau kavling.',
        estimatedCost: '~$250 - $300',
        expectedImpact: 'Mengalirkan utilitas dasar agar bangunan baru dapat tumbuh.',
        actionHint: 'Pilih lokasi dekat jalan: pompa air wajib di tepi sungai, pembangkit listrik di samping jalan.',
        highlightType: 'utilities',
        icon: <Zap size={17} className="text-cyan-300" />,
        tool: TileType.POWER_PLANT,
        isComplete: (state, currentSpeed) => isTutorialStepComplete('utilities', state, currentSpeed, baseline.current),
      },
      {
        id: 'zoning',
        title: 'Buat Zonasi Rumah dan Pekerjaan',
        reason: 'Tandai zona perumahan (hijau) dan komersial/industri (biru/kuning) di sepanjang jalan aktif.',
        estimatedCost: '~$60 - $150',
        expectedImpact: 'Menyediakan hunian keluarga dan lowongan kerja pertama.',
        actionHint: 'Pilih zona perumahan atau komersial, lalu klik petak kosong di sisi jalan aktif.',
        highlightType: 'zoning',
        icon: <Home size={17} className="text-emerald-400" />,
        tool: TileType.RESIDENTIAL,
        isComplete: (state, currentSpeed) => isTutorialStepComplete('zoning', state, currentSpeed, baseline.current),
      },
      {
        id: 'time',
        title: 'Jalankan Waktu Simulasi',
        reason: 'Waktu kota sedang jeda (pause). Jalankan kecepatan 1× agar warga mulai berdatangan dan berbelanja.',
        estimatedCost: 'Gratis',
        expectedImpact: 'Simulasi tick berjalan, kas kota mulai menerima pajak harian.',
        actionHint: 'Klik tombol Lakukan Sekarang atau tekan angka 2 / Spasi untuk memulai simulasi.',
        highlightType: null,
        icon: <Play size={17} className="text-emerald-300" />,
        isComplete: (state, currentSpeed) => isTutorialStepComplete('time', state, currentSpeed, baseline.current),
      },
      {
        id: 'problems',
        title: 'Tinjau Diagnosa Masalah Kota',
        reason: 'Pantau kartu Causal Diagnostics: setiap masalah menjawab apa yang terjadi, penyebab, dan solusi.',
        estimatedCost: 'Sesuai solusi',
        expectedImpact: 'Mencegah penurunan kebahagiaan warga dan menjaga kas tetap surplus.',
        actionHint: 'Buka kartu diagnosa untuk meninjau penyebab masalah dan melompat langsung ke lokasi.',
        highlightType: 'mission',
        icon: <Wrench size={17} className="text-cyan-400" />,
        isComplete: (state, currentSpeed) => isTutorialStepComplete('problems', state, currentSpeed, baseline.current),
      },
    ];
  }, []);

  const boundedIndex = Math.min(steps.length - 1, currentStepIndex);
  const activeStep = steps[boundedIndex] ?? steps[0];
  const isPreCompletedUtilities = activeStep.id === 'utilities' && hasActiveStarterUtilities(gameState);
  const isAllTutorialComplete = steps.every((step) => step.isComplete(gameState, speed));

  useEffect(() => {
    writeTutorialProgress({ minimized, currentStepIndex: boundedIndex }, undefined, tutorialSessionKey);
  }, [minimized, boundedIndex, tutorialSessionKey]);

  useEffect(() => {
    const reset = () => {
      setCurrentStepIndex(0);
      setMinimized(false);
      setActionGuidance(null);
      baseline.current = createTutorialBaseline(gameState.grid);
      writeTutorialProgress({ minimized: false, currentStepIndex: 0 }, undefined, tutorialSessionKey);
    };
    window.addEventListener('skyline:reset-onboarding', reset);
    return () => window.removeEventListener('skyline:reset-onboarding', reset);
  }, [gameState.grid, tutorialSessionKey]);

  // Listen for Escape key to cancel camera focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasCameraFocus) {
        onResetCamera?.();
        setActionGuidance(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasCameraFocus, onResetCamera]);

  useEffect(() => {
    const complete = activeStep?.isComplete(gameState, speed);
    const highlight = !complete ? activeStep?.highlightType ?? null : null;
    onHighlightChange?.(highlight);
    return () => onHighlightChange?.(null);
  }, [activeStep, gameState, onHighlightChange, speed]);

  useEffect(() => {
    if (isPreCompletedUtilities) return;
    if (activeStep?.isComplete(gameState, speed) && boundedIndex < steps.length - 1) {
      const timer = window.setTimeout(() => {
        setCurrentStepIndex((index) => Math.min(steps.length - 1, index + 1));
        setActionGuidance(null);
      }, 700);
      return () => window.clearTimeout(timer);
    }
  }, [activeStep, boundedIndex, gameState, isPreCompletedUtilities, speed, steps.length]);

  /** Computes framed target keeping both target and player settlement in visual frame */
  const showLocation = () => {
    const settlement = findSettlementCentroid(gameState.grid);

    let targetTile: [number, number] = nextAction?.targetTile ?? settlement;
    if (!nextAction?.targetTile && activeStep.id === 'road') {
      const roadRec = computeRoadRecommendations(gameState.grid, gameState.unlockedRegions);
      targetTile = roadRec.targetHighwayTile ?? settlement;
    } else if (!nextAction?.targetTile && activeStep.id === 'utilities') {
      const existingPlant = gameState.grid.flat().find((t) => t.type === TileType.POWER_PLANT);
      const existingPump = gameState.grid.flat().find((t) => t.type === TileType.WATER_PUMP);
      if (existingPlant || existingPump) {
        targetTile = existingPlant ? [existingPlant.x, existingPlant.y] : [existingPump.x, existingPump.y];
      } else {
        const utils = computeUtilityRecommendations(gameState.grid, gameState.unlockedRegions);
        targetTile = utils.powerTile ?? utils.pumpTile ?? settlement;
      }
    } else if (!nextAction?.targetTile && activeStep.id === 'zoning') {
      const zones = computeZoningRecommendations(gameState.grid, gameState.unlockedRegions);
      targetTile = zones.recommendedTiles[0] ?? settlement;
    } else if (!nextAction?.targetTile && activeStep.id === 'problems' && gameState.causalDiagnostics?.[0]?.location) {
      targetTile = [gameState.causalDiagnostics[0].location.x, gameState.causalDiagnostics[0].location.y];
    }

    const framed = calculateFramedFocus(targetTile, settlement, 0.6);
    onFocusTile(framed);
  };

  /** Action CTA: Automatically selects tool AND focuses map on target */
  const doNow = () => {
    const settlement = findSettlementCentroid(gameState.grid);

    if (activeStep.id === 'time') {
      onSetSpeed(1);
      setActionGuidance('Simulasi kini berjalan. Perhatikan pertumbuhan bangunan di sisi jalan.');
      onGuidanceMessage?.('Simulasi aktif pada kecepatan 1×.');
      return;
    }

    if (activeStep.id === 'road') {
      onSelectTool(TileType.ROAD);
      const roadRec = computeRoadRecommendations(gameState.grid, gameState.unlockedRegions);
      const target = nextAction?.targetTile ?? roadRec.targetHighwayTile;
      if (target) {
        const framed = calculateFramedFocus(target, settlement, 0.6);
        onFocusTile(framed);
        const msg = `Tarik jalan lokal dari settlement (${settlement[0] + 1}, ${settlement[1] + 1}) menuju jalan tol kuning (${target[0] + 1}, ${target[1] + 1}). Klik dan geser mouse untuk membangun.`;
        setActionGuidance(msg);
        onGuidanceMessage?.(msg);
      }
      return;
    }

    if (activeStep.id === 'utilities') {
      if (isPreCompletedUtilities) {
        setCurrentStepIndex((index) => Math.min(steps.length - 1, index + 1));
        setActionGuidance(null);
        return;
      }
      const utils = computeUtilityRecommendations(gameState.grid, gameState.unlockedRegions);
      onSelectTool(TileType.POWER_PLANT);
      if (utils.powerTile) {
        const framed = calculateFramedFocus(utils.powerTile, settlement, 0.6);
        onFocusTile(framed);
        const msg = `Pilih titik di (${utils.powerTile[0] + 1}, ${utils.powerTile[1] + 1}) yang menyentuh jalan untuk pembangkit listrik.`;
        setActionGuidance(msg);
        onGuidanceMessage?.(msg);
      }
      return;
    }

    if (activeStep.id === 'zoning') {
      const zones = computeZoningRecommendations(gameState.grid, gameState.unlockedRegions);
      const tiles = gameState.grid.flat();
      const residentialAdded = tiles.filter((tile) => tile.type === TileType.RESIDENTIAL).length - baseline.current.residential;
      const needsHousing = residentialAdded < 2;
      onSelectTool(needsHousing ? TileType.RESIDENTIAL : TileType.COMMERCIAL);
      if (zones.recommendedTiles[0]) {
        const target = zones.recommendedTiles[0];
        const framed = calculateFramedFocus(target, settlement, 0.6);
        onFocusTile(framed);
        const msg = needsHousing
          ? `Bangun kavling hunian di petak (${target[0] + 1}, ${target[1] + 1}). Dua kavling tambahan memberi ruang menuju 25 warga.`
          : `Kapasitas hunian cukup. Sekarang bangun zona komersial di petak (${target[0] + 1}, ${target[1] + 1}) agar warga punya tempat belanja.`;
        setActionGuidance(msg);
        onGuidanceMessage?.(msg);
      }
      return;
    }

    if (activeStep.tool) {
      onSelectTool(activeStep.tool);
    }
    showLocation();
    setActionGuidance(activeStep.actionHint);
    onGuidanceMessage?.(activeStep.actionHint);
  };

  const needsRecovery = gameState.money < 1000 && gameState.population === 0;

  // Minimized chip view
  if (minimized) {
    return (
      <button
        type="button"
        className="next-action-chip"
        onClick={() => setMinimized(false)}
        aria-label="Buka panduan langkah berikutnya"
      >
        <Sparkles size={15} className="text-cyan-400" />
        <span className="text-xs text-white">
          {!isAllTutorialComplete ? `Langkah ${boundedIndex + 1}/5: ${activeStep.title}` : nextAction ? nextAction.title : 'Panduan Kota'}
        </span>
      </button>
    );
  }

  // If tutorial is completed, seamlessly present the dynamic Next Action
  if (isAllTutorialComplete && nextAction && onNextAction) {
    const phaseLabel: Record<NextActionModel['phase'], string> = {
      BUILD: 'Bangun',
      CONNECT: 'Hubungkan',
      GROW: 'Tumbuhkan',
      DIAGNOSE: 'Diagnosis',
      PROGRESS: 'Progres',
    };

    return (
      <aside className="next-action-card" role="status" aria-live="polite" aria-label="Rekomendasi langkah berikutnya">
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-300">
            <Sparkles size={14} />
            <span>Langkah Berikutnya · {phaseLabel[nextAction.phase]}</span>
          </div>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            aria-label="Minimalkan kartu"
          >
            <Minimize2 size={13} />
          </button>
        </div>

        <div className="text-xs font-bold text-white leading-snug">{nextAction.title}</div>
        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{nextAction.description}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
          {nextAction.estimatedCost > 0 && (
            <span className="rounded bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 font-mono font-semibold text-amber-300">
              Biaya: ${nextAction.estimatedCost}
            </span>
          )}
          <span className="rounded bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 text-cyan-200">
            Dampak: {nextAction.expectedImpact}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onNextAction(nextAction)}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-3 text-xs transition-colors shadow-md"
        >
          <span>{nextAction.actionLabel}</span>
          <ArrowRight size={14} />
        </button>
      </aside>
    );
  }

  // Active Onboarding Tutorial Step Card
  return (
    <aside className="next-action-card" role="status" aria-live="polite" aria-label="Panduan pemain baru">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded-md bg-cyan-500/20 text-cyan-300 shrink-0">
            {activeStep.icon}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 truncate">
            Langkah {boundedIndex + 1} dari {steps.length}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setCurrentStepIndex((idx) => Math.min(steps.length - 1, idx + 1))}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors text-[10px] flex items-center gap-0.5"
            title="Lewati langkah ini"
          >
            <SkipForward size={12} />
            <span className="hidden sm:inline">Lewati</span>
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            aria-label="Minimalkan panduan"
          >
            <Minimize2 size={13} />
          </button>
        </div>
      </div>

      {/* Title & Reason */}
      <h2 className="text-xs font-bold text-white leading-snug">{activeStep.title}</h2>
      
      {isPreCompletedUtilities ? (
        <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-2 text-[11px] text-emerald-200">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-300 mb-0.5">
            <CheckCircle2 size={14} /> Utilitas Starter Aktif (50 MW / 50 kL)
          </div>
          Listrik dan pompa air sudah terhubung ke jaringan jalan. Kavling yang dibangun langsung siap dialiri.
        </div>
      ) : (
        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{activeStep.reason}</p>
      )}

      {/* Badges: Cost & Expected Impact */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 font-mono font-semibold text-amber-300">
          Biaya: {activeStep.estimatedCost}
        </span>
        <span className="rounded bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 text-cyan-200">
          Dampak: {activeStep.expectedImpact}
        </span>
      </div>

      {/* Guidance Message if any */}
      {actionGuidance && (
        <div className="mt-2 rounded-lg border border-cyan-500/30 bg-cyan-950/40 p-2 text-[11px] text-cyan-100">
          <div className="flex items-center gap-1.5 font-semibold text-cyan-300 mb-0.5">
            <Compass size={13} /> Petunjuk:
          </div>
          <p className="leading-relaxed">{actionGuidance}</p>
        </div>
      )}

      {/* Low Funds Recovery Alert */}
      {needsRecovery && (
        <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-950/40 p-2 text-[11px] text-rose-200">
          <div className="flex items-center gap-1 font-semibold text-rose-300">
            <AlertCircle size={13} /> Kas Menipis
          </div>
          <p className="mt-0.5 text-[10px] text-rose-100">
            Kas kota rendah sebelum warga berdatangan. Klaim hibah darurat untuk melanjutkan.
          </p>
          {onEmergencyGrant && (
            <button
              type="button"
              onClick={onEmergencyGrant}
              className="mt-1.5 inline-flex items-center gap-1 rounded bg-amber-400 px-2 py-1 text-[10px] font-bold text-black hover:bg-amber-300"
            >
              Klaim Hibah Darurat +$2,500
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={showLocation}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 font-semibold py-2 px-3 text-xs transition-colors min-h-[38px]"
          title="Fokuskan kamera ke target lokasi"
        >
          <MapPin size={14} className="text-cyan-400" />
          <span>Lokasi</span>
        </button>
        <button
          type="button"
          onClick={doNow}
          className="flex-[2] inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 px-3 text-xs transition-colors shadow-md min-h-[38px]"
        >
          {activeStep.id === 'time' ? <Play size={14} /> : <Compass size={14} />}
          <span>{isPreCompletedUtilities ? 'Lanjut ke Zonasi' : 'Lakukan Sekarang'}</span>
        </button>
      </div>

      {hasCameraFocus && onResetCamera && (
        <button
          type="button"
          onClick={onResetCamera}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-1 text-[10px] font-medium text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <RotateCcw size={12} /> Kembali ke Settlement (Esc)
        </button>
      )}
    </aside>
  );
}
