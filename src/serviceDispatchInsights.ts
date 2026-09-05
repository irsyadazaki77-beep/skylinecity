import { CityIncident, ServiceVehicleAgent, TileData, TileType } from './types';

export type DispatchAgency = 'FIRE' | 'MEDICAL' | 'POLICE' | 'TRAFFIC';
export type DispatchBand = 'CLEAR' | 'FAST' | 'NORMAL' | 'SLOW' | 'CRITICAL';

export interface ServiceDispatchInsight {
  agency: DispatchAgency;
  label: string;
  activeIncidents: number;
  criticalIncidents: number;
  requiredUnits: number;
  dispatchedUnits: number;
  queuedUnits: number;
  dispatchCompletionPercent: number;
  fleetUnits: number;
  activeUnits: number;
  onSceneUnits: number;
  availableUnits: number;
  bayQueue: number;
  averageRouteTiles: number;
  averageEtaMinutes: number;
  band: DispatchBand;
  recommendations: string[];
}

export interface ServiceDispatchInsightContext {
  grid: TileData[][];
  incidents: CityIncident[];
  vehicles: ServiceVehicleAgent[];
  serviceBayQueues: Record<string, number>;
  serviceCapacity: {
    fire: number;
    police: number;
    healthcare: number;
  };
  responseQuality: number;
}

const AGENCIES: Array<{ agency: DispatchAgency; label: string }> = [
  { agency: 'FIRE', label: 'Pemadam & Penyelamatan' },
  { agency: 'MEDICAL', label: 'Respons Medis' },
  { agency: 'POLICE', label: 'Respons Polisi' },
  { agency: 'TRAFFIC', label: 'Pengendalian Lalu Lintas' },
];

function roleMatchesAgency(role: ServiceVehicleAgent['role'], agency: DispatchAgency): boolean {
  if (agency === 'FIRE') return role === 'FIRE_ENGINE';
  if (agency === 'MEDICAL') return role === 'AMBULANCE';
  if (agency === 'POLICE') return role === 'POLICE_CAR';
  return role === 'TRAFFIC_UNIT';
}

function incidentMatchesAgency(type: CityIncident['type'], agency: DispatchAgency): boolean {
  if (agency === 'FIRE') return type === 'FIRE';
  if (agency === 'MEDICAL') return type === 'MEDICAL';
  if (agency === 'POLICE') return type === 'CRIME';
  return type === 'TRAFFIC';
}

function facilityUnits(tile: TileData): number {
  if (tile.type === TileType.FIRE_STATION) return 4;
  if (tile.type === TileType.POLICE_STATION) return 4;
  if (tile.type === TileType.CLINIC) return 2;
  return 0;
}

function facilityAgency(tile: TileData): DispatchAgency | null {
  if (tile.type === TileType.FIRE_STATION) return 'FIRE';
  if (tile.type === TileType.POLICE_STATION) return 'POLICE';
  if (tile.type === TileType.CLINIC) return 'MEDICAL';
  return null;
}

