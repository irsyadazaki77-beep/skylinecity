import { BUILD_COSTS, ROAD_BUILD_COSTS, ActiveTool, CityState, TileType } from './types';
import { CoreLoopAdvice, getCoreLoopAdvice } from './coreLoopAdvisor';
import {
  computeRoadRecommendations,
  computeUtilityRecommendations,
  computeZoningRecommendations,
} from './tutorialPathfinder';

/**
 * The single actionable recommendation shared by the HUD, onboarding CTA,
 * camera focus, and tool selection.  `advice` is retained so existing action
 * handling remains compatible while every surface can consume the same facts.
 */
export interface NextActionModel extends CoreLoopAdvice {
  actionType: CoreLoopAdvice['action']['kind'];
  label: string;
  reason: string;
  targetTile: [number, number] | null;
  tool?: ActiveTool;
  estimatedCost: number;
  expectedImpact: string;
  completionRule: string;
}

function actionTarget(state: CityState, advice: CoreLoopAdvice): [number, number] | null {
  if (advice.action.kind === 'FOCUS_DIAGNOSTIC') return [advice.action.location.x, advice.action.location.y];
  if (advice.action.kind !== 'TOOL') return null;

  const unlockedRegions = state.unlockedRegions ?? ['1,1'];
  if (advice.action.tool === TileType.ROAD) {
    const recommendation = computeRoadRecommendations(state.grid, unlockedRegions);
    return recommendation.bestPath[0] ?? recommendation.targetHighwayTile ?? null;
  }
  if (advice.action.tool === TileType.POWER_PLANT || advice.action.tool === TileType.WATER_PUMP) {
    const recommendation = computeUtilityRecommendations(state.grid, unlockedRegions);
    return advice.action.tool === TileType.POWER_PLANT
      ? recommendation.powerTile ?? null
      : recommendation.pumpTile ?? null;
  }
  if ([TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.INDUSTRIAL, TileType.OFFICE].includes(advice.action.tool as TileType)) {
    return computeZoningRecommendations(state.grid, unlockedRegions).recommendedTiles[0] ?? null;
  }
  return null;
}

function actionCost(advice: CoreLoopAdvice): number {
  if (advice.action.kind !== 'TOOL') return 0;
  if (advice.action.tool === TileType.ROAD) return ROAD_BUILD_COSTS.LOCAL;
  return BUILD_COSTS[advice.action.tool as TileType] ?? 0;
}

function impactFor(advice: CoreLoopAdvice): string {
  const impacts: Record<string, string> = {
    'start-simulation': 'Mengaktifkan tick simulasi dan pembaruan demand.',
    'connect-road': 'Membuka akses warga, suplai, utilitas, dan respons layanan.',
    'connect-power': 'Mengaktifkan jaringan listrik untuk bangunan yang tersambung.',
    'connect-water': 'Mengaktifkan coverage air bersih untuk bangunan yang tersambung.',
    'zone-residential': 'Menambah kapasitas hunian dan jalur menuju Kota Kecil.',
    'zone-jobs': 'Menambah pekerjaan dan pemasukan pajak kota.',
    'grow-town': 'Membawa populasi mendekati milestone Kota Kecil (25 warga).',
    'stabilize-budget': 'Mengurangi risiko kas negatif sebelum ekspansi.',
    'next-milestone': 'Mengarahkan investasi ke tujuan berikutnya.',
  };
  return impacts[advice.id] ?? 'Memperbaiki kondisi yang sedang menjadi prioritas kota.';
}

function completionFor(advice: CoreLoopAdvice): string {
  const rules: Record<string, string> = {
    'start-simulation': 'Kecepatan simulasi lebih besar dari 0.',
    'connect-road': 'Jaringan jalan lokal terhubung ke jalan tol regional.',
    'connect-power': 'Pembangkit aktif dan terhubung ke jaringan jalan.',
    'connect-water': 'Pompa aktif, menyentuh air, dan terhubung ke jaringan jalan.',
    'zone-residential': 'Terdapat sedikitnya empat petak hunian.',
    'zone-jobs': 'Terdapat sedikitnya dua petak komersial atau industri.',
    'grow-town': 'Populasi mencapai 25 warga.',
    'stabilize-budget': 'Arus kas operasional kembali non-negatif.',
    'next-milestone': 'Tujuan milestone berikutnya dimulai atau selesai.',
  };
  return rules[advice.id] ?? 'Masalah prioritas terselesaikan.';
}

export function getNextActionModel(state: CityState, speed: number): NextActionModel {
  const advice = getCoreLoopAdvice(state, speed);
  const tool = advice.action.kind === 'TOOL' ? advice.action.tool : undefined;
  return {
    ...advice,
    actionType: advice.action.kind,
    label: advice.actionLabel,
    reason: advice.description,
    targetTile: actionTarget(state, advice),
    tool,
    estimatedCost: actionCost(advice),
    expectedImpact: impactFor(advice),
    completionRule: completionFor(advice),
  };
}
