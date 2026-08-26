import { describe, expect, it } from 'vitest';
import { TransitLine } from './types';
import { deriveTransitRouteGeometry, calculateTransitMapBounds, projectTransitMapPoint } from './transitRouteMap';

const line: TransitLine = {
  id: 'bus-1',
  name: 'Bus 1',
  mode: 'BUS',
  stops: [[1, 2], [5, 2]],
  frequency: 12,
  active: true,
};

describe('transit route map geometry', () => {
  it('uses the simulated road path when a vehicle agent is available', () => {
    const routes = deriveTransitRouteGeometry([line], [{
      id: 'vehicle-bus-1-1',
      lineId: line.id,
      mode: 'BUS',
      path: [[1, 2], [2, 2], [2, 3], [5, 2]],
      headway: 12,
      capacity: 80,
      occupancy: 20,
      dwellTime: 1.5,
    }]);
    expect(routes[0].usesVehiclePath).toBe(true);
    expect(routes[0].path).toHaveLength(4);
  });

  it('falls back to configured stops and projects degenerate bounds safely', () => {
    const routes = deriveTransitRouteGeometry([line], []);
    const bounds = calculateTransitMapBounds(routes);
    expect(routes[0].usesVehiclePath).toBe(false);
    expect(projectTransitMapPoint([1, 2], bounds)).toEqual([12, 12]);
    expect(projectTransitMapPoint([5, 2], bounds)[1]).toBe(12);
  });

  it('marks an enabled line as out of hours without hiding its planned topology', () => {
    const routes = deriveTransitRouteGeometry([{ ...line, serviceStartHour: 7, serviceEndHour: 22 }], [], 23);
    expect(routes[0].operating).toBe(false);
    expect(routes[0].path).toEqual(line.stops);
  });
});
