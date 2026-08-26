export type SupportedLanguage = 'id' | 'en';

export interface LocalizationCatalog {
  language: SupportedLanguage;
  fallbackLanguage: SupportedLanguage;
  messages: Record<string, string>;
  fallbackMessages: Record<string, string>;
}

export const DEFAULT_LOCALIZATION: LocalizationCatalog = {
  language: 'id',
  fallbackLanguage: 'en',
  messages: {
    'app.continue': 'Lanjutkan Kota',
    'app.newCity': 'Kota Baru',
    'app.saveRecovery': 'Pemulihan Save',
    'app.performanceWarning': 'Kualitas visual diturunkan untuk menjaga kelancaran.',
    'nav.roads': 'Jalan',
    'nav.zoning': 'Zonasi',
    'nav.utilities': 'Utilitas',
    'nav.services': 'Layanan',
    'nav.transit': 'Transit',
    'nav.logistics': 'Logistik',
    'nav.terrain': 'Medan',
    'tool.select': 'Pilih',
    'tool.bulldoze': 'Hapus',
    'tool.search': 'Cari tool',
    'pulse.title': 'City Pulse',
    'pulse.detail': 'Detail',
    'pulse.focus': 'Fokus',
    'pulse.next': 'Berikutnya',
    'pulse.stable': 'Kota berjalan stabil. Gunakan City Info untuk memantau demand, jaringan, dan perkembangan warga secara mendalam.',
    'forecast.capacity': 'Kapasitas',
    'forecast.households': 'Household',
    'forecast.jobs': 'Jobs',
    'forecast.traffic': 'Traffic',
    'forecast.tax': 'Pajak',
    'forecast.maintenance': 'Maintenance',
    'forecast.pollution': 'Polusi',
    'info.title': 'Informasi Kota',
    'info.subtitle': 'Citizen & Urban Simulation 2.0',
    'info.overview': 'Ringkasan',
    'info.citizens': 'Warga',
    'info.economy': 'Ekonomi',
    'info.services': 'Layanan',
    'info.traffic': 'Lalu Lintas',
    'info.environment': 'Lingkungan',
  },
  fallbackMessages: {
    'app.continue': 'Continue City',
    'app.newCity': 'New City',
    'app.saveRecovery': 'Save Recovery',
    'app.performanceWarning': 'Visual quality was reduced to keep the game smooth.',
    'nav.roads': 'Roads',
    'nav.zoning': 'Zoning',
    'nav.utilities': 'Utilities',
    'nav.services': 'Services',
    'nav.transit': 'Transit',
    'nav.logistics': 'Logistics',
    'nav.terrain': 'Terrain',
    'tool.select': 'Select',
    'tool.bulldoze': 'Bulldoze',
    'tool.search': 'Search tools',
    'pulse.title': 'City Pulse',
    'pulse.detail': 'Details',
    'pulse.focus': 'Focus',
    'pulse.next': 'Next',
    'pulse.stable': 'The city is stable. Use City Info to monitor demand, networks, and citizen development in depth.',
    'forecast.capacity': 'Capacity',
    'forecast.households': 'Households',
    'forecast.jobs': 'Jobs',
    'forecast.traffic': 'Traffic',
    'forecast.tax': 'Tax',
    'forecast.maintenance': 'Maintenance',
    'forecast.pollution': 'Pollution',
    'info.title': 'City Information',
    'info.subtitle': 'Citizen & Urban Simulation 2.0',
    'info.overview': 'Overview',
    'info.citizens': 'Citizens',
    'info.economy': 'Economy',
    'info.services': 'Services',
    'info.traffic': 'Traffic',
    'info.environment': 'Environment',
  },
};

export function createLocalizationCatalog(language: SupportedLanguage = 'id'): LocalizationCatalog {
  if (language === 'en') {
    return {
      language,
      fallbackLanguage: 'id',
      messages: { ...DEFAULT_LOCALIZATION.fallbackMessages },
      fallbackMessages: { ...DEFAULT_LOCALIZATION.messages },
    };
  }
  return {
    ...DEFAULT_LOCALIZATION,
    messages: { ...DEFAULT_LOCALIZATION.messages },
    fallbackMessages: { ...DEFAULT_LOCALIZATION.fallbackMessages },
  };
}

export function translate(catalog: LocalizationCatalog, key: string, variables: Record<string, string | number> = {}): string {
  const template = catalog.messages[key] ?? catalog.fallbackMessages[key] ?? key;
  return Object.entries(variables).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template);
}
