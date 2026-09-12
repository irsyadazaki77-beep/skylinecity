import { CityState, TileType } from './types';

export interface CityMilestone {
  level: number;
  name: string;
  populationRequired: number;
  treasuryRequired: number;
  description: string;
  unlockedBuildingTypes: number[];
  mechanicSummary?: string;
  newDecisions?: string[];
}

export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'Infrastructure' | 'Utilities' | 'Zoning' | 'Economy' | 'Environment';
  prerequisiteId?: string;
  requiredMilestoneLevel: number;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  dailyUpkeep: number;
  unlockedMilestoneLevel: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  rewardMoney: number;
  locationLabel: string;
  estimatedCost: number;
  impact: string;
  recoveryPath: string;
  progress: (state: CityState) => { current: number; target: number; unit: string };
  location: (state: CityState) => { x: number; y: number } | null;
  check: (state: CityState) => boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  check: (state: CityState) => boolean;
}

export interface LivingCityUnlock {
  id: string;
  populationRequired?: number;
  condition?: 'FIRST_DISASTER' | 'POSITIVE_CASHFLOW';
  title: string;
  worldChange: string;
}

export type LivingCityStage = 1 | 2 | 3 | 4;

export function getLivingCityStage(population: number): LivingCityStage {
  if (population >= 5_000) return 4;
  if (population >= 1_000) return 3;
  if (population >= 250) return 2;
  return 1;
}

/** Commercial-scale unlock ladder. Kept additive so legacy milestone saves remain valid. */
export const LIVING_CITY_UNLOCKS: LivingCityUnlock[] = [
  { id: 'basic_services', populationRequired: 100, title: 'Layanan Dasar', worldChange: 'Armada layanan dan civic center mulai aktif.' },
  { id: 'commercial_growth', populationRequired: 250, title: 'Pertumbuhan Komersial', worldChange: 'Retail strip, cafe, dan main street bertambah ramai.' },
  { id: 'apartments_school', populationRequired: 500, title: 'Apartment & School Upgrade', worldChange: 'Silhouette hunian bertingkat dan kampus sekolah muncul.' },
  { id: 'public_transit', populationRequired: 1_000, title: 'Public Transit', worldChange: 'Bus line, halte, penumpang, dan transit corridor aktif.' },
  { id: 'office_district', populationRequired: 2_500, title: 'Office District', worldChange: 'Office mid-rise dan modern downtown mulai membentuk skyline.' },
  { id: 'highrise_landmark', populationRequired: 5_000, title: 'High-rise & Landmark', worldChange: 'Tower, landmark menyala, dan metropolitan core terbentuk.' },
  { id: 'disaster_preparation', condition: 'FIRST_DISASTER', title: 'Disaster Preparation', worldChange: 'Peralatan mitigasi dan recovery presentation tersedia.' },
  { id: 'infrastructure_upgrade', condition: 'POSITIVE_CASHFLOW', title: 'Infrastructure Upgrade', worldChange: 'Upgrade koridor dan utilitas dapat dibiayai berkelanjutan.' },
];

type LivingCityProgressState = Pick<CityState, 'population'> & Partial<Pick<CityState, 'disastersResolved' | 'incidents' | 'operatingBudget' | 'income' | 'expenses'>>;

export function getLivingCityUnlocks(state: LivingCityProgressState): LivingCityUnlock[] {
  return LIVING_CITY_UNLOCKS.filter((unlock) => {
    if (unlock.populationRequired !== undefined) return state.population >= unlock.populationRequired;
    if (unlock.condition === 'FIRST_DISASTER') return (state.disastersResolved ?? 0) > 0 || (state.incidents?.length ?? 0) > 0;
    return (state.operatingBudget ?? (state.income ?? 0) - (state.expenses ?? 0)) > 0;
  });
}

export function getNextLivingCityUnlock(state: Pick<CityState, 'population'>): LivingCityUnlock | null {
  return LIVING_CITY_UNLOCKS.find((unlock) => unlock.populationRequired !== undefined && state.population < unlock.populationRequired) ?? null;
}

