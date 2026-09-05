import { describe, expect, it } from 'vitest';
import { createInitialCityState } from './engine';
import { createStarterGrid } from './starterCity';
import { createLocalizationCatalog, translate } from './localization';
import { createDiagnosticBundle, getFeatureGate, getStateHash } from './releaseReadiness';
import { DEFAULT_SETTINGS } from './components/ui/SettingsModal';

describe('release readiness foundations', () => {
  it('keeps experimental features hidden unless explicitly enabled', () => {
    expect(getFeatureGate('core-city')).toBe('stable');
    expect(getFeatureGate('data-modding')).toBe('hidden');
    expect(getFeatureGate('data-modding', true)).toBe('experimental');
  });

  it('uses deterministic state hashes for diagnostic reports', () => {
    const first = createInitialCityState(createStarterGrid(), 2088);
    const second = createInitialCityState(createStarterGrid(), 2088);
    expect(getStateHash(first)).toBe(getStateHash(second));
    const bundle = createDiagnosticBundle(first, DEFAULT_SETTINGS);
    expect(bundle.city?.stateHash).toBe(getStateHash(first));
    expect(bundle.browser.devicePixelRatio).toBeGreaterThan(0);
  });

  it('detects changes across authoritative policy, incident, service, economy, transit, and disaster state', () => {
    const base = createInitialCityState(createStarterGrid(), 2088);
    const changes: Array<(state: ReturnType<typeof createInitialCityState>) => void> = [
      (state) => { state.activePolicies = ['small_biz']; },
      (state) => { state.incidents = [{ id: 'i-1', type: 'FIRE', x: 1, y: 1, severity: 1, createdDay: 1, remainingDays: 2, roadConnected: true }]; },
      (state) => { state.serviceResponseQuality = 42; },
      (state) => { state.happiness = 12; },
      (state) => { state.income = 999; state.expenses = 333; },
      (state) => { state.transitRidership = 7; },
      (state) => { state.disasters = [{ id: 'd-1', type: 'FLOOD', centerX: 2, centerY: 2, radius: 1, severity: 1, createdDay: 1, remainingDays: 3, affectedTiles: 2 }]; },
      (state) => { state.commandQueue = [{ id: 'cmd-1', type: 'SET_SPEED', issuedDay: 1, payload: { speed: 1 } } as never]; },
    ];

    for (const change of changes) {
      const candidate = structuredClone(base);
      change(candidate);
      expect(getStateHash(candidate)).not.toBe(getStateHash(base));
    }
  });

  it('falls back from missing localization keys and supports English catalog', () => {
    const id = createLocalizationCatalog('id');
    const en = createLocalizationCatalog('en');
    expect(translate(id, 'app.newCity')).toBe('Kota Baru');
    expect(translate(en, 'app.newCity')).toBe('New City');
    expect(translate(id, 'missing.key')).toBe('missing.key');
  });
});
