import { CityState } from './types';

export interface CityMilestone {
  level: number;
  name: string;
  populationRequired: number;
  treasuryRequired: number;
  description: string;
  unlockedBuildingTypes: number[];
}

export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'Infrastructure' | 'Utilities' | 'Zoning' | 'Economy' | 'Environment';
  prerequisiteId?: string;
  requiredMilestoneLevel: number;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  dailyUpkeep: number;
  unlockedMilestoneLevel: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  rewardMoney: number;
  check: (state: CityState) => boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  check: (state: CityState) => boolean;
}

export const MILESTONES: CityMilestone[] = [
  { level: 0, name: 'Village', populationRequired: 0, treasuryRequired: 0, description: 'A new municipality with room to grow.', unlockedBuildingTypes: [] },
  { level: 1, name: 'Town', populationRequired: 25, treasuryRequired: 0, description: 'Your first connected community is taking shape.', unlockedBuildingTypes: [7, 8] },
  { level: 2, name: 'City', populationRequired: 100, treasuryRequired: 0, description: 'The city now has the scale to support advanced services.', unlockedBuildingTypes: [9, 10] },
  { level: 3, name: 'Metro', populationRequired: 250, treasuryRequired: 25_000, description: 'A regional center with a real metropolitan economy.', unlockedBuildingTypes: [11] },
  { level: 4, name: 'Megacity', populationRequired: 600, treasuryRequired: 100_000, description: 'Density, services, and innovation are reinforcing each other.', unlockedBuildingTypes: [12] },
  { level: 5, name: 'Skyline Capital', populationRequired: 1_200, treasuryRequired: 250_000, description: 'A globally recognized skyline and a mature civic system.', unlockedBuildingTypes: [] },
];

export const TECH_NODES: TechNode[] = [
  { id: 'asphalt_roads', name: 'Asphalt Roads', description: 'Increase road capacity and reduce travel friction.', cost: 5_000, category: 'Infrastructure', requiredMilestoneLevel: 0 },
  { id: 'smart_lights', name: 'Smart Traffic Lights', description: 'Smooth intersections and reduce congestion spikes.', cost: 10_000, category: 'Infrastructure', prerequisiteId: 'asphalt_roads', requiredMilestoneLevel: 1 },
  { id: 'bike_lanes', name: 'Bike Lanes', description: 'Shift short trips away from cars.', cost: 12_000, category: 'Infrastructure', prerequisiteId: 'asphalt_roads', requiredMilestoneLevel: 1 },
  { id: 'bus_network', name: 'Bus Network', description: 'Reduce city-wide car traffic by 25%.', cost: 25_000, category: 'Infrastructure', prerequisiteId: 'smart_lights', requiredMilestoneLevel: 2 },
  { id: 'tram_system', name: 'Tram System', description: 'Unlock high-capacity public transit.', cost: 50_000, category: 'Infrastructure', prerequisiteId: 'bus_network', requiredMilestoneLevel: 3 },
  { id: 'water_meters', name: 'Water Meters', description: 'Reduce water consumption by 10%.', cost: 12_000, category: 'Utilities', requiredMilestoneLevel: 0 },
  { id: 'high_cap_pipes', name: 'High-Capacity Pipes', description: 'Increase water network capacity by 20%.', cost: 15_000, category: 'Utilities', requiredMilestoneLevel: 1 },
  { id: 'smart_grid', name: 'Smart Power Grid', description: 'Increase power capacity by 20%.', cost: 15_000, category: 'Utilities', requiredMilestoneLevel: 1 },
  { id: 'solar_subsidies', name: 'Solar Subsidies', description: 'Reduce city power demand by 10%.', cost: 20_000, category: 'Utilities', requiredMilestoneLevel: 2 },
  { id: 'deep_pumps', name: 'Deep Water Pumps', description: 'Increase pump output by 50%.', cost: 35_000, category: 'Utilities', prerequisiteId: 'high_cap_pipes', requiredMilestoneLevel: 2 },
  { id: 'adv_turbines', name: 'Advanced Turbines', description: 'Increase plant output by 50%.', cost: 40_000, category: 'Utilities', prerequisiteId: 'smart_grid', requiredMilestoneLevel: 2 },
  { id: 'mixed_use', name: 'Mixed-Use Zoning', description: 'Improve commercial productivity.', cost: 25_000, category: 'Zoning', requiredMilestoneLevel: 1 },
  { id: 'high_dens_res', name: 'High-Density Residential', description: 'Unlock taller residential buildings.', cost: 30_000, category: 'Zoning', requiredMilestoneLevel: 2 },
  { id: 'high_dens_com', name: 'High-Density Commercial', description: 'Unlock larger commercial buildings.', cost: 30_000, category: 'Zoning', requiredMilestoneLevel: 2 },
  { id: 'high_dens_ind', name: 'High-Density Industrial', description: 'Unlock larger industrial buildings.', cost: 30_000, category: 'Zoning', requiredMilestoneLevel: 2 },
  { id: 'sky_permits', name: 'Skyscraper Permits', description: 'Unlock level 5 skyline buildings.', cost: 80_000, category: 'Zoning', requiredMilestoneLevel: 4 },
  { id: 'prop_tax_hike', name: 'Property Tax Hike', description: 'Increase residential revenue at a happiness cost.', cost: 5_000, category: 'Economy', requiredMilestoneLevel: 1 },
  { id: 'small_biz', name: 'Small Business Grants', description: 'Boost commercial revenue.', cost: 20_000, category: 'Economy', requiredMilestoneLevel: 1 },
  { id: 'corp_subsidies', name: 'Corporate Subsidies', description: 'Boost industrial revenue.', cost: 25_000, category: 'Economy', requiredMilestoneLevel: 2 },
  { id: 'tourism', name: 'Tourism Campaign', description: 'Turn desirability into commercial income.', cost: 50_000, category: 'Economy', requiredMilestoneLevel: 3 },
  { id: 'recycling', name: 'Recycling Mandate', description: 'Reduce service maintenance and waste pressure.', cost: 15_000, category: 'Environment', requiredMilestoneLevel: 1 },
  { id: 'green_roofs', name: 'Green Roofs', description: 'Reduce pollution and maintenance.', cost: 20_000, category: 'Environment', requiredMilestoneLevel: 2 },
  { id: 'smart_sensors', name: 'Smart City Sensors', description: 'Increase utility capacity and city awareness.', cost: 45_000, category: 'Environment', requiredMilestoneLevel: 3 },
  { id: 'ai_management', name: 'AI City Management', description: 'Reduce maintenance overhead.', cost: 100_000, category: 'Environment', requiredMilestoneLevel: 4 },
  { id: 'megacity', name: 'Megacity Protocol', description: 'Unlock the final growth multiplier.', cost: 250_000, category: 'Environment', requiredMilestoneLevel: 5 },
];

