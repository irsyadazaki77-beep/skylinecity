import { Household, Citizen, AgeStage } from './citizenSimulation/types';

export interface HouseholdProfile {
  id: string;
  familyName: string;
  membersCount: number;
  adultsCount: number;
  childrenCount: number;
  residenceCoords: { x: number; y: number };
  dailyRent: number;
  savings: number;
  incomeTier: 'LOW' | 'MIDDLE' | 'HIGH';
  statusLabel: string;
  statusColor: 'emerald' | 'cyan' | 'amber' | 'rose';
  satisfactionScore: number;
  primaryConcern: string;
  isRelocatingSoon: boolean;
}

const FAMILY_SURNAMES = [
  'Santoso', 'Prasetyo', 'Wijaya', 'Kusuma', 'Saputra', 'Setiawan',
  'Nugroho', 'Hidayat', 'Wibowo', 'Siregar', 'Lubis', 'Susanto',
  'Gunawan', 'Hartono', 'Purnomo', 'Firmansyah', 'Darmawan', 'Utomo'
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Derives an inspectable, human-readable household presentation from simulation state.
 */
export function deriveHouseholdProfile(household: Household, citizens: Citizen[] = []): HouseholdProfile {
  const hash = hashString(household.id);
  const surname = FAMILY_SURNAMES[(hash >>> 3) % FAMILY_SURNAMES.length];
  const familyName = `Keluarga ${surname}`;

  // Member composition
  const householdMembers = citizens.filter((c) => household.citizenIds.includes(c.id));
  const adultsCount = householdMembers.filter((c) => c.stage === AgeStage.ADULT || c.stage === AgeStage.SENIOR).length;
  const childrenCount = householdMembers.filter((c) => c.stage === AgeStage.CHILD || c.stage === AgeStage.STUDENT).length;
  const membersCount = Math.max(household.citizenIds.length, adultsCount + childrenCount, 1);

  // Income tier
  const factors = household.satisfactionFactors;
  const incomeTier = household.incomeClass ?? (household.savings > 3000 ? 'HIGH' : household.savings > 800 ? 'MIDDLE' : 'LOW');

  // Primary concern
  let primaryConcern = 'Biaya hidup dan fasilitas seimbang';
  if (factors.rentAffordability < 40) {
    primaryConcern = 'Beban sewa tempat tinggal terlalu tinggi';
  } else if (factors.commute < 45) {
    primaryConcern = 'Kemacetan dan jarak tempuh kerja';
  } else if (factors.pollution < 40) {
    primaryConcern = 'Polusi udara dan kebisingan kawasan';
  } else if (factors.crime < 45) {
    primaryConcern = 'Keamanan lingkungan rawan kriminalitas';
  } else if (factors.schoolAccess < 40 && childrenCount > 0) {
    primaryConcern = 'Akses ke sekolah anak terbatas';
  } else if (factors.employment < 40) {
    primaryConcern = 'Pekerjaan anggota keluarga belum stabil';
  }

  // Status
  let statusLabel = 'Puas & Betah';
  let statusColor: HouseholdProfile['statusColor'] = 'emerald';
  if (household.relocationTimer > 2) {
    statusLabel = 'Kritis (Berencana Pindah)';
    statusColor = 'rose';
  } else if (household.satisfaction < 50) {
    statusLabel = 'Khawatir';
    statusColor = 'amber';
  } else if (household.satisfaction < 70) {
    statusLabel = 'Cukup Stabil';
    statusColor = 'cyan';
  }

  return {
    id: household.id,
    familyName,
    membersCount,
    adultsCount: Math.max(1, adultsCount),
    childrenCount,
    residenceCoords: { ...household.residence },
    dailyRent: Math.round(household.rent),
    savings: Math.round(household.savings),
    incomeTier,
    statusLabel,
    statusColor,
    satisfactionScore: Math.round(household.satisfaction),
    primaryConcern,
    isRelocatingSoon: household.relocationTimer > 0,
  };
}
