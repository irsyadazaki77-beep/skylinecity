import { describe, expect, it } from 'vitest';
import { createInitialCityState, simulateTick } from './engine';
import { createStarterGrid } from './starterCity';
import { getAdjacentRoadNodeKey, buildRoadGraph } from './traffic';
import { TileType } from './types';
import { createRuntimeAuditScenario } from './runtimeAuditScenario';
import { deleteSave, loadGame, saveGame } from './saveSystem';

describe('runtime audit scenario', () => {
  it('seeds a connected bus line and dispatch call without mutating the input state', () => {
    const initial = createInitialCityState(createStarterGrid(), 2088);
    const scenario = createRuntimeAuditScenario(initial);
    const roadGraph = buildRoadGraph(scenario.grid, scenario.unlockedUpgrades, scenario.timeOfDay);
    const line = scenario.transitLines?.[0];

    expect(scenario).not.toBe(initial);
    expect(initial.transitLines).toHaveLength(0);
    expect(scenario.transitLines).toHaveLength(2);
    expect(line?.stops).toHaveLength(2);
    expect(line?.stops.every(([x, y]) => getAdjacentRoadNodeKey(x, y, roadGraph))).toBe(true);
    expect(scenario.unlockedUpgrades).toContain('bus_network');
    expect(scenario.grid.flat().some((tile) => tile.type === TileType.BUS_DEPOT)).toBe(true);
    expect(scenario.incidents?.[0]?.type).toBe('FIRE');
  });

  it('produces real transit vehicle and emergency dispatch agents after a normal tick', () => {
    const initial = createInitialCityState(createStarterGrid(), 2088);
    const scenario = createRuntimeAuditScenario(initial);
    const next = simulateTick(scenario);
    expect(next.transitActiveLines).toBe(2);
    expect(next.transitBusDepots).toBeGreaterThan(0);
    expect(next.transitCapacity).toBeGreaterThan(0);
    expect(next.transitVehicles.length).toBeGreaterThan(0);
    expect(next.transitTransferOpportunities).toBe(1);
    expect(next.transitVehicles[0]?.path.length).toBeGreaterThan(1);
    expect(next.activeIncidents).toBeGreaterThan(0);
    expect(next.incidents[0]?.dispatchPath?.length).toBeGreaterThan(1);
    expect(next.serviceVehicles.length).toBeGreaterThan(0);
    expect(next.serviceVehicles[0]?.status).toBe('DISPATCHING');
  });

  it('round-trips active transit and dispatch agents through the release save format', () => {
    const initial = createInitialCityState(createStarterGrid(), 2088);
    const next = simulateTick(createRuntimeAuditScenario(initial));

    expect(saveGame('runtime-audit-roundtrip', next, 'Runtime Audit')).toBe(true);
    const loaded = loadGame('runtime-audit-roundtrip');
    expect(loaded?.gameState.transitLines?.[0]?.id).toBe('runtime-audit-bus-line');
    expect(loaded?.gameState.transitLines?.[1]?.id).toBe('runtime-audit-bus-line-02');
    expect(loaded?.gameState.transitVehicles?.[0]?.path.length).toBeGreaterThan(1);
    expect(loaded?.gameState.transitVehicles?.[0]?.routeProgress).toBeGreaterThanOrEqual(0);
    expect(loaded?.gameState.transitVehicles?.[0]?.nextStopIndex).toBeGreaterThanOrEqual(0);
    expect(loaded?.gameState.incidents?.[0]?.dispatchPath?.length).toBeGreaterThan(1);
    expect(loaded?.gameState.serviceVehicles?.[0]?.incidentId).toBe('runtime-audit-fire-call');
    deleteSave('runtime-audit-roundtrip');
  });
});
