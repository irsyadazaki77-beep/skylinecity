import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType, WeatherType } from '../../types';
import { gridToWorld } from './types3D';

interface EnvironmentPropsProps {
  grid: TileData[][];
  vegetationDensity?: 'low' | 'medium' | 'high';
  weather?: WeatherType;
  environmentRevision?: number;
}

interface EnvPosition {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  variant: 0 | 1 | 2 | 3;
}

interface RockPosition {
  x: number;
  y: number;
  z: number;
  scale: number;
  rx: number;
  ry: number;
  rz: number;
  variant: 0 | 1 | 2;
}

interface ChunkEnvData {
  trees: EnvPosition[];
  rocks: RockPosition[];
}

const CHUNK_SIZE = 20;

// Reusable scratch math objects to eliminate per-frame allocations
const _tmpPos = new THREE.Vector3();
const _tmpScale = new THREE.Vector3();
const _tmpRot = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler();
const _tmpMat = new THREE.Matrix4();
const _upAxis = new THREE.Vector3(0, 1, 0);

// Quick LCG for stable seeded randomness
function getSeededRandom(seed: number) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function getTreeVariantForTile(elevation: number, resource: string | undefined, rndVal: number): 0 | 1 | 2 | 3 {
  if (elevation >= 4) {
    return rndVal < 0.78 ? 1 : 2;
  }
  if (elevation >= 2) {
    return rndVal < 0.48 ? 1 : rndVal < 0.84 ? 0 : 2;
  }
  if (resource === 'fertile') {
    return rndVal < 0.28 ? 3 : rndVal < 0.76 ? 0 : 2;
  }
  return rndVal < 0.2 ? 3 : rndVal < 0.58 ? 0 : rndVal < 0.8 ? 1 : 2;
}

function computeChunkEnvironment(
  grid: TileData[][],
  chunkX: number,
  chunkY: number,
  width: number,
  height: number,
  treeProbMult: number,
): ChunkEnvData {
  const trees: EnvPosition[] = [];
  const rocks: RockPosition[] = [];

  const startX = chunkX * CHUNK_SIZE;
  const endX = Math.min(width, startX + CHUNK_SIZE);
  const startY = chunkY * CHUNK_SIZE;
  const endY = Math.min(height, startY + CHUNK_SIZE);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = grid[y]?.[x];
      if (!tile) continue;
      const seed = x * 719 + y * 431;
      const rnd = getSeededRandom(seed);

      if ((tile.type === TileType.EMPTY || tile.type === TileType.PARK) && !tile.water) {
        const [wx, , wz] = gridToWorld(x, y, width, height);
        const tileY = (tile.elevation || 0) * 0.15;
        const nearWater = [grid[y - 1]?.[x], grid[y]?.[x + 1], grid[y + 1]?.[x], grid[y]?.[x - 1]].some((n) => n?.water);

        if (tile.type === TileType.PARK) {
          const parkTreeCount = 2 + Math.floor(rnd() * 2);
          for (let k = 0; k < parkTreeCount; k++) {
            trees.push({
              x: wx + (rnd() - 0.5) * 0.55,
              y: tileY,
              z: wz + (rnd() - 0.5) * 0.55,
              scale: 0.58 + rnd() * 0.35,
              rotation: rnd() * Math.PI * 2,
              variant: rnd() < 0.65 ? 0 : 2,
            });
          }
        } else if (tile.resource === 'forest') {
          const clusterCount = Math.max(2, Math.round((3 + Math.floor(rnd() * 3)) * treeProbMult));
          const centerX = wx + (rnd() - 0.5) * 0.2;
          const centerZ = wz + (rnd() - 0.5) * 0.2;
          trees.push({
            x: centerX,
            y: tileY,
            z: centerZ,
            scale: 0.72 + rnd() * 0.28,
            rotation: rnd() * Math.PI * 2,
            variant: getTreeVariantForTile(tile.elevation || 0, tile.resource, rnd()),
          });
          for (let k = 1; k < clusterCount; k++) {
            const angle = (k / clusterCount) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
            const dist = 0.12 + rnd() * 0.28;
            trees.push({
              x: centerX + Math.cos(angle) * dist,
              y: tileY,
              z: centerZ + Math.sin(angle) * dist,
              scale: 0.48 + rnd() * 0.35,
              rotation: rnd() * Math.PI * 2,
              variant: getTreeVariantForTile(tile.elevation || 0, tile.resource, rnd()),
            });
          }
          if (rnd() < 0.65) {
            const shrubAngle = rnd() * Math.PI * 2;
            trees.push({
              x: centerX + Math.cos(shrubAngle) * 0.38,
              y: tileY,
              z: centerZ + Math.sin(shrubAngle) * 0.38,
              scale: 0.38 + rnd() * 0.2,
              rotation: rnd() * Math.PI * 2,
              variant: 2,
            });
          }
        } else if (nearWater && rnd() < 0.22 * treeProbMult) {
          trees.push({
            x: wx + (rnd() - 0.5) * 0.45,
            y: tileY,
            z: wz + (rnd() - 0.5) * 0.45,
            scale: 0.65 + rnd() * 0.4,
            rotation: rnd() * Math.PI * 2,
            variant: 3,
          });
        } else if (rnd() < 0.10 * treeProbMult) {
          trees.push({
            x: wx + (rnd() - 0.5) * 0.4,
            y: tileY,
            z: wz + (rnd() - 0.5) * 0.4,
            scale: 0.5 + rnd() * 0.4,
            rotation: rnd() * Math.PI * 2,
            variant: getTreeVariantForTile(tile.elevation || 0, tile.resource, rnd()),
          });
        }

        if (tile.resource === 'ore') {
          const count = 2 + Math.floor(rnd() * 3);
          for (let k = 0; k < count; k++) {
            rocks.push({
              x: wx + (rnd() - 0.5) * 0.6,
              y: tileY,
              z: wz + (rnd() - 0.5) * 0.6,
              scale: 0.1 + rnd() * 0.2,
              rx: rnd() * Math.PI,
              ry: rnd() * Math.PI,
              rz: rnd() * Math.PI,
              variant: Math.floor(rnd() * 3) as 0 | 1 | 2,
            });
          }
        } else if ((tile.elevation || 0) >= 3 && rnd() < 0.22) {
          rocks.push({
            x: wx + (rnd() - 0.5) * 0.4,
            y: tileY,
            z: wz + (rnd() - 0.5) * 0.4,
            scale: 0.09 + rnd() * 0.18,
            rx: rnd() * Math.PI,
            ry: rnd() * Math.PI,
            rz: rnd() * Math.PI,
            variant: Math.floor(rnd() * 3) as 0 | 1 | 2,
          });
        }
      }
    }
  }

  return { trees, rocks };
}

