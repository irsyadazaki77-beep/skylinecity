import { getRoadClass, RoadClass, TileData, TileType } from './types';

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
