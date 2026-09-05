import { GAME_CONFIG } from './config';

export enum TileType {
  EMPTY = 'EMPTY',
  ROAD = 'ROAD',
  BUS_DEPOT = 'BUS_DEPOT',
  TRAM_STATION = 'TRAM_STATION',
  BUS_STOP = 'BUS_STOP',
  TRAM_STOP = 'TRAM_STOP',
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL',
  OFFICE = 'OFFICE',
  INDUSTRIAL = 'INDUSTRIAL',
  POWER_PLANT = 'POWER_PLANT',
  WATER_PUMP = 'WATER_PUMP',
  FIRE_STATION = 'FIRE_STATION',
  POLICE_STATION = 'POLICE_STATION',
  CLINIC = 'CLINIC',
  SCHOOL = 'SCHOOL',
  WASTE_MANAGEMENT = 'WASTE_MANAGEMENT',
  WAREHOUSE = 'WAREHOUSE',
  CARGO_TERMINAL = 'CARGO_TERMINAL',
  PARK = 'PARK',
  PARKING = 'PARKING',
  FLOOD_BARRIER = 'FLOOD_BARRIER',
  WATER_RESERVOIR = 'WATER_RESERVOIR',
}

export type ResourceType = 'none' | 'fertile' | 'ore' | 'oil' | 'forest';

export type RoadClass = 'LOCAL' | 'ARTERIAL' | 'HIGHWAY';

export type IntersectionControl = 'AUTO' | 'SIGNAL' | 'STOP' | 'ROUNDABOUT';
export type SignalTimingMode = 'ADAPTIVE' | 'FIXED_NS' | 'FIXED_EW';
/** Vehicle/pedestrian stages emitted by the deterministic intersection clock. */
export type SignalStage = 'GREEN' | 'YELLOW' | 'ALL_RED' | 'PEDESTRIAN_CROSSING' | 'PERMISSIVE';
export type TurnMovement = 'STRAIGHT' | 'LEFT' | 'RIGHT' | 'U_TURN';
export type MixedUseFloorProgram = 'RETAIL_LIVING' | 'CREATIVE_OFFICE' | 'HOSPITALITY' | 'COMMUNITY_HUB';

export type RoadStructure = 'GROUND' | 'BRIDGE' | 'TUNNEL';

export type ParcelOwnership = 'CITY' | 'PRIVATE';
export type ParcelStatus = 'ZONED' | 'DEVELOPING' | 'ACTIVE' | 'ABANDONED';

export type TerrainTool = 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';

export type ServiceTypeKey = 'fire' | 'police' | 'health' | 'school' | 'waste';

export type ActiveTool = TileType | 'RESIDENTIAL_MEDIUM' | 'RESIDENTIAL_HIGH' | 'POINTER' | 'BULLDOZER' | 'ROAD_REPAIR' | 'TRANSIT_LINE' | 'DISTRICT' | 'TUNNEL_ROAD' | TerrainTool;

export type TransitLineMode = 'BUS' | 'TRAM';
export type ZoneDensity = 'LOW' | 'MEDIUM' | 'HIGH';
export type ResidentialHouseholdType = 'SINGLE' | 'COUPLE' | 'FAMILY' | 'SENIOR';
export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
export type WeatherType = 'CLEAR' | 'RAIN' | 'STORM' | 'HEATWAVE' | 'DROUGHT';

/** Deterministic phases used by the long-running city simulation pipeline. */
export type SimulationPhase =
  | 'INPUT'
  | 'UTILITIES'
  | 'POPULATION'
  | 'ECONOMY'
  | 'TRAFFIC'
  | 'SERVICES'
  | 'INCIDENTS'
  | 'DISASTERS'
  | 'HISTORY';

export type SimulationCommandType =
  | 'BUILD_ROAD'
  | 'BUILD_TILE'
  | 'ZONE_LAND'
  | 'DEMOLISH_TILE'
  | 'TERRAFORM'
  | 'REPAIR_ROAD'
  | 'UPGRADE_SERVICE'
  | 'ORDER_SERVICE_MAINTENANCE'
  | 'SET_SIGNAL'
  | 'CREATE_TRANSIT_LINE'
  | 'REMOVE_TRANSIT_LINE'
  | 'TOGGLE_TRANSIT_LINE'
  | 'UPDATE_TRANSIT_LINE'
  | 'START_RECOVERY_PROJECT'
  | 'SET_POLICY'
  | 'SET_TAX'
  | 'CREATE_DISTRICT'
  | 'REMOVE_DISTRICT'
  | 'UNLOCK_REGION'
  | 'UNLOCK_TECH'
  | 'CLAIM_MISSION'
  | 'START_SCENARIO'
  | 'SET_DISASTER_PREPARATION'
  | 'SET_CAMPAIGN_STYLE'
  | 'CREATE_TRADE_CONTRACT';

