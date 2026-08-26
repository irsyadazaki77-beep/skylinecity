import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState } from './engine';
import { findRoadPath } from './citizenSimulation/trips';
import { deleteSave, loadGame, saveGame } from './saveSystem';
import { buildRoadGraph, getTurnPenalty } from './traffic';
import { createTile, TileType } from './types';

function crossGrid() {
  const grid = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => createTile(x, y)));
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      if (x === 1 || y === 1) grid[y][x] = createTile(x, y, { type: TileType.ROAD, roadClass: 'LOCAL' });
    }
  }
  return grid;
}

describe('persistent intersection controls', () => {
  it('makes roundabouts cheaper than default signal/stop friction and blocks prohibited turns', () => {
    const autoGrid = crossGrid();
    const roundaboutGrid = crossGrid();
    roundaboutGrid[1][1].intersectionControl = 'ROUNDABOUT';
    const roundaboutGraph = buildRoadGraph(roundaboutGrid);
    const autoPenalty = getTurnPenalty(buildRoadGraph(autoGrid), '1,0', '1,1', '2,1');
    const roundaboutPenalty = getTurnPenalty(roundaboutGraph, '1,0', '1,1', '2,1');

    expect(roundaboutGraph.nodes.get('1,1')?.isIntersection).toBe(true);
    expect(roundaboutGraph.nodes.get('1,1')?.signalized).toBe(false);
    expect(roundaboutPenalty).toBeLessThan(autoPenalty);

    roundaboutGrid[1][1].prohibitedTurns = ['LEFT', 'RIGHT', 'U_TURN'];
    const restrictedGraph = buildRoadGraph(roundaboutGrid);
    expect(getTurnPenalty(restrictedGraph, '1,0', '1,1', '2,1')).toBe(Infinity);
    expect(findRoadPath('1,0', '2,1', restrictedGraph)).toEqual([]);
  });

  it('persists controls and restrictions through the compact save format', () => {
    const grid = createEmptyGrid(3, 3);
    grid[1][1] = createTile(1, 1, {
      type: TileType.ROAD,
      intersectionControl: 'SIGNAL',
      signalTimingMode: 'FIXED_EW',
      signalOffsetHours: 3,
      prohibitedTurns: ['LEFT', 'U_TURN'],
      parcelId: 'parcel-residential-test',
      parcelSeed: 12345,
      parcelWidth: 2,
      parcelHeight: 1,
      parcelIndex: 0,
      parcelOwnership: 'PRIVATE',
      parcelStatus: 'ACTIVE',
    });
    const state = createInitialCityState(grid, 2088, 'normal');
    const slot = `road-controls-${Date.now()}`;

    expect(saveGame(slot, state, 'Road Controls Test')).toBe(true);
    const loaded = loadGame(slot);
    deleteSave(slot);

    expect(loaded?.gameState.grid[1][1].intersectionControl).toBe('SIGNAL');
    expect(loaded?.gameState.grid[1][1].signalTimingMode).toBe('FIXED_EW');
    expect(loaded?.gameState.grid[1][1].signalOffsetHours).toBe(3);
    expect(loaded?.gameState.grid[1][1].prohibitedTurns).toEqual(['LEFT', 'U_TURN']);
    expect(loaded?.gameState.grid[1][1].parcelId).toBe('parcel-residential-test');
    expect(loaded?.gameState.grid[1][1].parcelSeed).toBe(12345);
    expect(loaded?.gameState.grid[1][1].parcelWidth).toBe(2);
    expect(loaded?.gameState.grid[1][1].parcelHeight).toBe(1);
    expect(loaded?.gameState.grid[1][1].parcelOwnership).toBe('PRIVATE');
    expect(loaded?.gameState.grid[1][1].parcelStatus).toBe('ACTIVE');
  });
});
