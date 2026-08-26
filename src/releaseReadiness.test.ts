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

  it('falls back from missing localization keys and supports English catalog', () => {
    const id = createLocalizationCatalog('id');
    const en = createLocalizationCatalog('en');
    expect(translate(id, 'app.newCity')).toBe('Kota Baru');
    expect(translate(en, 'app.newCity')).toBe('New City');
    expect(translate(id, 'missing.key')).toBe('missing.key');
  });
});