export interface SimulationCommand<TPayload = Record<string, unknown>> {
  id: string;
  type: SimulationCommandType;
  issuedDay: number;
  source: 'PLAYER' | 'SCENARIO' | 'SYSTEM';
  payload: TPayload;
}

export interface SimulationEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: string;
  day: number;
  phase: SimulationPhase;
  payload: TPayload;
}

export interface RoadLaneState {
  laneIndex: number;
  load: number;
  queue: number;
  dischargeRate: number;
  targetMovement?: TurnMovement;
}

export interface SignalPhaseState {
  stage: SignalStage;
  axis: 'NORTH_SOUTH' | 'EAST_WEST' | 'ALL';
  /** Position of the complete two-approach cycle, in deterministic seconds. */
  elapsedSeconds: number;
  /** Position inside the current stage, in deterministic seconds. */
  phaseElapsedSeconds: number;
  cycleSeconds: number;
  greenSeconds: number;
  yellowSeconds: number;
  allRedSeconds: number;
  pedestrianSeconds: number;
  pedestrianCrossing: boolean;
}

export interface RegionState {
  key: string;
  rx: number;
  ry: number;
  active: boolean;
  loaded: boolean;
  simulationLevel: 'FULL' | 'BACKGROUND' | 'FROZEN';
  lastSimulatedDay: number;
  residentCount: number;
  jobCount: number;
  trafficLoad: number;
  freightLoad: number;
  waterDepth: number;
}

export interface TradeContract {
  id: string;
  commodity: import('./logistics').FreightCommodity;
  direction: 'IMPORT' | 'EXPORT';
  quantityPerDay: number;
  pricePerUnit: number;
  reliability: number;
  remainingDays: number;
  active: boolean;
}

export interface RecoveryProject {
  id: string;
  type: 'ROAD_REPAIR' | 'FLOOD_CONTROL' | 'REBUILD_DISTRICT' | 'UTILITY_RESTORE';
  title: string;
  tiles: [number, number][];
  totalCost: number;
  remainingCost: number;
  totalWork: number;
  completedWork: number;
  remainingDays: number;
  active: boolean;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  seed: number;
  tags: string[];
  targetDays?: number;
  objectives: { id: string; label: string; target: number }[];
  premise?: string;
  constraints?: string[];
  events?: string[];
  hardChoices?: string[];
}

export interface ModManifest {
  id: string;
  name: string;
  version: string;
  gameVersion: string;
  namespace: string;
  dependencies?: string[];
  content: string[];
}

export interface CausalDiagnostic {
  id: string;
  category: 'POPULATION' | 'TRAFFIC' | 'ECONOMY' | 'SERVICES' | 'ENVIRONMENT' | 'BUILDING';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  explanation: string;
  value: number;
  threshold?: number;
  location?: { x: number; y: number };
  recommendation?: string;
  cause?: string;
  estimatedCost?: number;
  projectedImpact?: string;
  day: number;
}

export type CityIncidentType = 'FIRE' | 'MEDICAL' | 'CRIME' | 'TRAFFIC';

export type CityDisasterType = 'EARTHQUAKE' | 'FLOOD' | 'WILDFIRE' | 'STORM';

export interface CityIncident {
  id: string;
  type: CityIncidentType;
  x: number;
  y: number;
  severity: 1 | 2 | 3;
  createdDay: number;
  remainingDays: number;
  roadConnected: boolean;
  assignedFacility?: { x: number; y: number };
  dispatchPath?: [number, number][];
  parentIncidentId?: string;
  requiredUnits?: number;
  dispatchedUnits?: number;
  responseProgress?: number;
}

export type ServiceVehicleRole = 'FIRE_ENGINE' | 'AMBULANCE' | 'POLICE_CAR' | 'TRAFFIC_UNIT';
export type ServiceVehicleStatus = 'DISPATCHING' | 'ON_SCENE' | 'RETURNING';

