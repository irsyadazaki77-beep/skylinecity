import { CityState } from './types';

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
  check: (state: CityState) => boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  check: (state: CityState) => boolean;
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

export const MISSIONS: Mission[] = [
  { id: 'first_road', title: 'Hubungkan Distrik', description: 'Bangun minimal 8 petak jalan.', rewardMoney: 1_000, check: (state) => state.grid.flat().filter((tile) => tile.type === 'ROAD').length >= 8 },
  { id: 'first_utilities', title: 'Layanan Esensial', description: 'Aktifkan kapasitas listrik dan air.', rewardMoney: 1_500, check: (state) => state.powerCapacity > 0 && state.waterCapacity > 0 },
  { id: 'first_citizens', title: 'Sambut Warga', description: 'Capai populasi 25 jiwa.', rewardMoney: 2_500, check: (state) => state.population >= 25 },
  { id: 'living_city', title: 'Kota Punya Cerita', description: 'Saksikan tiga jenis kisah warga yang dipicu kehidupan kota nyata.', rewardMoney: 1_500, check: (state) => new Set((state.citizenStoryState?.history ?? []).map((story) => story.type)).size >= 3 },
  { id: 'healthy_neighborhood', title: 'Lingkungan Sehat', description: 'Capai 25 warga dengan kebahagiaan minimal 60%.', rewardMoney: 3_000, check: (state) => state.population >= 25 && state.happiness >= 60 },
  { id: 'positive_budget', title: 'Buku Kas Seimbang', description: 'Capai 50 warga sambil menjaga anggaran operasional harian tetap positif.', rewardMoney: 4_000, check: (state) => state.population >= 50 && (state.operatingBudget ?? state.income - state.expenses) >= 0 },
  { id: 'mobility_network', title: 'Gerakkan Kota', description: 'Operasikan transit publik dengan cakupan minimal 20% populasi.', rewardMoney: 5_000, check: (state) => (state.transitCoverage ?? 0) >= 20 && (state.transitActiveLines ?? 0) > 0 },
  { id: 'resilient_city', title: 'Kota Tangguh', description: 'Bangun perlindungan banjir atau selesaikan bencana alam.', rewardMoney: 4_500, check: (state) => (state.floodBarrierCount ?? 0) > 0 || (state.disastersResolved ?? 0) > 0 },
  { id: 'balanced_city', title: 'Kota Seimbang', description: 'Capai kebahagiaan 70%.', rewardMoney: 5_000, check: (state) => state.happiness >= 70 },
  { id: 'metro_ready', title: 'Siap Menjadi Metropolis', description: 'Capai milestone Metropolis.', rewardMoney: 10_000, check: (state) => state.milestoneLevel >= 3 },
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
