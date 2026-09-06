import { CityState, TileData } from './types';
import { Citizen, Household, Trip, TransitMode, TripPurpose } from './citizenSimulation/types';

export type CitizenStoryType = 'MOVED_IN' | 'FOUND_WORK' | 'LONG_COMMUTE' | 'USED_TRANSIT' | 'FLOOD_AFFECTED';
export type CitizenStoryStatus = 'ACTIVE' | 'OBSERVED' | 'RESOLVED';

export interface CitizenStory {
  id: string;
  key: string;
  type: CitizenStoryType;
  status: CitizenStoryStatus;
  day: number;
  subjectId: string;
  householdId: string;
  title: string;
  summary: string;
  cause: string;
  impact: string;
  choice: string;
  estimatedCost: number;
  projectedOutcome: string;
  location: { x: number; y: number };
  relatedDiagnosticId?: string;
}

export interface CitizenStoryState {
  active: CitizenStory[];
  history: CitizenStory[];
  lastEmittedByKey: Record<string, number>;
}

export const EMPTY_CITIZEN_STORY_STATE: CitizenStoryState = {
  active: [],
  history: [],
  lastEmittedByKey: {},
};

const STORY_HISTORY_LIMIT = 24;
const STORY_COOLDOWN_DAYS = 7;

function storyId(type: CitizenStoryType, subjectId: string, day: number, status: CitizenStoryStatus): string {
  return `citizen-story-${type.toLowerCase()}-${subjectId}-${day}-${status.toLowerCase()}`;
}

function tileAt(grid: TileData[][], location: { x: number; y: number }): TileData | undefined {
  return grid[location.y]?.[location.x];
}

function diagnosticId(state: CityState, title: string): string | undefined {
  return (state.causalDiagnostics ?? []).find((item) => item.title === title)?.id;
}