export const MILESTONES: CityMilestone[] = [
  {
    level: 0,
    name: 'Desa',
    populationRequired: 0,
    treasuryRequired: 0,
    description: 'Kota baru dengan ruang luas untuk tumbuh.',
    unlockedBuildingTypes: [],
    mechanicSummary: 'Membuka tata letak jalan dasar, koneksi utilitas listrik & air, serta zonasi awal perumahan dan toko.',
    newDecisions: ['Penempatan koridor jalan penghubung', 'Tata letak utilitas dasar'],
  },
  {
    level: 1,
    name: 'Kota Kecil',
    populationRequired: 25,
    treasuryRequired: 0,
    description: 'Komunitas terhubung pertamamu mulai terbentuk.',
    unlockedBuildingTypes: [7, 8],
    mechanicSummary: 'Membuka kebutuhan parkir dan manajemen layanan dasar (klinik, kantor polisi, dan pos pemadam).',
    newDecisions: ['Keseimbangan kapasitas parkir', 'Distribusi armada layanan darurat dasar', 'Insentif kawasan campuran dan UMKM'],
  },
  {
    level: 2,
    name: 'City',
    populationRequired: 100,
    treasuryRequired: 0,
    description: 'Kota kini cukup besar untuk mendukung layanan lanjutan.',
    unlockedBuildingTypes: [9, 10],
    mechanicSummary: 'Membuka kemacetan koridor utama, penataan sekolah, dan pengolahan limbah kota.',
    newDecisions: ['Pemisahan koridor arteri dan lokal', 'Akses pendidikan untuk penyerapan kerja', 'Kebijakan atap hijau dan daur ulang sampah'],
  },
  {
    level: 3,
    name: 'Metropolis',
    populationRequired: 250,
    treasuryRequired: 25_000,
    description: 'Pusat regional dengan ekonomi metropolitan yang matang.',
    unlockedBuildingTypes: [11],
    mechanicSummary: 'Membuka transit regional (bus & trem), pengendalian polusi industri, dan politik tarif pajak.',
    newDecisions: ['Rute dan frekuensi transit massal regional', 'Regulasi pajak diferensial komersial/industri', 'Strategi promosi pariwisata'],
  },
  {
    level: 4,
    name: 'Megakota',
    populationRequired: 600,
    treasuryRequired: 100_000,
    description: 'Kepadatan, layanan, dan inovasi saling memperkuat.',
    unlockedBuildingTypes: [12],
    mechanicSummary: 'Membuka mitigasi bencana besar, ekspansi regional multi-sektor, dan spesialisasi kota metropolitan.',
    newDecisions: ['Tanggul penahan banjir & protokol kebencanaan', 'Pusat operasi AI kota & izin gedung pencakar langit', 'Spesialisasi ekonomi kota'],
  },
  {
    level: 5,
    name: 'Ibu Kota Skyline',
    populationRequired: 1_200,
    treasuryRequired: 250_000,
    description: 'Cakrawala kota yang dikenal dunia dengan sistem sipil yang matang.',
    unlockedBuildingTypes: [],
    mechanicSummary: 'Membuka protokol puncak metropolitan dengan integrasi penuh sistem urban otonom.',
    newDecisions: ['Optimasi akhir infrastruktur metropolitan', 'Efisiensi regional maksimal'],
  },
];

