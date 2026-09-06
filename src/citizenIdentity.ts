import { Citizen, Household, AgeStage, EducationLevel, TransitMode } from './citizenSimulation/types';

export interface CitizenProfile {
  id: string;
  name: string;
  age: number;
  stage: AgeStage;
  stageLabel: string;
  education: EducationLevel;
  educationLabel: string;
  occupation: string;
  income: number;
  homeCoords: { x: number; y: number };
  workplaceCoords: { x: number; y: number } | null;
  transportMode: TransitMode;
  commuteTimeMinutes: number;
  happiness: number;
  health: number;
  majorComplaint: string;
  majorNeed: string;
  householdName: string;
  isRepresentative: boolean;
}

const FIRST_NAMES_MALE = [
  'Budi', 'Eko', 'Agus', 'Hendra', 'Bambang', 'Rian', 'Fajar', 'Aditya',
  'Rizky', 'Surya', 'Wahyu', 'Bayu', 'Dimas', 'Taufik', 'Arif', 'Ilham'
];

const FIRST_NAMES_FEMALE = [
  'Siti', 'Ayu', 'Dewi', 'Rini', 'Tri', 'Sri', 'Putri', 'Lestari',
  'Nur', 'Indah', 'Fitri', 'Nadia', 'Wulan', 'Maya', 'Ratna', 'Anisa'
];

const LAST_NAMES = [
  'Santoso', 'Prasetyo', 'Wijaya', 'Kusuma', 'Saputra', 'Setiawan',
  'Nugroho', 'Hidayat', 'Wibowo', 'Siregar', 'Lubis', 'Susanto',
  'Gunawan', 'Hartono', 'Purnomo', 'Firmansyah', 'Darmawan', 'Utomo'
];

const OCCUPATIONS_BY_EDU: Record<EducationLevel, string[]> = {
  [EducationLevel.UNEDUCATED]: [
    'Pekerja Logistik', 'Buruh Pabrik', 'Petugas Kebersihan', 'Staf Gudang',
    'Asisten Toko', 'Kurir Pengiriman', 'Petani Sayur', 'Kuli Bangunan'
  ],
  [EducationLevel.HIGH_SCHOOL]: [
    'Kasir Swalayan', 'Teknisi Lapangan', 'Operator Mesin', 'Mekanik Kendaraan',
    'Pramuniaga Ritel', 'Staf Administrasi', 'Barista Kafe', 'Pengemudi Transit'
  ],
  [EducationLevel.UNIVERSITY]: [
    'Insinyur Sipil', 'Manajer Operasional', 'Arsitek Urban', 'Dokter Spesialis',
    'Analis Data', 'Konsultan Finansial', 'Pengembang Perangkat Lunak', 'Dosen'
  ],
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Deterministically generates an authentic citizen profile from simulated Citizen state.
 */
export function deriveCitizenProfile(citizen: Citizen, household?: Household): CitizenProfile {
  const hash = hashString(citizen.id);
  const isFemale = (hash & 1) === 0;
  const firstNames = isFemale ? FIRST_NAMES_FEMALE : FIRST_NAMES_MALE;
  const firstName = firstNames[(hash >>> 1) % firstNames.length];
  const lastName = LAST_NAMES[(hash >>> 5) % LAST_NAMES.length];
  const fullName = `${firstName} ${lastName}`;

  // Stage label
  const stageLabels: Record<AgeStage, string> = {
    [AgeStage.CHILD]: 'Anak-anak',
    [AgeStage.STUDENT]: 'Pelajar / Mahasiswa',
    [AgeStage.ADULT]: 'Usia Produktif',
    [AgeStage.SENIOR]: 'Lanjut Usia',
  };

  const educationLabels: Record<EducationLevel, string> = {
    [EducationLevel.UNEDUCATED]: 'Pendidikan Dasar',
    [EducationLevel.HIGH_SCHOOL]: 'SMA / Kejuruan',
    [EducationLevel.UNIVERSITY]: 'Sarjana / Tinggi',
  };

  // Occupation
  let occupation = 'Mencari Kerja';
  if (citizen.stage === AgeStage.CHILD) {
    occupation = 'Siswa Sekolah';
  } else if (citizen.stage === AgeStage.SENIOR) {
    occupation = 'Pensiunan';
  } else if (citizen.workplace) {
    occupation = citizen.workplace.jobTitle;
  } else {
    const list = OCCUPATIONS_BY_EDU[citizen.education] || OCCUPATIONS_BY_EDU[EducationLevel.HIGH_SCHOOL];
    occupation = list[(hash >>> 8) % list.length];
  }

  // Daily income
  const baseSalary = citizen.workplace?.salary ?? (citizen.education === EducationLevel.UNIVERSITY ? 220 : citizen.education === EducationLevel.HIGH_SCHOOL ? 130 : 85);
  const income = citizen.stage === AgeStage.CHILD ? 0 : baseSalary;

  // Primary complaint
  let majorComplaint = 'Kondisi kota kondusif';
  if (citizen.commuteTime > 25) {
    majorComplaint = 'Waktu tempuh komuter terlalu lama';
  } else if (citizen.happiness < 40) {
    majorComplaint = 'Biaya hidup dan fasilitas kurang memadai';
  } else if (citizen.health < 50) {
    majorComplaint = 'Kualitas udara atau akses puskesmas minim';
  } else if (!citizen.workplace && citizen.stage === AgeStage.ADULT) {
    majorComplaint = 'Belum mendapatkan lowongan pekerjaan';
  }

  // Primary need
  let majorNeed = 'Rekreasi taman';
  if (citizen.serviceNeeds.healthcare > 60) {
    majorNeed = 'Pemeriksaan kesehatan';
  } else if (citizen.serviceNeeds.education > 60) {
    majorNeed = 'Fasilitas pendidikan';
  } else if (citizen.serviceNeeds.goods > 60) {
    majorNeed = 'Pusat belanja kebutuhan pokok';
  }

  const householdFamilyName = household
    ? `Keluarga ${LAST_NAMES[(hashString(household.id) >>> 3) % LAST_NAMES.length]}`
    : `Keluarga ${lastName}`;

  return {
    id: citizen.id,
    name: fullName,
    age: citizen.age,
    stage: citizen.stage,
    stageLabel: stageLabels[citizen.stage] ?? citizen.stage,
    education: citizen.education,
    educationLabel: educationLabels[citizen.education] ?? 'Dasar',
    occupation,
    income,
    homeCoords: { ...citizen.residence },
    workplaceCoords: citizen.workplace ? { ...citizen.workplace.workplaceTile } : null,
    transportMode: citizen.commuteTime > 20 ? TransitMode.TRANSIT : TransitMode.CAR,
    commuteTimeMinutes: Math.round(citizen.commuteTime),
    happiness: Math.round(citizen.happiness),
    health: Math.round(citizen.health),
    majorComplaint,
    majorNeed,
    householdName: householdFamilyName,
    isRepresentative: true,
  };
}
