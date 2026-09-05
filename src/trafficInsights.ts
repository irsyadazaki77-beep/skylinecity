import { getRoadClass, RoadClass, TileData, TileType } from './types';
import { TransitMode, Trip, TripPurpose } from './citizenSimulation/types';
import type { FreightTrip } from './logistics';
import type { TransitVehicleAgent } from './transit';
import type { ServiceVehicleAgent } from './types';

export interface RoadJunctionInsight {
  isIntersection: boolean;
  approachCount: number;
  approaches: string[];
  connectedClasses: RoadClass[];
  trafficPercent: number;
  laneUtilization: number;
  laneChangePressure: number;
  queuePressure: number;
  roadCondition: number;
  status: 'HEALTHY' | 'BUSY' | 'CRITICAL';
  recommendations: string[];
}

const DIRECTIONS: Array<[number, number, string]> = [
  [0, -1, 'Utara'],
  [1, 0, 'Timur'],
  [0, 1, 'Selatan'],
  [-1, 0, 'Barat'],
];

/**
 * Derives player-facing junction context from the same tile telemetry the
 * traffic simulation writes. This intentionally stays pure so inspector and
 * regression tests can explain a road without mutating the city.
 */
export function evaluateRoadJunction(tile: TileData, grid: TileData[][]): RoadJunctionInsight | null {
  if (tile.type !== TileType.ROAD) return null;

  const neighbors = DIRECTIONS
    .map(([dx, dy, label]) => ({ tile: grid[tile.y + dy]?.[tile.x + dx], label }))
    .filter(({ tile: candidate }) => candidate?.type === TileType.ROAD);
  const connectedClasses = Array.from(new Set(neighbors.map(({ tile: candidate }) => getRoadClass(candidate!))));
  const roadClass = getRoadClass(tile);
  const hasDifferentClassBranch = connectedClasses.some((connectedClass) => connectedClass !== roadClass);
  const isIntersection = neighbors.length >= 3 && (roadClass !== 'HIGHWAY' || hasDifferentClassBranch || (tile.intersectionControl ?? 'AUTO') !== 'AUTO');
  const trafficPercent = Math.max(0, Math.min(100, tile.traffic ?? 0));
  const laneUtilization = Math.max(0, Math.min(100, tile.laneUtilization ?? 0));
  const laneChangePressure = Math.max(0, Math.min(100, tile.laneChangePressure ?? 0));
  const queuePressure = Math.max(0, Math.min(100, tile.queuePressure ?? 0));
  const roadCondition = Math.max(0, Math.min(100, tile.roadCondition ?? 100));
  const status = queuePressure >= 70 || laneUtilization >= 90 || trafficPercent >= 85
    ? 'CRITICAL'
    : queuePressure >= 40 || laneUtilization >= 70 || trafficPercent >= 60
      ? 'BUSY'
      : 'HEALTHY';
  const recommendations: string[] = [];

  if (roadCondition < 60) recommendations.push('Jadwalkan maintenance; kondisi jalan memperbesar waktu tempuh dan menurunkan kapasitas.');
  if (isIntersection && (tile.intersectionControl ?? 'AUTO') === 'AUTO' && queuePressure >= 40) recommendations.push('Atur Signal atau Roundabout agar antrean simpang memiliki kontrol eksplisit.');
  if (isIntersection && (tile.intersectionControl ?? 'AUTO') === 'SIGNAL' && (tile.signalStage === 'ALL_RED' || tile.signalStage === 'PEDESTRIAN_CROSSING')) recommendations.push(`Fase ${tile.signalStage} sedang menahan arus; evaluasi timing atau offset bila antrean berulang.`);
  if (laneUtilization >= 80) recommendations.push(`Beban lajur ${Math.round(laneUtilization)}%; pertimbangkan upgrade kelas jalan atau rute alternatif.`);
  if (laneChangePressure >= 45) recommendations.push('Tekanan pindah lajur tinggi; rapikan hierarki jalan dan hindari terlalu banyak belokan dekat simpang.');
  if (!isIntersection && neighbors.length <= 1) recommendations.push('Ruas ini hampir terisolasi; pastikan terhubung ke jaringan sebelum menambah zoning di frontage.');
  if (recommendations.length === 0) recommendations.push('Arus jalan stabil. Pantau queue pressure saat jam sibuk dan setelah menambah zoning.');

  return {
    isIntersection,
    approachCount: neighbors.length,
    approaches: neighbors.map(({ label }) => label),
    connectedClasses,
    trafficPercent,
    laneUtilization,
    laneChangePressure,
    queuePressure,
    roadCondition,
    status,
    recommendations,
  };
}

export interface TrafficBottleneckInsight {
  x: number;
  y: number;
  roadClass: RoadClass;
  trafficPercent: number;
  queuePressure: number;
  originDesc: string;
  destinationDesc: string;
  purpose: TripPurpose;
  mode: TransitMode;
  tripCount: number;
  sampleSize: number;
  sharePercent: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  route: [number, number][];
  cohortCounts: {
    privateCars: number;
    freight: number;
    emergency: number;
    transit: number;
  };
  cause: string;
  recommendation: string;
  estimatedCost: number;
  projectedImpact: string;
}

export interface TrafficActorContext {
  trips?: Trip[];
  freightTrips?: FreightTrip[];
  serviceVehicles?: ServiceVehicleAgent[];
  transitVehicles?: TransitVehicleAgent[];
}

export interface TrafficBeforeAfter {
  day: number;
  intervention: string;
  before: { congestion: number; commute: number; queue: number; carTrips: number };
  after: { congestion: number; commute: number; queue: number; carTrips: number };
}

