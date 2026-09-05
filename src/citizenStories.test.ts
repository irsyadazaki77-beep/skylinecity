import { describe, expect, it } from 'vitest';
import { advanceCitizenStories, EMPTY_CITIZEN_STORY_STATE } from './citizenStories';
import { createEmptyGrid, createInitialCityState } from './engine';
import { AgeStage, EducationLevel, TransitMode, TripPurpose } from './citizenSimulation/types';
import { TileType } from './types';

function createStoryFixture() {
  const state = createInitialCityState(createEmptyGrid(8, 8), 4242);
  state.population = 25;
  state.milestoneLevel = 1;
  state.grid[2][2].type = TileType.RESIDENTIAL;
  state.grid[2][2].population = 2;
  state.grid[2][2].powered = true;
  state.grid[2][2].watered = true;
  state.citizenState = {
    seed: 4242,
    nextCitizenId: 2,
    nextHouseholdId: 2,
    samplingFactor: 1,
    populationScale: 1,
    representedPopulation: 1,
    citizens: [{
      id: 'citizen-1', householdId: 'household-1', residence: { x: 2, y: 2 }, age: 32,
      stage: AgeStage.ADULT, education: EducationLevel.HIGH_SCHOOL,
      workplace: { id: 'job-1', workplaceTile: { x: 6, y: 2 }, workplaceType: 'COMMERCIAL', educationRequired: EducationLevel.HIGH_SCHOOL, salary: 45, jobTitle: 'Pemilik Warung' },
      school: null, health: 80, happiness: 60, commuteTime: 31,
      serviceNeeds: { healthcare: 40, education: 10, leisure: 50, goods: 50 },
    }],
    households: [{
      id: 'household-1', residence: { x: 2, y: 2 }, citizenIds: ['citizen-1'], savings: 350, rent: 18,
      satisfaction: 62, relocationTimer: 0,
      satisfactionFactors: { rentAffordability: 70, employment: 90, commute: 30, crime: 80, pollution: 80, schoolAccess: 70, healthAccess: 70, overall: 62 },
    }],
    workplaces: [], schools: [], demographics: state.demographics!,
    activeTrips: [{
      id: 'trip-1', citizenId: 'citizen-1', householdId: 'household-1', origin: { x: 2, y: 2 }, destination: { x: 6, y: 2 },
      purpose: TripPurpose.COMMUTE_WORK, path: [[2, 3], [3, 3], [4, 3], [5, 3]], travelTime: 31, mode: TransitMode.CAR,
    }],
  };
  return state;
}

describe('deterministic citizen stories', () => {
  it('creates a causal long-commute story from a real citizen trip', () => {
    const first = advanceCitizenStories(undefined, createStoryFixture());
    const second = advanceCitizenStories(undefined, createStoryFixture());
    expect(first).toEqual(second);
    expect(first.active[0]?.type).toBe('LONG_COMMUTE');
    expect(first.history[0]?.cause).toContain('rumah–kerja');
    expect(first.history[0]?.choice).toContain('transit');
    expect(first.history[0]?.location).toEqual({ x: 2, y: 2 });
  });

  it('records an outcome only when the simulated commute actually recovers', () => {
    const state = createStoryFixture();
    const started = advanceCitizenStories(undefined, state);
    state.day += 1;
    state.citizenState!.activeTrips = [];
    state.citizenState!.citizens[0].commuteTime = 12;
    const recovered = advanceCitizenStories(started, state);
    expect(recovered.active.some((story) => story.type === 'LONG_COMMUTE')).toBe(false);
    expect(recovered.history.some((story) => story.type === 'LONG_COMMUTE' && story.status === 'RESOLVED')).toBe(true);
  });

  it('keeps the ledger bounded and does not unlock stories during onboarding', () => {
    const onboarding = createStoryFixture();
    onboarding.population = 10;
    onboarding.milestoneLevel = 0;
    expect(advanceCitizenStories(undefined, onboarding)).toEqual(EMPTY_CITIZEN_STORY_STATE);

    let storyState = advanceCitizenStories(undefined, createStoryFixture());
    const state = createStoryFixture();
    for (let day = 2; day <= 80; day += 1) {
      state.day = day;
      storyState = advanceCitizenStories(storyState, state);
    }
    expect(storyState.history.length).toBeLessThanOrEqual(24);
    expect(storyState.active.length).toBeLessThanOrEqual(8);
  });
});