export const TECH_NODES: TechNode[] = [
  { id: 'asphalt_roads', name: 'Jalan Aspal', description: 'Meningkatkan kapasitas jalan dan mengurangi hambatan perjalanan.', cost: 5_000, category: 'Infrastructure', requiredMilestoneLevel: 0 },
  { id: 'smart_lights', name: 'Lampu Lalu Lintas Cerdas', description: 'Melancarkan simpang dan mengurangi lonjakan kemacetan.', cost: 10_000, category: 'Infrastructure', prerequisiteId: 'asphalt_roads', requiredMilestoneLevel: 1 },
  { id: 'bike_lanes', name: 'Lajur Sepeda', description: 'Mengalihkan perjalanan pendek dari kendaraan bermotor.', cost: 12_000, category: 'Infrastructure', prerequisiteId: 'asphalt_roads', requiredMilestoneLevel: 1 },
  { id: 'bus_network', name: 'Jaringan Bus', description: 'Mengurangi lalu lintas mobil kota sebesar 25%.', cost: 25_000, category: 'Infrastructure', prerequisiteId: 'smart_lights', requiredMilestoneLevel: 2 },
  { id: 'tram_system', name: 'Sistem Trem', description: 'Membuka transit publik berkapasitas tinggi.', cost: 50_000, category: 'Infrastructure', prerequisiteId: 'bus_network', requiredMilestoneLevel: 3 },
  { id: 'water_meters', name: 'Meter Air', description: 'Mengurangi konsumsi air sebesar 10%.', cost: 12_000, category: 'Utilities', requiredMilestoneLevel: 0 },
  { id: 'high_cap_pipes', name: 'Pipa Berkapasitas Tinggi', description: 'Meningkatkan kapasitas jaringan air sebesar 20%.', cost: 15_000, category: 'Utilities', requiredMilestoneLevel: 1 },
  { id: 'smart_grid', name: 'Jaringan Listrik Cerdas', description: 'Meningkatkan kapasitas listrik sebesar 20%.', cost: 15_000, category: 'Utilities', requiredMilestoneLevel: 1 },
  { id: 'solar_subsidies', name: 'Subsidi Surya', description: 'Mengurangi kebutuhan listrik kota sebesar 10%.', cost: 20_000, category: 'Utilities', requiredMilestoneLevel: 2 },
  { id: 'deep_pumps', name: 'Pompa Air Dalam', description: 'Meningkatkan keluaran pompa sebesar 50%.', cost: 35_000, category: 'Utilities', prerequisiteId: 'high_cap_pipes', requiredMilestoneLevel: 2 },
  { id: 'adv_turbines', name: 'Turbin Lanjutan', description: 'Meningkatkan keluaran pembangkit sebesar 50%.', cost: 40_000, category: 'Utilities', prerequisiteId: 'smart_grid', requiredMilestoneLevel: 2 },
  { id: 'mixed_use', name: 'Zonasi Campuran', description: 'Meningkatkan produktivitas komersial.', cost: 25_000, category: 'Zoning', requiredMilestoneLevel: 1 },
  { id: 'high_dens_res', name: 'Hunian Kepadatan Tinggi', description: 'Membuka gedung hunian yang lebih tinggi.', cost: 30_000, category: 'Zoning', requiredMilestoneLevel: 2 },
  { id: 'high_dens_com', name: 'Komersial Kepadatan Tinggi', description: 'Membuka gedung komersial yang lebih besar.', cost: 30_000, category: 'Zoning', requiredMilestoneLevel: 2 },
  { id: 'high_dens_ind', name: 'Industri Kepadatan Tinggi', description: 'Membuka fasilitas industri yang lebih besar.', cost: 30_000, category: 'Zoning', requiredMilestoneLevel: 2 },
  { id: 'sky_permits', name: 'Izin Pencakar Langit', description: 'Membuka gedung skyline level 5.', cost: 80_000, category: 'Zoning', requiredMilestoneLevel: 4 },
  { id: 'prop_tax_hike', name: 'Kenaikan Pajak Properti', description: 'Meningkatkan pendapatan hunian dengan konsekuensi pada kebahagiaan.', cost: 5_000, category: 'Economy', requiredMilestoneLevel: 1 },
  { id: 'small_biz', name: 'Hibah Usaha Kecil', description: 'Meningkatkan pendapatan komersial.', cost: 20_000, category: 'Economy', requiredMilestoneLevel: 1 },
  { id: 'corp_subsidies', name: 'Subsidi Korporasi', description: 'Meningkatkan pendapatan industri.', cost: 25_000, category: 'Economy', requiredMilestoneLevel: 2 },
  { id: 'tourism', name: 'Kampanye Pariwisata', description: 'Mengubah daya tarik kota menjadi pendapatan komersial.', cost: 50_000, category: 'Economy', requiredMilestoneLevel: 3 },
  { id: 'recycling', name: 'Mandat Daur Ulang', description: 'Mengurangi biaya perawatan layanan dan tekanan sampah.', cost: 15_000, category: 'Environment', requiredMilestoneLevel: 1 },
  { id: 'green_roofs', name: 'Atap Hijau', description: 'Mengurangi polusi dan biaya perawatan.', cost: 20_000, category: 'Environment', requiredMilestoneLevel: 2 },
  { id: 'smart_sensors', name: 'Sensor Kota Cerdas', description: 'Meningkatkan kapasitas utilitas dan pemahaman kondisi kota.', cost: 45_000, category: 'Environment', requiredMilestoneLevel: 3 },
  { id: 'ai_management', name: 'Manajemen Kota AI', description: 'Mengurangi beban biaya perawatan.', cost: 100_000, category: 'Environment', requiredMilestoneLevel: 4 },
  { id: 'megacity', name: 'Protokol Megakota', description: 'Membuka pengali pertumbuhan akhir.', cost: 250_000, category: 'Environment', requiredMilestoneLevel: 5 },
];

