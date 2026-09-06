import React from 'react';
import * as THREE from 'three';

// Global shared materials to eliminate memory leaks and draw call overhead
export const sharedBuildingMats = {
  // Residential palette
  resL1: new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.6 }),
  resL1_abd: new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.6 }),
  resL2: new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.5 }),
  resL2_abd: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5 }),
  resL3: new THREE.MeshStandardMaterial({ color: '#047857', roughness: 0.4 }),
  resL3_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4 }),
  resL4: new THREE.MeshStandardMaterial({ color: '#34d399', roughness: 0.3, metalness: 0.3 }),
  resL4_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.3 }),
  resL5: new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.2, metalness: 0.7 }),
  resL5_abd: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.7 }),

  // Commercial palette
  comL1: new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.5 }),
  comL1_abd: new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5 }),
  comL2: new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.4 }),
  comL2_abd: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.4 }),
  comL3: new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.3, metalness: 0.4 }),
  comL3_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.4 }),
  comL4: new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.2, metalness: 0.6 }),
  comL4_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.2, metalness: 0.6 }),
  comL5: new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.1, metalness: 0.8 }),
  comL5_abd: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.1, metalness: 0.8 }),

  // Industrial palette
  indL1: new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.7 }),
  indL1_abd: new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 }),
  indL2: new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.6, metalness: 0.2 }),
  indL2_abd: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.6, metalness: 0.2 }),
  indL3: new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.5, metalness: 0.4 }),
  indL3_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.4 }),
  indL4: new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.3, metalness: 0.6 }),
  indL4_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.6 }),
  indL5: new THREE.MeshStandardMaterial({ color: '#14b8a6', roughness: 0.2, metalness: 0.8 }),
  indL5_abd: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.2, metalness: 0.8 }),

  // Contemporary facades
  resFacadeSand: new THREE.MeshStandardMaterial({ color: '#d6c2a5', roughness: 0.72 }),
  resFacadeWhite: new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.64 }),
  resFacadeClay: new THREE.MeshStandardMaterial({ color: '#b98b72', roughness: 0.7 }),
  resFacadeSlate: new THREE.MeshStandardMaterial({ color: '#52606d', roughness: 0.55, metalness: 0.12 }),
  resFacadeBlue: new THREE.MeshStandardMaterial({ color: '#6f8796', roughness: 0.58, metalness: 0.08 }),
  resConcrete: new THREE.MeshStandardMaterial({ color: '#b8b4ab', roughness: 0.82 }),
  resDarkMetal: new THREE.MeshStandardMaterial({ color: '#44575c', roughness: 0.58, metalness: 0.22 }),
  resTimber: new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: 0.78 }),
  resGlassBlue: new THREE.MeshStandardMaterial({ color: '#8fb9c9', emissive: '#4fd1c5', emissiveIntensity: 0, roughness: 0.15, metalness: 0.72, transparent: true, opacity: 0.82 }),
  resGlassDark: new THREE.MeshStandardMaterial({ color: '#294454', emissive: '#38bdf8', emissiveIntensity: 0, roughness: 0.16, metalness: 0.8, transparent: true, opacity: 0.88 }),
  resPaving: new THREE.MeshStandardMaterial({ color: '#a8a29e', roughness: 0.92 }),
  resGrass: new THREE.MeshStandardMaterial({ color: '#5f8b63', roughness: 0.95 }),
  resShrub: new THREE.MeshStandardMaterial({ color: '#356b4a', roughness: 0.9 }),
  resSolar: new THREE.MeshStandardMaterial({ color: '#1e3a5f', roughness: 0.24, metalness: 0.75 }),

  // Industrial campus palette
  indFacadeWhite: new THREE.MeshStandardMaterial({ color: '#d7dee2', roughness: 0.72 }),
  indFacadeSteel: new THREE.MeshStandardMaterial({ color: '#71808a', roughness: 0.48, metalness: 0.55 }),
  indFacadeTeal: new THREE.MeshStandardMaterial({ color: '#2f7d82', roughness: 0.4, metalness: 0.25 }),
  indFacadeBlue: new THREE.MeshStandardMaterial({ color: '#3e6f8f', roughness: 0.45, metalness: 0.3 }),
  indConcrete: new THREE.MeshStandardMaterial({ color: '#a8b0b2', roughness: 0.88 }),
  indGlass: new THREE.MeshStandardMaterial({ color: '#7ab7c5', emissive: '#22d3ee', emissiveIntensity: 0, roughness: 0.12, metalness: 0.78, transparent: true, opacity: 0.84 }),
  indSafety: new THREE.MeshStandardMaterial({ color: '#e0a43a', roughness: 0.58, metalness: 0.24 }),

  // Office & Commercial palette
  officeGlass: new THREE.MeshStandardMaterial({ color: '#7dd3fc', roughness: 0.1, metalness: 0.85, transparent: true, opacity: 0.88 }),
  officeSteel: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.35, metalness: 0.75 }),
  officeBronze: new THREE.MeshStandardMaterial({ color: '#78543d', roughness: 0.45, metalness: 0.4 }),
  officeWhite: new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.6 }),
  retailAwningRed: new THREE.MeshStandardMaterial({ color: '#be123c', roughness: 0.7 }),
  retailAwningBlue: new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.7 }),

  // Shared elements
  roof: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 }),
  roofGreen: new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.7 }),
  brick: new THREE.MeshStandardMaterial({ color: '#9a3412', roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8, roughness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({ color: '#93c5fd', roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 }),
  water: new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.1, metalness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 }),
  window: new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#fde047', emissiveIntensity: 0, roughness: 0.2 }),
  windowCyan: new THREE.MeshStandardMaterial({ color: '#a5f3fc', emissive: '#38bdf8', emissiveIntensity: 0, roughness: 0.2 }),
  windowDark: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4 }),
};

