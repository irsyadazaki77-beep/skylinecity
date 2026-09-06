import { CityEventData, ModManifest, ScenarioDefinition, TileType } from './types';
import { POLICIES, TECH_NODES, MISSIONS } from './progression';
import { PRODUCTION_RECIPES } from './logistics';

export interface BuildingDefinition {
  id: string;
  tileType: TileType;
  displayName: string;
  category: 'ZONE' | 'SERVICE' | 'UTILITY' | 'TRANSIT' | 'LOGISTICS' | 'ENVIRONMENT';
  maxLevel: number;
  tags: string[];
}

export interface ContentRegistry {
  buildings: Map<string, BuildingDefinition>;
  policies: typeof POLICIES;
  technologies: typeof TECH_NODES;
  recipes: typeof PRODUCTION_RECIPES;
  events: CityEventData[];
  missions: typeof MISSIONS;
  scenarios: ScenarioDefinition[];
  mods: ModManifest[];
}

export interface ModContentPack {
  manifest: ModManifest;
  buildings?: BuildingDefinition[];
  scenarios?: ScenarioDefinition[];
}

const buildingDefinitions: BuildingDefinition[] = [
  { id: 'residential', tileType: TileType.RESIDENTIAL, displayName: 'Hunian', category: 'ZONE', maxLevel: 5, tags: ['perumahan'] },
  { id: 'commercial', tileType: TileType.COMMERCIAL, displayName: 'Komersial', category: 'ZONE', maxLevel: 5, tags: ['ritel', 'pekerjaan'] },
  { id: 'office', tileType: TileType.OFFICE, displayName: 'Perkantoran', category: 'ZONE', maxLevel: 5, tags: ['kantor', 'pengetahuan', 'pekerjaan'] },
  { id: 'industrial', tileType: TileType.INDUSTRIAL, displayName: 'Industri', category: 'ZONE', maxLevel: 5, tags: ['produksi', 'pekerjaan'] },
  { id: 'power_plant', tileType: TileType.POWER_PLANT, displayName: 'Pembangkit Listrik', category: 'UTILITY', maxLevel: 1, tags: ['listrik'] },
  { id: 'water_pump', tileType: TileType.WATER_PUMP, displayName: 'Pompa Air', category: 'UTILITY', maxLevel: 1, tags: ['air'] },
  { id: 'bus_depot', tileType: TileType.BUS_DEPOT, displayName: 'Depo Bus', category: 'TRANSIT', maxLevel: 3, tags: ['transit'] },
  { id: 'tram_station', tileType: TileType.TRAM_STATION, displayName: 'Stasiun Trem', category: 'TRANSIT', maxLevel: 3, tags: ['transit'] },
  { id: 'bus_stop', tileType: TileType.BUS_STOP, displayName: 'Halte Bus', category: 'TRANSIT', maxLevel: 1, tags: ['transit', 'pemberhentian'] },
  { id: 'tram_stop', tileType: TileType.TRAM_STOP, displayName: 'Halte Trem', category: 'TRANSIT', maxLevel: 1, tags: ['transit', 'pemberhentian'] },
  { id: 'warehouse', tileType: TileType.WAREHOUSE, displayName: 'Gudang', category: 'LOGISTICS', maxLevel: 5, tags: ['angkutan', 'penyimpanan'] },
  { id: 'cargo_terminal', tileType: TileType.CARGO_TERMINAL, displayName: 'Terminal Kargo', category: 'LOGISTICS', maxLevel: 5, tags: ['angkutan', 'gerbang'] },
];

