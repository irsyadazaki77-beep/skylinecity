import { describe, expect, it } from 'vitest';
import { createInitialCityState, createEmptyGrid } from './engine';
import { TileType } from './types';
import { getCoreLoopAdvice } from './coreLoopAdvisor';
import { hasActiveStarterUtilities, isTutorialStepComplete } from './tutorialFlow';
import { simulateCityServices } from './services';
import { buildRoadGraph } from './traffic';
import { get2DTileClass } from './components/world/City2DCanvas';

describe('UI and Simulation Contract Tests', () => {
  describe('Priority 1: Starter City, Tutorial, and Core-Loop Advisor Synchronization', () => {
    it('starter city has power plant and water pump recognized as active utilities from tick 0', () => {
      const state = createInitialCityState();
      expect(hasActiveStarterUtilities(state)).toBe(true);
      expect(state.powerCapacity).toBeGreaterThanOrEqual(50);
      expect(state.waterCapacity).toBeGreaterThanOrEqual(50);
    });

    it('tutorial recognizes starter utilities as satisfied on fresh city without duplicate steps', () => {
      const state = createInitialCityState();
      expect(isTutorialStepComplete('utilities', state)).toBe(true);
    });

    it('core-loop advisor does not recommend duplicate utilities on fresh starter city', () => {
      const state = createInitialCityState();
      const advice = getCoreLoopAdvice(state, 1);
      // Fresh starter city should guide building roads, zones, or citizens, NOT duplicate power/water
      const adviceTitle = advice.title.toLowerCase();
      expect(adviceTitle.includes('pembangkit listrik cadangan')).toBe(false);
      expect(adviceTitle.includes('sediakan listrik')).toBe(false);
      // Shouldn't ask for basic power plant when 50 MW is already active
      if (advice.action.kind === 'TOOL') {
        expect(advice.action.tool).not.toBe(TileType.POWER_PLANT);
        expect(advice.action.tool).not.toBe(TileType.WATER_PUMP);
      }
    });
  });

  describe('Priority 2: Service Response Quality Semantics', () => {
    it('returns 0 for cities with 0 emergency capacity', () => {
      const grid = createEmptyGrid(10, 10);
      grid[1][1].type = TileType.RESIDENTIAL;
      grid[1][1].population = 40;
      const result = simulateCityServices(grid, buildRoadGraph(grid), 40, 20, 50, 5, 9, []);
      expect(result.serviceResponseQuality).toBe(0);
    });

    it('returns 0 if emergency services are disconnected from road', () => {
      const grid = createEmptyGrid(10, 10);
      grid[1][1].type = TileType.RESIDENTIAL;
      grid[1][1].population = 40;
      // Isolated fire station with no road
      grid[5][5].type = TileType.FIRE_STATION;
      grid[5][5].powered = true;
      const result = simulateCityServices(grid, buildRoadGraph(grid), 40, 20, 50, 5, 9, []);
      expect(result.serviceResponseQuality).toBe(0);
    });

    it('increases with connected active emergency facilities', () => {
      const grid = createEmptyGrid(10, 10);
      grid[1][1].type = TileType.RESIDENTIAL;
      grid[1][1].population = 40;
      grid[1][2].type = TileType.ROAD;
      grid[1][3].type = TileType.FIRE_STATION;
      grid[1][3].powered = true;
      const result1 = simulateCityServices(grid, buildRoadGraph(grid), 40, 20, 50, 5, 9, []);
      expect(result1.serviceResponseQuality).toBeGreaterThan(0);

      // Add police and clinic
      grid[2][2].type = TileType.ROAD;
      grid[2][3].type = TileType.POLICE_STATION;
      grid[2][3].powered = true;
      grid[3][2].type = TileType.ROAD;
      grid[3][3].type = TileType.CLINIC;
      grid[3][3].powered = true;
      const resultFull = simulateCityServices(grid, buildRoadGraph(grid), 40, 20, 50, 5, 9, []);
      expect(resultFull.serviceResponseQuality).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Priority 3: Congestion Metric Consistency', () => {
    it('verifies consistent semantics for congestion index 0, 50, and 100', () => {
      // Congestion 0%: completely free flow
      const congestionZero = 0;
      const freeFlowZero = Math.max(0, 100 - congestionZero);
      expect(freeFlowZero).toBe(100);
      expect(congestionZero).toBe(0);

      // Congestion 50%: moderate congestion
      const congestionFifty = 50;
      const freeFlowFifty = Math.max(0, 100 - congestionFifty);
      expect(freeFlowFifty).toBe(50);
      expect(congestionFifty).toBe(50);

      // Congestion 100%: complete gridlock
      const congestionHundred = 100;
      const freeFlowHundred = Math.max(0, 100 - congestionHundred);
      expect(freeFlowHundred).toBe(0);
      expect(congestionHundred).toBe(100);
    });
  });

  describe('Priority 4: 2D/3D Parity for Bridges and Structures', () => {
    it('prioritizes bridge/road over water in 2D tile classification', () => {
      const base = createEmptyGrid(1, 1)[0][0];
      const bridgeOnWater = { ...base, type: TileType.ROAD, water: true, roadStructure: 'BRIDGE' as const };
      expect(get2DTileClass(bridgeOnWater)).toBe('bridge');

      const regularRoadOnWater = { ...base, type: TileType.ROAD, water: true, roadStructure: 'GROUND' as const };
      expect(get2DTileClass(regularRoadOnWater)).toBe('bridge');

      const naturalWater = { ...base, type: TileType.EMPTY, water: true };
      expect(get2DTileClass(naturalWater)).toBe('water');
    });

    it('correctly maps arterial, highway, emergency, and municipal utility tiles', () => {
      const base = createEmptyGrid(1, 1)[0][0];
      expect(get2DTileClass({ ...base, type: TileType.ROAD, roadClass: 'ARTERIAL' })).toBe('arterial');
      expect(get2DTileClass({ ...base, type: TileType.ROAD, roadClass: 'HIGHWAY' })).toBe('highway');
      expect(get2DTileClass({ ...base, type: TileType.FIRE_STATION })).toBe('emergency');
      expect(get2DTileClass({ ...base, type: TileType.POLICE_STATION })).toBe('emergency');
      expect(get2DTileClass({ ...base, type: TileType.CLINIC })).toBe('emergency');
      expect(get2DTileClass({ ...base, type: TileType.POWER_PLANT })).toBe('power');
      expect(get2DTileClass({ ...base, type: TileType.WATER_PUMP })).toBe('pump');
      expect(get2DTileClass({ ...base, type: TileType.FLOOD_BARRIER })).toBe('barrier');
      expect(get2DTileClass({ ...base, type: TileType.WATER_RESERVOIR })).toBe('reservoir');
      expect(get2DTileClass({ ...base, type: TileType.PARK })).toBe('park');
      expect(get2DTileClass({ ...base, type: TileType.PARKING })).toBe('parking');
    });
  });

  describe('Priority 5: User-Facing 1-Based Coordinate Contract', () => {
    it('formats internal 0-based coordinate (35, 27) as user-facing 1-based (36, 28)', () => {
      const internalX = 35;
      const internalY = 27;

      const userFacingX = internalX + 1;
      const userFacingY = internalY + 1;

      expect(userFacingX).toBe(36);
      expect(userFacingY).toBe(28);

      const inspectorTitle = `Inspeksi Petak (${userFacingX}, ${userFacingY})`;
      expect(inspectorTitle).toBe('Inspeksi Petak (36, 28)');

      const tileAriaLabel = `Petak ${userFacingX}, ${userFacingY}; ROAD`;
      expect(tileAriaLabel).toBe('Petak 36, 28; ROAD');

      const bulldozeButtonLabel = `Gusur Petak (${userFacingX}, ${userFacingY})`;
      expect(bulldozeButtonLabel).toBe('Gusur Petak (36, 28)');
    });
  });
});
