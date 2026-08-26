import { CityState, TradeContract } from './types';

export interface TradeContractTickResult {
  contracts: TradeContract[];
  importCapacity: number;
  exportCapacity: number;
  importCapacityByCommodity: Partial<Record<TradeContract['commodity'], number>>;
  exportCapacityByCommodity: Partial<Record<TradeContract['commodity'], number>>;
  exportRevenue: number;
  reliability: number;
}

/** Advances persistent contracts and exposes a bounded market modifier to future logistics systems. */
export function simulateTradeContracts(state: CityState): TradeContractTickResult {
  const contracts: TradeContract[] = [];
  let importCapacity = 0;
  let exportCapacity = 0;
  const importCapacityByCommodity: Partial<Record<TradeContract['commodity'], number>> = {};
  const exportCapacityByCommodity: Partial<Record<TradeContract['commodity'], number>> = {};
  let exportRevenue = 0;
  let reliabilityTotal = 0;
  let reliabilityWeight = 0;
  for (const input of state.tradeContracts ?? []) {
    if (!input.active || input.remainingDays <= 0 || input.quantityPerDay <= 0) continue;
    const contract = { ...input, remainingDays: Math.max(0, input.remainingDays - 1), reliability: Math.max(0, Math.min(100, input.reliability)) };
    if (contract.remainingDays === 0) contract.active = false;
    else contracts.push(contract);
    const effectiveQuantity = contract.quantityPerDay * contract.reliability / 100;
    if (contract.direction === 'IMPORT') importCapacity += effectiveQuantity;
    else {
      exportCapacity += effectiveQuantity;
      exportRevenue += effectiveQuantity * Math.max(0, contract.pricePerUnit);
    }
    const capacityByCommodity = contract.direction === 'IMPORT' ? importCapacityByCommodity : exportCapacityByCommodity;
    capacityByCommodity[contract.commodity] = (capacityByCommodity[contract.commodity] ?? 0) + effectiveQuantity;
    reliabilityTotal += contract.reliability * contract.quantityPerDay;
    reliabilityWeight += contract.quantityPerDay;
  }
  return {
    contracts,
    importCapacity: Math.round(importCapacity * 10) / 10,
    exportCapacity: Math.round(exportCapacity * 10) / 10,
    importCapacityByCommodity,
    exportCapacityByCommodity,
    exportRevenue: Math.round(exportRevenue * 10) / 10,
    reliability: reliabilityWeight > 0 ? Math.round((reliabilityTotal / reliabilityWeight) * 10) / 10 : 100,
  };
}
