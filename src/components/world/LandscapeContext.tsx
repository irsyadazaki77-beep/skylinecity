import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TileData } from '../../types';
import { gridToWorld } from './types3D';
import { terrainHeight } from './visualModel';

// Low-cost continuous landscape under locked regions: one draw call, no tile components.
export function LandscapeContext({ grid, unlockedRegions }: { grid: TileData[][]; unlockedRegions: string[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const signature = grid.flat().map(t => `${t.elevation}:${t.water}:${t.resource}`).join('|');
  const tiles = useMemo(() => grid.flat().filter(t => !unlockedRegions.includes(`${Math.floor(t.x / 20)},${Math.floor(t.y / 20)}`)), [signature, unlockedRegions]);
  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    tiles.forEach((tile, i) => {
      const [x, , z] = gridToWorld(tile.x, tile.y, grid[0].length, grid.length);
      const y = terrainHeight(tile.elevation);
      dummy.position.set(x, (y - 0.55) / 2, z);
      dummy.scale.set(1, Math.max(0.02, y + 0.55), 1);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
      color.set(tile.water ? '#438e9a' : tile.resource === 'forest' ? '#648673' : tile.resource === 'ore' ? '#909486' : '#91a582');
      ref.current!.setColorAt(i, color);
    });
    ref.current.count = tiles.length;
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [tiles, grid.length, grid[0]?.length]);
  return <instancedMesh ref={ref} args={[undefined, undefined, Math.max(1, tiles.length)]} receiveShadow>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial roughness={0.95} />
  </instancedMesh>;
}