function capacityUnitsForAgency(agency: DispatchAgency, capacity: ServiceDispatchInsightContext['serviceCapacity']): number {
  if (agency === 'FIRE') return Math.max(0, Math.floor(capacity.fire / 75));
  if (agency === 'POLICE') return Math.max(0, Math.floor(capacity.police / 75));
  if (agency === 'MEDICAL') return Math.max(0, Math.floor(capacity.healthcare / 75));
  return Math.max(0, Math.floor((capacity.fire + capacity.police) / 75));
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function bandForEta(activeIncidents: number, queuedUnits: number, etaMinutes: number): DispatchBand {
  if (activeIncidents === 0) return 'CLEAR';
  if (queuedUnits > 0 || etaMinutes > 20) return 'CRITICAL';
  if (etaMinutes <= 5) return 'FAST';
  if (etaMinutes <= 10) return 'NORMAL';
  return 'SLOW';
}

/**
 * Derives explainable dispatch telemetry from the incident and persistent
 * service-fleet state. It is intentionally read-only and does not become part
 * of CityState, so UI diagnostics cannot alter simulation or save determinism.
 */
export function calculateServiceDispatchInsights(
  context: ServiceDispatchInsightContext,
): ServiceDispatchInsight[] {
  const qualityFactor = Math.max(0.45, Math.min(1.2, context.responseQuality / 100));

  return AGENCIES.map(({ agency, label }) => {
    const incidents = context.incidents.filter((incident) => incidentMatchesAgency(incident.type, agency));
    const vehicles = context.vehicles.filter((vehicle) => roleMatchesAgency(vehicle.role, agency));
    const requiredUnits = incidents.reduce((sum, incident) => sum + (incident.requiredUnits ?? (incident.type === 'TRAFFIC' ? 1 : incident.severity)), 0);
    const dispatchedUnits = incidents.reduce((sum, incident) => sum + (incident.dispatchedUnits ?? 0), 0);
    const queuedUnits = incidents.reduce((sum, incident) => sum + Math.max(0, (incident.requiredUnits ?? (incident.type === 'TRAFFIC' ? 1 : incident.severity)) - (incident.dispatchedUnits ?? 0)), 0);
    const criticalIncidents = incidents.filter((incident) => incident.severity >= 3).length;
    const routeLengths = incidents
      .map((incident) => incident.dispatchPath?.length ?? 0)
      .filter((length) => length > 0);
    const averageRouteTiles = routeLengths.length > 0
      ? round(routeLengths.reduce((sum, length) => sum + length, 0) / routeLengths.length)
      : 0;

    const etaSamples = incidents.map((incident) => {
      const pathLength = incident.dispatchPath?.length ?? 0;
      const incidentVehicles = vehicles.filter((vehicle) => vehicle.incidentId === incident.id);
      const activeProgress = incidentVehicles.length > 0
        ? Math.max(...incidentVehicles.map((vehicle) => vehicle.routeProgress))
        : 0;
      const remainingRoute = incidentVehicles.some((vehicle) => vehicle.status === 'ON_SCENE')
        ? 0
        : pathLength * Math.max(0, 1 - Math.min(1, activeProgress));
      const queueDelay = queuedUnits > 0 ? 3 + queuedUnits * 2 : 0;
      return remainingRoute * 1.2 / qualityFactor + queueDelay;
    }).filter((eta) => Number.isFinite(eta));
    const averageEtaMinutes = incidents.length > 0
      ? round(etaSamples.length > 0 ? etaSamples.reduce((sum, eta) => sum + eta, 0) / etaSamples.length : 20 + queuedUnits * 2)
      : 0;

    let fleetUnits = 0;
    let bayQueue = 0;
    for (const row of context.grid) {
      for (const tile of row) {
        if (facilityAgency(tile) === agency) fleetUnits += facilityUnits(tile);
        const tileAgency = facilityAgency(tile);
        if (tileAgency === agency) bayQueue += context.serviceBayQueues[`${tile.x},${tile.y}`] ?? 0;
      }
    }
    const capacityUnits = capacityUnitsForAgency(agency, context.serviceCapacity);
    const activeUnits = vehicles.filter((vehicle) => vehicle.status !== 'RETURNING').length;
    const onSceneUnits = vehicles.filter((vehicle) => vehicle.status === 'ON_SCENE').length;
    const effectiveFleetUnits = Math.max(fleetUnits, capacityUnits);
    const availableUnits = Math.max(0, effectiveFleetUnits - activeUnits);
    const dispatchCompletionPercent = requiredUnits > 0
      ? round(Math.min(100, dispatchedUnits / requiredUnits * 100))
      : 100;
    const band = bandForEta(incidents.length, queuedUnits + bayQueue, averageEtaMinutes);
    const recommendations: string[] = [];

    if (incidents.length === 0) recommendations.push('Tidak ada panggilan aktif; kapasitas siap untuk kejadian berikutnya.');
    if (queuedUnits > 0) recommendations.push(`${queuedUnits} unit masih antre; tambah kapasitas atau perbaiki fasilitas ${label.toLowerCase()}.`);
    if (bayQueue > 0) recommendations.push(`Antrean teluk ${bayQueue}; kurangi konflik depo dengan menambah pos layanan atau armada.`);
    if (availableUnits <= 0 && incidents.length > 0) recommendations.push('Tidak ada unit siap; jadwalkan perawatan atau bangun depo tambahan.');
    if (averageEtaMinutes > 10) recommendations.push(`ETA rata-rata ${averageEtaMinutes.toFixed(1)} menit; periksa koneksi jalan dan kemacetan koridor.`);
    if (recommendations.length === 0) recommendations.push('Respons stabil: kapasitas, armada, dan koneksi jalan mencukupi.');

    return {
      agency,
      label,
      activeIncidents: incidents.length,
      criticalIncidents,
      requiredUnits,
      dispatchedUnits,
      queuedUnits,
      dispatchCompletionPercent,
      fleetUnits: effectiveFleetUnits,
      activeUnits,
      onSceneUnits,
      availableUnits,
      bayQueue,
      averageRouteTiles,
      averageEtaMinutes,
      band,
      recommendations,
    };
  });
}