export const POLICIES: Policy[] = [
  { id: 'mixed_use', name: 'Insentif Kawasan Campuran', description: 'Mendorong lingkungan yang padat dan permintaan komersial yang lebih kuat.', dailyUpkeep: 10, unlockedMilestoneLevel: 1 },
  { id: 'small_biz', name: 'Keringanan Usaha Kecil', description: 'Mendukung toko lokal dengan subsidi operasional ringan.', dailyUpkeep: 10, unlockedMilestoneLevel: 1 },
  { id: 'green_roofs', name: 'Mandat Atap Hijau', description: 'Mengurangi polusi di distrik padat.', dailyUpkeep: 15, unlockedMilestoneLevel: 2 },
  { id: 'recycling', name: 'Program Sampah Sirkular', description: 'Mengurangi tekanan sampah dan beban layanan.', dailyUpkeep: 25, unlockedMilestoneLevel: 2 },
  { id: 'tourism', name: 'Promosi Pariwisata', description: 'Mengubah kota yang menarik menjadi pendapatan tambahan dari pengunjung.', dailyUpkeep: 30, unlockedMilestoneLevel: 3 },
  { id: 'ai_management', name: 'Pusat Operasi AI', description: 'Mengotomatiskan perencanaan perawatan kota.', dailyUpkeep: 40, unlockedMilestoneLevel: 4 },
];

const firstTile = (state: CityState, predicate: (type: TileType) => boolean) =>
  state.grid.flat().find((tile) => predicate(tile.type)) ?? null;
const tileLocation = (tile: { x: number; y: number } | null) => tile ? { x: tile.x, y: tile.y } : null;
const countTiles = (state: CityState, ...types: TileType[]) => state.grid.flat().filter((tile) => types.includes(tile.type)).length;
const progress = (current: number, target: number, unit: string) => ({ current: Math.max(0, current), target, unit });

