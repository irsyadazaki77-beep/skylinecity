import { ZoneDensity, ResidentialHouseholdType } from '../types';

export enum EducationLevel {
  UNEDUCATED = 0, // Elementary / No formal qualification (basic industry, entry retail)
  HIGH_SCHOOL = 1, // High school diploma (standard commercial, manufacturing, logistics)
  UNIVERSITY = 2,  // Higher education (tech, healthcare, high-tier offices, management)
}

export enum AgeStage {
  CHILD = 'CHILD',       // 0-17: Attends school, no job, dependent
  STUDENT = 'STUDENT',   // 18-24: May attend higher education or work
  ADULT = 'ADULT',       // 18-64: Active workforce
  SENIOR = 'SENIOR',     // 65+: Retired, high healthcare & park need
}

export enum TripPurpose {
  COMMUTE_WORK = 'COMMUTE_WORK',
  COMMUTE_SCHOOL = 'COMMUTE_SCHOOL',
  SHOPPING = 'SHOPPING',
  HEALTHCARE = 'HEALTHCARE',
  LEISURE = 'LEISURE',
}

export enum TransitMode {
  CAR = 'CAR',
  TRANSIT = 'TRANSIT',
  BIKE = 'BIKE',
  WALK = 'WALK',
}

export interface ServiceNeed {
  healthcare: number; // 0-100 desire/need
  education: number;  // 0-100 need (high for children/students)
  leisure: number;    // 0-100 need for parks/entertainment
  goods: number;      // 0-100 need for commercial shopping
}

export interface WorkplaceJob {
  id: string;
  workplaceTile: { x: number; y: number };
  workplaceType: 'COMMERCIAL' | 'OFFICE' | 'INDUSTRIAL' | 'SERVICE';
  educationRequired: EducationLevel;
  salary: number; // Daily salary
  jobTitle: string;
}

export interface Citizen {
  id: string;
  householdId: string;
  residence: { x: number; y: number };
  age: number;
  stage: AgeStage;
  education: EducationLevel;
  workplace: WorkplaceJob | null;
  school: { x: number; y: number } | null;
  health: number;       // 0-100
  happiness: number;    // 0-100
  commuteTime: number;  // In minutes
  serviceNeeds: ServiceNeed;
}

export interface HouseholdSatisfactionFactors {
  rentAffordability: number; // 0-100
  employment: number;        // 0-100
  commute: number;           // 0-100
  crime: number;             // 0-100 (100 = low crime)
  pollution: number;         // 0-100 (100 = clean air)
  schoolAccess: number;      // 0-100
  healthAccess: number;      // 0-100
  overall: number;           // 0-100
}

export interface Household {
  id: string;
  residence: { x: number; y: number }; // Tile coordinates of home
  citizenIds: string[];
  savings: number;                     // Household wealth
  rent: number;                        // Daily rent price
  satisfaction: number;                // 0-100 composite satisfaction
  satisfactionFactors: HouseholdSatisfactionFactors;
  relocationTimer: number;             // Consecutive days dissatisfied
  householdType?: ResidentialHouseholdType;
  preferredDensity?: ZoneDensity;
  incomeClass?: 'LOW' | 'MIDDLE' | 'HIGH';
}

export interface WorkplaceFacility {
  tileX: number;
  tileY: number;
  type: 'COMMERCIAL' | 'OFFICE' | 'INDUSTRIAL' | 'SERVICE';
  level: number;
  totalCapacity: number;
  positions: WorkplaceJob[];
}

export interface SchoolFacility {
  tileX: number;
  tileY: number;
  level: number;
  capacity: number;
  enrolledCitizenIds: string[];
}

export interface Trip {
  id: string;
  citizenId: string;
  householdId: string;
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  purpose: TripPurpose;
  path: [number, number][]; // Road coordinates [x, y] traversed
  travelTime: number;        // Travel time in minutes
  mode: TransitMode;
  transitLineIds?: string[];
  transfers?: number;
}

export interface MigrationSummary {
  immigrants: number;
  emigrants: number;
  relocations: number;
  netMigration: number;
  emigrationReasons?: Record<string, number>;
  primaryEmigrationReason?: string;
}

export interface WorkforceMetrics {
  totalJobSlots: number;
  filledJobs: number;
  vacantJobs: number;
  unemployedCitizens: number;
  employable: number;
  employed: number;
  unemployed: number;
  totalEmployable: number;
  totalEmployed: number;
  totalUnemployed: number;
  unemploymentRate: number;
  averageSalary: number;
}

export interface DemographicBreakdown {
  totalCitizens: number;
  /** Number of citizens represented by sampled simulation agents. */
  representedCitizens?: number;
  totalHouseholds: number;
  /** Number of households represented by sampled simulation agents. */
  representedHouseholds?: number;
  ageDistribution: {
    children: number;
    students: number;
    adults: number;
    seniors: number;
  };
  educationDistribution: {
    uneducated: number;
    highSchool: number;
    university: number;
  };
  workforce: WorkforceMetrics;
  householdStats: {
    averageSatisfaction: number;
    averageRent: number;
    averageSavings: number;
    homelessHouseholds: number;
  };
  tripStats: {
    totalTrips: number;
    averageCommuteTime: number;
    carTrips: number;
    transitTrips: number;
    bikeTrips: number;
    walkTrips: number;
  };
  migration: MigrationSummary;
}

export interface SerializedCitizenSimulationState {
  seed: number;
  nextCitizenId: number;
  nextHouseholdId: number;
  citizens: Citizen[];
  households: Household[];
  workplaces: WorkplaceFacility[];
  schools: SchoolFacility[];
  activeTrips: Trip[];
  demographics: DemographicBreakdown;
  samplingFactor: number;
  /** 1 = one simulated agent represents one citizen; larger values enable scalable cohorts. */
  populationScale?: number;
  /** Population represented by the serialized sampled agents. */
  representedPopulation?: number;
}

export interface CitizenSimulationState {
  seed: number;
  nextCitizenId: number;
  nextHouseholdId: number;
  citizens: Map<string, Citizen>;
  households: Map<string, Household>;
  workplaces: Map<string, WorkplaceFacility>;
  schools: Map<string, SchoolFacility>;
  activeTrips: Trip[];
  demographics: DemographicBreakdown;
  samplingFactor: number; // 1 = 1:1, >1 = 1 agent represents N citizens
  populationScale: number; // 1 = 1:1 population; >1 = each sampled agent represents N citizens
  representedPopulation: number;
}
