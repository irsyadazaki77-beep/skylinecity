import { TileData, TileType } from './types';

export interface BusinessProfile {
  name: string;
  sector: string;
  employees: number;
  jobCapacity: number;
  revenue: number;
  expenses: number;
  profit: number;
  customerActivity: number;
  supplyStatus: 'STABLE' | 'TIGHT' | 'DISRUPTED';
  freightDependency: number;
  efficiency: number;
  majorProblem: string;
}

const PREFIXES = ['Nusa', 'Meranti', 'Sagara', 'Bumi', 'Cakrawala', 'Raya', 'Tanjung', 'Surya'];
const COMMERCIAL = ['Market', 'Niaga', 'Kopi', 'Mart', 'Ritel', 'Foods'];
const OFFICE = ['Digital', 'Advisory', 'Systems', 'Studio', 'Capital', 'Works'];
const INDUSTRIAL = ['Logistik', 'Manufaktur', 'Materials', 'Agro', 'Engineering', 'Industri'];

function stableHash(tile: TileData): number {
  return Math.abs(Math.imul(tile.x + 17, 73856093) ^ Math.imul(tile.y + 31, 19349663) ^ Math.imul(tile.level + 7, 83492791));
}

/** Turns authoritative tile economy into a stable, inspectable business identity. */
export function deriveBusinessProfile(tile: TileData): BusinessProfile | null {
  if (![TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL].includes(tile.type)) return null;
  const hash = stableHash(tile);
  const suffixes = tile.type === TileType.INDUSTRIAL ? INDUSTRIAL : tile.type === TileType.OFFICE ? OFFICE : COMMERCIAL;
  const sector = tile.companySector?.replaceAll('_', ' ') ?? (tile.type === TileType.INDUSTRIAL ? 'MANUFACTURING' : tile.type === TileType.OFFICE ? 'PROFESSIONAL SERVICES' : 'LOCAL RETAIL');
  const employees = Math.max(0, Math.round(tile.jobs ?? 0));
  const efficiency = Math.max(0, Math.min(1, tile.companyEfficiency ?? tile.productivity / 100));
  const shortage = Math.max(0, Math.min(1, tile.inputShortage ?? 0));
  const profit = Math.round(tile.companyProfit ?? 0);
  const wageBase = tile.type === TileType.OFFICE ? 18 : tile.type === TileType.INDUSTRIAL ? 13 : 11;
  const expenses = Math.max(0, Math.round(employees * wageBase + Math.abs(profit) * 0.18 + shortage * employees * 9));
  const revenue = Math.max(0, expenses + profit);
  const capacityPerLevel = tile.type === TileType.OFFICE ? 15 : tile.type === TileType.INDUSTRIAL ? 18 : 12;
  const jobCapacity = Math.max(employees, Math.round(capacityPerLevel * Math.max(1, tile.level)));
  const customerActivity = tile.type === TileType.COMMERCIAL
    ? Math.round(Math.min(100, efficiency * 70 + Math.min(30, (tile.traffic ?? 0) * 0.4)))
    : Math.round(Math.min(100, efficiency * 100));
  const freightDependency = tile.type === TileType.INDUSTRIAL ? 90 : tile.type === TileType.COMMERCIAL ? 55 : 12;
  const supplyStatus = shortage >= 0.35 ? 'DISRUPTED' : shortage >= 0.12 ? 'TIGHT' : 'STABLE';
  const majorProblem = tile.abandoned ? 'Operasi berhenti: bangunan terbengkalai'
    : !tile.powered ? 'Pasokan listrik terputus'
      : !tile.watered ? 'Pasokan air terputus'
        : shortage >= 0.35 ? 'Kekurangan input produksi'
          : efficiency < 0.65 ? 'Efisiensi operasi rendah'
            : employees < jobCapacity * 0.5 ? 'Lowongan sulit terisi'
              : profit < 0 ? 'Biaya operasi melebihi pendapatan'
                : 'Tidak ada masalah besar';
  return {
    name: `${PREFIXES[hash % PREFIXES.length]} ${suffixes[Math.floor(hash / PREFIXES.length) % suffixes.length]}`,
    sector,
    employees,
    jobCapacity,
    revenue,
    expenses,
    profit,
    customerActivity,
    supplyStatus,
    freightDependency,
    efficiency: Math.round(efficiency * 100),
    majorProblem,
  };
}
