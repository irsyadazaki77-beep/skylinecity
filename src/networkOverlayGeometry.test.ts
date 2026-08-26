import { describe, expect, it } from 'vitest';
import { incidentOverlayColor, sampleGridPath, serviceVehicleOverlayColor } from './networkOverlayGeometry';

describe('network overlay geometry', () => {
  it('samples outbound and return progress deterministically', () => {
    const path: [number, number][] = [[0, 0], [2, 0], [2, 2]];
    expect(sampleGridPath(path, 0)).toEqual([0, 0]);
    expect(sampleGridPath(path, 0.5)).toEqual([2, 0]);
    expect(sampleGridPath(path, 1)).toEqual([2, 2]);
    expect(sampleGridPath(path, 1.5)).toEqual([2, 0]);
    expect(sampleGridPath(path, 2)).toEqual([0, 0]);
  });

  it('maps incident and fleet roles to stable overlay colors', () => {
    expect(incidentOverlayColor('FIRE')).toBe('#ef4444');
    expect(incidentOverlayColor('MEDICAL')).toBe('#34d399');
    expect(serviceVehicleOverlayColor('POLICE_CAR')).toBe('#93c5fd');
    expect(serviceVehicleOverlayColor('TRAFFIC_UNIT')).toBe('#fcd34d');
  });
});