function placeDescription(grid: TileData[][], location: { x: number; y: number }): string {
  const tile = grid[location.y]?.[location.x];
  const label = tile?.type === TileType.RESIDENTIAL
    ? 'Hunian'
    : tile?.type === TileType.COMMERCIAL
      ? 'Komersial'
      : tile?.type === TileType.OFFICE
        ? 'Perkantoran'
        : tile?.type === TileType.INDUSTRIAL
          ? 'Industri'
          : tile?.type === TileType.SCHOOL
            ? 'Sekolah'
            : tile?.type === TileType.CLINIC
              ? 'Klinik'
              : 'Aktivitas kota';
  return `${label} (${location.x}, ${location.y})`;
}

function purposeDescription(purpose: TripPurpose): string {
  if (purpose === TripPurpose.COMMUTE_WORK) return 'perjalanan kerja';
  if (purpose === TripPurpose.COMMUTE_SCHOOL) return 'perjalanan sekolah';
  if (purpose === TripPurpose.SHOPPING) return 'perjalanan belanja';
  if (purpose === TripPurpose.HEALTHCARE) return 'perjalanan layanan kesehatan';
  return 'perjalanan rekreasi';
}

/**
 * Finds top congested bottlenecks with human-readable origin and destination attribution.
 */
export function findTrafficBottlenecks(grid: TileData[][], actors: TrafficActorContext = {}, limit = 5): TrafficBottleneckInsight[] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const bottlenecks: TrafficBottleneckInsight[] = [];

  const roadTiles: TileData[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type === TileType.ROAD && ((tile.traffic ?? 0) >= 50 || (tile.queuePressure ?? 0) >= 35)) {
        roadTiles.push(tile);
      }
    }
  }

  roadTiles.sort((a, b) => ((b.traffic ?? 0) + (b.queuePressure ?? 0)) - ((a.traffic ?? 0) + (a.queuePressure ?? 0)));

  for (const tile of roadTiles) {
    const observedTrips = (actors.trips ?? []).filter((trip) =>
      trip.mode === TransitMode.CAR && trip.path.some(([x, y]) => x === tile.x && y === tile.y),
    );
    if (observedTrips.length === 0) continue;

    const roadClass = getRoadClass(tile);
    const trafficPercent = Math.round(tile.traffic ?? 0);
    const queuePressure = Math.round(tile.queuePressure ?? 0);

    const groups = new Map<string, { trips: Trip[]; firstIndex: number }>();
    observedTrips.forEach((trip, index) => {
      const key = `${trip.origin.x},${trip.origin.y}>${trip.destination.x},${trip.destination.y}:${trip.purpose}:${trip.mode}`;
      const group = groups.get(key);
      if (group) group.trips.push(trip);
      else groups.set(key, { trips: [trip], firstIndex: index });
    });
    const dominant = [...groups.values()].sort((a, b) => b.trips.length - a.trips.length || a.firstIndex - b.firstIndex)[0];
    const representative = dominant.trips[0];
    const tripCount = dominant.trips.length;
    const sampleSize = observedTrips.length;
    const sharePercent = Math.round((tripCount / sampleSize) * 100);
    const confidence = sampleSize >= 10 ? 'HIGH' : sampleSize >= 4 ? 'MEDIUM' : 'LOW';
    const originDesc = placeDescription(grid, representative.origin);
    const destinationDesc = placeDescription(grid, representative.destination);
    const crossesTile = (path: [number, number][]) => path.some(([x, y]) => x === tile.x && y === tile.y);
    const cohortCounts = {
      privateCars: observedTrips.length,
      freight: (actors.freightTrips ?? []).filter((trip) => crossesTile(trip.path)).length,
      emergency: (actors.serviceVehicles ?? []).filter((vehicle) => crossesTile(vehicle.path)).length,
      transit: (actors.transitVehicles ?? []).filter((vehicle) => crossesTile(vehicle.path)).length,
    };
    const observedCause = `${sharePercent}% dari ${sampleSize} perjalanan mobil yang teramati di ruas ini adalah ${purposeDescription(representative.purpose)} dari ${originDesc} menuju ${destinationDesc}.`;

    const cause = roadClass === 'LOCAL'
      ? `${observedCause} Arus tersebut melewati jalan lokal dengan kapasitas sempit.`
      : queuePressure >= 50
        ? `${observedCause} Antrean simpang dan manuver belok tinggi memperlambat aliran di titik (${tile.x}, ${tile.y}).`
        : `${observedCause} Volume perjalanan teramati menekan kapasitas koridor ${roadClass}.`;

    const recommendation = roadClass === 'LOCAL'
      ? `Upgrade ruas jalan (${tile.x}, ${tile.y}) ke Arterial 4-jalur atau sediakan rute Bus/Tram langsung.`
      : queuePressure >= 50
        ? `Atur lampu sinyal (Signal Timing) atau bangun bundaran (Roundabout) untuk memperlancar arus simpang.`
        : `Bangun jalan arteri alternatif atau perpanjang koridor angkutan umum.`;

    const estimatedCost = roadClass === 'LOCAL' ? 120 : 250;
    const projectedImpact = 'Berpotensi mengurangi waktu tempuh kelompok perjalanan dominan; hasil aktual diukur setelah intervensi.';

    bottlenecks.push({
      x: tile.x,
      y: tile.y,
      roadClass,
      trafficPercent,
      queuePressure,
      originDesc,
      destinationDesc,
      purpose: representative.purpose,
      mode: representative.mode,
      tripCount,
      sampleSize,
      sharePercent,
      confidence,
      route: representative.path,
      cohortCounts,
      cause,
      recommendation,
      estimatedCost,
      projectedImpact,
    });
    if (bottlenecks.length >= limit) break;
  }

  return bottlenecks;
}
