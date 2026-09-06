import React from 'react';
import { sharedBuildingMats, sharedBuildingGeos, BuildingRoofKit, BuildingLod } from './sharedKits';

interface OfficeKitProps {
  level: number;
  abandoned?: boolean;
  lod?: BuildingLod;
}

export function OfficeKit({
  level,
  abandoned = false,
  lod = 'NEAR',
}: OfficeKitProps) {
  const safeLevel = Math.max(1, Math.min(5, level));
  const baseHeight = 0.45 + safeLevel * 0.35;

  const matMain = abandoned ? sharedBuildingMats.comL3_abd : sharedBuildingMats.officeSteel;
  const matGlass = abandoned ? sharedBuildingMats.windowDark : sharedBuildingMats.officeGlass;

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
        <mesh material={matGlass} position={[0, baseHeight / 2 + 0.02, 0.44]}>
          <boxGeometry args={[0.7, baseHeight * 0.85, 0.02]} />
        </mesh>
        <BuildingRoofKit height={baseHeight + 0.02} lod="MID" />
      </group>
    );
  }

  // NEAR LOD
  if (safeLevel <= 2) {
    // Low-rise boutique professional office / creative studio
    return (
      <group>
        <mesh material={sharedBuildingMats.officeWhite} position={[0, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.82, 0.82, 0.82]} />
        </mesh>
        <mesh material={matGlass} position={[0, 0.42, 0.42]}>
          <boxGeometry args={[0.72, 0.7, 0.03]} />
        </mesh>
        {/* Steel brise-soleil sunshades */}
        {[-0.2, 0, 0.2].map((x) => (
          <mesh key={x} material={sharedBuildingMats.metal} position={[x, 0.42, 0.44]}>
            <boxGeometry args={[0.04, 0.76, 0.04]} />
          </mesh>
        ))}
        <BuildingRoofKit height={0.84} hasHVAC={true} lod="NEAR" />
      </group>
    );
  }

  if (safeLevel <= 4) {
    // Mid-to-high rise corporate headquarters
    return (
      <group>
        {/* Stone/concrete ground lobby */}
        <mesh material={sharedBuildingMats.resConcrete} position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.86, 0.48, 0.86]} />
        </mesh>
        {/* Glass curtain wall tower */}
        <mesh material={matGlass} position={[0, baseHeight / 2 + 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, baseHeight - 0.2, 0.78]} />
        </mesh>
        {/* Structural vertical mullions */}
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} material={matMain} position={[x, baseHeight / 2 + 0.25, 0]}>
            <boxGeometry args={[0.06, baseHeight - 0.18, 0.8]} />
          </mesh>
        ))}
        <BuildingRoofKit height={baseHeight + 0.15} hasHVAC={true} hasSolar={true} lod="NEAR" />
      </group>
    );
  }

  // Level 5: Prime CBD Financial Skyscraper
  return (
    <group>
      <mesh material={sharedBuildingMats.officeBronze} position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.88, 0.68, 0.88]} />
      </mesh>
      {/* Sleek tapered glass tower */}
      <mesh material={matGlass} position={[0, 1.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.76, 2.2, 0.76]} />
      </mesh>
      {/* Crown / Spire */}
      <mesh material={sharedBuildingMats.metal} position={[0, 2.65, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.12, 0.45, 8]} />
      </mesh>
      <BuildingRoofKit height={2.55} hasHVAC={true} hasSolar={true} lod="NEAR" />
    </group>
  );
}
