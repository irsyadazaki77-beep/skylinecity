import { describe, it, expect } from 'vitest';
import { TileType, TransitLine } from '../types';
import { createEmptyGrid } from '../engine';
import { buildRoadGraph } from '../traffic';
import { SeededRandom } from './prng';
import {
  EducationLevel,
  AgeStage,
  Citizen,
  Household,
  WorkplaceFacility,
  SchoolFacility,
  TransitMode,
} from './types';
import { createCitizen, createHousehold, simulateDemographicMigration } from './migration';
import { syncWorkplaceFacilities, matchCitizensToWorkplaces } from './jobMatching';
import { syncSchoolFacilitiesAndEnrollment } from './schools';
import { evaluateHouseholdSatisfaction, calculateTileRent } from './satisfaction';
import { generateCitizenTrips, applyTripTrafficToRoads, findRoadPath, findTransitLineAccess } from './trips';
import { 
  createInitialCitizenSimulationState, 
  serializeCitizenSimulation, 
  hydrateCitizenSimulation,
  simulateCitizenTick 
} from './citizenManager';

describe('Skyline Simulator 2.0 - Citizen and Household Simulation (Phase 1)', () => {

  describe('1. Determinism and State Isolation', () => {
    it('should generate identical PRNG sequences from the same seed', () => {
      const rng1 = new SeededRandom(4242);
      const rng2 = new SeededRandom(4242);

      const seq1 = Array.from({ length: 20 }, () => rng1.next());
      const seq2 = Array.from({ length: 20 }, () => rng2.next());

      expect(seq1).toEqual(seq2);
    });

    it('should simulate full citizen cycles with 100% deterministic results without global state', () => {
      const gridA = createEmptyGrid();
      const gridB = createEmptyGrid();

      // Set up identical starter cities
      for (const grid of [gridA, gridB]) {
        grid[0][0].type = TileType.POWER_PLANT;
        grid[0][1].type = TileType.ROAD;
        grid[0][2].type = TileType.RESIDENTIAL;
        grid[0][2].powered = true;
        grid[0][2].watered = true;
        grid[0][3].type = TileType.ROAD;
        grid[0][4].type = TileType.COMMERCIAL;
        grid[0][4].powered = true;
        grid[0][4].watered = true;
      }

      let stateA = createInitialCitizenSimulationState(777);
      let stateB = createInitialCitizenSimulationState(777);

      const roadGraphA = buildRoadGraph(gridA);
      const roadGraphB = buildRoadGraph(gridB);

      for (let day = 1; day <= 10; day++) {
        const resA = simulateCitizenTick(stateA, gridA, roadGraphA, day, 60, 40, 9);
        const resB = simulateCitizenTick(stateB, gridB, roadGraphB, day, 60, 40, 9);
        stateA = resA.state;
        stateB = resB.state;

        expect(resA.demographics.totalCitizens).toBe(resB.demographics.totalCitizens);
        expect(resA.demographics.workforce.filledJobs).toBe(resB.demographics.workforce.filledJobs);
        expect(resA.demographics.householdStats.averageSatisfaction).toBe(resB.demographics.householdStats.averageSatisfaction);
        expect(resA.trafficAverage).toBe(resB.trafficAverage);
      }
    });

    it('should produce different simulation trajectories when different seeds are provided', () => {
      const gridA = createEmptyGrid();
      const gridB = createEmptyGrid();
      for (const grid of [gridA, gridB]) {
        grid[0][0].type = TileType.POWER_PLANT;
        grid[0][1].type = TileType.ROAD;
        grid[0][2].type = TileType.RESIDENTIAL;
        grid[0][2].powered = true;
        grid[0][2].watered = true;
      }

      const stateA = createInitialCitizenSimulationState(1001);
      const stateB = createInitialCitizenSimulationState(9999);

      const roadGraph = buildRoadGraph(gridA);
      const resA = simulateCitizenTick(stateA, gridA, roadGraph, 1, 65, 30, 9);
      const resB = simulateCitizenTick(stateB, gridB, roadGraph, 1, 65, 30, 9);

      // The demographics compositions (ages/incomes/satisfaction) differ deterministically
      expect(resA.demographics.householdStats.averageSatisfaction).not.toBe(resB.demographics.householdStats.averageSatisfaction);
    });

    it('should resolve direct transit lines and one-transfer routes by shared stops', () => {
      const lines: TransitLine[] = [
        { id: 'line-a', name: 'A', mode: 'BUS', stops: [[2, 2], [5, 2]], frequency: 8, active: true },
        { id: 'line-b', name: 'B', mode: 'BUS', stops: [[5, 2], [8, 2]], frequency: 8, active: true },
      ];

      expect(findTransitLineAccess({ x: 2, y: 7 }, { x: 8, y: 7 }, lines)).toEqual({
        available: true,
        lineIds: ['line-a', 'line-b'],
        transfers: 1,
      });
      expect(findTransitLineAccess({ x: 2, y: 3 }, { x: 5, y: 3 }, lines)).toEqual({
        available: true,
        lineIds: ['line-a'],
        transfers: 0,
      });
      expect(findTransitLineAccess({ x: 2, y: 3 }, { x: 14, y: 14 }, lines).available).toBe(false);
    });

    it('finds the shortest multi-transfer chain across a regional line graph', () => {
      const lines: TransitLine[] = [
        { id: 'line-a', name: 'A', mode: 'BUS', stops: [[2, 2], [5, 2]], frequency: 8, active: true },
        { id: 'line-b', name: 'B', mode: 'BUS', stops: [[5, 2], [8, 2]], frequency: 8, active: true },
        { id: 'line-c', name: 'C', mode: 'BUS', stops: [[8, 2], [11, 2]], frequency: 8, active: true },
      ];

      expect(findTransitLineAccess({ x: 2, y: 3 }, { x: 11, y: 3 }, lines, 2)).toEqual({
        available: true,
        lineIds: ['line-a', 'line-b', 'line-c'],
        transfers: 2,
      });
    });
  });

  describe('2. Residence-Based Proximity & Invariants', () => {
    it('should match citizens to closer workplaces based on home residence', () => {
      const prng = new SeededRandom(101);
      const grid = createEmptyGrid();

      // Workplace A at (2, 0), Workplace B at (10, 0)
      grid[0][2].type = TileType.COMMERCIAL;
      grid[0][2].level = 1;
      grid[0][2].powered = true;

      grid[0][10].type = TileType.COMMERCIAL;
      grid[0][10].level = 1;
      grid[0][10].powered = true;

      const workplaces = new Map<string, WorkplaceFacility>();
      const citizens = new Map<string, Citizen>();

      syncWorkplaceFacilities(grid, workplaces, citizens, prng);

      // Citizen living at (1, 0)
      const c1 = createCitizen('c1', 'h1', { x: 1, y: 0 }, 28, EducationLevel.HIGH_SCHOOL, prng);
      citizens.set(c1.id, c1);

      matchCitizensToWorkplaces(citizens, workplaces, prng);

      expect(c1.workplace).not.toBeNull();
      // Should match the closer workplace at (2, 0) rather than (10, 0)
      expect(c1.workplace?.workplaceTile).toEqual({ x: 2, y: 0 });
    });

    it('should enroll students into the school closest to their home residence', () => {
      const prng = new SeededRandom(202);
      const grid = createEmptyGrid();

      // School 1 at (2, 2), School 2 at (15, 15)
      grid[2][2].type = TileType.SCHOOL;
      grid[2][2].powered = true;

      grid[15][15].type = TileType.SCHOOL;
      grid[15][15].powered = true;

      const schools = new Map<string, SchoolFacility>();
      const citizens = new Map<string, Citizen>();

      // Student living at (3, 2)
      const student = createCitizen('s1', 'h1', { x: 3, y: 2 }, 10, EducationLevel.UNEDUCATED, prng);
      citizens.set(student.id, student);

      syncSchoolFacilitiesAndEnrollment(grid, schools, citizens, prng);

      expect(student.school).toEqual({ x: 2, y: 2 });
    });
  });

  describe('3. Job Metrics & Unemployment Breakdown', () => {
    it('should accurately separate totalJobSlots, filledJobs, vacantJobs, and unemployedCitizens', () => {
      const prng = new SeededRandom(103);
      const grid = createEmptyGrid();
      grid[1][1].type = TileType.COMMERCIAL;
      grid[1][1].level = 1; // 4 jobs
      grid[1][1].powered = true;

      const workplaces = new Map<string, WorkplaceFacility>();
      const citizens = new Map<string, Citizen>();

      syncWorkplaceFacilities(grid, workplaces, citizens, prng);

      // Add 6 adult citizens (only 4 jobs available)
      for (let i = 0; i < 6; i++) {
        const c = createCitizen(`c-${i}`, `h-${i}`, { x: 1, y: 0 }, 28, EducationLevel.HIGH_SCHOOL, prng);
        citizens.set(c.id, c);
      }

      const metrics = matchCitizensToWorkplaces(citizens, workplaces, prng);

      expect(metrics.totalJobSlots).toBe(4);
      expect(metrics.filledJobs).toBe(4);
      expect(metrics.vacantJobs).toBe(0);
      expect(metrics.unemployedCitizens).toBe(2);
      expect(metrics.totalEmployable).toBe(6);
      expect(metrics.unemploymentRate).toBe(33.3);
    });
  });

  describe('4. Serialization & Hydration Invariants', () => {
    it('should serialize and hydrate full citizen state without data loss', () => {
      const prng = new SeededRandom(303);
      const original = createInitialCitizenSimulationState(4040);
      original.nextCitizenId = 42;
      original.nextHouseholdId = 15;

      const c1 = createCitizen('c-1', 'h-1', { x: 5, y: 5 }, 30, EducationLevel.UNIVERSITY, prng);
      c1.workplace = {
        id: '5,6-job-0',
        workplaceTile: { x: 5, y: 6 },
        workplaceType: 'COMMERCIAL',
        educationRequired: EducationLevel.UNIVERSITY,
        salary: 65,
        jobTitle: 'Developer',
      };
      original.citizens.set(c1.id, c1);

      const h1 = createHousehold('h-1', { x: 5, y: 5 }, 25, [c1], 450);
      original.households.set(h1.id, h1);

      const serialized = serializeCitizenSimulation(original);
      const hydrated = hydrateCitizenSimulation(serialized, 4040);

      expect(hydrated.seed).toBe(4040);
      expect(hydrated.nextCitizenId).toBe(42);
      expect(hydrated.nextHouseholdId).toBe(15);
      expect(hydrated.citizens.size).toBe(1);
      expect(hydrated.households.size).toBe(1);

      const hydratedCitizen = hydrated.citizens.get('c-1')!;
      expect(hydratedCitizen.residence).toEqual({ x: 5, y: 5 });
      expect(hydratedCitizen.workplace?.salary).toBe(65);
      expect(hydratedCitizen.workplace?.jobTitle).toBe('Developer');

      const hydratedHousehold = hydrated.households.get('h-1')!;
      expect(hydratedHousehold.residence).toEqual({ x: 5, y: 5 });
      expect(hydratedHousehold.savings).toBe(450);
    });
  });

  describe('5. Integrated road load invariants', () => {
    it('should add freight vehicle-equivalent load to the road network', () => {
      const grid = createEmptyGrid();
      for (let x = 0; x <= 4; x += 1) grid[0][x].type = TileType.ROAD;
      const roadGraph = buildRoadGraph(grid);
      const freight = [{
        id: 'freight-test',
        origin: { x: 0, y: 0 },
        destination: { x: 4, y: 0 },
        path: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] as [number, number][],
        cargo: 20,
        travelTime: 6,
        source: 'LOCAL_PRODUCTION' as const,
      }];

      const emptyTraffic = applyTripTrafficToRoads(grid, roadGraph, [], [], 1, []);
      const freightTraffic = applyTripTrafficToRoads(grid, roadGraph, [], [], 1, freight);

      expect(emptyTraffic.trafficAverage).toBe(0);
      expect(freightTraffic.trafficAverage).toBeGreaterThan(0);
    });
  });
});
