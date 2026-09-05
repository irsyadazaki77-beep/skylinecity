import { describe, expect, it } from 'vitest';
import { createInitialCityState, simulateTick } from './engine';
import { getStateHash } from './releaseReadiness';
import { createSimulationCommand, queueSimulationCommand } from './simulationCommands';
import { createStarterGrid } from './starterCity';
import { computeRoadRecommendations } from './tutorialPathfinder';
import { createTutorialBaseline, isTutorialStepComplete } from './tutorialFlow';
import { CityState, TileType } from './types';

function queueBuild(state: CityState, type: 'BUILD_ROAD' | 'ZONE_LAND' | 'BUILD_TILE', payload: Record<string, unknown>): CityState {
  return queueSimulationCommand(state, createSimulationCommand(type, state.day, payload));
}

function runP0Path(seed = 2088): { state: CityState; first25Day: number; firstDiagnosticDay: number; firstResolvedDay: number; minMoney: number } {
  let state = createInitialCityState(createStarterGrid(), seed, 'normal');
  const baseline = createTutorialBaseline(state.grid);
  const road = computeRoadRecommendations(state.grid, state.unlockedRegions).bestPath[0];
  expect(road).toBeDefined();

  state = queueBuild(state, 'BUILD_ROAD', { x: road[0], y: road[1], roadClass: 'LOCAL' });
  state = queueBuild(state, 'ZONE_LAND', { x: 36, y: 27, type: TileType.RESIDENTIAL, density: 'LOW' });
  state = queueBuild(state, 'ZONE_LAND', { x: 40, y: 27, type: TileType.RESIDENTIAL, density: 'LOW' });
  state = queueBuild(state, 'ZONE_LAND', { x: 35, y: 29, type: TileType.COMMERCIAL });
  state = simulateTick(state);

  expect(isTutorialStepComplete('road', state, 1, baseline)).toBe(true);
  expect(isTutorialStepComplete('utilities', state, 1, baseline)).toBe(true);
  expect(isTutorialStepComplete('zoning', state, 1, baseline)).toBe(true);

  let first25Day = 0;
  let firstDiagnosticDay = 0;
  let firstResolvedDay = 0;
  let minMoney = state.money;
  let clinicBuilt = false;
  let unemploymentResponseQueued = false;
  for (let tick = 0; tick < 30; tick += 1) {
    const hasUnemploymentProblem = (state.causalDiagnostics ?? []).some((diagnostic) => diagnostic.title === 'Pengangguran meningkat');
    if (!firstDiagnosticDay && hasUnemploymentProblem) firstDiagnosticDay = state.day;
    if (hasUnemploymentProblem && !unemploymentResponseQueued) {
      state = queueBuild(state, 'ZONE_LAND', { x: 39, y: 29, type: TileType.INDUSTRIAL });
      unemploymentResponseQueued = true;
    }
    if (!clinicBuilt && state.population >= 20) {
      state = queueBuild(state, 'BUILD_TILE', { x: 40, y: 29, type: TileType.CLINIC });
      clinicBuilt = true;
    }
    state = simulateTick(state);
    minMoney = Math.min(minMoney, state.money);
    if (!firstResolvedDay && (state.recentSimulationEvents ?? []).some((event) => event.type === 'DIAGNOSTIC_RESOLVED')) firstResolvedDay = state.day;
    if (!first25Day && state.population >= 25) first25Day = state.day;
    if (first25Day && firstResolvedDay && clinicBuilt) break;
  }

  state = queueSimulationCommand(
    { ...state, activePolicies: [...state.activePolicies, 'small_biz'] },
    createSimulationCommand('SET_POLICY', state.day, { policyId: 'small_biz', enabled: true }),
  );
  state = simulateTick(state);
  minMoney = Math.min(minMoney, state.money);
  while (state.day < 31) {
    state = simulateTick(state);
    minMoney = Math.min(minMoney, state.money);
  }
  return { state, first25Day, firstDiagnosticDay, firstResolvedDay, minMoney };
}

describe('P0 twenty-minute vertical slice', () => {
  it('reaches 25 citizens through causal player actions without a financial dead end', () => {
    const result = runP0Path();
    expect(result.firstDiagnosticDay).toBeGreaterThan(0);
    expect(result.firstDiagnosticDay).toBeLessThanOrEqual(10);
    expect(result.firstResolvedDay).toBeGreaterThanOrEqual(result.firstDiagnosticDay);
    expect(result.firstResolvedDay).toBeLessThanOrEqual(15);
    expect(result.first25Day).toBeGreaterThan(0);
    expect(result.first25Day).toBeLessThanOrEqual(15);
    expect(result.minMoney).toBeGreaterThan(4_500);
    expect(result.state.milestoneLevel).toBeGreaterThanOrEqual(1);
    expect(result.state.population).toBeGreaterThanOrEqual(20);
    expect(result.state.day).toBe(31);
    expect(result.state.grid.flat().some((tile) => tile.type === TileType.CLINIC)).toBe(true);
    expect(isTutorialStepComplete('problems', result.state, 1, createTutorialBaseline(createStarterGrid()))).toBe(true);
    expect(isTutorialStepComplete('specialization', result.state, 1, createTutorialBaseline(createStarterGrid()))).toBe(true);
    for (const diagnostic of result.state.causalDiagnostics ?? []) {
      expect(diagnostic.cause).toBeTruthy();
      expect(diagnostic.recommendation).toBeTruthy();
      expect(diagnostic.projectedImpact).toBeTruthy();
      expect(diagnostic.location).toBeDefined();
    }
  });

  it('replays the complete P0 path deterministically', () => {
    expect(getStateHash(runP0Path().state)).toBe(getStateHash(runP0Path().state));
  });
});
