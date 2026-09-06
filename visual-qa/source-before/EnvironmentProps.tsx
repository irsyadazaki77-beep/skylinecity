import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType } from '../../types';
import { gridToWorld } from './types3D';

interface EnvironmentPropsProps {
  grid: TileData[][];
  vegetationDensity?: 'low' | 'medium' | 'high';
  environmentRevision?: number;
}

interface EnvPosition {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  variant: 0 | 1 | 2;
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

// Quick LCG for stable seeded randomness
function getSeededRandom(seed: number) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function getTreeVariantForTile(elevation: number, resource: string | undefined, rndVal: number): 0 | 1 | 2 {
  if (elevation >= 4) {
    // Highland mountain: predominantly conifers / pines
    return rndVal < 0.78 ? 1 : 2;
  }
  if (elevation >= 2) {
    // Mid hills: mix of pine, broadleaf, and alpine shrubs
    return rndVal < 0.48 ? 1 : rndVal < 0.84 ? 0 : 2;
  }
  // Lowlands
  if (resource === 'fertile') {
    return rndVal < 0.7 ? 0 : 2;
  }
  return rndVal < 0.58 ? 0 : rndVal < 0.8 ? 1 : 2;
}

export function EnvironmentProps({ grid, vegetationDensity = 'medium', environmentRevision = 0 }: EnvironmentPropsProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  // Dynamic fields such as population and traffic do not change the placement
  // of procedural vegetation and rocks. The simulation supplies this revision
  // when terrain/topology changes, avoiding a full-grid signature scan here.
  const terrainSignature = environmentRevision;

  // Generate stable tree and rock positions based on grid structure
  const { treePositions, rockPositions } = useMemo(() => {
    const trees: EnvPosition[] = [];
    const rocks: RockPosition[] = [];
    const treeProbMult = vegetationDensity === 'low' ? 0.4 : vegetationDensity === 'high' ? 1.5 : 1.0;

    // 1. Perimeter boundary nature forest belt (just outside the 60x60 play zone)
    for (let x = -3; x < width + 3; x++) {
      for (let y = -3; y < height + 3; y++) {
        // Only place on the borders
        if (x < 0 || x >= width || y < 0 || y >= height) {
          const seed = (x + 100) * 313 + (y + 100) * 127;
          const rnd = getSeededRandom(seed);
          
          if (rnd() < 0.4 * treeProbMult) {
            // Find nearby grid tile for height estimate
            const gx = Math.max(0, Math.min(width - 1, x));
            const gy = Math.max(0, Math.min(height - 1, y));
            const baseElevation = grid[gy]?.[gx]?.elevation || 1;
            
            const [wx, , wz] = gridToWorld(gx, gy, width, height);
            const ox = (x < 0 ? x : x >= width ? x - width + 1 : 0);
            const oz = (y < 0 ? y : y >= height ? y - height + 1 : 0);

            trees.push({
              x: wx + ox + (rnd() - 0.5) * 0.4,
              y: baseElevation * 0.15,
              z: wz + oz + (rnd() - 0.5) * 0.4,
              scale: 0.65 + rnd() * 0.5,
              rotation: rnd() * Math.PI * 2,
              variant: Math.floor(rnd() * 3) as 0 | 1 | 2,
            });
          }
        }
      }
    }

    // 2. Resource/Forest/Rock tiles inside the active map
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        const seed = x * 719 + y * 431;
        const rnd = getSeededRandom(seed);

        if (tile.type === TileType.EMPTY && !tile.water) {
          const [wx, , wz] = gridToWorld(x, y, width, height);
          const tileY = (tile.elevation || 0) * 0.15;


          // Place trees on Forest resource or naturally on some tiles
          if (tile.resource === 'forest') {
            // Multiple trees inside a forest plot
            const baseCount = 3 + Math.floor(rnd() * 2);
            const count = Math.max(1, Math.round(baseCount * treeProbMult));
            for (let k = 0; k < count; k++) {
              trees.push({
                x: wx + (rnd() - 0.5) * 0.5,
                y: tileY,
                z: wz + (rnd() - 0.5) * 0.5,
                scale: 0.55 + rnd() * 0.45,
                rotation: rnd() * Math.PI * 2,
                variant: getTreeVariantForTile(tile.elevation || 0, tile.resource, rnd()),
              });
            }
          } else if (rnd() < 0.10 * treeProbMult) {
            // Natural spare trees
            trees.push({
              x: wx + (rnd() - 0.5) * 0.4,
              y: tileY,
              z: wz + (rnd() - 0.5) * 0.4,
              scale: 0.5 + rnd() * 0.4,
              rotation: rnd() * Math.PI * 2,
              variant: getTreeVariantForTile(tile.elevation || 0, tile.resource, rnd()),
            });
          }

          // Place rocks on Ore resources or high elevation hills
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
            // Mountain stones & ridges
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

    return { treePositions: trees, rockPositions: rocks };
  }, [terrainSignature, width, height, vegetationDensity]);

  // Geometries and Materials
  const broadleafGeo = useMemo(() => new THREE.IcosahedronGeometry(0.21, 1), []);
  const pineGeo = useMemo(() => new THREE.ConeGeometry(0.22, 0.5, 7), []);
  const shrubGeo = useMemo(() => new THREE.SphereGeometry(0.16, 7, 4), []);
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.03, 0.05, 0.22, 6), []);
  const roundedRockGeo = useMemo(() => new THREE.IcosahedronGeometry(0.8, 1), []);
  const flatRockGeo = useMemo(() => new THREE.SphereGeometry(0.8, 7, 3), []);
  const angularRockGeo = useMemo(() => new THREE.OctahedronGeometry(0.8, 0), []);

