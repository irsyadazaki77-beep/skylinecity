import { CityState } from './types';
export type CityStyleGoal = 'TRANSIT' | 'GREEN' | 'INDUSTRIAL' | 'RESILIENT' | 'MIXED_USE' | 'BALANCED';
export interface CampaignEvaluation { seed: number; style: CityStyleGoal; score: number; completed: boolean; dimensions: Record<string, number>; ending: string }
export function evaluateCityStyle(state: CityState, style: CityStyleGoal, seed = state.seed ?? 2088): CampaignEvaluation {
  const dimensions = { mobility: Math.max(0, Math.round((state.transitCoverage ?? 0) - (state.congestionIndex ?? 0) / 2 + 50)), green: Math.max(0, Math.round(100 - state.pollutionAverage)), industry: Math.round((state.productionEfficiency ?? 0) * 60 + (state.freightReliability ?? 0) * .4), resilience: Math.round(state.disasterPreparationState?.preparedness ?? 0), mixedUse: Math.min(100, (state.mixedUseBlocks ?? 0) * 12), balance: Math.round((state.happiness + Math.max(0, 100 - state.unemploymentRate)) / 2) };
  const key: Record<CityStyleGoal, keyof typeof dimensions> = { TRANSIT: 'mobility', GREEN: 'green', INDUSTRIAL: 'industry', RESILIENT: 'resilience', MIXED_USE: 'mixedUse', BALANCED: 'balance' };
  const score = Math.max(0, Math.min(100, dimensions[key[style]]));
  return { seed, style, score, completed: score >= 70 && state.population >= 100, dimensions, ending: score >= 85 ? 'Kota menjadi teladan regional.' : score >= 70 ? 'Kota mencapai identitas yang matang.' : 'Kota masih mencari bentuk terbaiknya.' };
}
