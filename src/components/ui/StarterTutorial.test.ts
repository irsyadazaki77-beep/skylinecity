import { describe, expect, it } from 'vitest';
import { readTutorialProgress, writeTutorialProgress } from './StarterTutorial';
import { createStarterGrid } from '../../starterCity';
import { createInitialCityState } from '../../engine';
import { hasActiveStarterUtilities } from '../../tutorialFlow';

describe('tutorial progress storage', () => {
  it('continues safely when storage cannot be read or written', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readTutorialProgress(broken)).toEqual({});
    expect(() => writeTutorialProgress({ minimized: true }, broken)).not.toThrow();
  });

  it('persists the compact onboarding state independently from gameplay', () => {
    let value: string | null = null;
    const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
    writeTutorialProgress({ minimized: true, currentStepIndex: 3 }, storage);
    expect(readTutorialProgress(storage)).toEqual({ minimized: true, currentStepIndex: 3 });
  });

  it('reads legacy v2 storage as fallback if v3 is not set', () => {
    const storage = {
      getItem: (key: string) => (key === 'skyline_onboarding_v2' ? JSON.stringify({ minimized: false, currentStepIndex: 2 }) : null),
      setItem: () => {},
    };
    expect(readTutorialProgress(storage)).toEqual({ minimized: false, currentStepIndex: 2 });
  });

  it('keeps progress isolated per city session', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    writeTutorialProgress({ minimized: true, currentStepIndex: 4 }, storage, 'save:alpha');
    writeTutorialProgress({ minimized: false, currentStepIndex: 1 }, storage, 'save:beta');

    expect(readTutorialProgress(storage, 'save:alpha')).toEqual({ minimized: true, currentStepIndex: 4 });
    expect(readTutorialProgress(storage, 'save:beta')).toEqual({ minimized: false, currentStepIndex: 1 });
    expect(readTutorialProgress(storage, 'new:city')).toEqual({});
  });

  it('keeps utility step active for explicit player confirmation instead of skipping automatically', () => {
    const state = createInitialCityState(createStarterGrid(), 2088);
    expect(hasActiveStarterUtilities(state)).toBe(true);
  });
});
