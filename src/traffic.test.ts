import { describe, expect, it } from 'vitest';
import { buildRoadGraph, getTurnMovement, getTurnPenalty, simulateRoadNetworkAndTraffic } from './traffic';
import { applyTripTrafficToRoads } from './citizenSimulation/trips';
import { createTile, TileType } from './types';
import { TransitMode, TripPurpose } from './citizenSimulation/types';

function roadGrid(roadClass: 'LOCAL' | 'ARTERIAL' | 'HIGHWAY') {
  return [[
    createTile(0, 0, { type: TileType.ROAD, roadClass }),
    createTile(1, 0, { type: TileType.ROAD, roadClass }),
  ]];
}

describe('road hierarchy and traffic capacity', () => {
  it('exposes distinct capacity and speed profiles for local, arterial, and highway roads', () => {
    const local = buildRoadGraph(roadGrid('LOCAL')).nodes.get('0,0')!;
    const arterial = buildRoadGraph(roadGrid('ARTERIAL')).nodes.get('0,0')!;
    const highway = buildRoadGraph(roadGrid('HIGHWAY')).nodes.get('0,0')!;

    expect(local.capacity).toBeLessThan(arterial.capacity);
    expect(arterial.capacity).toBeLessThan(highway.capacity);
    expect(local.speedMultiplier).toBeGreaterThan(arterial.speedMultiplier);
    expect(arterial.speedMultiplier).toBeGreaterThan(highway.speedMultiplier);
    expect(local.lanes).toBe(1);
    expect(arterial.lanes).toBe(2);
    expect(highway.lanes).toBe(3);
  });

  it('models signalized intersections and smart-light delay reduction', () => {
    const grid = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => createTile(x, y)),
    );
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        if (x === 1 || y === 1) grid[y][x] = createTile(x, y, { type: TileType.ROAD, roadClass: 'LOCAL' });
      }
    }
    const localIntersection = buildRoadGraph(grid).nodes.get('1,1')!;
    expect(localIntersection.isIntersection).toBe(true);
    expect(localIntersection.signalized).toBe(false);
    expect(localIntersection.intersectionDelay).toBeGreaterThan(1);

    grid[1][0] = createTile(0, 1, { type: TileType.ROAD, roadClass: 'ARTERIAL' });
    const arterialIntersection = buildRoadGraph(grid).nodes.get('1,1')!;
    const smartIntersection = buildRoadGraph(grid, ['smart_lights']).nodes.get('1,1')!;
    expect(arterialIntersection.signalized).toBe(true);
    expect(arterialIntersection.intersectionDelay).toBeLessThan(localIntersection.intersectionDelay);
    expect(smartIntersection.intersectionDelay).toBeLessThan(arterialIntersection.intersectionDelay);
  });

  it('does not treat every tile of a dual highway as a signalized junction', () => {
    const grid = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => createTile(x, y)),
    );
    for (let x = 0; x < 5; x += 1) {
      grid[1][x] = createTile(x, 1, { type: TileType.ROAD, roadClass: 'HIGHWAY' });
      grid[2][x] = createTile(x, 2, { type: TileType.ROAD, roadClass: 'HIGHWAY' });
    }
    grid[0][2] = createTile(2, 0, { type: TileType.ROAD, roadClass: 'LOCAL' });

    const graph = buildRoadGraph(grid);

    expect(graph.nodes.get('1,1')?.isIntersection).toBe(false);
    expect(graph.nodes.get('2,1')?.isIntersection).toBe(true);
  });

  it('classifies turning movements and applies explicit signal-phase friction', () => {
    const grid = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => createTile(x, y)),
    );
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        if (x === 1 || y === 1) grid[y][x] = createTile(x, y, { type: TileType.ROAD, roadClass: 'LOCAL' });
      }
    }
    grid[1][0] = createTile(0, 1, { type: TileType.ROAD, roadClass: 'ARTERIAL' });
    const graph = buildRoadGraph(grid);

    expect(getTurnMovement(graph, '1,0', '1,1', '2,1')).toBe('RIGHT');
    expect(getTurnMovement(graph, '1,0', '1,1', '1,2')).toBe('STRAIGHT');

    const northSouth = getTurnPenalty(graph, '1,2', '1,1', '1,0');
    const eastWest = getTurnPenalty(graph, '0,1', '1,1', '2,1');
    expect(graph.nodes.get('1,1')?.signalPhase).toBe('NORTH_SOUTH');
    expect(eastWest).toBeGreaterThan(northSouth);
  });

  it('rotates signal phases with city time and lets adaptive mode favor the pressured approach', () => {
    const grid = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => createTile(x, y)),
    );
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        if (x === 1 || y === 1) grid[y][x] = createTile(x, y, { type: TileType.ROAD, roadClass: 'LOCAL' });
      }
    }
    grid[1][0] = createTile(0, 1, { type: TileType.ROAD, roadClass: 'ARTERIAL' });

    const noon = buildRoadGraph(grid, [], 12).nodes.get('1,1')!;
    const evening = buildRoadGraph(grid, [], 18).nodes.get('1,1')!;
    expect(noon.signalPhase).toBe('NORTH_SOUTH');
    expect(evening.signalPhase).toBe('EAST_WEST');

    grid[1][0].traffic = 90;
    grid[1][2].traffic = 90;
    const pressureGraph = buildRoadGraph(grid, [], 12);
    expect(pressureGraph.nodes.get('1,1')?.signalPhase).toBe('EAST_WEST');

    grid[1][1].signalTimingMode = 'FIXED_NS';
    expect(buildRoadGraph(grid, [], 18).nodes.get('1,1')?.signalPhase).toBe('NORTH_SOUTH');
  });

  it('exposes yellow, all-red, and pedestrian crossing stages between green phases', () => {
    const grid = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => createTile(x, y)),
    );
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        if (x === 1 || y === 1) grid[y][x] = createTile(x, y, { type: TileType.ROAD, roadClass: 'LOCAL' });
      }
    }
    grid[1][0] = createTile(0, 1, { type: TileType.ROAD, roadClass: 'ARTERIAL' });

    const green = buildRoadGraph(grid, [], 12).nodes.get('1,1')!;
    const yellow = buildRoadGraph(grid, [], 10.25).nodes.get('1,1')!;
    const allRed = buildRoadGraph(grid, [], 11.5).nodes.get('1,1')!;

    expect(green.signalStage).toBe('GREEN');
    expect(yellow.signalStage).toBe('YELLOW');
    expect(allRed.signalStage).toBe('ALL_RED');
    expect(allRed.pedestrianCrossing).toBe(true);
  });

  it('reduces congestion on a higher-class road under the same car load', () => {
    const trips = Array.from({ length: 30 }, (_, index) => ({
      id: `trip-${index}`,
      citizenId: `citizen-${index}`,
      householdId: `household-${index}`,
      origin: { x: 0, y: 0 },
      destination: { x: 1, y: 0 },
      purpose: TripPurpose.COMMUTE_WORK,
      path: [[0, 0], [1, 0]] as [number, number][],
      travelTime: 10,
      mode: TransitMode.CAR,
    }));

    const localGrid = roadGrid('LOCAL');
    const highwayGrid = roadGrid('HIGHWAY');
    const localTraffic = simulateRoadNetworkAndTraffic(localGrid, buildRoadGraph(localGrid), [], trips, 1);
    const highwayTraffic = simulateRoadNetworkAndTraffic(highwayGrid, buildRoadGraph(highwayGrid), [], trips, 1);

    expect(highwayTraffic.trafficAverage).toBeLessThan(localTraffic.trafficAverage);
  });

  it('assigns turning vehicles to approach lanes and exposes lane spillback pressure', () => {
    const createCross = () => Array.from({ length: 5 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => x === 2 || y === 2
        ? createTile(x, y, { type: TileType.ROAD, roadClass: 'ARTERIAL' })
        : createTile(x, y)),
    );
    const rightTurnPath = [[2, 0], [2, 1], [2, 2], [3, 2], [4, 2]] as [number, number][];
    const straightPath = [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]] as [number, number][];
    const trip = (index: number, path: [number, number][]) => ({
      id: `lane-trip-${index}`,
      citizenId: `citizen-${index}`,
      householdId: `household-${index}`,
      origin: { x: path[0][0], y: path[0][1] },
      destination: { x: path[path.length - 1][0], y: path[path.length - 1][1] },
      purpose: TripPurpose.COMMUTE_WORK,
      path,
      travelTime: 10,
      mode: TransitMode.CAR,
    });

    const turnGrid = createCross();
    const turnGraph = buildRoadGraph(turnGrid);
    applyTripTrafficToRoads(turnGrid, turnGraph, Array.from({ length: 20 }, (_, index) => trip(index, rightTurnPath)));
    expect(turnGrid[0][2].laneChangePressure).toBeGreaterThan(0);
    expect(turnGrid[2][2].queuePressure).toBeGreaterThan(0);

    const balancedGrid = createCross();
    const balancedGraph = buildRoadGraph(balancedGrid);
    applyTripTrafficToRoads(balancedGrid, balancedGraph, [
      ...Array.from({ length: 10 }, (_, index) => trip(index, rightTurnPath)),
      ...Array.from({ length: 10 }, (_, index) => trip(index + 10, straightPath)),
    ]);
    expect(turnGrid[2][2].laneUtilization).toBeGreaterThan(balancedGrid[2][2].laneUtilization ?? 0);
    expect(turnGrid[2][2].traffic).toBeGreaterThan(balancedGrid[2][2].traffic);
  });

  it('retains a queue backlog briefly and drains it when demand disappears', () => {
    const grid = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => x === 1 || y === 1
        ? createTile(x, y, { type: TileType.ROAD, roadClass: 'LOCAL' })
        : createTile(x, y)),
    );
    const path = [[0, 1], [1, 1], [2, 1]] as [number, number][];
    const trip = (index: number) => ({
      id: `queue-trip-${index}`,
      citizenId: `citizen-${index}`,
      householdId: `household-${index}`,
      origin: { x: 0, y: 1 },
      destination: { x: 2, y: 1 },
      purpose: TripPurpose.COMMUTE_WORK,
      path,
      travelTime: 10,
      mode: TransitMode.CAR,
    });
    const graph = buildRoadGraph(grid);
    applyTripTrafficToRoads(grid, graph, Array.from({ length: 40 }, (_, index) => trip(index)));
    const peakQueue = grid[1][1].queuePressure ?? 0;

    applyTripTrafficToRoads(grid, graph, []);
    const drainedQueue = grid[1][1].queuePressure ?? 0;

    expect(peakQueue).toBeGreaterThan(0);
    expect(drainedQueue).toBeGreaterThan(0);
    expect(drainedQueue).toBeLessThan(peakQueue);
  });
});