export interface ServiceVehicleAgent {
  id: string;
  incidentId: string;
  role: ServiceVehicleRole;
  status: ServiceVehicleStatus;
  facility: { x: number; y: number };
  path: [number, number][];
  routeProgress: number;
  condition: number;
  fuel: number;
  createdDay: number;
}

export interface ServiceMaintenanceOrder {
  id: string;
  facility: { x: number; y: number };
  remainingTicks: number;
  cost: number;
  createdDay: number;
}

export interface CityDisaster {
  id: string;
  type: CityDisasterType;
  centerX: number;
  centerY: number;
  radius: number;
  severity: 1 | 2 | 3;
  createdDay: number;
  remainingDays: number;
  affectedTiles: number;
}

export interface TransitLine {
  id: string;
  name: string;
  mode: TransitLineMode;
  stops: [number, number][];
  frequency: number;
  active: boolean;
  serviceStartHour?: number;
  serviceEndHour?: number;
  peakStartHour?: number;
  peakEndHour?: number;
  peakFrequency?: number;
}

export type OverlayMode =
  | 'NONE'
  | 'TRAFFIC'
  | 'ROAD_CONDITION'
  | 'ROAD_HIERARCHY'
  | 'TRANSIT'
  | 'TRANSIT_ROUTES'
  | 'DISPATCH'
  | 'SERVICE_RESPONSE'
  | 'POWER'
  | 'WATER'
  | 'WASTE'
  | 'HEALTH'
  | 'EDUCATION'
  | 'FIRE'
  | 'POLICE'
  | 'LAND_VALUE'
  | 'POLLUTION'
  | 'NOISE'
  | 'HAPPINESS'
  | 'INCIDENTS'
  | 'DISASTERS'
  | 'NATURAL_RESOURCES'
  | 'HYDROLOGY'
  | 'DISTRICTS';

export interface TileData {
  type: TileType;
  x: number;
  y: number;
  level: number;
  population: number;
  jobs: number;
  traffic: number;
  powered: boolean;
  watered: boolean;
  productivity: number;
  abandoned: boolean;
  fireCovered: boolean;
  policeCovered: boolean;
  healthCovered: boolean;
  schoolCovered: boolean;
  wasteCovered: boolean;
  landValue: number;
  suitability?: number;
  pollution: number;
  noise: number;
  crime: number;
  health: number;
  education: number;
  upgradeProgress: number;
  elevation: number;
  resource: ResourceType;
  water: boolean;
  roadClass?: RoadClass;
  roadStructure?: RoadStructure;
  roadCondition?: number;
  /** Stable land ownership/subdivision metadata shared by a parcel's tiles. */
  parcelId?: string;
  parcelSeed?: number;
  parcelWidth?: number;
  parcelHeight?: number;
  parcelIndex?: number;
  parcelOwnership?: ParcelOwnership;
  parcelStatus?: ParcelStatus;
  /** Transient lane telemetry written by traffic simulation. */
  laneUtilization?: number;
  laneChangePressure?: number;
  queuePressure?: number;
  laneStates?: RoadLaneState[];
  intersectionControl?: IntersectionControl;
  signalTimingMode?: SignalTimingMode;
  signalOffsetHours?: number;
  signalStage?: SignalStage;
  pedestrianCrossing?: boolean;
  prohibitedTurns?: TurnMovement[];
  mixedUseProgram?: MixedUseFloorProgram;
  zoneDensity?: ZoneDensity;
  rent?: number;
  rentPressure?: number;
  affordability?: number;
  serviceUpgrades?: string[];
  companySector?: string;
  companyEfficiency?: number;
  companyProfit?: number;
  inputShortage?: number;
  mixedUseFloorCount?: number;
  mixedUseRetailFloors?: number;
  mixedUseOfficeFloors?: number;
  mixedUseResidentialFloors?: number;
  transitCovered?: boolean;
  /** Estimated road response time in minutes for each service category. */
  serviceResponseTimes?: Partial<Record<ServiceTypeKey, number>>;
  incidentSeverity?: number;
  disasterSeverity?: number;
  disasterImpact?: number;
  waterDepth?: number;
  flowDx?: number;
  flowDy?: number;
  reservoirLevel?: number;
}

