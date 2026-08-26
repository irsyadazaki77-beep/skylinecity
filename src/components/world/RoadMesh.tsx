import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getRoadClass, IntersectionControl, RoadClass, RoadStructure, TileData, TileType } from '../../types';
import { gridToWorld } from './types3D';

interface RoadMeshProps {
  grid: TileData[][];
  nightFactor: number;
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
  hasDifferentClassBranch: boolean;
  roadStructure: RoadStructure;
  intersectionControl: IntersectionControl;
}

const ROAD_RENDER_COLORS: Record<RoadClass, string> = {
  LOCAL: '#657383',
  ARTERIAL: '#71869c',
  HIGHWAY: '#536a82',
};

export function RoadMesh({ grid, nightFactor }: RoadMeshProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const asphaltRef = useRef<THREE.InstancedMesh>(null);
  const roadTopologySignature = useMemo(() => grid.map((row) => row.map((tile) => (
    `${tile.type}:${tile.roadClass ?? ''}:${tile.roadStructure ?? 'GROUND'}:${tile.elevation ?? 0}:${tile.intersectionControl ?? 'AUTO'}`
  )).join(',')).join(';'), [grid]);

  // Parse road tiles and analyze adjacency
  const roadData = useMemo(() => {
    const roads: RoadConnection[] = [];

    const isRoad = (x: number, y: number): boolean => {
      if (x < 0 || x >= width || y < 0 || y >= height) return false;
      return grid[y][x].type === TileType.ROAD;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x].type === TileType.ROAD) {
          const hasN = isRoad(x, y - 1);
          const hasE = isRoad(x + 1, y);
          const hasS = isRoad(x, y + 1);
          const hasW = isRoad(x - 1, y);
          const count = (hasN ? 1 : 0) + (hasE ? 1 : 0) + (hasS ? 1 : 0) + (hasW ? 1 : 0);
          const roadClass = getRoadClass(grid[y][x]);
          const hasDifferentClassBranch = [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]].some(([nx, ny]) => (
            isRoad(nx, ny) && getRoadClass(grid[ny][nx]) !== roadClass
          ));

          roads.push({
            x,
            y,
            hasN,
            hasE,
            hasS,
            hasW,
            count,
            roadClass,
            hasDifferentClassBranch,
            roadStructure: grid[y][x].roadStructure ?? 'GROUND',
            intersectionControl: grid[y][x].intersectionControl ?? 'AUTO',
          });
        }
      }
    }
    return roads;
  }, [height, roadTopologySignature, width]);

  // Geometries for instancing
  const asphaltGeo = useMemo(() => new THREE.BoxGeometry(0.96, 0.04, 0.96), []);
  const sidewalkGeo = useMemo(() => new THREE.BoxGeometry(0.12, 0.06, 0.96), []);
  const centerLineGeo = useMemo(() => new THREE.PlaneGeometry(0.04, 0.6), []);
  const laneDividerGeo = useMemo(() => new THREE.PlaneGeometry(0.025, 0.62), []);
  const tunnelRoofGeo = useMemo(() => new THREE.BoxGeometry(0.9, 0.08, 0.9), []);
  const crosswalkStripGeo = useMemo(() => new THREE.PlaneGeometry(0.08, 0.35), []);
  const roundaboutGeo = useMemo(() => new THREE.RingGeometry(0.2, 0.28, 16), []);
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.02, 0.02, 0.8), []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.05, 8, 8), []);

  // Materials
  const asphaltMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#657383',
    vertexColors: true,
  }), []);

  const sidewalkMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.6,
  }), []);

  const yellowLineMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#f59e0b',
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
      dummy.position.set(wx, wy + 0.02, wz);
      dummy.rotation.set(0, 0, 0);
      const widthScale = road.roadClass === 'HIGHWAY' ? 1.12 : road.roadClass === 'ARTERIAL' ? 1.04 : 0.94;
      dummy.scale.set(widthScale, 1, widthScale);
      dummy.updateMatrix();
      asphaltRef.current!.setMatrixAt(index, dummy.matrix);
      const roadColor = new THREE.Color(ROAD_RENDER_COLORS[road.roadClass]);
      roadColor.lerp(new THREE.Color('#1b2638'), Math.min(0.42, nightFactor * 0.42));
      asphaltRef.current!.setColorAt(index, roadColor);
    });
    asphaltRef.current.count = roadData.length;
    asphaltRef.current.instanceMatrix.needsUpdate = true;
    if (asphaltRef.current.instanceColor) asphaltRef.current.instanceColor.needsUpdate = true;
    asphaltRef.current.computeBoundingSphere();
  }, [height, nightFactor, roadData, roadTopologySignature, width]);

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
        const { hasN, hasE, hasS, hasW, count, roadClass, hasDifferentClassBranch, roadStructure, intersectionControl } = road;

        // Determine rotation for straight or corner segments
        let rotationY = 0;
        if (count === 2) {
          if (hasN && hasS) rotationY = 0; // Vertical straight
          else if (hasE && hasW) rotationY = Math.PI / 2; // Horizontal straight
          else if (hasN && hasE) rotationY = 0; // Corner N-E
          else if (hasE && hasS) rotationY = Math.PI / 2; // Corner E-S
          else if (hasS && hasW) rotationY = Math.PI; // Corner S-W
          else if (hasW && hasN) rotationY = -Math.PI / 2; // Corner W-N
        } else if (count === 3) {
          if (!hasS) rotationY = 0; // T-Junction facing North (missing South)
          else if (!hasW) rotationY = Math.PI / 2; // facing East
          else if (!hasN) rotationY = Math.PI; // facing South
          else if (!hasE) rotationY = -Math.PI / 2; // facing West
        }

        const isHorizontalStraight = (count === 2 && hasE && hasW);
        const isVerticalStraight = (count === 2 && hasN && hasS);
        const isIntersection = count >= 3 && (roadClass !== 'HIGHWAY' || hasDifferentClassBranch || intersectionControl !== 'AUTO');

        return (
          <group key={`road-${road.x}-${road.y}`} position={[wx, wy, wz]}>
            {roadStructure === 'TUNNEL' && <mesh geometry={tunnelRoofGeo} material={tunnelRoofMat} position={[0, 0.16, 0]} receiveShadow />}
            {roadStructure === 'BRIDGE' && (
              <>
                <mesh geometry={poleGeo} material={poleMat} position={[-0.3, -0.25, 0]} scale={[2, 0.9, 2]} />
                <mesh geometry={poleGeo} material={poleMat} position={[0.3, -0.25, 0]} scale={[2, 0.9, 2]} />
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
            {isVerticalStraight && roadClass !== 'LOCAL' && (
              <mesh 
                geometry={centerLineGeo} 
                material={yellowLineMat} 
                position={[0, 0.045, 0]} 
                rotation={[-Math.PI / 2, 0, 0]} 
              />
            )}
            {isHorizontalStraight && roadClass !== 'LOCAL' && (
              <mesh 
                geometry={centerLineGeo} 
                material={yellowLineMat} 
                position={[0, 0.045, 0]} 
                rotation={[-Math.PI / 2, 0, Math.PI / 2]} 
              />
            )}
            {isVerticalStraight && roadClass === 'HIGHWAY' && (
              <>
                <mesh geometry={laneDividerGeo} material={whiteLineMat} position={[-0.17, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
                <mesh geometry={laneDividerGeo} material={whiteLineMat} position={[0.17, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} />
              </>
            )}
            {isHorizontalStraight && roadClass === 'HIGHWAY' && (
              <>
                <mesh geometry={laneDividerGeo} material={whiteLineMat} position={[0, 0.045, -0.17]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
                <mesh geometry={laneDividerGeo} material={whiteLineMat} position={[0, 0.045, 0.17]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} />
              </>
            )}

            {/* 4-Way or 3-Way Crosswalks */}
            {isIntersection && (
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
                <mesh geometry={bulbGeo} material={streetlightBulbMat} position={[0.1, 0.78, 0.1]} />
                {nightFactor > 0.4 && (
                  <pointLight position={[0.1, 0.75, 0.1]} color="#fef08a" intensity={0.6 * nightFactor} distance={3} />
                )}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}