export const POLICIES: Policy[] = [
  { id: 'mixed_use', name: 'Mixed-Use Incentives', description: 'Encourage compact neighborhoods and stronger commercial demand.', dailyUpkeep: 10, unlockedMilestoneLevel: 1 },
  { id: 'small_biz', name: 'Small Business Relief', description: 'Support local shops with a modest operating subsidy.', dailyUpkeep: 10, unlockedMilestoneLevel: 1 },
  { id: 'green_roofs', name: 'Green Roof Mandate', description: 'Reduce pollution in dense districts.', dailyUpkeep: 15, unlockedMilestoneLevel: 2 },
  { id: 'recycling', name: 'Circular Waste Program', description: 'Reduce waste pressure and service overhead.', dailyUpkeep: 25, unlockedMilestoneLevel: 2 },
  { id: 'tourism', name: 'Tourism Promotion', description: 'Convert a beautiful city into additional visitor revenue.', dailyUpkeep: 30, unlockedMilestoneLevel: 3 },
  { id: 'ai_management', name: 'AI Operations Center', description: 'Automate municipal maintenance planning.', dailyUpkeep: 40, unlockedMilestoneLevel: 4 },
];

export const MISSIONS: Mission[] = [
  { id: 'first_road', title: 'Connect the District', description: 'Build at least 8 road tiles.', rewardMoney: 1_000, check: (state) => state.grid.flat().filter((tile) => tile.type === 'ROAD').length >= 8 },
  { id: 'first_utilities', title: 'Essential Services', description: 'Bring both power and water capacity online.', rewardMoney: 1_500, check: (state) => state.powerCapacity > 0 && state.waterCapacity > 0 },
  { id: 'first_citizens', title: 'Welcome Citizens', description: 'Reach a population of 25.', rewardMoney: 2_500, check: (state) => state.population >= 25 },
  { id: 'healthy_neighborhood', title: 'Healthy Neighborhood', description: 'Reach 25 residents with at least 60% happiness.', rewardMoney: 3_000, check: (state) => state.population >= 25 && state.happiness >= 60 },
  { id: 'positive_budget', title: 'Balanced Books', description: 'Reach 50 residents while keeping daily operating budget positive.', rewardMoney: 4_000, check: (state) => state.population >= 50 && (state.operatingBudget ?? state.income - state.expenses) >= 0 },
  { id: 'mobility_network', title: 'Move the City', description: 'Operate public transit with at least 20% population coverage.', rewardMoney: 5_000, check: (state) => (state.transitCoverage ?? 0) >= 20 && (state.transitActiveLines ?? 0) > 0 },
  { id: 'resilient_city', title: 'Resilient City', description: 'Build flood protection or resolve a natural disaster.', rewardMoney: 4_500, check: (state) => (state.floodBarrierCount ?? 0) > 0 || (state.disastersResolved ?? 0) > 0 },
  { id: 'balanced_city', title: 'Balanced City', description: 'Reach 70% happiness.', rewardMoney: 5_000, check: (state) => state.happiness >= 70 },
  { id: 'metro_ready', title: 'Metro Ready', description: 'Reach the Metro milestone.', rewardMoney: 10_000, check: (state) => state.milestoneLevel >= 3 },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'builder', title: 'Master Builder', description: 'Construct 50 non-empty tiles.', check: (state) => state.grid.flat().filter((tile) => tile.type !== 'EMPTY').length >= 50 },
  { id: 'green_city', title: 'Green City', description: 'Keep average pollution below 15.', check: (state) => state.population >= 50 && state.pollutionAverage < 15 },
  { id: 'prosperous', title: 'Prosperous Treasury', description: 'Accumulate $50,000.', check: (state) => state.money >= 50_000 },
  { id: 'skyline', title: 'A New Skyline', description: 'Unlock a level 5 building.', check: (state) => state.buildingLevelCounts.residential[4] > 0 || state.buildingLevelCounts.commercial[4] > 0 || state.buildingLevelCounts.industrial[4] > 0 },
];

export function getMilestoneLevel(state: Pick<CityState, 'population' | 'money'>): number {
  let level = 0;
  for (const milestone of MILESTONES) {
    if (state.population >= milestone.populationRequired && state.money >= milestone.treasuryRequired) level = milestone.level;
  }
  return level;
}