export interface HistoryRecord {
  day: number;
  population: number;
  money: number;
  income: number;
  expenses: number;
  happiness: number;
  desirability?: number;
  trafficAverage?: number;
  residentialDemand?: number;
  commercialDemand?: number;
  officeDemand?: number;
  industrialDemand?: number;
  congestionIndex?: number;
  averageCommuteTime?: number;
  serviceResponseQuality?: number;
  transitCoverage?: number;
}

export interface CityEventData {
  id: string;
  name: string;
  description: string;
  durationDays: number;
  remainingDays: number;
  type: 'HEATWAVE' | 'ECONOMIC_BOOM' | 'HEAVY_RAIN' | 'TECH_SURGE' | 'RECESSION';
  demandMultiplier?: number;
  powerDemandMultiplier?: number;
  waterDemandMultiplier?: number;
  incomeMultiplier?: number;
  happinessImpact?: number;
}

export interface GameSettings {
  difficulty: 'easy' | 'normal' | 'hard';
  autosave: boolean;
  shadowQuality: 'low' | 'medium' | 'high';
  antialiasing: boolean;
  renderScale: number; // 50, 75, 100, 120
  trafficDensity: 'low' | 'medium' | 'high';
  vegetationDensity: 'low' | 'medium' | 'high';
  dayNightCycle: 'enabled' | 'disabled' | 'locked_day' | 'locked_night';
  vsync: boolean;
  volume: number;
  musicVolume: number;
  /** User-facing release settings. Optional in old fixtures and normalized at load time. */
  language?: 'id' | 'en';
  reducedMotion?: boolean;
  uiScale?: 'small' | 'medium' | 'large';
  adaptiveQuality?: boolean;
  experimentalFeatures?: boolean;
  highContrast?: boolean;
  colorblindMode?: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
}

