import { describe, expect, it } from 'vitest';
import { buildRoadGraph } from './traffic';
import { createTile, TileType } from './types';
import { findRoadPath } from './citizenSimulation/trips';

describe('bridge road topology', () => {
  it('keeps a bridge over water in the road graph and routing', () => {
    const grid = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => createTile(x, y)),
    );
    for (let x = 0; x < 5; x += 1) {
      grid[1][x] = createTile(x, 1, {
        type: TileType.ROAD,
        roadClass: 'HIGHWAY',
        roadStructure: x === 2 ? 'BRIDGE' : 'GROUND',
        water: x === 2,
      });
    }
    const graph = buildRoadGraph(grid);
    expect(graph.nodes.get('2,1')?.roadClass).toBe('HIGHWAY');
    expect(graph.nodes.get('2,1')?.neighbors).toContain('1,1');
    expect(findRoadPath('0,1', '4,1', graph)).toEqual([[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]);
  });

  it('preserves tunnel structure in the road graph for steep terrain', () => {
    const grid = Array.from({ length: 1 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => createTile(x, y, { type: TileType.ROAD, roadClass: 'HIGHWAY', elevation: 8, roadStructure: 'TUNNEL' })),
    );
    const graph = buildRoadGraph(grid);
    expect(graph.nodes.get('1,0')?.roadStructure).toBe('TUNNEL');
    expect(findRoadPath('0,0', '2,0', graph)).toHaveLength(3);
  });
});