  const trunkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.92 }), []);
  const broadleafMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b8457', roughness: 0.78 }), []);
  const pineMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1b593b', roughness: 0.84 }), []);
  const shrubMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#579a61', roughness: 0.82 }), []);
  const roundedRockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a8581', roughness: 0.88 }), []);
  const flatRockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6d7782', roughness: 0.92 }), []);
  const angularRockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4e5860', roughness: 0.85 }), []);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const broadleafRef = useRef<THREE.InstancedMesh>(null);
  const pineRef = useRef<THREE.InstancedMesh>(null);
  const shrubRef = useRef<THREE.InstancedMesh>(null);
  const roundedRockRef = useRef<THREE.InstancedMesh>(null);
  const flatRockRef = useRef<THREE.InstancedMesh>(null);
  const angularRockRef = useRef<THREE.InstancedMesh>(null);

  const broadleafPositions = useMemo(() => treePositions.filter((tree) => tree.variant === 0), [treePositions]);
  const pinePositions = useMemo(() => treePositions.filter((tree) => tree.variant === 1), [treePositions]);
  const shrubPositions = useMemo(() => treePositions.filter((tree) => tree.variant === 2), [treePositions]);
  const roundedRockPositions = useMemo(() => rockPositions.filter((rock) => rock.variant === 0), [rockPositions]);
  const flatRockPositions = useMemo(() => rockPositions.filter((rock) => rock.variant === 1), [rockPositions]);
  const angularRockPositions = useMemo(() => rockPositions.filter((rock) => rock.variant === 2), [rockPositions]);

  useEffect(() => {
    if (!trunkRef.current || !broadleafRef.current || !pineRef.current || !shrubRef.current || !roundedRockRef.current || !flatRockRef.current || !angularRockRef.current) return;

    const tempTrunk = new THREE.Matrix4();
    const tempRock = new THREE.Matrix4();
    const tempCanopy = new THREE.Matrix4();
    const trunkRot = new THREE.Quaternion();
    const canopyRot = new THREE.Quaternion();
    const rockRot = new THREE.Quaternion();

    // 1. Position Trunks and Foliage
    treePositions.forEach((tree, i) => {
      // Trunk Composition
      const trunkPos = new THREE.Vector3(tree.x, tree.y + 0.1 * tree.scale, tree.z);
      const trunkScale = new THREE.Vector3(tree.scale, tree.scale, tree.scale);
      trunkRot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation);
      tempTrunk.compose(trunkPos, trunkRot, trunkScale);
      trunkRef.current!.setMatrixAt(i, tempTrunk);
    });

    trunkRef.current.count = treePositions.length;
    trunkRef.current.instanceMatrix.needsUpdate = true;

    const setCanopyMatrices = (ref: React.RefObject<THREE.InstancedMesh | null>, positions: EnvPosition[], variant: 0 | 1 | 2) => {
      positions.forEach((tree, i) => {
        const canopyY = variant === 0 ? 0.37 : variant === 1 ? 0.35 : 0.18;
        const canopyScale = variant === 0
          ? new THREE.Vector3(tree.scale, tree.scale * 0.82, tree.scale)
          : variant === 1
            ? new THREE.Vector3(tree.scale, tree.scale, tree.scale)
            : new THREE.Vector3(tree.scale, tree.scale * 0.72, tree.scale);
        const canopyPos = new THREE.Vector3(tree.x, tree.y + canopyY * tree.scale, tree.z);
        canopyRot.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation);
        tempCanopy.compose(canopyPos, canopyRot, canopyScale);
        ref.current!.setMatrixAt(i, tempCanopy);
      });
      ref.current!.count = positions.length;
      ref.current!.instanceMatrix.needsUpdate = true;
    };

    setCanopyMatrices(broadleafRef, broadleafPositions, 0);
    setCanopyMatrices(pineRef, pinePositions, 1);
    setCanopyMatrices(shrubRef, shrubPositions, 2);

    // 2. Position Rocks
    const setRockMatrices = (ref: React.RefObject<THREE.InstancedMesh | null>, positions: RockPosition[], yScale: number) => positions.forEach((rock, i) => {
      const rockPos = new THREE.Vector3(rock.x, rock.y + 0.04, rock.z);
      const rockScale = new THREE.Vector3(rock.scale, rock.scale * yScale, rock.scale);
      rockRot.setFromEuler(new THREE.Euler(rock.rx, rock.ry, rock.rz));
      tempRock.compose(rockPos, rockRot, rockScale);
      ref.current!.setMatrixAt(i, tempRock);
    });

    setRockMatrices(roundedRockRef, roundedRockPositions, 0.82);
    setRockMatrices(flatRockRef, flatRockPositions, 0.42);
    setRockMatrices(angularRockRef, angularRockPositions, 1.0);
  }, [treePositions, rockPositions, broadleafPositions, pinePositions, shrubPositions, roundedRockPositions, flatRockPositions, angularRockPositions]);

  return (
    <group name="EnvironmentProps">
      {/* Fixed draw-call budget: one instanced mesh per silhouette family. */}
      <instancedMesh
        ref={trunkRef}
        args={[trunkGeo, trunkMat, treePositions.length || 1]}
        castShadow
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
        castShadow
      />
      <instancedMesh
        ref={roundedRockRef}
        args={[roundedRockGeo, roundedRockMat, roundedRockPositions.length || 1]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={flatRockRef}
        args={[flatRockGeo, flatRockMat, flatRockPositions.length || 1]}
        castShadow
        receiveShadow
      />
      <instancedMesh
        ref={angularRockRef}
        args={[angularRockGeo, angularRockMat, angularRockPositions.length || 1]}
        castShadow
        receiveShadow
      />
    </group>
  );
}