export interface CityState {
  /** Save schema used by migration code. Optional for backwards-compatible test fixtures. */
  schemaVersion?: number;
  featureSet?: 'stable' | 'experimental';
  grid: TileData[][];
  money: number;
  population: number;
  day: number;
  timeOfDay?: number;
  season?: Season;
  weather?: WeatherType;
  temperature?: number;
  precipitation?: number;
  climatePowerMultiplier?: number;
  climateWaterMultiplier?: number;
  climateTrafficMultiplier?: number;
  climateFireRisk?: number;
  floodedTiles?: number;
  averageWaterDepth?: number;
  peakWaterDepth?: number;
  flowingWaterTiles?: number;
  reservoirStorage?: number;
  floodBarrierCount?: number;
  powerCapacity: number;
  powerDemand: number;
  waterCapacity: number;
  waterDemand: number;
  trafficAverage: number;
  averageCommuteTime: number;
  congestionIndex: number;
  averageQueuePressure?: number;
  income: number;
  expenses: number;
  unlockedUpgrades: string[];
  households: number;
  workers: number;
  employment: number;
  unemploymentRate: number;
  availableJobs: number;
  residentialDemand: number;
  commercialDemand: number;
  officeDemand?: number;
  industrialDemand: number;
  consumerDemand?: number;
  retailSupply?: number;
  goodsDemand?: number;
  goodsSupply?: number;
  commercialUtilization?: number;
  officeUtilization?: number;
  industrialUtilization?: number;
  officeRevenue?: number;
  marketHealth?: number;
  freightDemand?: number;
  freightCapacity?: number;
  freightReliability?: number;
  industrialAccess?: number;
  commercialStock?: number;
  commodityDemand?: Record<import('./logistics').FreightCommodity, number>;
  commoditySupply?: Record<import('./logistics').FreightCommodity, number>;
  commodityStock?: Record<import('./logistics').FreightCommodity, number>;
  productionInputDemand?: Record<import('./logistics').FreightCommodity, number>;
  productionEfficiency?: number;
  cargoTerminals?: number;
  cargoThroughput?: number;
  connectedIndustries?: number;
  warehouses?: number;
  warehouseCapacity?: number;
  warehouseBuffer?: number;
  warehouseInventory?: Record<string, number>;
  desirability: number;
  residentialTaxRate: number;
  commercialTaxRate: number;
  industrialTaxRate: number;
  history: HistoryRecord[];
  happiness: number;
  healthcareCoverage: number;
  educationCoverage: number;
  fireSafety: number;
  crimeRate: number;
  wasteCapacity: number;
  wasteProduction: number;
  wasteCoverage: number;
  fireServiceCapacity?: number;
  policeServiceCapacity?: number;
  healthcareCapacity?: number;
  educationCapacity?: number;
  serviceResponseQuality?: number;
  incidents?: CityIncident[];
  serviceVehicles?: ServiceVehicleAgent[];
  serviceFleetTotal?: number;
  serviceFleetActive?: number;
  serviceFleetAvailable?: number;
  serviceFleetOnScene?: number;
  serviceFleetAverageCondition?: number;
  serviceDepotCondition?: Record<string, number>;
  serviceFleetMaintenanceCost?: number;
  serviceMaintenanceOrders?: ServiceMaintenanceOrder[];
  serviceBayQueues?: Record<string, number>;
  parcelCount?: number;
  developedParcelCount?: number;
  privateParcelCount?: number;
  averageParcelSize?: number;
  mixedUseBlocks?: number;
  mixedUseFloorArea?: number;
  mixedUseJobs?: number;
  activeIncidents?: number;
  incidentResponseLoad?: number;
  incidentsResolved?: number;
  incidentHappinessPenalty?: number;
  incidentDispatchedUnits?: number;
  incidentQueuedUnits?: number;
  disasters?: CityDisaster[];
  activeDisasters?: number;
  disasterResponseLoad?: number;
  disastersResolved?: number;
  disasterHappinessPenalty?: number;
  disasterRecoveryRate?: number;
  milestoneLevel: number;
  activePolicies: string[];
  districts?: import('./districts').CityDistrict[];
  activeEvents: string[];
  eventsData?: CityEventData[];
  completedMissions: string[];
  unlockedAchievements: string[];
  landValueAverage: number;
  suitabilityAverage?: number;
  pollutionAverage: number;
  noiseAverage: number;
  educationLevel: number;
  healthIndex: number;
  buildingLevelCounts: {
    residential: number[];
    commercial: number[];
    industrial: number[];
  };
  unlockedRegions: string[];
  transitCapacity?: number;
  transitRidership?: number;
  transitCoverage?: number;
  transitBusDepots?: number;
  transitTramStations?: number;
  transitActiveLines?: number;
  transitActiveVehicles?: number;
  transitAverageWait?: number;
  transitTransferOpportunities?: number;
  transitPlatformCapacity?: number;
  transitAverageDwell?: number;
  transitFareRevenue?: number;
  transitOperatingCost?: number;
  parkingDemand?: number;
  parkingSupply?: number;
  parkingCoverage?: number;
  parkingPressure?: number;
  transitLines?: TransitLine[];
  transitVehicles?: import('./transit').TransitVehicleAgent[];
  activeFreightTrips?: import('./logistics').FreightTrip[];
  seed?: number;
  demographics?: import('./citizenSimulation/types').DemographicBreakdown;
  activeTrips?: import('./citizenSimulation/types').Trip[];
  citizenState?: import('./citizenSimulation/types').SerializedCitizenSimulationState;
  totalJobSlots?: number;
  filledJobs?: number;
  vacantJobs?: number;
  unemployedCitizens?: number;
  /** Long-running simulation metadata introduced by Metropolis 3.0. */
  regions?: Record<string, RegionState>;
  activeRegionKeys?: string[];
  commandQueue?: SimulationCommand[];
  recentSimulationEvents?: SimulationEvent[];
  simulationPhase?: SimulationPhase;
  tradeContracts?: TradeContract[];
  tradeImportCapacity?: number;
  tradeExportCapacity?: number;
  tradeExportRevenue?: number;
  recoveryProjects?: RecoveryProject[];
  causalDiagnostics?: CausalDiagnostic[];
  citizenStoryState?: import('./citizenStories').CitizenStoryState;
  neighborhoodIdentityState?: import('./neighborhoodIdentity').NeighborhoodIdentityState;
  disasterPreparationState?: import('./disasterPreparation').DisasterPreparationState;
  policyConsequences?: import('./policyConsequences').PolicyConsequence[];
  cityHistoryState?: import('./cityHistory').CityHistoryState;
  campaignEvaluation?: import('./campaigns').CampaignEvaluation;
  campaignStyleGoal?: import('./campaigns').CityStyleGoal;
  primaryEmigrationReason?: string;
  municipalDebt?: number;
  capitalBudget?: number;
  operatingBudget?: number;
  specialization?: 'BALANCED' | 'TOURISM' | 'EDUCATION' | 'TECHNOLOGY' | 'LOGISTICS' | 'GREEN_INDUSTRY' | 'TRANSIT_METROPOLIS' | 'RESILIENT' | 'MIXED_USE';
  activeScenarioId?: string;
  scenarioCompleted?: boolean;
  scenarioObjectiveValues?: Record<string, number>;
  /** Persisted deterministic signal clocks, keyed by `${x},${y}` intersection key. */
  signalStates?: Record<string, SignalPhaseState>;
}

