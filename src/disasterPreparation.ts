import { CityDisaster, CityState, TileType } from './types';

export type DisasterPhase = 'MONITORING' | 'FORECAST' | 'PREPARATION' | 'IMPACT' | 'RESPONSE' | 'RECOVERY' | 'EVALUATION';
export type PreparationAction = 'CLOSE_ROADS' | 'EVACUATE' | 'OPEN_SHELTERS' | 'STOCKPILE' | 'PREPOSITION_UNITS' | 'REINFORCE_BARRIERS' | 'REDUCE_UTILITY_LOAD';
export interface DisasterPreparationState {
  phase: DisasterPhase;
  forecast?: { type: CityDisaster['type']; centerX: number; centerY: number; intensity: 1 | 2 | 3; riskTiles: number; estimatedDamage: number; daysRemaining: number };
  actions: PreparationAction[];
  preparedness: number;
  avoidedDamage: number;
  recoveryCost: number;
  evaluation?: string;
  lastDisasterId?: string;
}

export const PREPARATION_COSTS: Record<PreparationAction, number> = { CLOSE_ROADS: 100, EVACUATE: 400, OPEN_SHELTERS: 600, STOCKPILE: 500, PREPOSITION_UNITS: 350, REINFORCE_BARRIERS: 800, REDUCE_UTILITY_LOAD: 150 };

export function calculatePreparedness(state: CityState, actions: PreparationAction[]): number {
  const unique = new Set(actions);
  const structural = Math.min(35, (state.floodBarrierCount ?? 0) * 7 + state.grid.flat().filter((tile) => tile.type === TileType.WATER_RESERVOIR).length * 5);
  const service = Math.min(20, (state.serviceResponseQuality ?? 0) * 0.2);
  return Math.min(100, Math.round(structural + service + unique.size * 7));
}

export function advanceDisasterPreparation(previous: DisasterPreparationState | undefined, state: CityState, previousDisasters: CityDisaster[] = []): DisasterPreparationState {
  const base = previous ?? { phase: 'MONITORING', actions: [], preparedness: 0, avoidedDamage: 0, recoveryCost: 0 };
  const active = state.disasters?.[0];
  const wasActive = previousDisasters[0];
  const preparedness = calculatePreparedness(state, base.actions);
  if (active) {
    const rawDamage = active.severity * Math.max(1, active.affectedTiles) * 90;
    const avoidedDamage = Math.round(rawDamage * preparedness / 150);
    return { ...base, phase: active.remainingDays > 1.5 ? 'IMPACT' : 'RESPONSE', preparedness, avoidedDamage, recoveryCost: Math.max(0, rawDamage - avoidedDamage), lastDisasterId: active.id, forecast: { type: active.type, centerX: active.centerX, centerY: active.centerY, intensity: active.severity, riskTiles: active.affectedTiles, estimatedDamage: rawDamage, daysRemaining: active.remainingDays } };
  }
  if (wasActive || base.phase === 'RESPONSE') return { ...base, phase: 'RECOVERY', preparedness, evaluation: `Persiapan ${preparedness}% mencegah estimasi kerugian $${base.avoidedDamage}.` };
  if (base.phase === 'RECOVERY') return { ...base, phase: 'EVALUATION', preparedness };
  const floodRisk = ((state.weather === 'STORM') || (state.precipitation ?? 0) >= 1.75) && state.grid.flat().some((tile) => tile.water);
  if (floodRisk) {
    const dry = state.grid.flat().filter((tile) => !tile.water).sort((a, b) => a.elevation - b.elevation || a.y - b.y || a.x - b.x)[0];
    return { ...base, phase: base.forecast ? 'PREPARATION' : 'FORECAST', preparedness, forecast: { type: 'FLOOD', centerX: dry?.x ?? 0, centerY: dry?.y ?? 0, intensity: (state.precipitation ?? 0) >= 1.9 ? 3 : 2, riskTiles: Math.max(1, state.floodedTiles ?? 0), estimatedDamage: Math.round((state.precipitation ?? 0) * 1_250), daysRemaining: 2 } };
  }
  return { ...base, phase: 'MONITORING', preparedness, forecast: undefined };
}

export function setPreparationAction(state: DisasterPreparationState | undefined, action: PreparationAction, enabled: boolean): DisasterPreparationState {
  const base = state ?? { phase: 'MONITORING', actions: [], preparedness: 0, avoidedDamage: 0, recoveryCost: 0 };
  return { ...base, actions: enabled ? [...new Set([...base.actions, action])].sort() : base.actions.filter((item) => item !== action) };
}
