
export type BeautificationType = 'PLAZA' | 'URBAN_TREE' | 'PEDESTRIAN_PATH' | 'FOUNTAIN' | 'PARK_SCULPTURE';

export interface BeautificationItem {
  id: BeautificationType;
  name: { id: string; en: string };
  cost: number;
  maintenanceDaily: number;
  landValueRadius: number;
  landValueBonus: number;
  happinessBonus: number;
  pollutionFilter: number;
  description: { id: string; en: string };
}

export const BEAUTIFICATION_CATALOG: Record<BeautificationType, BeautificationItem> = {
  PLAZA: {
    id: 'PLAZA',
    name: { id: 'Plaza Tropis', en: 'Tropical Plaza' },
    cost: 120,
    maintenanceDaily: 2,
    landValueRadius: 3,
    landValueBonus: 4,
    happinessBonus: 3,
    pollutionFilter: 0.1,
    description: { id: 'Ruang publik terbuka berpaving dengan pohon peneduh.', en: 'Paved open public square with shade trees.' },
  },
  URBAN_TREE: {
    id: 'URBAN_TREE',
    name: { id: 'Pohon Rain Tree', en: 'Urban Rain Tree' },
    cost: 40,
    maintenanceDaily: 1,
    landValueRadius: 2,
    landValueBonus: 3,
    happinessBonus: 2,
    pollutionFilter: 0.25,
    description: { id: 'Pohon peneduh tropis yang menyerap polusi dan mempercantik jalan.', en: 'Canopy shade tree filtering pollution and cooling the streets.' },
  },
  PEDESTRIAN_PATH: {
    id: 'PEDESTRIAN_PATH',
    name: { id: 'Jalur Pedestrian Hijau', en: 'Green Pedestrian Promenade' },
    cost: 60,
    maintenanceDaily: 1,
    landValueRadius: 2,
    landValueBonus: 3,
    happinessBonus: 3,
    pollutionFilter: 0.15,
    description: { id: 'Jalur jalan kaki nyaman bebas kendaraan bermotor.', en: 'Comfortable dedicated walking promenade.' },
  },
  FOUNTAIN: {
    id: 'FOUNTAIN',
    name: { id: 'Air Mancur Kota', en: 'Civic Water Fountain' },
    cost: 250,
    maintenanceDaily: 4,
    landValueRadius: 4,
    landValueBonus: 6,
    happinessBonus: 5,
    pollutionFilter: 0.05,
    description: { id: 'Air mancur megah di pusat lingkungan untuk kebanggaan warga.', en: 'Grand water fountain elevating neighborhood civic pride.' },
  },
  PARK_SCULPTURE: {
    id: 'PARK_SCULPTURE',
    name: { id: 'Monumen Seni Publik', en: 'Public Art Monument' },
    cost: 180,
    maintenanceDaily: 3,
    landValueRadius: 3,
    landValueBonus: 5,
    happinessBonus: 4,
    pollutionFilter: 0,
    description: { id: 'Karya seni landmark publik memperkuat identitas kota.', en: 'Iconic landmark sculpture establishing city cultural identity.' },
  },
};

/**
 * Computes localized beautification bonuses without bloating the tick simulation loop.
 */
export function calculateBeautificationBonuses(
  item: BeautificationItem,
  distance: number,
): { landValueImpact: number; happinessImpact: number } {
  if (distance > item.landValueRadius) {
    return { landValueImpact: 0, happinessImpact: 0 };
  }
  const factor = 1 - distance / (item.landValueRadius + 1);
  return {
    landValueImpact: Math.round(item.landValueBonus * factor),
    happinessImpact: Math.round(item.happinessBonus * factor),
  };
}
