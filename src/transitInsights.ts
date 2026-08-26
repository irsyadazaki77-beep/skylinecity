import { TileData, TileType, TransitLine } from './types';
import { TransitVehicleAgent } from './transit';

export type TransitLineStatus = 'READY' | 'CROWDED' | 'LIMITED' | 'OFFLINE';

export interface TransitLineInsight {
  lineId: string;
  status: TransitLineStatus;
  validStops: number;
  stopCount: number;
  catchmentPopulation: number;
  transferStops: number;
  vehicles: number;
  capacity: number;
  occupancyPercent: number;
  averageWaitMinutes: number;
  fareRevenue: number;
  operatingCost: number;
  balance: number;
  recommendations: string[];
}

export interface TransitInsightContext {
  grid: TileData[][];
  lines: TransitLine[];
  vehicles: TransitVehicleAgent[];
  totalPopulation: number;
  transitRidership: number;
  transitCapacity: number;
  timeOfDay: number;
}

function isValidStop(tile: TileData | undefined, mode: TransitLine['mode']): boolean {
  if (!tile?.powered) return false;
  return mode === 'BUS'
    ? tile.type === TileType.BUS_DEPOT || tile.type === TileType.BUS_STOP
    : tile.type === TileType.TRAM_STATION || tile.type === TileType.TRAM_STOP;
}

function stopKey(stop: [number, number]): string {
  return `${stop[0]},${stop[1]}`;
}

function lineFrequency(line: TransitLine, timeOfDay: number): number {
  const peakStart = line.peakStartHour ?? 7;
  const peakEnd = line.peakEndHour ?? 9;
  return timeOfDay >= peakStart && timeOfDay < peakEnd
    ? Math.max(1, line.peakFrequency ?? Math.round(line.frequency * 0.65))
    : Math.max(1, line.frequency);
}

function stopCatchmentPopulation(line: TransitLine, validStops: [number, number][], grid: TileData[][]): number {
  const range = line.mode === 'TRAM' ? 28 : 18;
  let population = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (tile.type !== TileType.RESIDENTIAL || tile.population <= 0) continue;
      const covered = validStops.some(([x, y]) => Math.abs(tile.x - x) + Math.abs(tile.y - y) <= range);
      if (covered) population += tile.population;
    }
  }
  return population;
}

/**
 * Builds actionable per-line transit feedback from existing stop, vehicle,
 * and city aggregates. This is intentionally read-only: line simulation
 * remains authoritative in transit.ts.
 */
export function calculateTransitLineInsights(context: TransitInsightContext): TransitLineInsight[] {
  const activeLines = context.lines.filter((line) => line.active);
  const lineCountsAtStop = new Map<string, number>();
  for (const line of activeLines) {
    for (const stop of line.stops) lineCountsAtStop.set(stopKey(stop), (lineCountsAtStop.get(stopKey(stop)) ?? 0) + 1);
  }

  return context.lines.map((line) => {
    const validStopCoordinates = line.stops.filter(([x, y]) => isValidStop(context.grid[y]?.[x], line.mode));
    const validStops = validStopCoordinates.length;
    const vehicles = context.vehicles.filter((vehicle) => vehicle.lineId === line.id);
    const capacity = vehicles.reduce((sum, vehicle) => sum + vehicle.capacity, 0);
    const occupancy = vehicles.reduce((sum, vehicle) => sum + vehicle.occupancy, 0);
    const occupancyPercent = capacity > 0 ? Math.min(100, occupancy / capacity * 100) : 0;
    const averageWaitMinutes = line.active ? lineFrequency(line, context.timeOfDay) / 2 : 0;
    const transferStops = line.active ? line.stops.filter((stop) => (lineCountsAtStop.get(stopKey(stop)) ?? 0) > 1).length : 0;
    const catchmentPopulation = stopCatchmentPopulation(line, validStopCoordinates, context.grid);
    const lineCapacityShare = context.transitCapacity > 0 ? Math.min(1, capacity / context.transitCapacity) : 0;
    const fare = line.mode === 'TRAM' ? 2.2 : 1.5;
    const fareRevenue = Math.round(context.transitRidership * lineCapacityShare * fare);
    const operatingCost = Math.round(vehicles.length * (line.mode === 'TRAM' ? 8 : 4));
    const balance = fareRevenue - operatingCost;
    const recommendations: string[] = [];

    if (!line.active) recommendations.push('Line nonaktif; aktifkan untuk memasukkan kendaraan dan demand ke simulasi.');
    if (validStops < line.stops.length) recommendations.push(`${line.stops.length - validStops} stop tidak valid: cek listrik, tipe fasilitas, dan koneksi jalan.`);
    if (validStops >= 2 && catchmentPopulation === 0) recommendations.push('Catchment tidak menjangkau warga; geser stop mendekati kawasan hunian aktif.');
    if (occupancyPercent >= 85) recommendations.push(`Kepadatan kendaraan ${Math.round(occupancyPercent)}%; tambah kendaraan atau rapatkan headway.`);
    if (averageWaitMinutes > 10) recommendations.push(`Waktu tunggu ${averageWaitMinutes.toFixed(1)} menit; turunkan frekuensi headway terutama saat peak.`);
    if (line.active && activeLines.length > 1 && transferStops === 0) recommendations.push('Belum ada transfer stop; bagikan satu stop dengan line lain untuk membentuk jaringan.');
    if (line.active && balance < 0) recommendations.push(`Line defisit $${Math.abs(balance)}/hari; tingkatkan ridership atau kurangi armada.`);
    if (recommendations.length === 0) recommendations.push('Line sehat: catchment, headway, dan kapasitas berjalan seimbang.');

    const status: TransitLineStatus = !line.active
      ? 'OFFLINE'
      : validStops < line.stops.length
        ? 'LIMITED'
        : occupancyPercent >= 85
          ? 'CROWDED'
          : 'READY';

    return {
      lineId: line.id,
      status,
      validStops,
      stopCount: line.stops.length,
      catchmentPopulation,
      transferStops,
      vehicles: vehicles.length,
      capacity,
      occupancyPercent,
      averageWaitMinutes,
      fareRevenue,
      operatingCost,
      balance,
      recommendations,
    };
  });
}