export const BUILD_COSTS: Record<TileType, number> = {
  [TileType.EMPTY]: GAME_CONFIG.BUILD_COSTS.EMPTY,
  [TileType.ROAD]: GAME_CONFIG.BUILD_COSTS.ROAD,
  [TileType.BUS_DEPOT]: GAME_CONFIG.BUILD_COSTS.BUS_DEPOT,
  [TileType.TRAM_STATION]: GAME_CONFIG.BUILD_COSTS.TRAM_STATION,
  [TileType.BUS_STOP]: GAME_CONFIG.BUILD_COSTS.BUS_STOP,
  [TileType.TRAM_STOP]: GAME_CONFIG.BUILD_COSTS.TRAM_STOP,
  [TileType.RESIDENTIAL]: GAME_CONFIG.BUILD_COSTS.RESIDENTIAL,
  [TileType.COMMERCIAL]: GAME_CONFIG.BUILD_COSTS.COMMERCIAL,
  [TileType.INDUSTRIAL]: GAME_CONFIG.BUILD_COSTS.INDUSTRIAL,
  [TileType.OFFICE]: GAME_CONFIG.BUILD_COSTS.OFFICE,
  [TileType.POWER_PLANT]: GAME_CONFIG.BUILD_COSTS.POWER_PLANT,
  [TileType.WATER_PUMP]: GAME_CONFIG.BUILD_COSTS.WATER_PUMP,
  [TileType.FIRE_STATION]: GAME_CONFIG.BUILD_COSTS.FIRE_STATION,
  [TileType.POLICE_STATION]: GAME_CONFIG.BUILD_COSTS.POLICE_STATION,
  [TileType.CLINIC]: GAME_CONFIG.BUILD_COSTS.CLINIC,
  [TileType.SCHOOL]: GAME_CONFIG.BUILD_COSTS.SCHOOL,
  [TileType.WASTE_MANAGEMENT]: GAME_CONFIG.BUILD_COSTS.WASTE_MANAGEMENT,
  [TileType.WAREHOUSE]: GAME_CONFIG.BUILD_COSTS.WAREHOUSE,
  [TileType.CARGO_TERMINAL]: GAME_CONFIG.BUILD_COSTS.CARGO_TERMINAL,
  [TileType.PARK]: GAME_CONFIG.BUILD_COSTS.PARK,
  [TileType.PARKING]: GAME_CONFIG.BUILD_COSTS.PARKING,
  [TileType.FLOOD_BARRIER]: GAME_CONFIG.BUILD_COSTS.FLOOD_BARRIER,
  [TileType.WATER_RESERVOIR]: GAME_CONFIG.BUILD_COSTS.WATER_RESERVOIR,
};

export const ROAD_BUILD_COSTS: Record<RoadClass, number> = {
  LOCAL: GAME_CONFIG.ROAD_CLASSES.LOCAL.BUILD_COST,
  ARTERIAL: GAME_CONFIG.ROAD_CLASSES.ARTERIAL.BUILD_COST,
  HIGHWAY: GAME_CONFIG.ROAD_CLASSES.HIGHWAY.BUILD_COST,
};

export const ROAD_MAINTENANCE_COSTS: Record<RoadClass, number> = {
  LOCAL: GAME_CONFIG.ROAD_CLASSES.LOCAL.MAINTENANCE,
  ARTERIAL: GAME_CONFIG.ROAD_CLASSES.ARTERIAL.MAINTENANCE,
  HIGHWAY: GAME_CONFIG.ROAD_CLASSES.HIGHWAY.MAINTENANCE,
};

