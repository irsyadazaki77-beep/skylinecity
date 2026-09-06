import React from 'react';
import { sharedBuildingMats } from './sharedKits';
import { ConstructionStage } from '../../../constructionPresentation';

interface ConstructionKitProps {
  stage: ConstructionStage;
  level?: number;
  type?: string;
}

export function ConstructionKit({
  stage,
  level = 1,
  type = 'RESIDENTIAL',
}: ConstructionKitProps) {
  const safeLevel = Math.max(1, Math.min(5, level));

  if (stage === 'SITE_PREPARATION' || stage === 'PREPARATION') {
    // Bulldozed ground, survey stakes and gravel base
    return (
      <group name="Construction-SitePrep">
        <mesh material={sharedBuildingMats.resPaving} position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[0.92, 0.04, 0.92]} />
        </mesh>
        {/* Survey stakes */}
        {[
          [-0.38, -0.38],
          [0.38, -0.38],
          [-0.38, 0.38],
          [0.38, 0.38],
        ].map(([x, z]) => (
          <mesh key={`${x}-${z}`} material={sharedBuildingMats.indSafety} position={[x, 0.12, z]}>
            <cylinderGeometry args={[0.015, 0.015, 0.22, 6]} />
          </mesh>
        ))}
      </group>
    );
  }

  if (stage === 'FOUNDATION') {
    // Poured concrete slab, rebar mesh, gravel border
    return (
      <group name="Construction-Foundation">
        <mesh material={sharedBuildingMats.resPaving} position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[0.92, 0.04, 0.92]} />
        </mesh>
        <mesh material={sharedBuildingMats.resConcrete} position={[0, 0.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, 0.12, 0.74]} />
        </mesh>
        {/* Vertical starter rebar pins */}
        {[-0.3, 0.3].flatMap((x) =>
          [-0.28, 0.28].map((z) => (
            <mesh key={`${x}-${z}`} material={sharedBuildingMats.metal} position={[x, 0.2, z]}>
              <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
            </mesh>
          )),
        )}
      </group>
    );
  }

  if (stage === 'FRAME') {
    // Structural steel/concrete columns, floor slabs, perimeter safety netting
    return (
      <group name="Construction-Frame">
        <mesh material={sharedBuildingMats.resConcrete} position={[0, 0.06, 0]} castShadow>
          <boxGeometry args={[0.8, 0.1, 0.76]} />
        </mesh>
        {/* Structural vertical columns */}
        {[-0.32, 0.32].flatMap((x) =>
          [-0.3, 0.3].map((z) => (
            <mesh
              key={`${x}-${z}`}
              material={sharedBuildingMats.resDarkMetal}
              position={[x, 0.45 + safeLevel * 0.08, z]}
              castShadow
            >
              <boxGeometry args={[0.04, 0.8 + safeLevel * 0.16, 0.04]} />
            </mesh>
          )),
        )}
        {/* Floor slabs */}
        {[0.3, 0.6 + safeLevel * 0.1].map((h) => (
          <mesh key={h} material={sharedBuildingMats.resConcrete} position={[0, h, 0]}>
            <boxGeometry args={[0.76, 0.04, 0.72]} />
          </mesh>
        ))}
        {/* Safety barrier */}
        <mesh material={sharedBuildingMats.indSafety} position={[0, 0.15, 0.38]}>
          <boxGeometry args={[0.78, 0.03, 0.02]} />
        </mesh>
      </group>
    );
  }

  if (stage === 'STRUCTURE') {
    // Solid core, structural framing, exterior walls taking shape
    return (
      <group name="Construction-Structure">
        <mesh material={sharedBuildingMats.resConcrete} position={[0, 0.45 + safeLevel * 0.05, 0]} castShadow>
          <boxGeometry args={[0.72, 0.8 + safeLevel * 0.12, 0.68]} />
        </mesh>
        {/* External scaffolding cage */}
        <mesh material={sharedBuildingMats.metal} position={[0, 0.5 + safeLevel * 0.05, 0.38]}>
          <boxGeometry args={[0.82, 0.9 + safeLevel * 0.12, 0.06]} />
        </mesh>
        <mesh material={sharedBuildingMats.indSafety} position={[0.36, 0.5, 0.38]}>
          <cylinderGeometry args={[0.02, 0.02, 0.9, 6]} />
        </mesh>
      </group>
    );
  }

  if (stage === 'FACADE' || stage === 'RENOVATING') {
    // Building structure nearly full size, partial facade panels & scaffolding
    return (
      <group name={`Construction-${stage}`}>
        <mesh material={sharedBuildingMats.resConcrete} position={[0, 0.5 + safeLevel * 0.1, 0]} castShadow>
          <boxGeometry args={[0.78, 0.92 + safeLevel * 0.18, 0.74]} />
        </mesh>
        {/* Scaffolding and safety netting covering facade */}
        <mesh material={sharedBuildingMats.indSafety} position={[0, 0.52 + safeLevel * 0.1, 0.39]}>
          <boxGeometry args={[0.82, 0.88 + safeLevel * 0.16, 0.03]} />
        </mesh>
        <mesh material={sharedBuildingMats.metal} position={[-0.38, 0.52 + safeLevel * 0.1, 0.39]}>
          <cylinderGeometry args={[0.02, 0.02, 0.9 + safeLevel * 0.16, 6]} />
        </mesh>
        <mesh material={sharedBuildingMats.metal} position={[0.38, 0.52 + safeLevel * 0.1, 0.39]}>
          <cylinderGeometry args={[0.02, 0.02, 0.9 + safeLevel * 0.16, 6]} />
        </mesh>
      </group>
    );
  }

  if (stage === 'FINISHING') {
    // Exterior finished, window glazing in, interior lights and clean up
    return (
      <group name="Construction-Finishing">
        <mesh
          material={type === 'INDUSTRIAL' ? sharedBuildingMats.indFacadeSteel : sharedBuildingMats.resFacadeSand}
          position={[0, 0.5 + safeLevel * 0.1, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.8, 0.95 + safeLevel * 0.18, 0.76]} />
        </mesh>
        {/* Final safety tape / site fences at entrance */}
        <mesh material={sharedBuildingMats.indSafety} position={[0, 0.12, 0.42]}>
          <boxGeometry args={[0.5, 0.04, 0.02]} />
        </mesh>
      </group>
    );
  }

  return null;
}
