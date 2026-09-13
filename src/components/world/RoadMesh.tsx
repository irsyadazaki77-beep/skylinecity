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
  elevation: number;
  deltaN: number;
  deltaE: number;
  deltaS: number;
  deltaW: number;
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
          const elevation = grid[y][x].elevation || 0;
          const deltaN = hasN ? ((grid[y - 1]?.[x]?.elevation || 0) - elevation) : 0;
          const deltaE = hasE ? ((grid[y]?.[x + 1]?.elevation || 0) - elevation) : 0;
          const deltaS = hasS ? ((grid[y + 1]?.[x]?.elevation || 0) - elevation) : 0;
          const deltaW = hasW ? ((grid[y]?.[x - 1]?.elevation || 0) - elevation) : 0;
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
            elevation,
            deltaN,
            deltaE,
            deltaS,
            deltaW,
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
  const sidewalkGeo = useMemo(() => new THREE.BoxGeometry(0.12, 0.06, 0.98), []);
  const railGeo = useMemo(() => new THREE.BoxGeometry(0.04, 0.12, 1), []);
  const bridgePierGeo = useMemo(() => new THREE.BoxGeometry(0.28, 1.6, 0.42), []);
  const bridgeCapGeo = useMemo(() => new THREE.BoxGeometry(0.96, 0.12, 0.36), []);
  const bridgeGirderGeo = useMemo(() => new THREE.BoxGeometry(0.96, 0.12, 0.96), []);
  const centerLineContinuousGeo = useMemo(() => new THREE.PlaneGeometry(0.04, 1.0), []);
  const centerLineCurveGeo = useMemo(() => new THREE.RingGeometry(0.32, 0.36, 12, 1, 0, Math.PI / 2), []);
  const stopBarGeo = useMemo(() => new THREE.PlaneGeometry(0.08, 0.44), []);
  const slopeSkirtGeo = useMemo(() => new THREE.BoxGeometry(1.0, 0.22, 0.08), []);
  const solidLineGeo = useMemo(() => new THREE.PlaneGeometry(0.025, 1.0), []);
  const tunnelRoofGeo = useMemo(() => new THREE.BoxGeometry(0.92, 0.1, 0.92), []);
  const crosswalkStripGeo = useMemo(() => new THREE.PlaneGeometry(0.08, 0.38), []);
  const roundaboutGeo = useMemo(() => new THREE.RingGeometry(0.2, 0.28, 16), []);
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.018, 0.024, 0.82), []);
  const armGeo = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 0.24), []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.048, 8, 8), []);
  const lightPoolGeo = useMemo(() => new THREE.CircleGeometry(0.65, 14), []);
  const stopRoofGeo = useMemo(() => new THREE.BoxGeometry(0.32, 0.035, 0.16), []);
  const stopSignGeo = useMemo(() => new THREE.BoxGeometry(0.035, 0.22, 0.035), []);
  const medianGeo = useMemo(() => new THREE.BoxGeometry(0.14, 0.07, 0.98), []);
  const medianBushGeo = useMemo(() => new THREE.SphereGeometry(0.06, 6, 6), []);
  const arrowStemGeo = useMemo(() => new THREE.PlaneGeometry(0.035, 0.20), []);
  const arrowHeadGeo = useMemo(() => new THREE.ConeGeometry(0.06, 0.12, 3), []);
  const pedestrianPaverGeo = useMemo(() => new THREE.BoxGeometry(0.96, 0.065, 0.96), []);
  const bollardGeo = useMemo(() => new THREE.CylinderGeometry(0.025, 0.03, 0.22, 6), []);

  // Materials
  const medianMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3f6212', roughness: 0.85 }), []);
  const pedestrianPaverMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a7b56', roughness: 0.8 }), []);
  const bollardMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.6, roughness: 0.3 }), []);
  const asphaltMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.92,
  }), []);

  const sidewalkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.72,
  }), []);

  const bridgePierMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#64748b',
    roughness: 0.82,
  }), []);

  const guardrailMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.7,
    roughness: 0.25,
  }), []);

  const yellowLineMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fbbf24',
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
    color: '#0f172a',
    roughness: 0.95,
  }), []);

  const poleMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#334155',
    metalness: 0.85,
    roughness: 0.2,
  }), []);

  const streetlightBulbMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fef08a',
  }), []);

  const lightPoolMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fef08a',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), []);

  const stopMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8b735a', roughness: 0.76 }), []);
  const signalBoxGeo = useMemo(() => new THREE.BoxGeometry(0.06, 0.16, 0.05), []);
  const signalLightGeo = useMemo(() => new THREE.SphereGeometry(0.02, 6, 6), []);
  const signalBoxMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 }), []);
  const lightRedActiveMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ef4444' }), []);
  const lightYellowActiveMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#eab308' }), []);
  const lightGreenActiveMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#22c55e' }), []);
  const lightInactiveMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.9 }), []);

  // Every asphalt slab shares the same geometry and material. Upload the
  // per-tile transforms to one instanced mesh to keep road rendering cheap as
  // the city grows.
  useEffect(() => {
    if (!asphaltRef.current) return;
    const dummy = new THREE.Object3D();
    roadData.forEach((road, index) => {
      const [wx, , wz] = gridToWorld(road.x, road.y, width, height);
      const wy = (grid[road.y][road.x].elevation || 0) * 0.15 + (road.roadStructure === 'BRIDGE' ? 0.22 : road.roadStructure === 'TUNNEL' ? -0.08 : 0);
      // Keep the asphalt skin a few millimetres above the terrain surface.
      // A flush top face causes the striped moire/z-fighting that is most
      // visible on long highways at an isometric camera angle.
      dummy.position.set(wx, wy - 0.02, wz);
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
  streetlightBulbMat.color.setHSL(0.14, 0.95, 0.5 + nightFactor * 0.5);
  lightPoolMat.opacity = Math.min(0.24, nightFactor * 0.24);

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

          const isCurveNE = count === 2 && hasN && hasE;
          const isCurveES = count === 2 && hasE && hasS;
          const isCurveSW = count === 2 && hasS && hasW;
          const isCurveWN = count === 2 && hasW && hasN;

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
                  <mesh geometry={bridgeGirderGeo} material={bridgePierMat} position={[0, -0.08, 0]} castShadow receiveShadow />
                  <mesh geometry={bridgeCapGeo} material={bridgePierMat} position={[0, -0.16, 0]} castShadow />
                  <mesh geometry={bridgePierGeo} material={bridgePierMat} position={[-0.28, -0.9, 0]} castShadow />
                  <mesh geometry={bridgePierGeo} material={bridgePierMat} position={[0.28, -0.9, 0]} castShadow />
                  {!hasW && <mesh geometry={railGeo} material={guardrailMat} position={[-0.46, 0.16, 0]} castShadow />}
                  {!hasE && <mesh geometry={railGeo} material={guardrailMat} position={[0.46, 0.16, 0]} castShadow />}
                  {!hasN && <mesh geometry={railGeo} material={guardrailMat} position={[0, 0.16, -0.46]} rotation={[0, Math.PI / 2, 0]} castShadow />}
                  {!hasS && <mesh geometry={railGeo} material={guardrailMat} position={[0, 0.16, 0.46]} rotation={[0, Math.PI / 2, 0]} castShadow />}
                </>
              )}

              {/* Slope transitional skirts to eliminate elevation gaps */}
              {road.deltaN < 0 && <mesh geometry={slopeSkirtGeo} material={asphaltMat} position={[0, -0.08, -0.48]} />}
              {road.deltaS < 0 && <mesh geometry={slopeSkirtGeo} material={asphaltMat} position={[0, -0.08, 0.48]} />}
              {road.deltaW < 0 && <mesh geometry={slopeSkirtGeo} material={asphaltMat} position={[-0.48, -0.08, 0]} rotation={[0, Math.PI / 2, 0]} />}
              {road.deltaE < 0 && <mesh geometry={slopeSkirtGeo} material={asphaltMat} position={[0.48, -0.08, 0]} rotation={[0, Math.PI / 2, 0]} />}

              {/* Sidewalk Curbs along non-connected edges */}
              {roadClass !== 'PEDESTRIAN' && roadClass !== 'SERVICE' && (
                <>
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
                </>
              )}

              {/* Pedestrian Plaza Paving and Entry Bollards */}
              {roadClass === 'PEDESTRIAN' && (
                <>
                  <mesh geometry={pedestrianPaverGeo} material={pedestrianPaverMat} position={[0, 0.045, 0]} receiveShadow />
                  {!hasN && <mesh geometry={bollardGeo} material={bollardMat} position={[-0.32, 0.11, -0.44]} castShadow />}
                  {!hasN && <mesh geometry={bollardGeo} material={bollardMat} position={[0.32, 0.11, -0.44]} castShadow />}
                  {!hasS && <mesh geometry={bollardGeo} material={bollardMat} position={[-0.32, 0.11, 0.44]} castShadow />}
                  {!hasS && <mesh geometry={bollardGeo} material={bollardMat} position={[0.32, 0.11, 0.44]} castShadow />}
                  {!hasW && <mesh geometry={bollardGeo} material={bollardMat} position={[-0.44, 0.11, -0.32]} castShadow />}
                  {!hasW && <mesh geometry={bollardGeo} material={bollardMat} position={[-0.44, 0.11, 0.32]} castShadow />}
                  {!hasE && <mesh geometry={bollardGeo} material={bollardMat} position={[0.44, 0.11, -0.32]} castShadow />}
                  {!hasE && <mesh geometry={bollardGeo} material={bollardMat} position={[0.44, 0.11, 0.32]} castShadow />}
                </>
              )}

              {/* Avenue Landscaped Central Median and Dual Lanes */}
              {roadClass === 'AVENUE' && isVerticalStraight && (
                <>
                  <mesh geometry={medianGeo} material={medianMat} position={[0, 0.05, 0]} />
                  <mesh geometry={medianBushGeo} material={medianMat} position={[0, 0.09, -0.28]} />
                  <mesh geometry={medianBushGeo} material={medianMat} position={[0, 0.09, 0.28]} />
                  <mesh geometry={solidLineGeo} material={whiteLineMat} position={[-0.26, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                  <mesh geometry={solidLineGeo} material={whiteLineMat} position={[0.26, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                </>
              )}
              {roadClass === 'AVENUE' && isHorizontalStraight && (
                <>
                  <mesh geometry={medianGeo} material={medianMat} position={[0, 0.05, 0]} rotation={[0, Math.PI / 2, 0]} />
                  <mesh geometry={medianBushGeo} material={medianMat} position={[-0.28, 0.09, 0]} />
                  <mesh geometry={medianBushGeo} material={medianMat} position={[0.28, 0.09, 0]} />
                  <mesh geometry={solidLineGeo} material={whiteLineMat} position={[0, 0.045, -0.26]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                  <mesh geometry={solidLineGeo} material={whiteLineMat} position={[0, 0.045, 0.26]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                </>
              )}

              {/* One-Way Directional Lane Arrows */}
              {roadClass === 'ONE_WAY' && isVerticalStraight && (
                <>
                  <mesh geometry={arrowStemGeo} material={whiteLineMat} position={[0, 0.045, 0.05]} rotation={[-Math.PI / 2, 0, 0]} />
                  <mesh geometry={arrowHeadGeo} material={whiteLineMat} position={[0, 0.045, -0.1]} rotation={[Math.PI / 2, 0, 0]} />
                </>
              )}
              {roadClass === 'ONE_WAY' && isHorizontalStraight && (
                <>
                  <mesh geometry={arrowStemGeo} material={whiteLineMat} position={[-0.05, 0.045, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                  <mesh geometry={arrowHeadGeo} material={whiteLineMat} position={[0.1, 0.045, 0]} rotation={[0, 0, -Math.PI / 2]} />
                </>
              )}

              {/* Continuous Center Lane Markings for Standard Roads */}
              {isVerticalStraight && (roadClass === 'LOCAL' || roadClass === 'ARTERIAL') && (
                <mesh
                  geometry={centerLineContinuousGeo}
                  material={yellowLineMat}
                  position={[0, 0.045, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                />
              )}
              {isHorizontalStraight && (roadClass === 'LOCAL' || roadClass === 'ARTERIAL') && (
                <mesh
                  geometry={centerLineContinuousGeo}
                  material={yellowLineMat}
                  position={[0, 0.045, 0]}
                  rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                />
              )}

              {/* Smooth 90-degree turning curve lines */}
              {isCurveNE && (roadClass === 'LOCAL' || roadClass === 'ARTERIAL' || roadClass === 'AVENUE') && (
                <mesh
                  geometry={centerLineCurveGeo}
                  material={yellowLineMat}
                  position={[0.5, 0.045, -0.5]}
                  rotation={[-Math.PI / 2, 0, Math.PI]}
                />
              )}
              {isCurveES && (roadClass === 'LOCAL' || roadClass === 'ARTERIAL' || roadClass === 'AVENUE') && (
                <mesh
                  geometry={centerLineCurveGeo}
                  material={yellowLineMat}
                  position={[0.5, 0.045, 0.5]}
                  rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                />
              )}
              {isCurveSW && (roadClass === 'LOCAL' || roadClass === 'ARTERIAL' || roadClass === 'AVENUE') && (
                <mesh
                  geometry={centerLineCurveGeo}
                  material={yellowLineMat}
                  position={[-0.5, 0.045, 0.5]}
                  rotation={[-Math.PI / 2, 0, 0]}
                />
              )}
              {isCurveWN && (roadClass === 'LOCAL' || roadClass === 'ARTERIAL' || roadClass === 'AVENUE') && (
                <mesh
                  geometry={centerLineCurveGeo}
                  material={yellowLineMat}
                  position={[-0.5, 0.045, -0.5]}
                  rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
                />
              )}

              {/* Highway multi-lane continuous dividers */}
              {isVerticalStraight && roadClass === 'HIGHWAY' && (
                <>
                  <mesh geometry={centerLineContinuousGeo} material={yellowLineMat} position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                  <mesh geometry={solidLineGeo} material={whiteLineMat} position={[-0.38, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                  <mesh geometry={solidLineGeo} material={whiteLineMat} position={[0.38, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                </>
              )}
              {isHorizontalStraight && roadClass === 'HIGHWAY' && (
                <>
                  <mesh geometry={centerLineContinuousGeo} material={yellowLineMat} position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                  <mesh geometry={solidLineGeo} material={whiteLineMat} position={[0, 0.045, -0.38]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                  <mesh geometry={solidLineGeo} material={whiteLineMat} position={[0, 0.045, 0.38]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                </>
              )}

              {/* 4-Way or 3-Way Crosswalks with Stop Bars */}
              {isIntersection && roadClass !== 'HIGHWAY' && roadClass !== 'PEDESTRIAN' && (
                <group position={[0, 0.046, 0]}>
                  {hasN && (
                    <>
                      <mesh geometry={stopBarGeo} material={whiteLineMat} position={[0, 0, -0.38]} rotation={[-Math.PI / 2, 0, 0]} />
                      <group position={[0, 0, -0.26]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                      </group>
                    </>
                  )}
                  {hasS && (
                    <>
                      <mesh geometry={stopBarGeo} material={whiteLineMat} position={[0, 0, 0.38]} rotation={[-Math.PI / 2, 0, 0]} />
                      <group position={[0, 0, 0.26]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                      </group>
                    </>
                  )}
                  {hasE && (
                    <>
                      <mesh geometry={stopBarGeo} material={whiteLineMat} position={[0.38, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                      <group position={[0.26, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                      </group>
                    </>
                  )}
                  {hasW && (
                    <>
                      <mesh geometry={stopBarGeo} material={whiteLineMat} position={[-0.38, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                      <group position={[-0.26, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[-0.12, 0, 0]} />
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0, 0, 0]} />
                        <mesh geometry={crosswalkStripGeo} material={whiteLineMat} position={[0.12, 0, 0]} />
                      </group>
                    </>
                  )}
                </group>
              )}

              {isIntersection && intersectionControl === 'ROUNDABOUT' && (
                <mesh geometry={roundaboutGeo} material={roundaboutMat} position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} />
              )}

              {roadClass === 'ARTERIAL' && (road.x + road.y) % 5 === 0 && (
                <group position={[0.5, 0.06, 0.18]}>
                  <mesh geometry={stopSignGeo} material={stopMat} position={[0, 0.16, 0]} castShadow />
                  <mesh geometry={stopRoofGeo} material={stopMat} position={[0, 0.28, 0]} castShadow />
                </group>
              )}

              {/* Street Lamp on Intersections and regular roadside intervals */}
              {roadClass !== 'HIGHWAY' && (isIntersection || (road.x + road.y) % 4 === 0) && (
                <group position={[-0.42, 0, -0.42]}>
                  <mesh geometry={poleGeo} material={poleMat} position={[0, 0.41, 0]} castShadow />
                  <mesh geometry={armGeo} material={poleMat} position={[0.07, 0.78, 0.07]} rotation={[0.3, -Math.PI / 4, -0.3]} />
                  <mesh geometry={bulbGeo} material={streetlightBulbMat} position={[0.13, 0.8, 0.13]} />
                  {nightFactor > 0.18 && (
                    <mesh geometry={lightPoolGeo} material={lightPoolMat} position={[0.22, 0.048, 0.22]} rotation={[-Math.PI / 2, 0, 0]} />
                  )}
                </group>
              )}

              {/* Traffic Signal on Signalized Intersections */}
              {isIntersection && intersectionControl !== 'ROUNDABOUT' && (
                <group position={[0.42, 0, 0.42]}>
                  <mesh geometry={poleGeo} material={poleMat} position={[0, 0.35, 0]} castShadow />
                  <mesh geometry={signalBoxGeo} material={signalBoxMat} position={[0, 0.65, 0]} />
                  <mesh
                    geometry={signalLightGeo}
                    material={grid[road.y][road.x].signalStage === 'ALL_RED' || grid[road.y][road.x].signalStage === 'PEDESTRIAN_CROSSING' ? lightRedActiveMat : lightInactiveMat}
                    position={[0, 0.69, 0.028]}
                  />
                  <mesh
                    geometry={signalLightGeo}
                    material={grid[road.y][road.x].signalStage === 'YELLOW' ? lightYellowActiveMat : lightInactiveMat}
                    position={[0, 0.65, 0.028]}
                  />
                  <mesh
                    geometry={signalLightGeo}
                    material={grid[road.y][road.x].signalStage === 'GREEN' ? lightGreenActiveMat : lightInactiveMat}
                    position={[0, 0.61, 0.028]}
                  />
                </group>
              )}
            </group>
          );
      })}
    </group>
  );
}

