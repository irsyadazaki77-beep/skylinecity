import { describe, expect, it } from 'vitest';
import { createInitialCityState } from './engine';
import { createStarterGrid } from './starterCity';
import { createDistrict } from './districts';
import { advanceNeighborhoodIdentities, applyNeighborhoodIdentityEffects, deriveNeighborhoodIdentity } from './neighborhoodIdentity';
import { advanceDisasterPreparation, calculatePreparedness } from './disasterPreparation';
import { derivePolicyConsequences } from './policyConsequences';
import { advanceCityHistory } from './cityHistory';
import { evaluateCityStyle } from './campaigns';
import { applySimulationCommands, createSimulationCommand } from './simulationCommands';
import { TileType } from './types';

describe('living city systems', () => {
  const createState = (seed: number) => createInitialCityState(createStarterGrid(), seed);
  it('derives a district identity from real land use and explains it', () => {
    const state = createState(12);
    state.milestoneLevel = 1;
    for (let y = 5; y < 9; y += 1) for (let x = 5; x < 9; x += 1) Object.assign(state.grid[y][x], { type: TileType.RESIDENTIAL, population: 8, healthCovered: true, schoolCovered: true });
    const district = createDistrict(state.grid, [7, 7], { id: 'homes', name: 'Keluarga', policy: 'COMMUNITY_SERVICES', radius: 3, createdDay: 1 });
    const identity = deriveNeighborhoodIdentity(state, district);
    expect(identity.type).toBe('FAMILY_QUARTER');
    expect(identity.reasons.join(' ')).toContain('residential');
    expect(deriveNeighborhoodIdentity(state, district)).toEqual(identity);
  });

  it('applies bounded gameplay effects from identity', () => {
    const state = createState(4);
    state.milestoneLevel = 1;
    state.residentialDemand = 10;
    state.districts = [createDistrict(state.grid, [5, 5], { id: 'green', name: 'Hijau', policy: 'GREEN', radius: 3, createdDay: 1 })];
    state.neighborhoodIdentityState = advanceNeighborhoodIdentities(state);
    const before = state.happiness;
    applyNeighborhoodIdentityEffects(state);
    expect(state.happiness).toBeGreaterThan(before);
    expect(state.residentialDemand).toBeLessThanOrEqual(100);
  });

  it('makes flood preparation purchased through the deterministic command queue effective', () => {
    const state = createState(9);
    state.money = 5_000;
    const command = createSimulationCommand('SET_DISASTER_PREPARATION', state.day, { action: 'EVACUATE', enabled: true });
    expect(applySimulationCommands(state, [command])).toEqual([command]);
    expect(state.money).toBe(4_600);
    const prepared = calculatePreparedness(state, state.disasterPreparationState?.actions ?? []);
    const active = { id: 'flood-1', type: 'FLOOD' as const, centerX: 2, centerY: 2, radius: 2, severity: 3 as const, createdDay: 2, remainingDays: 3, affectedTiles: 10 };
    state.disasters = [active];
    const outcome = advanceDisasterPreparation(state.disasterPreparationState, state);
    expect(outcome.preparedness).toBe(prepared);
    expect(outcome.avoidedDamage).toBeGreaterThan(0);
    expect(outcome.recoveryCost).toBeLessThan(2_700);
  });

  it('describes policy winners, losers, horizons, cost and before-after', () => {
    const state = createState(2);
    state.activePolicies = ['green_roofs']; state.pollutionAverage = 20;
    const [result] = derivePolicyConsequences(state);
    expect(result.costPerDay).toBeGreaterThan(0);
    expect(result.beneficiary).toBeTruthy(); expect(result.disadvantaged).toBeTruthy();
    expect(result.measuredMetric).toBe('pollutionAverage');
    expect(result.observedValue).toBe(20);
    expect(result.expectedDirection).toBe('DOWN');
  });

  it('persists bounded causal history without duplicating known events', () => {
    const prior = createState(7); const next = { ...prior, milestoneLevel: 1, day: 2, population: 25, money: prior.money + 500 };
    const history = advanceCityHistory(undefined, next, prior);
    expect(history.events[0]?.type).toBe('MILESTONE');
    expect(history.events[0]?.impact.population).toBe(25);
    expect(advanceCityHistory(history, { ...next, day: 3 }, next).events).toHaveLength(1);
  });

  it('evaluates campaign styles by more than population and preserves challenge seed', () => {
    const state = createState(77); state.population = 150; state.pollutionAverage = 8;
    const green = evaluateCityStyle(state, 'GREEN', 77);
    const transit = evaluateCityStyle(state, 'TRANSIT', 77);
    expect(green.seed).toBe(77); expect(green.completed).toBe(true);
    expect(green.score).not.toBe(transit.score);
  });
});
