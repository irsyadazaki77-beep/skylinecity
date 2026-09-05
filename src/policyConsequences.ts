import { CityState } from './types';

export interface PolicyContract {
  costPerDay: number;
  benefit: string;
  beneficiary: string;
  disadvantaged: string;
  shortTerm: string;
  longTerm: string;
  measuredMetric: 'income' | 'pollutionAverage' | 'operatingBudget';
  expectedDirection: 'UP' | 'DOWN' | 'MIXED';
}

export interface PolicyConsequence extends PolicyContract {
  policyId: string;
  /** A value sampled from the current simulated city state, never a counterfactual. */
  observedValue: number;
}

/** These descriptions mirror multipliers used by engine/depthSimulation. */
export const POLICY_CONTRACTS: Record<string, PolicyContract> = {
  mixed_use: { costPerDay: 10, benefit: 'Membuka program mixed-use dan menaikkan revenue komersial 10%.', beneficiary: 'Toko lokal dan penghuni koridor campuran', disadvantaged: 'Kas kota dan kawasan single-use', shortTerm: 'Biaya program $10/hari; revenue komersial mendapat multiplier 1,10×.', longTerm: 'Blok campuran dapat berkembang bila parcel dan demand mendukung.', measuredMetric: 'income', expectedDirection: 'UP' },
  small_biz: { costPerDay: 10, benefit: 'Menaikkan revenue komersial 20%.', beneficiary: 'Usaha dan pekerja ritel', disadvantaged: 'Kas kota', shortTerm: 'Biaya subsidi $10/hari; revenue komersial mendapat multiplier 1,20×.', longTerm: 'Basis pajak komersial menjadi lebih bernilai tetapi tetap bergantung pada supply dan logistik.', measuredMetric: 'income', expectedDirection: 'UP' },
  green_roofs: { costPerDay: 15, benefit: 'Mengalikan sumber polusi menjadi 0,85× dan memberi pengurangan maintenance 5%.', beneficiary: 'Warga di sekitar sumber polusi', disadvantaged: 'Kas kota dan pemilik bangunan yang patuh', shortTerm: 'Sumber polusi turun 15% sebelum penyebaran lingkungan dihitung.', longTerm: 'Kesehatan dan land value dapat membaik bila sumber polusi lain terkendali.', measuredMetric: 'pollutionAverage', expectedDirection: 'DOWN' },
  recycling: { costPerDay: 25, benefit: 'Mengalikan sumber polusi menjadi 0,80× dan memberi pengurangan maintenance 5%.', beneficiary: 'Warga dan lingkungan kota', disadvantaged: 'Kas kota dan bisnis penghasil polusi', shortTerm: 'Sumber polusi turun 20% sebelum penyebaran lingkungan dihitung.', longTerm: 'Biaya infrastruktur bersih turun, tetapi policy ini belum mengubah wasteProduction secara langsung.', measuredMetric: 'pollutionAverage', expectedDirection: 'DOWN' },
  tourism: { costPerDay: 30, benefit: 'Menaikkan revenue komersial 30%.', beneficiary: 'Retail dan kawasan rekreasi', disadvantaged: 'Kas kota', shortTerm: 'Biaya promosi $30/hari; revenue komersial mendapat multiplier 1,30×.', longTerm: 'Hasil tetap sensitif pada utilization dan reliability logistik.', measuredMetric: 'income', expectedDirection: 'UP' },
  ai_management: { costPerDay: 40, benefit: 'Menaikkan revenue kantor 12% dan memberi pengurangan maintenance 20%.', beneficiary: 'Sektor kantor dan pengguna infrastruktur', disadvantaged: 'Kas kota dan tenaga administrasi', shortTerm: 'Biaya operasi $40/hari; office revenue 1,12× dan maintenance turun.', longTerm: 'Operating budget membaik hanya bila penghematan dan revenue melebihi upkeep policy.', measuredMetric: 'operatingBudget', expectedDirection: 'MIXED' },
};

export function derivePolicyConsequences(state: CityState): PolicyConsequence[] {
  return [...state.activePolicies].sort().flatMap((policyId) => {
    const contract = POLICY_CONTRACTS[policyId];
    if (!contract) return [];
    const observedValue = contract.measuredMetric === 'income'
      ? state.income
      : contract.measuredMetric === 'pollutionAverage'
        ? state.pollutionAverage
        : state.operatingBudget ?? state.income - state.expenses;
    // Policy effects are intentionally communicated as a qualitative, contract-backed
    // direction. A synthetic before/after number would look like measured evidence,
    // despite there being no counterfactual city simulation to support it.
    return [{ policyId, ...contract, observedValue: Math.round(observedValue * 10) / 10 }];
  });
}

export function applyPolicyTradeoffs(state: CityState): void {
  const active = new Set(state.activePolicies);
  state.expenses += [...active].reduce((sum, id) => sum + (POLICY_CONTRACTS[id]?.costPerDay ?? 0), 0);
  if (active.has('mixed_use')) { state.commercialDemand = Math.min(100, state.commercialDemand + 4); state.congestionIndex = Math.max(0, state.congestionIndex - Math.min(3, (state.mixedUseBlocks ?? 0) * 0.4)); }
  if (active.has('small_biz')) state.commercialDemand = Math.min(100, state.commercialDemand + 3);
  if (active.has('green_roofs')) { state.pollutionAverage = Math.max(0, state.pollutionAverage - 3); state.industrialDemand = Math.max(-100, state.industrialDemand - 1); }
  if (active.has('recycling')) state.wasteProduction = Math.max(0, Math.round(state.wasteProduction * 0.92));
  if (active.has('tourism')) { state.income += Math.round(Math.max(0, state.desirability) * 0.5); state.trafficAverage = Math.min(100, state.trafficAverage + 2); }
  if (active.has('ai_management')) state.serviceResponseQuality = Math.min(100, (state.serviceResponseQuality ?? 0) + 3);
  state.operatingBudget = state.income - state.expenses;
}
