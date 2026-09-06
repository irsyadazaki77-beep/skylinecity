import { describe, expect, it } from 'vitest';
import { sampleRepresentativePedestrians, updatePedestrianAgent, getRushHourMultiplier, PedestrianAgent } from './pedestrianModel';
import { TileType, TileData, createTile } from './types';
import { Trip, TransitMode, TripPurpose } from './citizenSimulation/types';
import { gridToWorld } from './components/world/types3D';

function makeGrid(w = 10, h = 10): TileData[][] {
  const grid: TileData[][] = [];
  for (let y = 0; y < h; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < w; x++) {
      row.push(createTile(x, y, { powered: true, watered: true, elevation: 0 }));
    }
    grid.push(row);
  }
  return grid;
}

describe('representative pedestrian model', () => {
  it('modulates rush hour multipliers based on time of day', () => {
    expect(getRushHourMultiplier(8)).toBe(1.75); // Morning rush
    expect(getRushHourMultiplier(18)).toBe(1.75); // Evening rush
    expect(getRushHourMultiplier(12)).toBe(1.35); // Lunchtime
    expect(getRushHourMultiplier(3)).toBe(0.35); // Night calm
    expect(getRushHourMultiplier(15)).toBe(1.0); // Normal afternoon
  });

  it('samples representative pedestrians from real walking and transit trips', () => {
    const grid = makeGrid();
    grid[2][2].type = TileType.ROAD;
    grid[2][3].type = TileType.ROAD;

    const trips: Trip[] = [
      {
        id: 'trip-1',
        citizenId: 'cit-1',
        householdId: 'hh-1',
        origin: { x: 2, y: 2 },
        destination: { x: 3, y: 2 },
        path: [[2, 2], [3, 2]],
        mode: TransitMode.WALK,
        purpose: TripPurpose.COMMUTE_WORK,
        travelTime: 5,
      },
      {
        id: 'trip-2',
        citizenId: 'cit-2',
        householdId: 'hh-2',
        origin: { x: 2, y: 2 },
        destination: { x: 3, y: 2 },
        path: [[2, 2], [3, 2]],
        mode: TransitMode.TRANSIT,
        purpose: TripPurpose.SHOPPING,
        travelTime: 8,
      },
    ];

    const agents = sampleRepresentativePedestrians(grid, trips, null, 8, 25, 50);
    expect(agents.length).toBeGreaterThanOrEqual(2);
    const walkAgent = agents.find((a) => a.id === 'ped-trip-1');
    expect(walkAgent).toBeDefined();
    expect(walkAgent?.purpose).toBe('WORK');
    expect(walkAgent?.sideOffset).not.toBe(0); // Walks on sidewalk, not road center
  });

  it('updates pedestrian position along sidewalk and respects crosswalk signals', () => {
    const grid = makeGrid();
    grid[1][1].type = TileType.ROAD;
    grid[1][2].type = TileType.ROAD;
    grid[1][2].traffic = 20;
    grid[1][2].signalStage = 'ALL_RED';
    grid[1][2].pedestrianCrossing = false;

    const agent: PedestrianAgent = {
      id: 'ped-test',
      citizenId: 'c1',
      householdId: 'h1',
      state: 'WALKING',
      origin: { x: 1, y: 1 },
      destination: { x: 2, y: 1 },
      currentTile: { x: 1, y: 1 },
      path: [[1, 1], [2, 1]],
      pathIndex: 0,
      segmentProgress: 0.85,
      sideOffset: 0.28,
      worldPos: [0, 0, 0],
      heading: 0,
      speed: 0.05,
      color: '#ffffff',
      isTransitUser: false,
      purpose: 'WORK',
      crossingWaitTimer: 0,
    };

    // Frame update when approaching signal intersection with pedestrianCrossing=false
    updatePedestrianAgent(agent, 0.016, grid, 10, 10, gridToWorld);
    expect(agent.state).toBe('WAITING');

    // Signal changes to pedestrian crossing allowed
    grid[1][2].pedestrianCrossing = true;
    updatePedestrianAgent(agent, 0.016, grid, 10, 10, gridToWorld);
    expect(agent.state).toBe('CROSSING');
  });

  it('does not mutate authoritative city grid tiles during pedestrian sampling or frame update', () => {
    const grid = makeGrid();
    grid[0][0].type = TileType.RESIDENTIAL;
    grid[0][0].population = 10;
    const initialPop = grid[0][0].population;

    sampleRepresentativePedestrians(grid, [], null, 12, 10, 20);
    expect(grid[0][0].population).toBe(initialPop);
  });
});