function candidateStories(state: CityState): CitizenStory[] {
  const serialized = state.citizenState;
  if (!serialized) return [];
  const citizens = [...(serialized.citizens ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const households = [...(serialized.households ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const trips = [...(serialized.activeTrips ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const byCitizen = new Map(citizens.map((citizen) => [citizen.id, citizen]));
  const candidates: CitizenStory[] = [];

  const flooded = households.find((household) => (tileAt(state.grid, household.residence)?.waterDepth ?? 0) >= 0.3);
  if (flooded) {
    const depth = tileAt(state.grid, flooded.residence)?.waterDepth ?? 0;
    const key = `FLOOD_AFFECTED:${flooded.id}`;
    candidates.push({
      id: storyId('FLOOD_AFFECTED', flooded.id, state.day, 'ACTIVE'), key, type: 'FLOOD_AFFECTED', status: 'ACTIVE',
      day: state.day, subjectId: flooded.citizenIds[0] ?? flooded.id, householdId: flooded.id,
      title: 'Rumah keluarga terdampak genangan',
      summary: `Genangan ${depth.toFixed(1)} m mencapai rumah keluarga ini dan mengganggu aktivitas hariannya.`,
      cause: 'Rumah berada pada koridor aliran air yang belum terlindungi.',
      impact: 'Akses kerja, kesehatan, dan kepuasan keluarga menurun selama genangan bertahan.',
      choice: 'Perbaiki akses jalan, tambah barrier/reservoir, atau prioritaskan pemulihan kawasan.',
      estimatedCost: 420,
      projectedOutcome: 'Kedalaman air dan waktu pemulihan keluarga berkurang pada tick berikutnya.',
      location: { ...flooded.residence }, relatedDiagnosticId: diagnosticId(state, 'Genangan menghambat kawasan'),
    });
  }

  const longTrip = trips.find((trip) => trip.purpose === TripPurpose.COMMUTE_WORK && trip.travelTime >= 25);
  if (longTrip) {
    const citizen = byCitizen.get(longTrip.citizenId);
    const key = `LONG_COMMUTE:${longTrip.citizenId}`;
    candidates.push({
      id: storyId('LONG_COMMUTE', longTrip.citizenId, state.day, 'ACTIVE'), key, type: 'LONG_COMMUTE', status: 'ACTIVE',
      day: state.day, subjectId: longTrip.citizenId, householdId: longTrip.householdId,
      title: 'Perjalanan kerja memakan waktu lama',
      summary: `${citizen?.id ?? 'Seorang warga'} menempuh ${Math.round(longTrip.travelTime)} menit untuk mencapai tempat kerja.`,
      cause: 'Rute rumah–kerja melewati koridor yang panjang atau padat.',
      impact: 'Waktu pribadi dan kepuasan household berkurang; beban jalan bertambah.',
      choice: 'Hubungkan rute lebih langsung, tingkatkan koridor, atau sediakan transit yang melayani kedua ujung perjalanan.',
      estimatedCost: 180,
      projectedOutcome: 'Target commute turun di bawah 20 menit dengan akses yang lebih langsung.',
      location: { ...longTrip.origin }, relatedDiagnosticId: diagnosticId(state, 'Waktu commute tinggi'),
    });
  }

  const transitTrip = trips.find((trip) => trip.mode === TransitMode.TRANSIT);
  if (transitTrip) {
    const key = `USED_TRANSIT:${transitTrip.citizenId}`;
    candidates.push({
      id: storyId('USED_TRANSIT', transitTrip.citizenId, state.day, 'OBSERVED'), key, type: 'USED_TRANSIT', status: 'OBSERVED',
      day: state.day, subjectId: transitTrip.citizenId, householdId: transitTrip.householdId,
      title: 'Warga beralih ke angkutan umum',
      summary: `Perjalanan ${transitTrip.purpose.toLowerCase().replaceAll('_', ' ')} dilakukan dengan transit dalam ${Math.round(transitTrip.travelTime)} menit.`,
      cause: 'Stop dan jadwal transit menjangkau asal serta tujuan perjalanan.',
      impact: 'Satu perjalanan mobil berkurang, tetapi kapasitas dan waktu tunggu transit ikut terbebani.',
      choice: 'Pertahankan layanan atau tambah frekuensi bila okupansi dan waktu tunggu meningkat.',
      estimatedCost: 0,
      projectedOutcome: 'Ridership bertahan tanpa memperburuk operating balance bila kapasitas mencukupi.',
      location: { ...transitTrip.origin }, relatedDiagnosticId: diagnosticId(state, 'Transit sepi penumpang'),
    });
  }

  const employed = citizens.find((citizen) => citizen.workplace);
  if (employed?.workplace) {
    const key = `FOUND_WORK:${employed.id}:${employed.workplace.id}`;
    candidates.push({
      id: storyId('FOUND_WORK', employed.id, state.day, 'OBSERVED'), key, type: 'FOUND_WORK', status: 'OBSERVED',
      day: state.day, subjectId: employed.id, householdId: employed.householdId,
      title: 'Seorang warga mendapat pekerjaan',
      summary: `${employed.id} bekerja sebagai ${employed.workplace.jobTitle} dengan perjalanan sekitar ${Math.round(employed.commuteTime)} menit.`,
      cause: 'Pendidikan warga cocok dengan lowongan yang dapat dicapai dari rumah.',
      impact: 'Pendapatan household dan penerimaan pajak meningkat, disertai perjalanan komuter baru.',
      choice: 'Jaga akses kerja atau dekatkan hunian dan pekerjaan untuk menekan biaya commute.',
      estimatedCost: 0,
      projectedOutcome: 'Household lebih stabil selama pekerjaan dan akses jalan tetap tersedia.',
      location: { ...employed.workplace.workplaceTile },
    });
  }

  const migration = state.demographics?.migration;
  const newestHousehold = households.at(-1);
  if ((migration?.immigrants ?? 0) > 0 && newestHousehold) {
    const key = `MOVED_IN:${newestHousehold.id}`;
    candidates.push({
      id: storyId('MOVED_IN', newestHousehold.id, state.day, 'OBSERVED'), key, type: 'MOVED_IN', status: 'OBSERVED',
      day: state.day, subjectId: newestHousehold.citizenIds[0] ?? newestHousehold.id, householdId: newestHousehold.id,
      title: 'Keluarga baru tiba di kota',
      summary: `${newestHousehold.citizenIds.length} warga menempati rumah baru di kawasan ini.`,
      cause: 'Hunian tersedia, utilitas aktif, dan daya tarik kota cukup untuk mendorong migrasi.',
      impact: 'Populasi, kebutuhan pekerjaan, utilitas, dan layanan bertambah.',
      choice: 'Sediakan pekerjaan dan layanan di dekat rumah sebelum tekanan commute meningkat.',
      estimatedCost: 0,
      projectedOutcome: 'Keluarga menetap bila affordability, pekerjaan, dan akses layanan tetap sehat.',
      location: { ...newestHousehold.residence },
    });
  }

  return candidates;
}

function isResolved(story: CitizenStory, state: CityState, citizens: Map<string, Citizen>, households: Map<string, Household>, trips: Trip[]): boolean {
  if (story.type === 'LONG_COMMUTE') {
    return !trips.some((trip) => trip.citizenId === story.subjectId && trip.purpose === TripPurpose.COMMUTE_WORK && trip.travelTime >= 25);
  }
  if (story.type === 'FLOOD_AFFECTED') {
    const household = households.get(story.householdId);
    return !household || (tileAt(state.grid, household.residence)?.waterDepth ?? 0) < 0.15;
  }
  return !citizens.has(story.subjectId);
}

function resolvedStory(story: CitizenStory, state: CityState): CitizenStory {
  const flood = story.type === 'FLOOD_AFFECTED';
  return {
    ...story,
    id: storyId(story.type, story.subjectId, state.day, 'RESOLVED'),
    status: 'RESOLVED',
    day: state.day,
    title: flood ? 'Keluarga kembali setelah genangan surut' : 'Perjalanan kerja kembali wajar',
    summary: flood ? 'Kedalaman air di rumah turun ke tingkat aman.' : 'Warga ini tidak lagi tercatat memiliki commute di atas 25 menit.',
    impact: flood ? 'Akses rumah dan aktivitas household pulih.' : 'Waktu pribadi pulih dan tekanan perjalanan berkurang.',
    projectedOutcome: flood ? 'Risiko berulang tetap bergantung pada perlindungan koridor air.' : 'Manfaat bertahan selama rute dan kapasitas tidak kembali memburuk.',
  };
}

/** Advances a compact, deterministic story ledger from real citizen telemetry. */
export function advanceCitizenStories(previous: CitizenStoryState | undefined, state: CityState): CitizenStoryState {
  const base: CitizenStoryState = previous
    ? { active: [...previous.active], history: [...previous.history], lastEmittedByKey: { ...previous.lastEmittedByKey } }
    : { active: [], history: [], lastEmittedByKey: {} };
  if (state.population < 25 && state.milestoneLevel < 1) return base;

  const serialized = state.citizenState;
  const citizens = new Map((serialized?.citizens ?? []).map((citizen) => [citizen.id, citizen]));
  const households = new Map((serialized?.households ?? []).map((household) => [household.id, household]));
  const trips = serialized?.activeTrips ?? [];
  const stillActive: CitizenStory[] = [];
  const outcomes: CitizenStory[] = [];
  for (const story of base.active) {
    if (isResolved(story, state, citizens, households, trips)) outcomes.push(resolvedStory(story, state));
    else stillActive.push(story);
  }

  const candidates = candidateStories(state).filter((story) => {
    if (stillActive.some((active) => active.key === story.key)) return false;
    const lastDay = base.lastEmittedByKey[story.key];
    return lastDay === undefined || state.day - lastDay >= STORY_COOLDOWN_DAYS;
  });
  const next = candidates[0];
  if (next) {
    base.lastEmittedByKey[next.key] = state.day;
    if (next.status === 'ACTIVE') stillActive.push(next);
  }
  const emitted = [...outcomes, ...(next ? [next] : [])];
  return {
    active: stillActive.slice(-8),
    history: [...base.history, ...emitted].slice(-STORY_HISTORY_LIMIT),
    lastEmittedByKey: base.lastEmittedByKey,
  };
}
