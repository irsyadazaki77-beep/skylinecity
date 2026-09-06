import React from 'react';
import { sharedBuildingMats, sharedBuildingGeos, BuildingRoofKit, BuildingLod } from './sharedKits';

interface ResidentialKitProps {
  level: number;
  abandoned?: boolean;
  lod?: BuildingLod;
}

export function ResidentialKit({
  level,
  abandoned = false,
  lod = 'NEAR',
}: ResidentialKitProps) {
  const safeLevel = Math.max(1, Math.min(5, level));
  const baseHeight = 0.35 + safeLevel * 0.28;

  const matMain = abandoned
    ? safeLevel === 1
      ? sharedBuildingMats.resL1_abd
      : safeLevel === 2
        ? sharedBuildingMats.resL2_abd
        : safeLevel === 3
          ? sharedBuildingMats.resL3_abd
          : safeLevel === 4
            ? sharedBuildingMats.resL4_abd
            : sharedBuildingMats.resL5_abd
    : safeLevel === 1
      ? sharedBuildingMats.resFacadeSand
      : safeLevel === 2
        ? sharedBuildingMats.resFacadeClay
        : safeLevel === 3
          ? sharedBuildingMats.resFacadeSlate
          : safeLevel === 4
            ? sharedBuildingMats.resFacadeBlue
            : sharedBuildingMats.resConcrete;

  // FAR representation: clean single box proxy matching exact height and footprint
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

  // MID representation: simplified massing with base facade and roof
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
        <BuildingRoofKit height={baseHeight + 0.02} lod="MID" />
      </group>
    );
  }

  // NEAR representation: full architectural detail with balconies, windows, and tropical touches
  if (safeLevel === 1) {
    // Level 1: Suburban bungalow / tropical cottage
    return (
      <group>
        {/* Main bungalow body */}
        <mesh material={matMain} position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.74, 0.38, 0.68]} />
        </mesh>
        {/* Sloped roof */}
        <mesh material={sharedBuildingMats.roof} position={[0, 0.44, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.58, 0.22, 4]} />
        </mesh>
        {/* Front porch */}
        <mesh material={sharedBuildingMats.resTimber} position={[0, 0.06, 0.38]}>
          <boxGeometry args={[0.36, 0.08, 0.18]} />
        </mesh>
        {/* Front window */}
        <mesh material={abandoned ? sharedBuildingMats.windowDark : sharedBuildingMats.resGlassBlue} position={[0.2, 0.22, 0.35]}>
          <planeGeometry args={[0.18, 0.18]} />
        </mesh>
      </group>
    );
  }

  if (safeLevel === 2) {
    // Level 2: Two-story townhouse
    return (
      <group>
        <mesh material={matMain} position={[0, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.76, 0.68, 0.72]} />
        </mesh>
        {/* Timber facade accent */}
        <mesh material={sharedBuildingMats.resTimber} position={[0, 0.36, 0.37]}>
          <boxGeometry args={[0.5, 0.34, 0.03]} />
        </mesh>
        {/* Upper balcony */}
        <mesh material={sharedBuildingMats.resDarkMetal} position={[0, 0.38, 0.4]}>
          <boxGeometry args={[0.42, 0.08, 0.12]} />
        </mesh>
        <BuildingRoofKit height={0.7} hasSolar={true} lod="NEAR" />
      </group>
    );
  }

  if (safeLevel === 3) {
    // Level 3: Mid-rise apartment block (4 floors)
    return (
      <group>
        <mesh material={matMain} position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.82, 1.08, 0.8]} />
        </mesh>
        {/* Window bands */}
        {[-0.2, 0.1, 0.4].map((y) => (
          <mesh
            key={y}
            material={abandoned ? sharedBuildingMats.windowDark : sharedBuildingMats.resGlassBlue}
            position={[0, y + 0.55, 0.41]}
          >
            <boxGeometry args={[0.68, 0.14, 0.02]} />
          </mesh>
        ))}
        {/* Balconies */}
        {[-0.05, 0.25].map((y) => (
          <mesh key={y} material={sharedBuildingMats.resConcrete} position={[0, y + 0.55, 0.45]}>
            <boxGeometry args={[0.5, 0.06, 0.12]} />
          </mesh>
        ))}
        <BuildingRoofKit height={1.1} hasGreenRoof={true} hasHVAC={true} lod="NEAR" />
      </group>
    );
  }

  if (safeLevel === 4) {
    // Level 4: High-rise contemporary condominium
    return (
      <group>
        <mesh material={matMain} position={[0, 0.8, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.84, 1.58, 0.82]} />
        </mesh>
        {/* Glass corner feature */}
        <mesh material={sharedBuildingMats.resGlassDark} position={[0.26, 0.82, 0.26]}>
          <boxGeometry args={[0.34, 1.52, 0.34]} />
        </mesh>
        <BuildingRoofKit height={1.6} hasGreenRoof={true} hasSolar={true} lod="NEAR" />
      </group>
    );
  }

  // Level 5: Modern tropical luxury residential skyscraper
  return (
    <group>
      {/* Lower podium */}
      <mesh material={sharedBuildingMats.resConcrete} position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.88, 0.58, 0.88]} />
      </mesh>
      {/* Main tower */}
      <mesh material={matMain} position={[0, 1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.74, 1.9, 0.74]} />
      </mesh>
      {/* Sky terrace at mid-height */}
      <mesh material={sharedBuildingMats.roofGreen} position={[0, 1.25, 0.38]}>
        <boxGeometry args={[0.5, 0.06, 0.14]} />
      </mesh>
      <BuildingRoofKit height={2.2} hasGreenRoof={true} hasSolar={true} hasHVAC={true} lod="NEAR" />
    </group>
  );
}
