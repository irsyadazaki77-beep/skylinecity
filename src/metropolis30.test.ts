import { describe, expect, it } from 'vitest';
import { createInitialCityState, createEmptyGrid, simulateTick } from './engine';
import { applySimulationCommands, createSimulationCommand, queueSimulationCommand } from './simulationCommands';
import { createContentRegistry, registerMod, registerModContentPack, validateModManifest } from './contentRegistry';
import { calculateRegionTelemetry, getActiveRegionKeys } from './regionSimulation';
import { createRecoveryProject } from './recoveryProjects';
import { evaluateScenario } from './scenarioSystem';
import { createBenchmarkState, runBenchmarkScenario } from './metropolisBenchmarks';
import { generateRegionChunk, getStreamingRegionKeys } from './worldStreaming';
import { SimulationCommand, TileType } from './types';

describe('Metropolis 3.0 foundation', () => {
  it('applies queued commands at the start of a deterministic tick', () => {
    const state = createInitialCityState(createEmptyGrid(), 44);
    const command = createSimulationCommand('BUILD_ROAD', state.day, { x: 3, y: 3, roadClass: 'ARTERIAL' });
    const queued = queueSimulationCommand(state, command);
    const next = simulateTick(queued);
    expect(next.grid[3][3].type).toBe(TileType.ROAD);
    expect(next.grid[3][3].roadClass).toBe('ARTERIAL');
    expect(next.commandQueue).toHaveLength(0);
    expect(next.recentSimulationEvents?.some((event) => event.type === 'COMMAND_APPLIED')).toBe(true);
  });

  it('creates stable command identifiers without process-global counters', () => {
    const first = createSimulationCommand('SET_TAX', 4, { type: 'commercial' as const, value: 11 });
    const second = createSimulationCommand('SET_TAX', 4, { type: 'commercial' as const, value: 11 });
    expect(first.id).toBe(second.id);
  });

  it('does not double-charge an optimistic road command on the next tick', () => {
    const state = createInitialCityState(createEmptyGrid(), 46);
    state.money = 1_000;
    const command = createSimulationCommand('BUILD_ROAD', state.day, { x: 3, y: 3, roadClass: 'LOCAL', cost: 20 });
    queueSimulationCommand(state, command);
    applySimulationCommands(state, [command]);
    expect(state.grid[3][3].type).toBe(TileType.ROAD);
    expect(state.money).toBe(980);
    applySimulationCommands(state, [command]);
    expect(state.money).toBe(980);
  });

  it('applies extended player commands idempotently after optimistic UI updates', () => {
    const state = createInitialCityState(createEmptyGrid(), 45);
    state.grid[2][2].type = TileType.ROAD;
    state.money = 10_000;
    state.transitLines = [{ id: 'line-1', name: 'Line 1', mode: 'BUS', stops: [[2, 2], [3, 2]], frequency: 8, active: true }];
    const contract = {
      id: 'contract-food-import', commodity: 'FOOD' as const, direction: 'IMPORT' as const,
      quantityPerDay: 20, pricePerUnit: 1.2, reliability: 90, remainingDays: 30, active: true,
    };
    const commands: SimulationCommand[] = [
      createSimulationCommand('SET_TAX', state.day, { type: 'residential' as const, value: 12 }),
      createSimulationCommand('SET_POLICY', state.day, { policyId: 'recycling', enabled: true }),
      createSimulationCommand('TOGGLE_TRANSIT_LINE', state.day, { lineId: 'line-1', active: false }),
      createSimulationCommand('CREATE_TRADE_CONTRACT', state.day, { contract, fee: 120 }),
    ];
    const queued = commands.reduce((current, command) => queueSimulationCommand(current, command), state);
    const applied = applySimulationCommands(queued, queued.commandQueue);
    expect(applied).toHaveLength(4);
    expect(queued.residentialTaxRate).toBe(12);
    expect(queued.activePolicies).toContain('recycling');
    expect(queued.transitLines?.[0].active).toBe(false);
    expect(queued.tradeContracts).toHaveLength(1);
    expect(queued.money).toBe(9_880);
    applySimulationCommands(queued, commands);
    expect(queued.tradeContracts).toHaveLength(1);
    expect(queued.money).toBe(9_880);
  });

  it('keeps region telemetry deterministic and limits active focus to a local neighborhood', () => {
    const state = createInitialCityState(createEmptyGrid(), 55);
    state.unlockedRegions = ['1,1', '0,1', '2,1', '2,2'];
    state.activeRegionKeys = ['1,1'];
    const regions = calculateRegionTelemetry(state);
    expect(Object.keys(regions)).toEqual(expect.arrayContaining(state.unlockedRegions));
    expect(getActiveRegionKeys(state, { x: 30, y: 30 })).toEqual(expect.arrayContaining(['1,1', '0,1', '2,1', '2,2']));
  });

  it('advances a recovery project over multiple days', () => {
    const state = createInitialCityState(createEmptyGrid(), 66);
    state.recoveryProjects = [createRecoveryProject('r1', 'ROAD_REPAIR', 'Repair corridor', [[2, 2]], 100, 20, 4)];
    const first = simulateTick(state);
    expect(first.recoveryProjects?.[0].completedWork).toBeGreaterThan(0);
    const second = simulateTick(first);
    expect(second.recoveryProjects?.[0].completedWork).toBeGreaterThanOrEqual(first.recoveryProjects?.[0].completedWork ?? 0);
  });

  it('validates and registers data-driven mods without executable code', () => {
    expect(validateModManifest({ id: 'bad id', name: 'Bad' }).valid).toBe(false);
    const registry = createContentRegistry();
    const result = registerMod(registry, {
      id: 'example.citypack', name: 'Example City Pack', version: '1.0.0', gameVersion: '3.0.0', namespace: 'example', content: ['buildings', 'scenarios'],
    });
    expect(result.errors).toEqual([]);
    expect(result.registry.mods).toHaveLength(1);
    const contentResult = registerModContentPack(createContentRegistry(), {
      manifest: { id: 'pack.city', name: 'Pack', version: '1.0.0', gameVersion: '3.0.0', namespace: 'pack', content: ['buildings'] },
      buildings: [{ id: 'pack.landmark', tileType: TileType.PARK, displayName: 'Landmark', category: 'ENVIRONMENT', maxLevel: 1, tags: ['landmark'] }],
    });
    expect(contentResult.errors).toEqual([]);
    expect(contentResult.registry.buildings.has('pack.landmark')).toBe(true);
  });

  it('evaluates scenario objectives from live city state', () => {
    const state = createInitialCityState(createEmptyGrid(), 77);
    state.population = 250;
    state.floodBarrierCount = 3;
    const scenario = createContentRegistry().scenarios.find((item) => item.id === 'flood-resilience')!;
    expect(evaluateScenario(state, scenario).completed).toBe(true);
  });

  it('runs deterministic benchmark scenarios and exposes completed telemetry', () => {
    const one = runBenchmarkScenario('SMALL_TOWN', 2, 99);
    const two = runBenchmarkScenario('SMALL_TOWN', 2, 99);
    expect(one.state.day).toBe(two.state.day);
    expect(one.state.population).toBe(two.state.population);
    expect(one.state.money).toBe(two.state.money);
    expect(one.state.regions).toEqual(two.state.regions);
  });

  it('keeps the 100k performance benchmark finite over a long run', () => {
    const result = runBenchmarkScenario('PERFORMANCE_100K', 20, 9090);
    expect(Number.isFinite(result.elapsedMs)).toBe(true);
    expect(result.state.grid.flat().every((tile) => Number.isFinite(tile.population) && Number.isFinite(tile.jobs))).toBe(true);
    expect(Number.isFinite(result.state.money)).toBe(true);
    expect(Number.isFinite(result.state.population)).toBe(true);
    expect(result.state.population).toBe(100_000);
    expect(result.state.citizenState?.citizens.length).toBeGreaterThan(0);
    expect(result.state.citizenState?.populationScale).toBeGreaterThan(1);
  }, 30_000);

  it('generates deterministic region chunks beyond the starter map', () => {
    const first = generateRegionChunk(1234, 7, -2, 'highland');
    const second = generateRegionChunk(1234, 7, -2, 'highland');
    expect(first.tiles).toEqual(second.tiles);
    expect(first.tiles[0][0].x).toBe(140);
    expect(getStreamingRegionKeys({ rx: 7, ry: -2 }, 1)).toHaveLength(9);
  });
});
