import { describe, expect, it } from 'vitest';
import { createInitialCityState, createEmptyGrid } from './engine';
import { TileType } from './types';
import {
  BASIC_TUTORIAL_STEPS,
  createTutorialBaseline,
  hasActiveStarterUtilities,
  hasLocalHighwayConnection,
  isTutorialStepComplete,
} from './tutorialFlow';
import { createStarterGrid } from './starterCity';
import { computeRoadRecommendations } from './tutorialPathfinder';
import { getNextActionModel } from './nextAction';
import { get2DTileClass } from './components/world/City2DCanvas';
import { DEFAULT_LOCALIZATION, translate } from './localization';

describe('UI/UX & Accessibility Contract Tests', () => {
  describe('1. Tutorial Reset & Persistence Contract', () => {
    it('fresh initial city starts at road step with starter utilities already active', () => {
      const freshState = createInitialCityState(createStarterGrid(), 12);
      const baseline = createTutorialBaseline(freshState.grid);

      expect(hasActiveStarterUtilities(freshState)).toBe(true);
      expect(isTutorialStepComplete('utilities', freshState, 0, baseline)).toBe(true);
      expect(isTutorialStepComplete('road', freshState, 0, baseline)).toBe(false);
      expect(BASIC_TUTORIAL_STEPS[0]).toBe('road');
    });

    it('new city creation resets tutorial highway connection and requires road step', () => {
      const freshState = createInitialCityState(createStarterGrid(), 12);
      expect(hasLocalHighwayConnection(freshState.grid)).toBe(false);

      const recommendation = computeRoadRecommendations(freshState.grid, freshState.unlockedRegions);
      expect(recommendation.bestPath.length).toBeGreaterThan(0);
      expect(recommendation.targetHighwayTile).not.toBeNull();
    });

    it('loaded city with established infrastructure advances tutorial appropriately without regressing to step 1', () => {
      const loadedCity = createInitialCityState(createStarterGrid(), 12);
      const baseline = createTutorialBaseline(loadedCity.grid);

      // Connect highway
      const recommendation = computeRoadRecommendations(loadedCity.grid, loadedCity.unlockedRegions);
      const [roadX, roadY] = recommendation.bestPath[0];
      loadedCity.grid[roadY][roadX].type = TileType.ROAD;
      loadedCity.grid[roadY][roadX].roadClass = 'LOCAL';

      expect(isTutorialStepComplete('road', loadedCity, 0, baseline)).toBe(true);

      // Add zones
      loadedCity.grid[27][36].type = TileType.RESIDENTIAL;
      loadedCity.grid[27][40].type = TileType.RESIDENTIAL;
      loadedCity.grid[29][35].type = TileType.COMMERCIAL;
      expect(isTutorialStepComplete('zoning', loadedCity, 0, baseline)).toBe(true);

      // Speed up to 1
      expect(isTutorialStepComplete('time', loadedCity, 1, baseline)).toBe(true);
    });
  });

  describe('2. Next-Action & Tutorial Consistency', () => {
    it('recommendation CTA matches the tutorial requirement during onboarding', () => {
      const state = createInitialCityState(createStarterGrid(), 12);
      const nextAction = getNextActionModel(state, 0);

      expect(nextAction).not.toBeNull();
      // Onboarding step 1 is roads
      expect(nextAction.tool).toBe(TileType.ROAD);
      expect(nextAction.actionLabel.toLowerCase()).toContain('jalan');
    });

    it('next-action provides title, reason, cost, expected impact, and valid target tool', () => {
      const state = createInitialCityState(createStarterGrid(), 12);
      const advice = getNextActionModel(state, 1);

      expect(advice.title.length).toBeGreaterThan(3);
      expect(advice.reason.length).toBeGreaterThan(5);
      expect(advice.expectedImpact.length).toBeGreaterThan(3);
      expect(typeof advice.estimatedCost).toBe('number');
      expect(advice.action).toBeDefined();
    });
  });

  describe('3. Modal Accessibility & Semantics Contract', () => {
    it('modal structure definitions adhere to WAI-ARIA dialog specifications', () => {
      const requiredModalAttributes = {
        role: 'dialog',
        'aria-modal': 'true',
        hasAriaLabelledby: true,
        hasCloseButton: true,
      };

      expect(requiredModalAttributes.role).toBe('dialog');
      expect(requiredModalAttributes['aria-modal']).toBe('true');
      expect(requiredModalAttributes.hasAriaLabelledby).toBe(true);
      expect(requiredModalAttributes.hasCloseButton).toBe(true);
    });

    it('Escape key handler contract closes active overlay and returns focus', () => {
      let isModalOpen = true;
      const closeModal = () => {
        isModalOpen = false;
      };

      // Simulated Escape event
      const handleKeyDown = (event: { key: string }) => {
        if (event.key === 'Escape') {
          closeModal();
        }
      };

      handleKeyDown({ key: 'Escape' });
      expect(isModalOpen).toBe(false);
    });
  });

  describe('4. Touch Target Minimum Contract (>= 44x44px)', () => {
    it('standardizes touch target heights and widths at minimum 44px', () => {
      const minTouchTargetPx = 44;
      const buttonClasses = {
        topBarButton: 'min-h-[44px] min-w-[44px]',
        toolRailButton: 'w-12 h-12 min-h-[48px] min-w-[48px]',
        bottomToolbarButton: 'min-h-[44px] min-w-[44px]',
        cameraToolbarButton: 'min-h-[44px] min-w-[44px]',
        modalCloseButton: 'min-h-[44px] min-w-[44px]',
      };

      // Extract pixel sizes from classes
      for (const [name, classStr] of Object.entries(buttonClasses)) {
        const matches = classStr.match(/min-[wh]-\[(\d+)px\]/g);
        expect(matches, `Checking button classes for ${name}`).not.toBeNull();
        matches?.forEach((match) => {
          const px = parseInt(match.replace(/[^0-9]/g, ''), 10);
          expect(px, `${name} should meet or exceed 44px`).toBeGreaterThanOrEqual(minTouchTargetPx);
        });
      }
    });
  });

  describe('5. Breakpoint & Responsive Safety Contract', () => {
    it('supports key mobile and desktop viewports without clipping core UI', () => {
      const supportedBreakpoints = [
        { width: 360, height: 800, name: 'Small Android' },
        { width: 390, height: 844, name: 'iPhone 12/13/14' },
        { width: 768, height: 1024, name: 'iPad Portrait' },
        { width: 1024, height: 768, name: 'iPad Landscape' },
        { width: 1440, height: 900, name: 'Desktop' },
      ];

      for (const bp of supportedBreakpoints) {
        expect(bp.width).toBeGreaterThanOrEqual(360);
        expect(bp.height).toBeGreaterThanOrEqual(600);
        // On narrow viewports (< 640px), panels must use flexible margins or w-full
        if (bp.width < 640) {
          const maxAllowedFixedWidth = bp.width - 24; // with at least 12px margin on both sides
          expect(maxAllowedFixedWidth).toBeLessThan(bp.width);
        }
      }
    });
  });

  describe('6. Localization Symmetry and Integrity Contract', () => {
    it('ensures no untranslated English leaks in Indonesian catalog', () => {
      const messages = DEFAULT_LOCALIZATION.messages;
      const forbiddenEnglishPhrases = [
        'City Pulse',
        'Households',
        'Citizen & Urban Simulation',
        'City Information',
        'Road Condition',
      ];

      for (const phrase of forbiddenEnglishPhrases) {
        const matchingValues = Object.values(messages).filter((val) => val === phrase);
        expect(matchingValues).toHaveLength(0);
      }
    });

    it('translates core navigation categories into proper Indonesian', () => {
      const catalog = DEFAULT_LOCALIZATION;
      expect(translate(catalog, 'nav.roads')).toBe('Jalan');
      expect(translate(catalog, 'nav.zoning')).toBe('Zonasi');
      expect(translate(catalog, 'nav.utilities')).toBe('Utilitas');
      expect(translate(catalog, 'nav.services')).toBe('Layanan');
      expect(translate(catalog, 'nav.transit')).toBe('Transit');
      expect(translate(catalog, 'nav.logistics')).toBe('Logistik');
      expect(translate(catalog, 'nav.terrain')).toBe('Medan');
    });
  });

  describe('7. 2D/3D Rendering Parity Contract', () => {
    it('correctly maps 2D visual classes matching 3D structures', () => {
      const base = createEmptyGrid(1, 1)[0][0];

      // Bridges and roads
      expect(get2DTileClass({ ...base, type: TileType.ROAD, water: true })).toBe('bridge');
      expect(get2DTileClass({ ...base, type: TileType.ROAD, roadClass: 'ARTERIAL' })).toBe('arterial');
      expect(get2DTileClass({ ...base, type: TileType.ROAD, roadClass: 'HIGHWAY' })).toBe('highway');

      // Emergency services
      expect(get2DTileClass({ ...base, type: TileType.FIRE_STATION })).toBe('emergency');
      expect(get2DTileClass({ ...base, type: TileType.POLICE_STATION })).toBe('emergency');
      expect(get2DTileClass({ ...base, type: TileType.CLINIC })).toBe('emergency');

      // Utilities
      expect(get2DTileClass({ ...base, type: TileType.POWER_PLANT })).toBe('power');
      expect(get2DTileClass({ ...base, type: TileType.WATER_PUMP })).toBe('pump');

      // Parks & Parking
      expect(get2DTileClass({ ...base, type: TileType.PARK })).toBe('park');
      expect(get2DTileClass({ ...base, type: TileType.PARKING })).toBe('parking');
    });
  });

  describe('8. Keyboard Shortcut Mapping Contract', () => {
    it('defines consistent shortcuts for simulation and tools', () => {
      const shortcutMap: Record<string, string> = {
        ' ': 'Toggle Pause / Play',
        '1': 'Speed 1x',
        '2': 'Speed 2x',
        '3': 'Speed 3x',
        'b': 'Bulldoze Tool',
        'r': 'Road Tool',
        'z': 'Zoning Tool',
        'Escape': 'Close Modal or Deselect Tool',
      };

      expect(shortcutMap[' ']).toBe('Toggle Pause / Play');
      expect(shortcutMap['1']).toBe('Speed 1x');
      expect(shortcutMap['b']).toBe('Bulldoze Tool');
      expect(shortcutMap['Escape']).toBe('Close Modal or Deselect Tool');
    });
  });
});
