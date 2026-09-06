import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getRoadClass, IntersectionControl, RoadClass, RoadStructure, TileData, TileType } from '../../types';
import { roadVisual } from './visualModel';
import { gridToWorld } from './types3D';

interface RoadMeshProps {
  grid: TileData[][];
  nightFactor: number;
  tutorialHighlight?: boolean;
  targetHighwayTile?: [number, number] | null;
  roadRevision?: number;
  dirtyChunkKeys?: string[];
}

interface RoadConnection {
  x: number;
  y: number;
  hasN: boolean;
  hasE: boolean;
  hasS: boolean;
  hasW: boolean;
  count: number;
  roadClass: RoadClass;
  roadStructure: RoadStructure;
  intersectionControl: IntersectionControl;
}

const ROAD_CHUNK_SIZE = 10;

interface RoadChunkCache {
  width: number;
  height: number;
  lastGrid: TileData[][] | null;
  lastRevision: number;
  chunks: Map<string, RoadConnection[]>;
}

function roadChunkKey(x: number, y: number): string {
  return `${Math.floor(x / ROAD_CHUNK_SIZE)},${Math.floor(y / ROAD_CHUNK_SIZE)}`;
}

export function RoadMesh({ grid, nightFactor, tutorialHighlight = false, targetHighwayTile = null, roadRevision = 0, dirtyChunkKeys = [] }: RoadMeshProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const asphaltRef = useRef<THREE.InstancedMesh>(null);
  const roadChunkCacheRef = useRef<RoadChunkCache>({
    width: 0,
    height: 0,
    lastGrid: null,
    lastRevision: -1,
    chunks: new Map(),
  });

  // Parse road tiles and analyze adjacency. The cache is keyed by the same
  // 10x10 dirty chunks emitted by the simulation. A road tile's connection
  // reads one neighbor in each direction, so the simulation marks adjacent
  // chunks whenever a road changes.
  const roadData = useMemo(() => {
    const cache = roadChunkCacheRef.current;
    const dimensionsChanged = cache.width !== width || cache.height !== height;
    const gridReferenceChanged = cache.lastGrid !== grid;
    const dirtyKeys = new Set(dirtyChunkKeys);
    const mustRebuildAll = dimensionsChanged
      || cache.lastGrid === null
      || (roadRevision === 0 && gridReferenceChanged)
      || (gridReferenceChanged && cache.lastRevision !== roadRevision && dirtyKeys.size === 0);

    if (dimensionsChanged || mustRebuildAll) {
      cache.width = width;
      cache.height = height;
      cache.chunks.clear();
    }

    const isRoad = (x: number, y: number): boolean => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return grid[y][x].type === TileType.ROAD;
    };

    const rebuildChunk = (chunkKey: string): RoadConnection[] => {
      const [chunkX, chunkY] = chunkKey.split(',').map(Number);
      const startX = Math.max(0, chunkX * ROAD_CHUNK_SIZE);
      const startY = Math.max(0, chunkY * ROAD_CHUNK_SIZE);
      const endX = Math.min(width, startX + ROAD_CHUNK_SIZE);
      const endY = Math.min(height, startY + ROAD_CHUNK_SIZE);
      const roads: RoadConnection[] = [];
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          if (grid[y][x].type !== TileType.ROAD) continue;
          const hasN = isRoad(x, y - 1);
          const hasE = isRoad(x + 1, y);
          const hasS = isRoad(x, y + 1);
          const hasW = isRoad(x - 1, y);
          const count = (hasN ? 1 : 0) + (hasE ? 1 : 0) + (hasS ? 1 : 0) + (hasW ? 1 : 0);
          const roadClass = getRoadClass(grid[y][x]);
          roads.push({
            x,
            y,
            hasN,
            hasE,
            hasS,
            hasW,
            count,
            roadClass,
            roadStructure: grid[y][x].roadStructure ?? 'GROUND',
            intersectionControl: grid[y][x].intersectionControl ?? 'AUTO',
          });
        }
      }
      return roads;
    };

    if (mustRebuildAll) {
      for (let y = 0; y < height; y += ROAD_CHUNK_SIZE) {
        for (let x = 0; x < width; x += ROAD_CHUNK_SIZE) {
          const key = roadChunkKey(x, y);
          cache.chunks.set(key, rebuildChunk(key));
        }
      }
    } else if (cache.lastRevision !== roadRevision || gridReferenceChanged) {
      for (const key of dirtyKeys) cache.chunks.set(key, rebuildChunk(key));
    }

    cache.lastGrid = grid;
    cache.lastRevision = roadRevision;
    const roads: RoadConnection[] = [];
    for (const key of [...cache.chunks.keys()].sort()) roads.push(...(cache.chunks.get(key) ?? []));
    return roads;
  }, [dirtyChunkKeys, height, roadRevision, width, grid]);

  // Geometries for instancing
  // Keep the road as a shallow visual skin. The shared surface closes the
  // inter-tile seam without making each road read as a raised slab.
  const asphaltGeo = useMemo(() => new THREE.BoxGeometry(1, 0.06, 1), []);
  const sidewalkGeo = useMemo(() => new THREE.BoxGeometry(0.12, 0.06, 0.96), []);
  const railGeo = useMemo(() => new THREE.BoxGeometry(0.035, 0.1, 1), []);
  const bridgePierGeo = useMemo(() => new THREE.BoxGeometry(0.24, 0.9, 0.36), []);
  const centerLineGeo = useMemo(() => new THREE.PlaneGeometry(0.035, 0.62), []);
  const laneDividerGeo = useMemo(() => new THREE.PlaneGeometry(0.025, 0.62), []);
  const solidLineGeo = useMemo(() => new THREE.PlaneGeometry(0.02, 0.96), []);
  const tunnelRoofGeo = useMemo(() => new THREE.BoxGeometry(0.9, 0.08, 0.9), []);
  const crosswalkStripGeo = useMemo(() => new THREE.PlaneGeometry(0.075, 0.36), []);
  const roundaboutGeo = useMemo(() => new THREE.RingGeometry(0.2, 0.28, 16), []);
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.018, 0.022, 0.8), []);
  const armGeo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 0.22), []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.045, 8, 8), []);

  // Materials
  const asphaltMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.92,
  }), []);

  const sidewalkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#a8b5c4',
    roughness: 0.65,
  }), []);

  const bridgePierMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#8492a6',
    roughness: 0.85,
  }), []);

  const guardrailMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.65,
    roughness: 0.28,
  }), []);

  const yellowLineMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#eab308',
    side: THREE.DoubleSide,
  }), []);

  const whiteLineMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#f8fafc',
    side: THREE.DoubleSide,
  }), []);

  const roundaboutMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fbbf24',
    side: THREE.DoubleSide,
  }), []);

  const tunnelRoofMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#111827',
    roughness: 0.95,
  }), []);

  const poleMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#475569',
    metalness: 0.8,
    roughness: 0.2,
  }), []);

  const streetlightBulbMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fef08a',
  }), []);

  // Every asphalt slab shares the same geometry and material. Upload the
  // per-tile transforms to one instanced mesh to keep road rendering cheap as
  // the city grows.
  useEffect(() => {
    if (!asphaltRef.current) return;
    const dummy = new THREE.Object3D();
    roadData.forEach((road, index) => {
      const [wx, , wz] = gridToWorld(road.x, road.y, width, height);
      const wy = (grid[road.y][road.x].elevation || 0) * 0.15 + (road.roadStructure === 'BRIDGE' ? 0.22 : road.roadStructure === 'TUNNEL' ? -0.08 : 0);
      dummy.position.set(wx, wy - 0.03, wz);
      dummy.rotation.set(0, 0, 0);
      const widthScale = roadVisual(road.roadClass).width;
      dummy.scale.set(widthScale, 1, widthScale);
      dummy.updateMatrix();
      asphaltRef.current!.setMatrixAt(index, dummy.matrix);
      const roadColor = new THREE.Color(roadVisual(road.roadClass).color);
      roadColor.lerp(new THREE.Color('#1b2638'), Math.min(0.42, nightFactor * 0.42));
      asphaltRef.current!.setColorAt(index, roadColor);
    });
    asphaltRef.current.count = roadData.length;
    asphaltRef.current.instanceMatrix.needsUpdate = true;
    if (asphaltRef.current.instanceColor) asphaltRef.current.instanceColor.needsUpdate = true;
    asphaltRef.current.computeBoundingSphere();
  }, [height, nightFactor, roadData, roadRevision, width]);

  // Update street light brightness based on night
  streetlightBulbMat.color.setHSL(0.15, 0.9, 0.5 + nightFactor * 0.5);

  return (
    <group name="RoadNetwork">
      <instancedMesh
        ref={asphaltRef}
        args={[asphaltGeo, asphaltMat, Math.max(1, roadData.length)]}
        receiveShadow
      />
      {roadData.map((road) => {
        const [wx, , wz] = gridToWorld(road.x, road.y, width, height);
        const wy = (grid[road.y][road.x].elevation || 0) * 0.15 + (road.roadStructure === 'BRIDGE' ? 0.22 : road.roadStructure === 'TUNNEL' ? -0.08 : 0);
        const { hasN, hasE, hasS, hasW, count, roadClass, roadStructure, intersectionControl } = road;

        const isHorizontalStraight = hasE && hasW && (count === 2 || roadClass === 'HIGHWAY');
        const isVerticalStraight = hasN && hasS && (count === 2 || (roadClass === 'HIGHWAY' && !isHorizontalStraight));
        const isIntersection = count >= 3;
        const isTargetHighway = tutorialHighlight && roadClass === 'HIGHWAY' && (
          !targetHighwayTile || (road.x === targetHighwayTile[0] && road.y === targetHighwayTile[1])
        );

        return (
          <group key={`road-${road.x}-${road.y}`} position={[wx, wy, wz]}>
            {isTargetHighway && (
              <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[1.18, 1.18]} />
                <meshBasicMaterial color="#facc15" transparent opacity={0.3} depthWrite={false} />
              </mesh>
            )}
            {roadStructure === 'TUNNEL' && <mesh geometry={tunnelRoofGeo} material={tunnelRoofMat} position={[0, 0.16, 0]} receiveShadow />}
            {roadStructure === 'BRIDGE' && (
              <>
                <mesh geometry={bridgePierGeo} material={bridgePierMat} position={[-0.3, -0.45, 0]} castShadow />
                <mesh geometry={bridgePierGeo} material={bridgePierMat} position={[0.3, -0.45, 0]} castShadow />
                {!hasW && <mesh geometry={railGeo} material={guardrailMat} position={[-0.46, 0.16, 0]} castShadow />}
                {!hasE && <mesh geometry={railGeo} material={guardrailMat} position={[0.46, 0.16, 0]} castShadow />}
                {!hasN && <mesh geometry={railGeo} material={guardrailMat} position={[0, 0.16, -0.46]} rotation={[0, Math.PI / 2, 0]} castShadow />}
                {!hasS && <mesh geometry={railGeo} material={guardrailMat} position={[0, 0.16, 0.46]} rotation={[0, Math.PI / 2, 0]} castShadow />}
              </>
            )}
            {/* Sidewalk Curbs along non-connected edges */}
            {!hasW && <mesh geometry={sidewalkGeo} material={sidewalkMat} position={[-0.42, 0.05, 0]} receiveShadow />}
            {!hasE && <mesh geometry={sidewalkGeo} material={sidewalkMat} position={[0.42, 0.05, 0]} receiveShadow />}
            {!hasN && (
              <mesh 
                geometry={sidewalkGeo} 
                material={sidewalkMat} 
                position={[0, 0.05, -0.42]} 
                rotation={[0, Math.PI / 2, 0]} 
                receiveShadow 
              />
            )}
            {!hasS && (
              <mesh 
                geometry={sidewalkGeo} 
                material={sidewalkMat} 
                position={[0, 0.05, 0.42]} 
                rotation={[0, Math.PI / 2, 0]} 
                receiveShadow 
              />
            )}

            {/* Lane Markings */}
            {isVerticalStraight && roadClass !== 'HIGHWAY' && (
              <mesh 
                geometry={centerLineGeo} 
                material={yellowLineMat} 
                position={[0, 0.045, 0]} 
                rotation={[-Math.PI / 2, 0, 0]} 
              />
            )}
            {isHorizontalStraight && roadClass !== 'HIGHWAY' && (
              <mesh 
                geometry={centerLineGeo} 
                material={yellowLineMat} 
                position={[0, 0.045, 0]} 
                rotation={[-Math.PI / 2, 0, Math.PI / 2]} 
              />
            )}
            {isVerticalStraight && roadClass === 'HIGHWAY' && (
              <>
                <mesh geometry={laneDividerGeo} material={yellowLineMat} position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                <mesh geometry={solidLineGeo} material={whiteLineMat} position={[-0.36, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                <mesh geometry={solidLineGeo} material={whiteLineMat} position={[0.36, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
              </>
            )}
            {isHorizontalStraight && roadClass === 'HIGHWAY' && (
              <>
                <mesh geometry={laneDividerGeo} material={yellowLineMat} position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                <mesh geometry={solidLineGeo} material={whiteLineMat} position={[0, 0.045, -0.36]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                <mesh geometry={solidLineGeo} material={whiteLineMat} position={[0, 0.045, 0.36]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
              </>
            )}

            {/* 4-Way or 3-Way Crosswalks */}
            {isIntersection && roadClass !== 'HIGHWAY' && (
              <group position={[0, 0.046, 0]}>
                {hasN && (
                  <group position={[0, 0, -0.28]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                  </group>
                )}
                {hasS && (
                  <group position={[0, 0, 0.28]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                  </group>
                )}
                {hasE && (
                  <group position={[0.28, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                  </group>
                )}
                {hasW && (
                  <group position={[-0.28, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                    <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                  </group>
                )}
              </group>
            )}

            {isIntersection && intersectionControl === 'ROUNDABOUT' && (
              <mesh geometry={roundaboutGeo} material={roundaboutMat} position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            )}

            {/* Street Lamp on Intersections and select straight road corners */}
            {roadClass !== 'HIGHWAY' && (isIntersection || (road.x + road.y) % 4 === 0) && (
              <group position={[-0.42, 0, -0.42]}>
                <mesh geometry={poleGeo} material={poleMat} position={[0, 0.4, 0]} castShadow />
                <mesh geometry={armGeo} material={poleMat} position={[0.07, 0.76, 0.07]} rotation={[0.3, -Math.PI / 4, -0.3]} />
                <mesh geometry={bulbGeo} material={streetlightBulbMat} position={[0.13, 0.78, 0.13]} />
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

