import { CityIncident, ServiceVehicleRole } from './types';

export function sampleGridPath(path: [number, number][], progress: number): [number, number] | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];
  const boundedProgress = Math.max(0, Math.min(1, progress <= 1 ? progress : 2 - progress));
  const position = boundedProgress * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(position));
  const fraction = position - index;
  const [x1, y1] = path[index];
  const [x2, y2] = path[index + 1];
  return [x1 + (x2 - x1) * fraction, y1 + (y2 - y1) * fraction];
}

export function incidentOverlayColor(type: CityIncident['type']): string {
  if (type === 'FIRE') return '#ef4444';
  if (type === 'MEDICAL') return '#34d399';
  if (type === 'CRIME') return '#60a5fa';
  return '#fbbf24';
}

export function serviceVehicleOverlayColor(role: ServiceVehicleRole): string {
  if (role === 'FIRE_ENGINE') return '#f87171';
  if (role === 'AMBULANCE') return '#6ee7b7';
  if (role === 'POLICE_CAR') return '#93c5fd';
  return '#fcd34d';
}
