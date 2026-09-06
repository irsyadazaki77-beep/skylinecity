import React from 'react';
import { sharedBuildingMats, sharedBuildingGeos, BuildingRoofKit, BuildingLod } from './sharedKits';

interface IndustrialKitProps {
  level: number;
  abandoned?: boolean;
  lod?: BuildingLod;
}

export function IndustrialKit({
  level,
  abandoned = false,
  lod = 'NEAR',
}: IndustrialKitProps) {
  const safeLevel = Math.max(1, Math.min(5, level));
  const baseHeight = 0.35 + safeLevel * 0.22;

  const matMain = abandoned
    ? safeLevel <= 2
      ? sharedBuildingMats.indL1_abd
      : sharedBuildingMats.indL3_abd
    : safeLevel === 1
      ? sharedBuildingMats.indFacadeSteel
      : safeLevel === 2
        ? sharedBuildingMats.indL2
        : safeLevel === 3
          ? sharedBuildingMats.indFacadeBlue
          : sharedBuildingMats.indFacadeTeal;

  if (lod === 'FAR') {
    return (
      <mesh
        geometry={sharedBuildingGeos.farMass}
        material={matMain}
        position={[0, baseHeight / 2 + 0.02, 0]}
        scale={[1, baseHeight, 1]}
        castShadow={false}
      />
    );
  }

  if (lod === 'MID') {
    return (
      <group>
        <mesh
          geometry={sharedBuildingGeos.midMass}
          material={matMain}
          position={[0, baseHeight / 2 + 0.02, 0]}
          scale={[1, baseHeight, 1]}
          castShadow
          receiveShadow
        />
        {/* Loading bay marking */}
        <mesh material={sharedBuildingMats.indSafety} position={[0, 0.15, 0.44]}>
          <boxGeometry args={[0.45, 0.04, 0.02]} />
        </mesh>
      </group>
    );
  }

  // NEAR LOD
  if (safeLevel === 1) {
    // Workshop / small light manufacturing
    return (
      <group>
        <mesh material={matMain} position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.82, 0.48, 0.78]} />
        </mesh>
        {/* Corrugated roof */}
        <mesh material={sharedBuildingMats.indFacadeSteel} position={[0, 0.52, 0]} rotation={[0, 0, 0.08]} castShadow>
          <boxGeometry args={[0.86, 0.05, 0.82]} />
        </mesh>
        {/* Loading shutter */}
        <mesh material={sharedBuildingMats.indSafety} position={[0, 0.18, 0.4]}>
          <boxGeometry args={[0.42, 0.28, 0.03]} />
        </mesh>
      </group>
    );
  }

  if (safeLevel === 2) {
    // Factory with exhaust chimney / ventilation
    return (
      <group>
        <mesh material={matMain} position={[0, 0.32, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.84, 0.62, 0.8]} />
        </mesh>
        {/* Exhaust pipe */}
        <mesh material={sharedBuildingMats.metal} position={[0.26, 0.68, -0.22]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.38, 8]} />
        </mesh>
        {/* Dual loading bays */}
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} material={sharedBuildingMats.indSafety} position={[x, 0.18, 0.41]}>
            <boxGeometry args={[0.28, 0.26, 0.03]} />
          </mesh>
        ))}
      </group>
    );
  }

  if (safeLevel === 3) {
    // Industrial complex / logistics hub
    return (
      <group>
        <mesh material={matMain} position={[0, 0.38, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.86, 0.74, 0.84]} />
        </mesh>
        {/* Storage silo */}
        <mesh material={sharedBuildingMats.indFacadeSteel} position={[-0.25, 0.5, 0.2]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.6, 12]} />
        </mesh>
        <mesh material={sharedBuildingMats.indSafety} position={[0.2, 0.2, 0.43]}>
          <boxGeometry args={[0.36, 0.32, 0.03]} />
        </mesh>
      </group>
    );
  }

  // Level 4/5: Advanced High-Tech R&D and Clean Biotech Campus
  return (
    <group>
      <mesh material={sharedBuildingMats.indFacadeWhite} position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.86, 0.88, 0.84]} />
      </mesh>
      {/* Cleanroom glass ribbon */}
      <mesh material={sharedBuildingMats.indGlass} position={[0, 0.45, 0.43]}>
        <boxGeometry args={[0.74, 0.3, 0.03]} />
      </mesh>
      <BuildingRoofKit height={0.9} hasSolar={true} hasHVAC={true} lod="NEAR" />
    </group>
  );
}
