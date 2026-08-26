import { TileType } from './types';

export interface ServiceUpgradeDefinition {
  id: string;
  name: string;
  description: string;
  facilityTypes: TileType[];
  buildCost: number;
  dailyUpkeep: number;
  capacityMultiplier?: number;
  rangeBonus?: number;
  responseBonus?: number;
}

export const SERVICE_UPGRADES: ServiceUpgradeDefinition[] = [
  { id: 'fire_engine_bay', name: 'Extra Engine Bay', description: 'Adds fire response capacity.', facilityTypes: [TileType.FIRE_STATION], buildCost: 650, dailyUpkeep: 18, capacityMultiplier: 0.55, responseBonus: 0.04 },
  { id: 'fire_training', name: 'Training Center', description: 'Improves fire response reliability and reach.', facilityTypes: [TileType.FIRE_STATION], buildCost: 900, dailyUpkeep: 24, rangeBonus: 3, responseBonus: 0.08 },
  { id: 'ambulance_wing', name: 'Ambulance Wing', description: 'Adds patient and emergency capacity.', facilityTypes: [TileType.CLINIC], buildCost: 750, dailyUpkeep: 22, capacityMultiplier: 0.6, responseBonus: 0.05 },
  { id: 'clinic_specialist', name: 'Specialist Unit', description: 'Improves healthcare coverage quality.', facilityTypes: [TileType.CLINIC], buildCost: 1100, dailyUpkeep: 30, rangeBonus: 2, capacityMultiplier: 0.35 },
  { id: 'police_patrol_garage', name: 'Patrol Garage', description: 'Adds police patrol capacity.', facilityTypes: [TileType.POLICE_STATION], buildCost: 700, dailyUpkeep: 20, capacityMultiplier: 0.55, responseBonus: 0.05 },
  { id: 'police_traffic_unit', name: 'Traffic Unit', description: 'Improves incident response on congested roads.', facilityTypes: [TileType.POLICE_STATION], buildCost: 950, dailyUpkeep: 26, rangeBonus: 3, responseBonus: 0.08 },
  { id: 'school_classroom_wing', name: 'Classroom Wing', description: 'Adds student capacity.', facilityTypes: [TileType.SCHOOL], buildCost: 600, dailyUpkeep: 16, capacityMultiplier: 0.7 },
  { id: 'school_playground', name: 'Playground', description: 'Improves local education and wellbeing.', facilityTypes: [TileType.SCHOOL], buildCost: 420, dailyUpkeep: 10, rangeBonus: 2, responseBonus: 0.03 },
  { id: 'waste_recycling_line', name: 'Recycling Line', description: 'Adds waste processing capacity and reduces environmental pressure.', facilityTypes: [TileType.WASTE_MANAGEMENT], buildCost: 800, dailyUpkeep: 20, capacityMultiplier: 0.75 },
];

export function getServiceUpgrade(id: string): ServiceUpgradeDefinition | undefined {
  return SERVICE_UPGRADES.find((upgrade) => upgrade.id === id);
}

export function getServiceUpgradesFor(type: TileType): ServiceUpgradeDefinition[] {
  return SERVICE_UPGRADES.filter((upgrade) => upgrade.facilityTypes.includes(type));
}

export function serviceUpgradeStats(type: TileType, ids: string[] = []) {
  const upgrades = ids.map(getServiceUpgrade).filter((upgrade): upgrade is ServiceUpgradeDefinition => Boolean(upgrade) && upgrade.facilityTypes.includes(type));
  return {
    upgrades,
    capacityMultiplier: 1 + upgrades.reduce((sum, upgrade) => sum + (upgrade.capacityMultiplier ?? 0), 0),
    rangeBonus: upgrades.reduce((sum, upgrade) => sum + (upgrade.rangeBonus ?? 0), 0),
    responseBonus: upgrades.reduce((sum, upgrade) => sum + (upgrade.responseBonus ?? 0), 0),
    dailyUpkeep: upgrades.reduce((sum, upgrade) => sum + upgrade.dailyUpkeep, 0),
  };
}
