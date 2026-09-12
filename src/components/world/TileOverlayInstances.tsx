import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TileData } from '../../types';
import { CityDistrict } from '../../districts';
import { getOverlayColor } from '../../overlayModel';
import { roadHeight } from './visualModel';

/** One draw call for all thematic tiles, with no per-frame allocations. */
export function TileOverlayInstances({ grid, overlay, districts, unlockedRegions, expansion, homeSatisfaction }: {
  homeSatisfaction?: Record<string, number>; grid: TileData[][]; overlay: string; districts: CityDistrict[]; unlockedRegions: string[]; expansion: boolean;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const entries = useMemo(() => {
    const visible = [];
    for (const row of grid) for (const tile of row) {
      if (!expansion && !unlockedRegions.includes(`${Math.floor(tile.x / 20)},${Math.floor(tile.y / 20)}`)) continue;
      const color = getOverlayColor(tile, overlay, districts, homeSatisfaction);
      if (color) visible.push({ tile, color });
    }
    return visible;
  }, [grid, overlay, districts, unlockedRegions, expansion, homeSatisfaction]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    const scale = new THREE.Vector3(1, 1, 1);
    const position = new THREE.Vector3();
    const color = new THREE.Color();
    entries.forEach(({ tile, color: value }, index) => {
      position.set(tile.x - grid[0].length / 2 + 0.5, roadHeight(tile) + 0.09, tile.y - grid.length / 2 + 0.5);
      mesh.current!.setMatrixAt(index, matrix.compose(position, rotation, scale));
      mesh.current!.setColorAt(index, color.set(value));
    });
    mesh.current.count = entries.length;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [entries, grid]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(1, grid.length * (grid[0]?.length ?? 0))]} name="CityTileOverlays" raycast={() => {}}>
    <planeGeometry args={[0.96, 0.96]} />
    <meshBasicMaterial transparent opacity={0.38} depthWrite={false} side={THREE.DoubleSide} />
  </instancedMesh>;
}