export const SCENARIO_DEFINITIONS: ScenarioDefinition[] = [
  { id: 'balanced-beginnings', name: 'Kota dari Nol', description: 'Bangun fondasi kota tanpa mengorbankan kebahagiaan.', premise: 'Permukiman tropis baru membutuhkan pekerjaan dan layanan.', seed: 1024, tags: ['seimbang'], targetDays: 120, constraints: ['Kas awal terbatas'], events: ['Gelombang migrasi'], hardChoices: ['Pertumbuhan atau layanan'], objectives: [{ id: 'population', label: 'Capai 100 warga', target: 100 }, { id: 'happiness', label: 'Jaga kebahagiaan di atas 60', target: 60 }] },
  { id: 'flood-resilience', name: 'Koridor Banjir', description: 'Lindungi kota sungai yang tumbuh sambil menjaga anggaran tetap seimbang.', premise: 'Koridor sungai produktif sekaligus rentan monsun.', seed: 2088, tags: ['banjir', 'pemulihan'], targetDays: 180, constraints: ['Pembangunan tetap di koridor sungai'], events: ['Peringatan hujan lebat'], hardChoices: ['Evakuasi atau aktivitas ekonomi'], objectives: [{ id: 'population', label: 'Capai 250 warga', target: 250 }, { id: 'flood-control', label: 'Bangun 3 tanggul banjir', target: 3 }] },
  { id: 'transit-metropolis', name: 'Kota Tanpa Macet', description: 'Bangun jaringan transit yang menjaga tekanan komuter tetap terkendali.', premise: 'Pertumbuhan cepat bertumpu pada satu koridor arteri.', seed: 8192, tags: ['transit', 'lalu lintas'], targetDays: 300, constraints: ['Jalan tol baru dibatasi'], events: ['Jam sibuk regional'], hardChoices: ['Tarif murah atau kas sehat'], objectives: [{ id: 'ridership', label: 'Capai cakupan transit 65%', target: 65 }, { id: 'congestion', label: 'Jaga kemacetan di bawah 35', target: 35 }] },
  { id: 'industrial-transition', name: 'Krisis Industri', description: 'Bersihkan produksi tanpa menjatuhkan lapangan kerja.', premise: 'Pabrik utama menghadapi kekurangan input dan polusi.', seed: 4096, tags: ['industri', 'hijau'], targetDays: 240, constraints: ['Pertahankan pekerjaan'], events: ['Gangguan logistik'], hardChoices: ['Subsidi atau diversifikasi'], objectives: [{ id: 'efficiency', label: 'Pertahankan efisiensi produksi 85%', target: 85 }, { id: 'pollution', label: 'Jaga polusi di bawah 25', target: 25 }, { id: 'jobs', label: 'Pertahankan 100 pekerjaan', target: 100 }] },
  { id: 'mixed-use-metro', name: 'Metropolitan Baru', description: 'Kembangkan pusat regional campuran yang padat.', premise: 'Kota siap memadat tanpa kehilangan karakter distrik.', seed: 16384, tags: ['campuran', 'metro'], targetDays: 320, constraints: ['Utamakan pengisian kawasan'], events: ['Lonjakan harga lahan'], hardChoices: ['Kepadatan atau keterjangkauan'], objectives: [{ id: 'population', label: 'Capai 300 warga', target: 300 }, { id: 'mixed-use', label: 'Bangun 6 blok campuran', target: 6 }] },
  { id: 'green-balance', name: 'Kota Seimbang', description: 'Seimbangkan kemakmuran, udara bersih, dan kesejahteraan warga.', premise: 'Kota tropis menolak memilih antara ekonomi dan kualitas hidup.', seed: 32768, tags: ['hijau', 'seimbang'], targetDays: 260, constraints: ['Polusi maksimum 20'], events: ['Tekanan investasi'], hardChoices: ['Industri cepat atau ekonomi bersih'], objectives: [{ id: 'balance', label: 'Capai skor keseimbangan 70', target: 70 }, { id: 'pollution', label: 'Jaga polusi di bawah 20', target: 20 }] },
  { id: 'housing-crisis', name: 'Krisis Perumahan', description: 'Kendalikan lonjakan harga sewa dan sediakan hunian terjangkau tanpa merusak keuangan kota.', premise: 'Pertumbuhan pekerja cepat memicu lonjakan sewa apartemen.', seed: 65536, tags: ['perumahan', 'ekonomi'], targetDays: 240, constraints: ['Pertahankan kas positif'], events: ['Protes sewa hunian'], hardChoices: ['Kontrol sewa atau insentif pengembang'], objectives: [{ id: 'affordability', label: 'Tingkatkan keterjangkauan di atas 65%', target: 65 }, { id: 'population', label: 'Capai 200 warga', target: 200 }] },
  { id: 'economic-recovery', name: 'Pemulihan Ekonomi', description: 'Pulihkan surplus anggaran dan produktivitas bisnis setelah gangguan supply chain.', premise: 'Kota mengalami penurunan kas akibat rantai pasok industri terputus.', seed: 131072, tags: ['pemulihan', 'anggaran'], targetDays: 280, constraints: ['Tanpa utang berlebih'], events: ['Restrukturisasi industri'], hardChoices: ['Pajak ketat atau belanja stimulus'], objectives: [{ id: 'income', label: 'Capai surplus harian di atas $200', target: 200 }, { id: 'jobs', label: 'Sediakan 150 pekerjaan stabil', target: 150 }] },
];

