import { describe, expect, it } from 'vitest';
import { createLocalizationCatalog, DEFAULT_LOCALIZATION, translate } from './localization';

describe('core build localization', () => {
  const coreKeys = [
    'nav.roads',
    'nav.zoning',
    'nav.utilities',
    'nav.services',
    'nav.transit',
    'nav.logistics',
    'nav.terrain',
    'tool.localRoad',
    'tool.arterial',
    'tool.highway',
    'tool.tunnel',
    'tool.roadWorks',
    'tool.powerPlant',
    'tool.waterPump',
    'tool.fireStation',
    'tool.policeStation',
    'tool.clinic',
    'tool.school',
    'tool.wastePlant',
    'tool.park',
    'tool.parking',
    'tool.floodBarrier',
    'tool.reservoir',
    'tool.busDepot',
    'tool.tramStation',
    'tool.busStop',
    'tool.tramStop',
    'tool.linePlanner',
    'tool.warehouse',
    'tool.cargoTerminal',
    'tool.raise',
    'tool.lower',
    'tool.level',
    'tool.smooth',
  ];

  it('has complete Indonesian and English terms for the first-city loop', () => {
    for (const language of ['id', 'en'] as const) {
      const catalog = createLocalizationCatalog(language);
      for (const key of coreKeys) expect(translate(catalog, key)).not.toBe(key);
    }
  });

  it('uses Jalan consistently in Indonesian navigation', () => {
    expect(translate(createLocalizationCatalog('id'), 'nav.roads')).toBe('Jalan');
    expect(translate(createLocalizationCatalog('id'), 'tool.localRoad')).toBe('Jalan Lokal');
  });

  it('ensures symmetric keys between Indonesian and English catalogs with no missing keys', () => {
    const idKeys = Object.keys(DEFAULT_LOCALIZATION.messages).sort();
    const enKeys = Object.keys(DEFAULT_LOCALIZATION.fallbackMessages).sort();
    expect(idKeys).toEqual(enKeys);
  });

  it('ensures Indonesian catalog has no unintended English terms', () => {
    const idMessages = DEFAULT_LOCALIZATION.messages;

    expect(idMessages['pulse.title']).toBe('Denyut Kota');
    expect(idMessages['pulse.title']).not.toBe('City Pulse');

    expect(idMessages['forecast.households']).toBe('Rumah Tangga');
    expect(idMessages['forecast.households']).not.toBe('Household');

    expect(idMessages['forecast.jobs']).toBe('Lapangan Kerja');
    expect(idMessages['forecast.jobs']).not.toBe('Jobs');

    expect(idMessages['forecast.traffic']).toBe('Beban Lalu Lintas');
    expect(idMessages['forecast.traffic']).not.toBe('Traffic');

    expect(idMessages['forecast.maintenance']).toBe('Biaya Perawatan');
    expect(idMessages['forecast.maintenance']).not.toBe('Maintenance');

    expect(idMessages['info.subtitle']).toBe('Simulasi Warga & Tata Kota 2.0');
    expect(idMessages['info.subtitle']).not.toBe('Citizen & Urban Simulation 2.0');

    expect(idMessages['pulse.cityInfo']).toBe('Info Kota');
    expect(idMessages['infoViews.roadCondition']).toBe('Kondisi Jalan');
    expect(idMessages['save.title']).toBe('Pengelolaan Simpan & Muat Kota');
    expect(idMessages['metric.households']).not.toBe('Households');
  });
});
