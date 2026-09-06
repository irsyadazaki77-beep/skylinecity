import React from 'react';
import { sharedBuildingMats, sharedBuildingGeos, BuildingRoofKit, BuildingLod } from './sharedKits';

interface CommercialKitProps {
  level: number;
  abandoned?: boolean;
  lod?: BuildingLod;
}

export function CommercialKit({
  level,
  abandoned = false,
  lod = 'NEAR',
}: CommercialKitProps) {
  const safeLevel = Math.max(1, Math.min(5, level));
  const baseHeight = 0.38 + safeLevel * 0.3;

  const matMain = abandoned
    ? safeLevel === 1
      ? sharedBuildingMats.comL1_abd
      : safeLevel === 2
        ? sharedBuildingMats.comL2_abd
        : safeLevel === 3
          ? sharedBuildingMats.comL3_abd
          : safeLevel === 4
            ? sharedBuildingMats.comL4_abd
            : sharedBuildingMats.comL5_abd
    : safeLevel === 1
      ? sharedBuildingMats.comL1
      : safeLevel === 2
        ? sharedBuildingMats.comL2
        : safeLevel === 3
          ? sharedBuildingMats.comL3
          : safeLevel === 4
            ? sharedBuildingMats.comL4
            : sharedBuildingMats.comL5;

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
        <BuildingRoofKit height={baseHeight + 0.02} lod="MID" />
      </group>
    );
  }

  // NEAR LOD
  if (safeLevel === 1) {
    // Small shophouse / warung / roadside cafe
    return (
      <group>
        <mesh material={matMain} position={[0, 0.22, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, 0.42, 0.74]} />
        </mesh>
        {/* Colorful striped awning */}
        <mesh material={sharedBuildingMats.retailAwningRed} position={[0, 0.24, 0.42]} rotation={[0.22, 0, 0]}>
          <boxGeometry args={[0.82, 0.04, 0.2]} />
        </mesh>
        {/* Glass front window */}
        <mesh material={abandoned ? sharedBuildingMats.windowDark : sharedBuildingMats.glass} position={[0, 0.16, 0.38]}>
          <planeGeometry args={[0.68, 0.24]} />
        </mesh>
      </group>
    );
  }

  if (safeLevel === 2) {
    // 2-story retail store with office above
    return (
      <group>
        <mesh material={matMain} position={[0, 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.82, 0.78, 0.78]} />
        </mesh>
        <mesh material={sharedBuildingMats.retailAwningBlue} position={[0, 0.3, 0.44]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.84, 0.04, 0.2]} />
        </mesh>
        <mesh material={abandoned ? sharedBuildingMats.windowDark : sharedBuildingMats.glass} position={[0, 0.18, 0.4]}>
          <boxGeometry args={[0.74, 0.26, 0.02]} />
        </mesh>
        <BuildingRoofKit height={0.8} lod="NEAR" />
      </group>
    );
  }

  if (safeLevel === 3) {
    // Commercial complex / shopping plaza
    return (
      <group>
        <mesh material={matMain} position={[0, 0.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.84, 1.18, 0.82]} />
        </mesh>
        {/* Prominent glass atrium */}
        <mesh material={sharedBuildingMats.glass} position={[0, 0.6, 0.42]}>
          <boxGeometry args={[0.55, 1.0, 0.04]} />
        </mesh>
        <BuildingRoofKit height={1.2} hasHVAC={true} lod="NEAR" />
      </group>
    );
  }

  if (safeLevel === 4) {
    // Commercial tower with mixed retail podium
    return (
      <group>
        <mesh material={sharedBuildingMats.officeSteel} position={[0, 0.32, 0]} castShadow>
          <boxGeometry args={[0.88, 0.62, 0.88]} />
        </mesh>
        <mesh material={matMain} position={[0, 1.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.76, 1.38, 0.76]} />
        </mesh>
        <mesh material={sharedBuildingMats.officeGlass} position={[0, 1.0, 0.39]}>
          <boxGeometry args={[0.62, 1.25, 0.02]} />
        </mesh>
        <BuildingRoofKit height={1.7} hasHVAC={true} lod="NEAR" />
      </group>
    );
  }

  // Level 5: Mega commercial skyscraper
  return (
    <group>
      <mesh material={sharedBuildingMats.officeBronze} position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.9, 0.68, 0.9]} />
      </mesh>
      <mesh material={matMain} position={[0, 1.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.78, 2.0, 0.78]} />
      </mesh>
      <mesh material={sharedBuildingMats.officeGlass} position={[0, 1.35, 0]}>
        <boxGeometry args={[0.8, 1.9, 0.8]} />
      </mesh>
      <BuildingRoofKit height={2.35} hasHVAC={true} hasSolar={true} lod="NEAR" />
    </group>
  );
}