export function createContentRegistry(): ContentRegistry {
  return {
    buildings: new Map(buildingDefinitions.map((definition) => [definition.id, definition])),
    policies: [...POLICIES],
    technologies: [...TECH_NODES],
    recipes: { ...PRODUCTION_RECIPES },
    events: [],
    missions: [...MISSIONS],
    scenarios: SCENARIO_DEFINITIONS.map((scenario) => ({ ...scenario, objectives: scenario.objectives.map((objective) => ({ ...objective })) })),
    mods: [],
  };
}

export function validateModManifest(manifest: unknown): { valid: boolean; errors: string[]; manifest?: ModManifest } {
  const value = manifest as Partial<ModManifest> | null;
  const errors: string[] = [];
  if (!value || typeof value !== 'object') errors.push('Manifest harus berupa object.');
  if (!value?.id || !/^[a-z0-9][a-z0-9._-]*$/.test(value.id)) errors.push('id harus lowercase dan hanya berisi a-z, 0-9, titik, underscore, atau strip.');
  if (!value?.name || typeof value.name !== 'string') errors.push('name wajib diisi.');
  if (!value?.version || typeof value.version !== 'string') errors.push('version wajib diisi.');
  if (!value?.gameVersion || typeof value.gameVersion !== 'string') errors.push('gameVersion wajib diisi.');
  if (!value?.namespace || !/^[a-z0-9][a-z0-9._-]*$/.test(value.namespace)) errors.push('namespace tidak valid.');
  if (!Array.isArray(value?.content)) errors.push('content harus berupa array.');
  if (value?.dependencies && (!Array.isArray(value.dependencies) || value.dependencies.some((item) => typeof item !== 'string'))) errors.push('dependencies harus berupa array string.');
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors, manifest: value as ModManifest };
}

export function registerMod(registry: ContentRegistry, manifest: unknown): { registry: ContentRegistry; errors: string[] } {
  const validation = validateModManifest(manifest);
  if (!validation.valid || !validation.manifest) return { registry, errors: validation.errors };
  if (registry.mods.some((mod) => mod.id === validation.manifest!.id)) return { registry, errors: [`Mod '${validation.manifest.id}' sudah terdaftar.`] };
  return { registry: { ...registry, mods: [...registry.mods, validation.manifest] }, errors: [] };
}

/** Registers JSON content only; arbitrary functions/scripts are intentionally rejected. */
export function registerModContentPack(registry: ContentRegistry, pack: unknown): { registry: ContentRegistry; errors: string[] } {
  const value = pack as Partial<ModContentPack> | null;
  const registered = registerMod(registry, value?.manifest);
  if (registered.errors.length > 0 || !registered.registry.mods.length) return registered;
  const errors: string[] = [];
  const buildings = value?.buildings ?? [];
  const scenarios = value?.scenarios ?? [];
  if (!Array.isArray(buildings) || buildings.some((building) => !building || typeof building.id !== 'string' || typeof building.displayName !== 'string')) errors.push('buildings harus berupa definisi data yang valid.');
  if (!Array.isArray(scenarios) || scenarios.some((scenario) => !scenario || typeof scenario.id !== 'string' || !Array.isArray(scenario.objectives))) errors.push('scenarios harus berupa definisi data yang valid.');
  const manifest = registered.registry.mods[registered.registry.mods.length - 1];
  const namespace = `${manifest.namespace}.`;
  if (buildings.some((building) => !building.id.startsWith(namespace))) errors.push(`Semua building ID harus memakai namespace '${namespace}'.`);
  if (scenarios.some((scenario) => !scenario.id.startsWith(namespace))) errors.push(`Semua scenario ID harus memakai namespace '${namespace}'.`);
  if (errors.length > 0) return { registry, errors };
  const nextBuildings = new Map(registered.registry.buildings);
  for (const building of buildings) nextBuildings.set(building.id, building);
  return {
    registry: {
      ...registered.registry,
      buildings: nextBuildings,
      scenarios: [...registered.registry.scenarios, ...scenarios],
    },
    errors: [],
  };
}

export function loadModContentJson(registry: ContentRegistry, json: string): { registry: ContentRegistry; errors: string[] } {
  try {
    return registerModContentPack(registry, JSON.parse(json));
  } catch {
    return { registry, errors: ['Mod JSON tidak dapat diparse.'] };
  }
}