export function EnvironmentProps({
  grid,
  vegetationDensity = 'medium',
  weather = 'CLEAR',
  environmentRevision = 0,
}: EnvironmentPropsProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const chunkCacheRef = useRef<Map<string, ChunkEnvData>>(new Map());
  const perimeterCacheRef = useRef<{ trees: EnvPosition[]; rocks: RockPosition[] } | null>(null);
  const lastConfigRef = useRef<string>('');

  const { treePositions, rockPositions } = useMemo(() => {
    const climateTreeMult = weather === 'DROUGHT' ? 0.55 : weather === 'HEATWAVE' ? 0.75 : weather === 'STORM' ? 0.9 : 1;
    const treeProbMult = (vegetationDensity === 'low' ? 0.4 : vegetationDensity === 'high' ? 1.5 : 1.0) * climateTreeMult;
    const configKey = `${width}x${height}_${vegetationDensity}_${weather}`;

    if (lastConfigRef.current !== configKey) {
      chunkCacheRef.current.clear();
      perimeterCacheRef.current = null;
      lastConfigRef.current = configKey;
    }

    // 1. Perimeter boundary forest belt
    if (!perimeterCacheRef.current) {
      const pTrees: EnvPosition[] = [];
      for (let x = -3; x < width + 3; x++) {
        for (let y = -3; y < height + 3; y++) {
          if (x < 0 || x >= width || y < 0 || y >= height) {
            const seed = (x + 100) * 313 + (y + 100) * 127;
            const rnd = getSeededRandom(seed);
            if (rnd() < 0.4 * treeProbMult) {
              const gx = Math.max(0, Math.min(width - 1, x));
              const gy = Math.max(0, Math.min(height - 1, y));
              const baseElevation = grid[gy]?.[gx]?.elevation || 1;
              const [wx, , wz] = gridToWorld(gx, gy, width, height);
              const ox = (x < 0 ? x : x >= width ? x - width + 1 : 0);
              const oz = (y < 0 ? y : y >= height ? y - height + 1 : 0);
              pTrees.push({
                x: wx + ox + (rnd() - 0.5) * 0.4,
                y: baseElevation * 0.15,
                z: wz + oz + (rnd() - 0.5) * 0.4,
                scale: 0.65 + rnd() * 0.5,
                rotation: rnd() * Math.PI * 2,
                variant: getTreeVariantForTile(baseElevation, undefined, rnd()),
              });
            }
          }
        }
      }
      perimeterCacheRef.current = { trees: pTrees, rocks: [] };
    }

    // 2. Chunk-based internal map trees and rocks
    const allTrees: EnvPosition[] = [...perimeterCacheRef.current.trees];
    const allRocks: RockPosition[] = [];
    const numChunksX = Math.ceil(width / CHUNK_SIZE);
    const numChunksY = Math.ceil(height / CHUNK_SIZE);

    for (let cy = 0; cy < numChunksY; cy++) {
      for (let cx = 0; cx < numChunksX; cx++) {
        const cKey = `${cx}_${cy}_rev${environmentRevision}`;
        let chunkData = chunkCacheRef.current.get(cKey);
        if (!chunkData) {
          chunkData = computeChunkEnvironment(grid, cx, cy, width, height, treeProbMult);
          chunkCacheRef.current.set(cKey, chunkData);
        }
        for (let i = 0; i < chunkData.trees.length; i++) allTrees.push(chunkData.trees[i]);
        for (let i = 0; i < chunkData.rocks.length; i++) allRocks.push(chunkData.rocks[i]);
      }
    }

    return { treePositions: allTrees, rockPositions: allRocks };
  }, [environmentRevision, width, height, vegetationDensity, weather, grid]);

  // Geometries and Materials with cleanup
  const broadleafGeo = useMemo(() => new THREE.DodecahedronGeometry(0.24, 1), []);
  const pineGeo = useMemo(() => new THREE.ConeGeometry(0.24, 0.54, 7), []);
  const shrubGeo = useMemo(() => new THREE.DodecahedronGeometry(0.18, 0), []);
  const palmGeo = useMemo(() => new THREE.ConeGeometry(0.2, 0.44, 7), []);
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.025, 0.055, 0.24, 6), []);
  const roundedRockGeo = useMemo(() => new THREE.IcosahedronGeometry(0.8, 1), []);
  const flatRockGeo = useMemo(() => new THREE.SphereGeometry(0.8, 7, 3), []);
  const angularRockGeo = useMemo(() => new THREE.OctahedronGeometry(0.8, 0), []);

  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#543d2b', roughness: 0.92 }), []);
  const broadleafMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2d6a4f', roughness: 0.76 }), []);
  const pineMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1b4332', roughness: 0.82 }), []);
  const shrubMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#40916c', roughness: 0.8 }), []);
  const palmMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#52b788', roughness: 0.74 }), []);
  const roundedRockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a8581', roughness: 0.88 }), []);
  const flatRockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6d7782', roughness: 0.92 }), []);
  const angularRockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4e5860', roughness: 0.85 }), []);

  useEffect(() => {
    return () => {
      broadleafGeo.dispose();
      pineGeo.dispose();
      shrubGeo.dispose();
      palmGeo.dispose();
      trunkGeo.dispose();
      roundedRockGeo.dispose();
      flatRockGeo.dispose();
      angularRockGeo.dispose();
      trunkMat.dispose();
      broadleafMat.dispose();
      pineMat.dispose();
      shrubMat.dispose();
      palmMat.dispose();
      roundedRockMat.dispose();
      flatRockMat.dispose();
      angularRockMat.dispose();
    };
  }, [
    broadleafGeo, pineGeo, shrubGeo, palmGeo, trunkGeo,
    roundedRockGeo, flatRockGeo, angularRockGeo,
    trunkMat, broadleafMat, pineMat, shrubMat, palmMat,
    roundedRockMat, flatRockMat, angularRockMat,
  ]);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const broadleafRef = useRef<THREE.InstancedMesh>(null);
  const pineRef = useRef<THREE.InstancedMesh>(null);
  const shrubRef = useRef<THREE.InstancedMesh>(null);
  const palmRef = useRef<THREE.InstancedMesh>(null);
  const roundedRockRef = useRef<THREE.InstancedMesh>(null);
  const flatRockRef = useRef<THREE.InstancedMesh>(null);
  const angularRockRef = useRef<THREE.InstancedMesh>(null);

  const broadleafPositions = useMemo(() => treePositions.filter((tree) => tree.variant === 0), [treePositions]);
  const pinePositions = useMemo(() => treePositions.filter((tree) => tree.variant === 1), [treePositions]);
  const shrubPositions = useMemo(() => treePositions.filter((tree) => tree.variant === 2), [treePositions]);
  const palmPositions = useMemo(() => treePositions.filter((tree) => tree.variant === 3), [treePositions]);
  const roundedRockPositions = useMemo(() => rockPositions.filter((rock) => rock.variant === 0), [rockPositions]);
  const flatRockPositions = useMemo(() => rockPositions.filter((rock) => rock.variant === 1), [rockPositions]);
  const angularRockPositions = useMemo(() => rockPositions.filter((rock) => rock.variant === 2), [rockPositions]);

  useEffect(() => {
    if (!trunkRef.current || !broadleafRef.current || !pineRef.current || !shrubRef.current || !palmRef.current || !roundedRockRef.current || !flatRockRef.current || !angularRockRef.current) return;

    // 1. Position Trunks
    for (let i = 0; i < treePositions.length; i++) {
      const tree = treePositions[i];
      _tmpPos.set(tree.x, tree.y + 0.1 * tree.scale, tree.z);
      _tmpScale.set(tree.scale, tree.scale, tree.scale);
      _tmpRot.setFromAxisAngle(_upAxis, tree.rotation);
      _tmpMat.compose(_tmpPos, _tmpRot, _tmpScale);
      trunkRef.current.setMatrixAt(i, _tmpMat);
    }
    trunkRef.current.count = treePositions.length;
    trunkRef.current.instanceMatrix.needsUpdate = true;

    // 2. Position Foliage Canopies
    const populateCanopies = (
      ref: React.RefObject<THREE.InstancedMesh | null>,
      positions: EnvPosition[],
      variant: 0 | 1 | 2 | 3,
    ) => {
      const mesh = ref.current;
      if (!mesh) return;
      const canopyY = variant === 0 ? 0.37 : variant === 1 ? 0.35 : variant === 3 ? 0.48 : 0.18;
      for (let i = 0; i < positions.length; i++) {
        const tree = positions[i];
        if (variant === 0) {
          _tmpScale.set(tree.scale, tree.scale * 0.82, tree.scale);
        } else if (variant === 1) {
          _tmpScale.set(tree.scale, tree.scale, tree.scale);
        } else if (variant === 3) {
          _tmpScale.set(tree.scale * 1.2, tree.scale * 0.35, tree.scale * 1.2);
        } else {
          _tmpScale.set(tree.scale, tree.scale * 0.72, tree.scale);
        }
        _tmpPos.set(tree.x, tree.y + canopyY * tree.scale, tree.z);
        _tmpRot.setFromAxisAngle(_upAxis, tree.rotation);
        _tmpMat.compose(_tmpPos, _tmpRot, _tmpScale);
        mesh.setMatrixAt(i, _tmpMat);
      }
      mesh.count = positions.length;
      mesh.instanceMatrix.needsUpdate = true;
    };

    populateCanopies(broadleafRef, broadleafPositions, 0);
    populateCanopies(pineRef, pinePositions, 1);
    populateCanopies(shrubRef, shrubPositions, 2);
    populateCanopies(palmRef, palmPositions, 3);

    // 3. Position Rocks
    const populateRocks = (
      ref: React.RefObject<THREE.InstancedMesh | null>,
      positions: RockPosition[],
      yScale: number,
    ) => {
      const mesh = ref.current;
      if (!mesh) return;
      for (let i = 0; i < positions.length; i++) {
        const rock = positions[i];
        _tmpPos.set(rock.x, rock.y + 0.04, rock.z);
        _tmpScale.set(rock.scale, rock.scale * yScale, rock.scale);
        _tmpEuler.set(rock.rx, rock.ry, rock.rz);
        _tmpRot.setFromEuler(_tmpEuler);
        _tmpMat.compose(_tmpPos, _tmpRot, _tmpScale);
        mesh.setMatrixAt(i, _tmpMat);
      }
      mesh.count = positions.length;
      mesh.instanceMatrix.needsUpdate = true;
    };

    populateRocks(roundedRockRef, roundedRockPositions, 0.82);
    populateRocks(flatRockRef, flatRockPositions, 0.42);
    populateRocks(angularRockRef, angularRockPositions, 1.0);
  }, [
    treePositions, rockPositions, broadleafPositions, pinePositions,
    shrubPositions, palmPositions, roundedRockPositions, flatRockPositions, angularRockPositions,
  ]);

  return (
    <group name="EnvironmentProps">
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, trunkMat, treePositions.length || 1]}
        receiveShadow
      />
      <instancedMesh
        ref={broadleafRef}
        args={[broadleafGeo, broadleafMat, broadleafPositions.length || 1]}
        castShadow
      />
      <instancedMesh
        ref={pineRef}
        args={[pineGeo, pineMat, pinePositions.length || 1]}
        castShadow
      />
      <instancedMesh
        ref={shrubRef}
        args={[shrubGeo, shrubMat, shrubPositions.length || 1]}
      />
      <instancedMesh
        ref={palmRef}
        args={[palmGeo, palmMat, palmPositions.length || 1]}
        castShadow
      />
      <instancedMesh
        ref={roundedRockRef}
        args={[roundedRockGeo, roundedRockMat, roundedRockPositions.length || 1]}
        receiveShadow
      />
      <instancedMesh
        ref={flatRockRef}
        args={[flatRockGeo, flatRockMat, flatRockPositions.length || 1]}
        receiveShadow
      />
      <instancedMesh
        ref={angularRockRef}
        args={[angularRockGeo, angularRockMat, angularRockPositions.length || 1]}
        receiveShadow
      />
    </group>
  );
}