export const TERRAFORM_COST = GAME_CONFIG.TERRAFORM_COST;
export const ROAD_REPAIR_COST = GAME_CONFIG.ROAD_REPAIR_COST;
export const TUNNEL_BUILD_COST = Math.round(GAME_CONFIG.ROAD_CLASSES.HIGHWAY.BUILD_COST * GAME_CONFIG.TUNNEL_COST_MULTIPLIER);

export function getRoadClass(tile: Pick<TileData, 'roadClass'>): RoadClass {
  return tile.roadClass ?? 'LOCAL';
}

export const MAINTENANCE_COSTS: Record<TileType, number> = {
  [TileType.EMPTY]: GAME_CONFIG.MAINTENANCE_COSTS.EMPTY,
  [TileType.ROAD]: GAME_CONFIG.MAINTENANCE_COSTS.ROAD,
  [TileType.BUS_DEPOT]: GAME_CONFIG.MAINTENANCE_COSTS.BUS_DEPOT,
  [TileType.TRAM_STATION]: GAME_CONFIG.MAINTENANCE_COSTS.TRAM_STATION,
  [TileType.BUS_STOP]: GAME_CONFIG.MAINTENANCE_COSTS.BUS_STOP,
  [TileType.TRAM_STOP]: GAME_CONFIG.MAINTENANCE_COSTS.TRAM_STOP,
  [TileType.RESIDENTIAL]: GAME_CONFIG.MAINTENANCE_COSTS.RESIDENTIAL,
  [TileType.COMMERCIAL]: GAME_CONFIG.MAINTENANCE_COSTS.COMMERCIAL,
  [TileType.INDUSTRIAL]: GAME_CONFIG.MAINTENANCE_COSTS.INDUSTRIAL,
  [TileType.OFFICE]: GAME_CONFIG.MAINTENANCE_COSTS.OFFICE,
  [TileType.POWER_PLANT]: GAME_CONFIG.MAINTENANCE_COSTS.POWER_PLANT,
  [TileType.WATER_PUMP]: GAME_CONFIG.MAINTENANCE_COSTS.WATER_PUMP,
  [TileType.FIRE_STATION]: GAME_CONFIG.MAINTENANCE_COSTS.FIRE_STATION,
  [TileType.POLICE_STATION]: GAME_CONFIG.MAINTENANCE_COSTS.POLICE_STATION,
  [TileType.CLINIC]: GAME_CONFIG.MAINTENANCE_COSTS.CLINIC,
  [TileType.SCHOOL]: GAME_CONFIG.MAINTENANCE_COSTS.SCHOOL,
  [TileType.WASTE_MANAGEMENT]: GAME_CONFIG.MAINTENANCE_COSTS.WASTE_MANAGEMENT,
  [TileType.WAREHOUSE]: GAME_CONFIG.MAINTENANCE_COSTS.WAREHOUSE,
  [TileType.CARGO_TERMINAL]: GAME_CONFIG.MAINTENANCE_COSTS.CARGO_TERMINAL,
  [TileType.PARK]: GAME_CONFIG.MAINTENANCE_COSTS.PARK,
  [TileType.PARKING]: GAME_CONFIG.MAINTENANCE_COSTS.PARKING,
  [TileType.FLOOD_BARRIER]: GAME_CONFIG.MAINTENANCE_COSTS.FLOOD_BARRIER,
  [TileType.WATER_RESERVOIR]: GAME_CONFIG.MAINTENANCE_COSTS.WATER_RESERVOIR,
};

export function createTile(x: number, y: number, overrides: Partial<TileData> = {}): TileData {
  return {
    type: TileType.EMPTY,
    x,
    y,
    level: 1,
    population: 0,
    jobs: 0,
    traffic: 0,
    powered: false,
    watered: false,
    productivity: 0,
    abandoned: false,
    fireCovered: false,
    policeCovered: false,
    healthCovered: false,
    schoolCovered: false,
    wasteCovered: false,
    landValue: 30,
    suitability: 50,
    pollution: 0,
    noise: 0,
    crime: 30,
    health: 50,
    education: 0,
    upgradeProgress: 0,
    elevation: 1,
    resource: 'none',
    water: false,
    roadClass: 'LOCAL',
    roadCondition: 100,
    transitCovered: false,
    disasterSeverity: 0,
    disasterImpact: 0,
    ...overrides,
  };
}
