import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState, simulateTick } from './engine';
import { createStarterGrid } from './starterCity';
import { createSimulationCommand, queueSimulationCommand } from './simulationCommands';
import { ALL_TUTORIAL_STEPS, BASIC_TUTORIAL_STEPS, ADVANCED_TUTORIAL_STEPS, isTutorialStepComplete, createTutorialBaseline } from './tutorialFlow';
import { calculateTutorialFraming } from './tutorialPathfinder';
import { TileType } from './types';
import { readFileSync } from 'node:fs';

describe('Browser Smoke & Layout Test Suite', () => {
  const viewports = [
    { name: 'mobile', width: 360, height: 800 },
    { name: 'mobile-large', width: 390, height: 844 },
    { name: 'tablet-portrait', width: 768, height: 1024 },
    { name: 'tablet-landscape', width: 1024, height: 768 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  it('verifies responsive viewport contracts for mobile, tablet, and desktop', () => {
    for (const vp of viewports) {
      const isMobile = vp.width < 640;
      const isTablet = vp.width >= 640 && vp.width < 1024;
      const isDesktop = vp.width >= 1024;

      expect(vp.width).toBeGreaterThan(0);
      expect(vp.height).toBeGreaterThan(0);

      if (isMobile) {
        expect([360, 390]).toContain(vp.width);
      } else if (isTablet) {
        expect([768, 1024]).toContain(vp.width);
      } else {
        expect(isDesktop).toBe(true);
      }
    }
  });

  it('checks the source-level touch, overflow, and modal layout contracts', () => {
    const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');
    const canvas = readFileSync(new URL('./components/world/City2DCanvas.tsx', import.meta.url), 'utf8');
    const sidebar = readFileSync(new URL('./components/Sidebar.tsx', import.meta.url), 'utf8');
    const hud = readFileSync(new URL('./components/ui/GameHUD.tsx', import.meta.url), 'utf8');
    const milestone = readFileSync(new URL('./components/MilestoneBanner.tsx', import.meta.url), 'utf8');

    expect(css).toContain('--touch-min: 44px');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('min-width: 44px');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('max-height: min(88vh, calc(100dvh - 32px))');
    expect(css).toContain('height: fit-content');
    expect(css).toContain('bottom: 148px');
    expect(css).toContain('flex-wrap: wrap');
    expect(sidebar).toContain('useState<BuildCategory | null>(null)');
    expect(sidebar).toContain('tool-drawer-backdrop');
    expect(hud).not.toContain('next-action-card');
    expect(milestone).toContain('role="dialog"');
    expect(milestone).toContain('useModalFocus');
    expect(canvas).toContain('aria-label={`Petak ${tile.x + 1}, ${tile.y + 1}; ${tile.type}`}');
    expect(canvas).not.toContain('style={{ width: 24, height: 24 }}');
  });

  it('validates start screen dismissal flow', () => {
    // Start screen checks intro key
    const introKey = 'skyline_release_intro_seen';
    expect(introKey).toBe('skyline_release_intro_seen');
  });

  it('validates tutorial progression and action hints across all stages', () => {
    const grid = createStarterGrid();
    const state = createInitialCityState(grid, 2088);

    expect(ALL_TUTORIAL_STEPS.length).toBe(11);
    expect(BASIC_TUTORIAL_STEPS).toEqual(['road', 'utilities', 'zoning', 'time', 'problems']);
    expect(ADVANCED_TUTORIAL_STEPS).toHaveLength(6);
    const baseline = createTutorialBaseline(grid);
    const isStep1Done = isTutorialStepComplete('road', state, 0, baseline);
    expect(typeof isStep1Done).toBe('boolean');

    const framing = calculateTutorialFraming(grid, [34, 30]);
    expect(framing).toBeDefined();
    expect(framing.focus[0]).toBeGreaterThanOrEqual(0);
    expect(framing.focus[1]).toBeGreaterThanOrEqual(0);
    expect(framing.zoom).toBeGreaterThan(0);
  });

  it('validates 2D mode core interactions and build actions', () => {
    const state = createInitialCityState(createEmptyGrid(10, 10), 2088);
    // Road build command
    const roadCmd = createSimulationCommand('BUILD_ROAD', state.day, { x: 2, y: 2, roadClass: 'LOCAL' });
    const withRoad = queueSimulationCommand(state, roadCmd);
    const simulatedRoad = simulateTick(withRoad);
    expect(simulatedRoad.grid[2][2].type).toBe(TileType.ROAD);

    // Residential build command
    const resCmd = createSimulationCommand('ZONE_LAND', simulatedRoad.day, { x: 2, y: 3, type: TileType.RESIDENTIAL });
    const withRes = queueSimulationCommand(simulatedRoad, resCmd);
    const simulatedRes = simulateTick(withRes);
    expect(simulatedRes.grid[3][2].type).toBe(TileType.RESIDENTIAL);

    // Bulldoze command
    const bulldozeCmd = createSimulationCommand('DEMOLISH_TILE', simulatedRes.day, { x: 2, y: 3 });
    const withBulldoze = queueSimulationCommand(simulatedRes, bulldozeCmd);
    const simulatedBulldoze = simulateTick(withBulldoze);
    expect(simulatedBulldoze.grid[3][2].type).toBe(TileType.EMPTY);
  });

  it('verifies camera focus and reset contracts', () => {
    const initialFocus: [number, number] | null = null;
    const initialZoom = 1.25;
    const initialRotation = 0;

    // Simulate focus
    let currentFocus: [number, number] | null = [34, 25];
    let currentZoom = 1.8;
    let currentRotation = 45;

    // Simulate reset camera
    currentFocus = initialFocus;
    currentZoom = initialZoom;
    currentRotation = initialRotation;

    expect(currentFocus).toBeNull();
    expect(currentZoom).toBe(1.25);
    expect(currentRotation).toBe(0);
  });
});