// Global shared reusable geometries
export const sharedBuildingGeos = {
  farMass: new THREE.BoxGeometry(0.88, 1, 0.88),
  midMass: new THREE.BoxGeometry(0.86, 1, 0.86),
  roofParapet: new THREE.BoxGeometry(0.9, 0.06, 0.9),
  windowPanel: new THREE.PlaneGeometry(0.24, 0.32),
  balconyBox: new THREE.BoxGeometry(0.5, 0.08, 0.2),
  hvacBox: new THREE.BoxGeometry(0.18, 0.12, 0.18),
  solarPanel: new THREE.BoxGeometry(0.36, 0.025, 0.24),
  waterTank: new THREE.CylinderGeometry(0.14, 0.14, 0.22, 10),
};

export type BuildingLod = 'NEAR' | 'MID' | 'FAR';

/**
 * Shared building rooftop kit providing realistic mechanical penthouses,
 * AC chillers, and tropical rooftop gardens.
 */
export function BuildingRoofKit({
  roofType: _roofType = 'FLAT',
  hasGreenRoof = false,
  hasSolar = false,
  hasHVAC = true,
  height = 1.0,
  lod = 'NEAR',
}: {
  roofType?: 'FLAT' | 'HIPPED' | 'TERRACE';
  hasGreenRoof?: boolean;
  hasSolar?: boolean;
  hasHVAC?: boolean;
  height?: number;
  lod?: BuildingLod;
}) {
  if (lod === 'FAR') return null;

  return (
    <group position={[0, height, 0]}>
      {/* Roof Surface */}
      <mesh
        material={hasGreenRoof ? sharedBuildingMats.roofGreen : sharedBuildingMats.roof}
        position={[0, 0.02, 0]}
        receiveShadow
      >
        <boxGeometry args={[0.82, 0.04, 0.82]} />
      </mesh>

      {/* Roof Parapet */}
      <mesh material={sharedBuildingMats.resConcrete} position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.86, 0.06, 0.86]} />
      </mesh>

      {/* Near LOD Props */}
      {lod === 'NEAR' && (
        <>
          {hasHVAC && (
            <mesh
              geometry={sharedBuildingGeos.hvacBox}
              material={sharedBuildingMats.metal}
              position={[-0.22, 0.12, -0.2]}
              castShadow
            />
          )}
          {hasSolar && (
            <mesh
              geometry={sharedBuildingGeos.solarPanel}
              material={sharedBuildingMats.resSolar}
              position={[0.2, 0.08, 0.18]}
              rotation={[0.15, 0, 0]}
              castShadow
            />
          )}
        </>
      )}
    </group>
  );
}

/**
 * Shared ground floor kit with commercial shopfront awnings,
 * residential porches, or loading bays.
 */
export function BuildingGroundFloorKit({
  type,
  lod = 'NEAR',
}: {
  type: 'RESIDENTIAL' | 'COMMERCIAL' | 'OFFICE' | 'INDUSTRIAL';
  lod?: BuildingLod;
}) {
  if (lod === 'FAR') return null;

  if (type === 'COMMERCIAL') {
    return (
      <group position={[0, 0.15, 0]}>
        {/* Glass shopfront */}
        <mesh material={sharedBuildingMats.glass} position={[0, 0, 0.42]}>
          <boxGeometry args={[0.76, 0.28, 0.04]} />
        </mesh>
        {/* Awning */}
        <mesh material={sharedBuildingMats.retailAwningRed} position={[0, 0.2, 0.46]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.82, 0.03, 0.18]} />
        </mesh>
      </group>
    );
  }

  if (type === 'INDUSTRIAL') {
    return (
      <group position={[0, 0.15, 0]}>
        {/* Loading shutter */}
        <mesh material={sharedBuildingMats.indFacadeSteel} position={[0, 0, 0.42]}>
          <boxGeometry args={[0.5, 0.28, 0.03]} />
        </mesh>
        <mesh material={sharedBuildingMats.indSafety} position={[0, 0.16, 0.43]}>
          <boxGeometry args={[0.54, 0.04, 0.02]} />
        </mesh>
      </group>
    );
  }

  // Residential porch
  return (
    <group position={[0, 0.1, 0]}>
      <mesh material={sharedBuildingMats.resConcrete} position={[0, -0.05, 0.38]}>
        <boxGeometry args={[0.4, 0.08, 0.2]} />
      </mesh>
    </group>
  );
}