export const MISSIONS: Mission[] = [
  { id: 'first_road', title: 'Hubungkan Kota ke Highway', description: 'Bangun minimal 8 petak jalan dan pertahankan akses regional.', rewardMoney: 1_000, locationLabel: 'Gerbang highway', estimatedCost: 800, impact: 'Membuka arus warga, pekerja, dan freight.', recoveryPath: 'Mulai dari satu local road murah; lanjutkan ruas saat kas kembali positif.', progress: (state) => progress(countTiles(state, TileType.ROAD), 8, 'petak'), location: (state) => tileLocation(firstTile(state, (type) => type === TileType.ROAD)), check: (state) => countTiles(state, TileType.ROAD) >= 8 },
  { id: 'first_utilities', title: 'Stabilkan Listrik dan Air', description: 'Aktifkan kedua utilitas dasar kota.', rewardMoney: 1_500, locationLabel: 'Koridor utilitas', estimatedCost: 3_500, impact: 'Mengaktifkan okupansi dan pembangunan lot.', recoveryPath: 'Bangun satu fasilitas dahulu, hentikan waktu, lalu lengkapi jaringan kedua.', progress: (state) => progress(Number(state.powerCapacity > 0) + Number(state.waterCapacity > 0), 2, 'jaringan'), location: (state) => tileLocation(firstTile(state, (type) => type === TileType.POWER_PLANT || type === TileType.WATER_PUMP)), check: (state) => state.powerCapacity > 0 && state.waterCapacity > 0 },
  { id: 'first_citizens', title: 'Bangun Residential District', description: 'Tumbuhkan lingkungan pertama hingga 100 warga.', rewardMoney: 2_500, locationLabel: 'Residential district', estimatedCost: 2_400, impact: 'Membuka layanan dasar dan aktivitas lingkungan.', recoveryPath: 'Tambah lot ber-frontage, lalu pulihkan power, water, dan happiness.', progress: (state) => progress(state.population, 100, 'warga'), location: (state) => tileLocation(firstTile(state, (type) => type === TileType.RESIDENTIAL)), check: (state) => state.population >= 100 },
  { id: 'living_city', title: 'Kota Punya Cerita', description: 'Saksikan tiga jenis kisah warga yang dipicu kehidupan kota nyata.', rewardMoney: 1_500, locationLabel: 'Kawasan warga aktif', estimatedCost: 0, impact: 'Membuktikan hubungan keputusan kota dengan pengalaman warga.', recoveryPath: 'Jalankan waktu dan sediakan hunian, pekerjaan, serta perjalanan transit.', progress: (state) => progress(new Set((state.citizenStoryState?.history ?? []).map((story) => story.type)).size, 3, 'jenis cerita'), location: (state) => state.citizenStoryState?.active[0]?.location ?? state.citizenStoryState?.history[0]?.location ?? null, check: (state) => new Set((state.citizenStoryState?.history ?? []).map((story) => story.type)).size >= 3 },
  { id: 'healthy_neighborhood', title: 'Kawasan Bahagia', description: 'Pertahankan kebahagiaan minimal 70% saat kota berisi 250 warga.', rewardMoney: 3_000, locationLabel: 'Kawasan dengan layanan', estimatedCost: 4_000, impact: 'Lingkungan lebih terawat dan pertumbuhan lebih stabil.', recoveryPath: 'Atasi diagnostic terburuk, tambah park atau layanan, lalu tunggu pemulihan.', progress: (state) => progress(Math.min(state.population / 250, state.happiness / 70) * 100, 100, '% syarat'), location: (state) => tileLocation(firstTile(state, (type) => type === TileType.PARK || type === TileType.CLINIC)), check: (state) => state.population >= 250 && state.happiness >= 70 },
  { id: 'commercial_corridor', title: 'Bangun Commercial Corridor', description: 'Operasikan enam lot commercial/office dengan pekerjaan aktif.', rewardMoney: 4_000, locationLabel: 'Main street komersial', estimatedCost: 4_800, impact: 'Menambah pekerjaan, belanja lokal, signage, dan pedestrian traffic.', recoveryPath: 'Mulai dari corner shop; tambah lot hanya saat demand dan utilitas tersedia.', progress: (state) => progress(state.grid.flat().filter((tile) => (tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE) && tile.jobs > 0).length, 6, 'bangunan'), location: (state) => tileLocation(firstTile(state, (type) => type === TileType.COMMERCIAL || type === TileType.OFFICE)), check: (state) => state.grid.flat().filter((tile) => (tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE) && tile.jobs > 0).length >= 6 },
  { id: 'positive_budget', title: 'Cashflow Positif', description: 'Capai 500 warga dengan anggaran operasional harian positif.', rewardMoney: 4_000, locationLabel: 'Town center', estimatedCost: 0, impact: 'Membuka jalur upgrade infrastruktur tanpa utang baru.', recoveryPath: 'Tunda ekspansi, kurangi upkeep non-kritis, dan tingkatkan okupansi pekerjaan.', progress: (state) => progress(Math.min(state.population / 500, (state.operatingBudget ?? state.income - state.expenses) >= 0 ? 1 : 0) * 100, 100, '% syarat'), location: (state) => tileLocation(firstTile(state, (type) => type === TileType.POLICE_STATION || type === TileType.PARK)), check: (state) => state.population >= 500 && (state.operatingBudget ?? state.income - state.expenses) >= 0 },
  { id: 'mobility_network', title: 'Operasikan Bus Line', description: 'Operasikan transit publik dengan cakupan minimal 20% populasi.', rewardMoney: 5_000, locationLabel: 'Transit corridor', estimatedCost: 8_000, impact: 'Mengurangi car trips dan tekanan koridor.', recoveryPath: 'Pendekkan rute, tambah stop pada catchment padat, atau kurangi headway.', progress: (state) => progress((state.transitActiveLines ?? 0) > 0 ? (state.transitCoverage ?? 0) : 0, 20, '% cakupan'), location: (state) => tileLocation(firstTile(state, (type) => type === TileType.BUS_STOP || type === TileType.BUS_DEPOT)), check: (state) => (state.transitCoverage ?? 0) >= 20 && (state.transitActiveLines ?? 0) > 0 },
  { id: 'traffic_relief', title: 'Kurangi Traffic', description: 'Turunkan congestion index menjadi 35 atau lebih rendah pada kota 1.000 warga.', rewardMoney: 6_000, locationLabel: 'Intersection terpadat', estimatedCost: 6_000, impact: 'Mempercepat commute, freight, dan service response.', recoveryPath: 'Gunakan transit, arterial bypass, signal, atau hilangkan bottleneck satu per satu.', progress: (state) => progress(state.population >= 1_000 ? Math.max(0, 100 - (state.congestionIndex ?? 100)) : state.population / 10, 65, 'skor lancar'), location: (state) => tileLocation([...state.grid.flat()].filter((tile) => tile.type === TileType.ROAD).sort((a, b) => b.traffic - a.traffic)[0] ?? null), check: (state) => state.population >= 1_000 && (state.congestionIndex ?? 100) <= 35 },
  { id: 'resilient_city', title: 'Pulihkan Kota dari Banjir', description: 'Bangun perlindungan banjir atau selesaikan bencana alam.', rewardMoney: 4_500, locationLabel: 'Waterfront terdampak', estimatedCost: 5_000, impact: 'Mengurangi gangguan jalan, bangunan, dan layanan darurat.', recoveryPath: 'Prioritaskan akses darurat, pompa area rendah, lalu bangun barrier bertahap.', progress: (state) => progress(Math.max(state.floodBarrierCount ?? 0, state.disastersResolved ?? 0), 1, 'aksi pemulihan'), location: (state) => tileLocation([...state.grid.flat()].sort((a, b) => (b.disasterImpact ?? 0) - (a.disasterImpact ?? 0))[0] ?? null), check: (state) => (state.floodBarrierCount ?? 0) > 0 || (state.disastersResolved ?? 0) > 0 },
  { id: 'metro_ready', title: 'Bangun Landmark Metropolitan', description: 'Capai 5.000 warga dan hadirkan landmark kota.', rewardMoney: 10_000, locationLabel: 'Metropolitan core', estimatedCost: 25_000, impact: 'Menciptakan skyline, tujuan wisata, dan momen kota besar.', recoveryPath: 'Bangun densitas bertahap; stabilkan layanan dan kas sebelum landmark.', progress: (state) => progress(Math.min(state.population / 5_000, countTiles(state, TileType.PARK) > 0 ? 1 : 0) * 100, 100, '% syarat'), location: (state) => tileLocation(firstTile(state, (type) => type === TileType.PARK || type === TileType.OFFICE)), check: (state) => state.population >= 5_000 && countTiles(state, TileType.PARK) > 0 },
];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'builder', title: 'Pembangun Ulung', description: 'Bangun 50 petak yang tidak kosong.', check: (state) => state.grid.flat().filter((tile) => tile.type !== 'EMPTY').length >= 50 },
  { id: 'green_city', title: 'Kota Hijau', description: 'Jaga rata-rata polusi di bawah 15.', check: (state) => state.population >= 50 && state.pollutionAverage < 15 },
  { id: 'prosperous', title: 'Kas Sejahtera', description: 'Kumpulkan $50.000.', check: (state) => state.money >= 50_000 },
  { id: 'skyline', title: 'Cakrawala Baru', description: 'Buka gedung level 5.', check: (state) => state.buildingLevelCounts.residential[4] > 0 || state.buildingLevelCounts.commercial[4] > 0 || state.buildingLevelCounts.industrial[4] > 0 },
];

export function getMilestoneLevel(state: Pick<CityState, 'population' | 'money'>): number {
  let level = 0;
  for (const milestone of MILESTONES) {
    if (state.population >= milestone.populationRequired && state.money >= milestone.treasuryRequired) level = milestone.level;
  }
  return level;
}
