import React, { useEffect } from 'react';
import * as THREE from 'three';
import { TileData, TileType } from '../../types';
import { gridToWorld } from './types3D';
import { BuildingFootprint } from '../../urbanForm';

// Global shared materials to prevent massive memory leaks and draw call overhead
const sharedMats = {
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

  roof: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 }),
  roofGreen: new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.7 }),
  brick: new THREE.MeshStandardMaterial({ color: '#9a3412', roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8, roughness: 0.3 }),
  glass: new THREE.MeshStandardMaterial({ color: '#93c5fd', roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.85 }),
  water: new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.1, metalness: 0.5 }),

  window: new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#fde047', emissiveIntensity: 0, roughness: 0.2 }),
  window_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', emissive: '#000000', emissiveIntensity: 0, roughness: 0.2 }),

  windowCyan: new THREE.MeshStandardMaterial({ color: '#a5f3fc', emissive: '#38bdf8', emissiveIntensity: 0, roughness: 0.2 }),
  windowCyan_abd: new THREE.MeshStandardMaterial({ color: '#1e293b', emissive: '#000000', emissiveIntensity: 0, roughness: 0.2 }),

  redAlert: new THREE.MeshBasicMaterial({ color: '#ef4444' }),
  white: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 }),
  redCross: new THREE.MeshBasicMaterial({ color: '#dc2626' }),

  // Contemporary residential palette: warm neutral facades, dark metal,
  // timber accents, and restrained glass instead of a single neon-green
  // material repeated across every house.
  resFacadeSand: new THREE.MeshStandardMaterial({ color: '#d6c2a5', roughness: 0.72 }),
  resFacadeWhite: new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.64 }),
  resFacadeClay: new THREE.MeshStandardMaterial({ color: '#b98b72', roughness: 0.7 }),
  resFacadeSlate: new THREE.MeshStandardMaterial({ color: '#52606d', roughness: 0.55, metalness: 0.12 }),
  resFacadeBlue: new THREE.MeshStandardMaterial({ color: '#6f8796', roughness: 0.58, metalness: 0.08 }),
  resConcrete: new THREE.MeshStandardMaterial({ color: '#b8b4ab', roughness: 0.82 }),
  resDarkMetal: new THREE.MeshStandardMaterial({ color: '#26313a', roughness: 0.38, metalness: 0.72 }),
  resTimber: new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: 0.78 }),
  resGlassBlue: new THREE.MeshStandardMaterial({ color: '#8fb9c9', emissive: '#4fd1c5', emissiveIntensity: 0, roughness: 0.15, metalness: 0.72, transparent: true, opacity: 0.82 }),
  resGlassDark: new THREE.MeshStandardMaterial({ color: '#294454', emissive: '#38bdf8', emissiveIntensity: 0, roughness: 0.16, metalness: 0.8, transparent: true, opacity: 0.88 }),
  resPaving: new THREE.MeshStandardMaterial({ color: '#a8a29e', roughness: 0.92 }),
  resGrass: new THREE.MeshStandardMaterial({ color: '#5f8b63', roughness: 0.95 }),
  resShrub: new THREE.MeshStandardMaterial({ color: '#356b4a', roughness: 0.9 }),
  resSolar: new THREE.MeshStandardMaterial({ color: '#1e3a5f', roughness: 0.24, metalness: 0.75 }),

  // Clean contemporary industrial campus palette: precast panels, teal
  // glass, blue logistics doors, and restrained safety accents.
  indFacadeWhite: new THREE.MeshStandardMaterial({ color: '#d7dee2', roughness: 0.72 }),
  indFacadeSteel: new THREE.MeshStandardMaterial({ color: '#71808a', roughness: 0.48, metalness: 0.55 }),
  indFacadeTeal: new THREE.MeshStandardMaterial({ color: '#2f7d82', roughness: 0.4, metalness: 0.25 }),
  indFacadeBlue: new THREE.MeshStandardMaterial({ color: '#3e6f8f', roughness: 0.45, metalness: 0.3 }),
  indConcrete: new THREE.MeshStandardMaterial({ color: '#a8b0b2', roughness: 0.88 }),
  indGlass: new THREE.MeshStandardMaterial({ color: '#7ab7c5', emissive: '#22d3ee', emissiveIntensity: 0, roughness: 0.12, metalness: 0.78, transparent: true, opacity: 0.84 }),
  indSafety: new THREE.MeshStandardMaterial({ color: '#e0a43a', roughness: 0.58, metalness: 0.24 }),
};

function residentialVariant(tile: TileData): number {
  // Stable variation is essential: the same save must render the same city,
  // but adjacent parcels should not all share one blueprint.
  let hash = (tile.x * 374761393 + tile.y * 668265263 + tile.level * 1442695041) | 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) & 7;
}

function ModernResidentialBuilding({ level, variant, abandoned, frontageRotation = 0 }: { level: number; variant: number; abandoned: boolean; frontageRotation?: number }) {
  const facadeOptions = [sharedMats.resFacadeSand, sharedMats.resFacadeWhite, sharedMats.resFacadeClay, sharedMats.resFacadeSlate, sharedMats.resFacadeBlue];
  const facade = abandoned ? sharedMats.resL1_abd : facadeOptions[variant % facadeOptions.length];
  const facadeAlt = abandoned ? sharedMats.resL2_abd : facadeOptions[(variant + 2) % facadeOptions.length];
  const glass = abandoned ? sharedMats.window_abd : (variant % 2 === 0 ? sharedMats.resGlassBlue : sharedMats.resGlassDark);
  const angle = (variant % 4) * Math.PI / 2;

  const lot = (
    <group>
      <mesh material={sharedMats.resGrass} position={[0, 0.025, 0]} receiveShadow>
        <boxGeometry args={[0.9, 0.05, 0.9]} />
      </mesh>
      <mesh material={sharedMats.resPaving} position={[variant % 2 === 0 ? 0.28 : -0.28, 0.058, 0.28]} receiveShadow>
        <boxGeometry args={[0.18, 0.025, 0.38]} />
      </mesh>
      <mesh material={sharedMats.resShrub} position={[-0.34, 0.12, -0.3]} castShadow>
        <sphereGeometry args={[0.09, 7, 5]} />
      </mesh>
      <mesh material={sharedMats.resShrub} position={[0.34, 0.11, -0.29]} castShadow>
        <sphereGeometry args={[0.075, 7, 5]} />
      </mesh>
    </group>
  );

  const frontWindow = (x: number, y: number, width = 0.15, height = 0.13) => (
    <mesh key={`window-${x}-${y}`} material={glass} position={[x, y, 0.31]}>
      <boxGeometry args={[width, height, 0.018]} />
    </mesh>
  );

  if (level === 1) {
    return (
      <group rotation={[0, frontageRotation + angle, 0]}>
        {lot}
        {variant % 6 === 0 && (
          <group>
            <mesh material={facade} position={[0, 0.25, 0]} castShadow receiveShadow><boxGeometry args={[0.58, 0.42, 0.5]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[0, 0.49, 0]}><boxGeometry args={[0.64, 0.055, 0.56]} /></mesh>
            <mesh material={facadeAlt} position={[0.12, 0.52, -0.02]} castShadow><boxGeometry args={[0.27, 0.16, 0.3]} /></mesh>
            {frontWindow(-0.16, 0.25, 0.14, 0.15)}
            {frontWindow(0.16, 0.25, 0.12, 0.12)}
          </group>
        )}
        {variant % 6 === 1 && (
          <group>
            <mesh material={facade} position={[-0.16, 0.24, 0]} castShadow receiveShadow><boxGeometry args={[0.32, 0.4, 0.52]} /></mesh>
            <mesh material={facadeAlt} position={[0.13, 0.2, -0.08]} castShadow><boxGeometry args={[0.35, 0.32, 0.34]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[-0.16, 0.48, 0]}><boxGeometry args={[0.38, 0.05, 0.58]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[0.13, 0.39, -0.08]}><boxGeometry args={[0.42, 0.05, 0.4]} /></mesh>
            {frontWindow(-0.16, 0.25, 0.15, 0.15)}
            {frontWindow(0.13, 0.2, 0.16, 0.1)}
          </group>
        )}
        {variant % 6 === 2 && (
          <group>
            {[-0.22, 0, 0.22].map((x) => <mesh key={x} material={facade} position={[x, 0.23, 0]} castShadow receiveShadow><boxGeometry args={[0.2, 0.38, 0.5]} /></mesh>)}
            <mesh material={sharedMats.resTimber} position={[0, 0.47, 0.01]}><boxGeometry args={[0.72, 0.055, 0.54]} /></mesh>
            {[-0.22, 0, 0.22].map((x) => frontWindow(x, 0.24, 0.12, 0.14))}
          </group>
        )}
        {variant % 6 === 3 && (
          <group>
            <mesh material={facade} position={[0, 0.25, 0]} castShadow receiveShadow><boxGeometry args={[0.6, 0.42, 0.5]} /></mesh>
            <mesh material={facadeAlt} position={[0.04, 0.5, 0]} rotation={[0, 0, -0.08]} castShadow><boxGeometry args={[0.67, 0.08, 0.56]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[-0.22, 0.31, 0.27]}><boxGeometry args={[0.12, 0.18, 0.02]} /></mesh>
            {frontWindow(0.13, 0.26, 0.2, 0.16)}
          </group>
        )}
        {variant % 6 === 4 && (
          <group>
            <mesh material={sharedMats.resGlassDark} position={[0, 0.26, 0]} castShadow receiveShadow><boxGeometry args={[0.56, 0.44, 0.48]} /></mesh>
            <mesh material={facade} position={[-0.24, 0.25, 0]} castShadow><boxGeometry args={[0.12, 0.42, 0.52]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[0, 0.51, 0]}><boxGeometry args={[0.64, 0.055, 0.56]} /></mesh>
            <mesh material={sharedMats.resSolar} position={[0.18, 0.55, 0.02]} rotation={[0.18, 0, 0]}><boxGeometry args={[0.2, 0.02, 0.3]} /></mesh>
          </group>
        )}
        {variant % 6 === 5 && (
          <group>
            <mesh material={facade} position={[-0.24, 0.24, 0]} castShadow receiveShadow><boxGeometry args={[0.18, 0.4, 0.48]} /></mesh>
            <mesh material={facadeAlt} position={[0.24, 0.24, 0]} castShadow receiveShadow><boxGeometry args={[0.18, 0.4, 0.48]} /></mesh>
            <mesh material={sharedMats.resTimber} position={[0, 0.46, 0]}><boxGeometry args={[0.7, 0.06, 0.54]} /></mesh>
            <mesh material={glass} position={[0, 0.24, 0.26]}><boxGeometry args={[0.17, 0.2, 0.018]} /></mesh>
          </group>
        )}
      </group>
    );
  }

  if (level === 2) {
    const floors = variant % 3 === 0 ? 2 : 3;
    return (
      <group rotation={[0, frontageRotation + angle, 0]}>
        {lot}
        {variant % 3 === 0 && (
          <group>
            <mesh material={facade} position={[-0.19, 0.48, 0]} castShadow receiveShadow><boxGeometry args={[0.33, 0.86, 0.58]} /></mesh>
            <mesh material={facadeAlt} position={[0.19, 0.44, 0]} castShadow receiveShadow><boxGeometry args={[0.33, 0.78, 0.58]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[0, 0.92, 0]}><boxGeometry args={[0.72, 0.06, 0.64]} /></mesh>
            {[-0.19, 0.19].map((x) => frontWindow(x, 0.52, 0.15, 0.17))}
            {[-0.19, 0.19].map((x) => frontWindow(x, 0.78, 0.15, 0.17))}
          </group>
        )}
        {variant % 3 === 1 && (
          <group>
            <mesh material={facade} position={[0, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[0.65, 0.95, 0.58]} /></mesh>
            <mesh material={sharedMats.resConcrete} position={[0.13, 1.03, 0]} castShadow><boxGeometry args={[0.37, 0.1, 0.6]} /></mesh>
            <mesh material={glass} position={[0, 0.53, 0.31]}><boxGeometry args={[0.42, 0.58, 0.018]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[0, 1.08, 0]}><boxGeometry args={[0.72, 0.06, 0.64]} /></mesh>
            <mesh material={sharedMats.resSolar} position={[-0.2, 1.12, 0]} rotation={[0.16, 0, 0]}><boxGeometry args={[0.2, 0.02, 0.28]} /></mesh>
          </group>
        )}
        {variant % 3 === 2 && (
          <group>
            <mesh material={facadeAlt} position={[-0.18, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[0.28, 0.98, 0.6]} /></mesh>
            <mesh material={facade} position={[0.16, 0.42, 0]} castShadow receiveShadow><boxGeometry args={[0.36, 0.78, 0.56]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[-0.18, 1.04, 0]}><boxGeometry args={[0.34, 0.05, 0.66]} /></mesh>
            <mesh material={sharedMats.resTimber} position={[0.16, 0.84, 0.3]}><boxGeometry args={[0.28, 0.04, 0.12]} /></mesh>
            {[-0.18, 0.16].map((x) => frontWindow(x, 0.53, 0.13, 0.16))}
            {[-0.18, 0.16].map((x) => frontWindow(x, 0.78, 0.13, 0.16))}
          </group>
        )}
        {floors > 2 && <mesh material={glass} position={[0, 0.9, 0.305]}><boxGeometry args={[0.42, 0.22, 0.018]} /></mesh>}
      </group>
    );
  }

  const towerHeight = level === 3 ? 1.35 : level === 4 ? 1.9 : 2.55;
  const towerWidth = level === 3 ? 0.68 : level === 4 ? 0.73 : 0.62;
  const balconyCount = level === 3 ? 2 : level === 4 ? 3 : 4;
  return (
    <group rotation={[0, frontageRotation + angle, 0]}>
      {lot}
      {variant % 3 === 0 ? (
        <group>
          <mesh material={facade} position={[0, towerHeight / 2 + 0.08, 0]} castShadow receiveShadow><boxGeometry args={[towerWidth, towerHeight, 0.62]} /></mesh>
          <mesh material={glass} position={[0, towerHeight / 2 + 0.1, 0.316]}><boxGeometry args={[towerWidth * 0.66, towerHeight * 0.82, 0.018]} /></mesh>
        </group>
      ) : variant % 3 === 1 ? (
        <group>
          <mesh material={facadeAlt} position={[-0.16, towerHeight / 2 + 0.08, 0]} castShadow receiveShadow><boxGeometry args={[towerWidth * 0.55, towerHeight, 0.6]} /></mesh>
          <mesh material={facade} position={[0.18, towerHeight / 2 + 0.02, 0]} castShadow receiveShadow><boxGeometry args={[towerWidth * 0.38, towerHeight * 0.88, 0.54]} /></mesh>
          <mesh material={glass} position={[-0.16, towerHeight / 2 + 0.1, 0.31]}><boxGeometry args={[towerWidth * 0.4, towerHeight * 0.78, 0.018]} /></mesh>
        </group>
      ) : (
        <group>
          <mesh material={sharedMats.resConcrete} position={[0, towerHeight / 2 + 0.08, 0]} castShadow receiveShadow><boxGeometry args={[towerWidth, towerHeight, 0.62]} /></mesh>
          <mesh material={facade} position={[0, towerHeight * 0.42, 0.325]} castShadow><boxGeometry args={[towerWidth * 0.72, towerHeight * 0.18, 0.035]} /></mesh>
          <mesh material={glass} position={[0, towerHeight * 0.7, 0.325]}><boxGeometry args={[towerWidth * 0.58, towerHeight * 0.2, 0.018]} /></mesh>
        </group>
      )}
      {Array.from({ length: balconyCount }).map((_, index) => (
        <mesh key={`balcony-${index}`} material={sharedMats.resDarkMetal} position={[variant % 2 === 0 ? 0.2 : -0.2, 0.38 + index * (towerHeight / (balconyCount + 1)), 0.36]}>
          <boxGeometry args={[0.22, 0.035, 0.16]} />
        </mesh>
      ))}
      <mesh material={level === 5 ? sharedMats.resGlassDark : sharedMats.resDarkMetal} position={[0, towerHeight + 0.18, 0]} castShadow>
        <boxGeometry args={[towerWidth * 0.78, 0.08, 0.68]} />
      </mesh>
      {level >= 4 && <mesh material={sharedMats.resSolar} position={[0.12, towerHeight + 0.24, 0]} rotation={[0.14, 0, 0]}><boxGeometry args={[0.25, 0.025, 0.32]} /></mesh>}
    </group>
  );
}

function commercialVariant(tile: TileData): number {
  let hash = (tile.x * 1103515245 + tile.y * 12345 + tile.level * 2654435761) | 0;
  hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
  return (hash ^ (hash >>> 13)) & 7;
}

function ModernCommercialBuilding({ level, variant, abandoned, frontageRotation = 0 }: { level: number; variant: number; abandoned: boolean; frontageRotation?: number }) {
  const body = abandoned ? sharedMats.comL1_abd : [sharedMats.comL1, sharedMats.comL2, sharedMats.comL3, sharedMats.comL4][variant % 4];
  const bodyAlt = abandoned ? sharedMats.comL2_abd : [sharedMats.comL2, sharedMats.comL3, sharedMats.comL4, sharedMats.comL5][(variant + 1) % 4];
  const glass = abandoned ? sharedMats.window_abd : (variant % 2 === 0 ? sharedMats.windowCyan : sharedMats.resGlassBlue);
  const angle = (variant % 4) * Math.PI / 2;

  const paving = (
    <group>
      <mesh material={sharedMats.resPaving} position={[0, 0.025, 0]} receiveShadow><boxGeometry args={[0.92, 0.05, 0.92]} /></mesh>
      <mesh material={sharedMats.resGrass} position={[variant % 2 === 0 ? -0.34 : 0.34, 0.058, -0.28]} receiveShadow><boxGeometry args={[0.18, 0.025, 0.3]} /></mesh>
      <mesh material={sharedMats.resShrub} position={[variant % 2 === 0 ? -0.34 : 0.34, 0.14, -0.28]} castShadow><sphereGeometry args={[0.09, 7, 5]} /></mesh>
    </group>
  );

  if (level === 1) {
    return (
      <group rotation={[0, frontageRotation + angle, 0]}>
        {paving}
        {variant % 4 === 0 && (
          <group>
            <mesh material={body} position={[0, 0.24, 0]} castShadow receiveShadow><boxGeometry args={[0.68, 0.44, 0.58]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[0, 0.49, 0.02]}><boxGeometry args={[0.76, 0.06, 0.66]} /></mesh>
            <mesh material={glass} position={[0, 0.2, 0.31]}><boxGeometry args={[0.5, 0.22, 0.018]} /></mesh>
            <mesh material={sharedMats.resTimber} position={[0, 0.35, 0.36]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.62, 0.035, 0.16]} /></mesh>
          </group>
        )}
        {variant % 4 === 1 && (
          <group>
            <mesh material={bodyAlt} position={[-0.2, 0.22, 0]} castShadow receiveShadow><boxGeometry args={[0.3, 0.4, 0.58]} /></mesh>
            <mesh material={body} position={[0.18, 0.27, 0]} castShadow receiveShadow><boxGeometry args={[0.34, 0.5, 0.58]} /></mesh>
            <mesh material={glass} position={[0.18, 0.25, 0.31]}><boxGeometry args={[0.26, 0.26, 0.018]} /></mesh>
            <mesh material={sharedMats.comL5} position={[-0.2, 0.24, 0.31]}><boxGeometry args={[0.22, 0.18, 0.018]} /></mesh>
          </group>
        )}
        {variant % 4 === 2 && (
          <group>
            <mesh material={sharedMats.resGlassDark} position={[0, 0.26, 0]} castShadow receiveShadow><boxGeometry args={[0.62, 0.48, 0.56]} /></mesh>
            <mesh material={body} position={[-0.3, 0.27, 0]} castShadow><boxGeometry args={[0.08, 0.5, 0.62]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[0, 0.53, 0]}><boxGeometry args={[0.7, 0.06, 0.64]} /></mesh>
          </group>
        )}
        {variant % 4 === 3 && (
          <group>
            <mesh material={body} position={[-0.18, 0.25, 0]} castShadow receiveShadow><boxGeometry args={[0.34, 0.46, 0.56]} /></mesh>
            <mesh material={bodyAlt} position={[0.18, 0.2, -0.08]} castShadow receiveShadow><boxGeometry args={[0.32, 0.36, 0.38]} /></mesh>
            <mesh material={glass} position={[-0.18, 0.22, 0.3]}><boxGeometry args={[0.24, 0.2, 0.018]} /></mesh>
            <mesh material={sharedMats.resDarkMetal} position={[0.18, 0.41, -0.08]}><boxGeometry args={[0.38, 0.04, 0.44]} /></mesh>
          </group>
        )}
      </group>
    );
  }

  const height = level === 2 ? 0.9 : level === 3 ? 1.45 : level === 4 ? 2.2 : 3.05;
  return (
    <group rotation={[0, frontageRotation + angle, 0]}>
      {paving}
      {variant % 3 === 0 ? (
        <group>
          <mesh material={body} position={[0, height / 2 + 0.06, 0]} castShadow receiveShadow><boxGeometry args={[0.7, height, 0.62]} /></mesh>
          <mesh material={glass} position={[0, height * 0.52, 0.321]}><boxGeometry args={[0.48, height * 0.6, 0.018]} /></mesh>
        </group>
      ) : variant % 3 === 1 ? (
        <group>
          <mesh material={bodyAlt} position={[-0.18, height / 2 + 0.06, 0]} castShadow receiveShadow><boxGeometry args={[0.34, height, 0.62]} /></mesh>
          <mesh material={body} position={[0.19, height * 0.44, 0]} castShadow receiveShadow><boxGeometry args={[0.32, height * 0.82, 0.58]} /></mesh>
          <mesh material={sharedMats.resGlassDark} position={[-0.18, height * 0.55, 0.321]}><boxGeometry args={[0.2, height * 0.58, 0.018]} /></mesh>
        </group>
      ) : (
        <group>
          <mesh material={sharedMats.resConcrete} position={[0, height / 2 + 0.06, 0]} castShadow receiveShadow><boxGeometry args={[0.72, height, 0.64]} /></mesh>
          {Array.from({ length: Math.max(2, Math.round(height * 1.6)) }).map((_, index) => (
            <mesh key={`storey-window-${index}`} material={glass} position={[0, 0.28 + index * 0.32, 0.33]}><boxGeometry args={[0.52, 0.12, 0.018]} /></mesh>
          ))}
        </group>
      )}
      <mesh material={level >= 4 ? sharedMats.comL5 : sharedMats.resDarkMetal} position={[0, height + 0.16, 0]} castShadow><boxGeometry args={[0.78, 0.08, 0.7]} /></mesh>
      {level >= 3 && <mesh material={sharedMats.resSolar} position={[0.18, height + 0.22, 0]} rotation={[0.12, 0, 0]}><boxGeometry args={[0.22, 0.025, 0.3]} /></mesh>}
    </group>
  );
}

function ModernMixedUseBuilding({ level, variant, abandoned, program = 'RETAIL_LIVING', frontageRotation = 0 }: { level: number; variant: number; abandoned: boolean; program?: TileData['mixedUseProgram']; frontageRotation?: number }) {
  const isOffice = program === 'CREATIVE_OFFICE';
  const isHospitality = program === 'HOSPITALITY';
  const isCommunity = program === 'COMMUNITY_HUB';
  const podium = abandoned
    ? sharedMats.comL1_abd
    : isCommunity ? sharedMats.resConcrete : isOffice ? sharedMats.comL4 : sharedMats.comL3;
  const upper = abandoned
    ? sharedMats.resL2_abd
    : isOffice
      ? sharedMats.comL4
      : isHospitality
        ? sharedMats.resFacadeClay
        : [sharedMats.resFacadeWhite, sharedMats.resFacadeSand, sharedMats.resFacadeBlue][variant % 3];
  const glass = abandoned ? sharedMats.window_abd : isOffice ? sharedMats.resGlassDark : sharedMats.resGlassBlue;
  const upperHeight = level >= 4 ? 1.18 : level >= 3 ? 0.92 : 0.72;

  return (
    <group rotation={[0, frontageRotation + (variant % 4) * Math.PI / 2, 0]}>
      <mesh material={sharedMats.resPaving} position={[0, 0.025, 0]} receiveShadow><boxGeometry args={[1.82, 0.05, 1.82]} /></mesh>
      <mesh material={podium} position={[0, 0.34, 0]} castShadow receiveShadow><boxGeometry args={[1.44, 0.58, 1.12]} /></mesh>
      <mesh material={glass} position={[0, 0.28, 0.57]}><boxGeometry args={[1.12, 0.28, 0.018]} /></mesh>
      <mesh material={sharedMats.resDarkMetal} position={[0, 0.52, 0.61]} rotation={[0.18, 0, 0]}><boxGeometry args={[1.3, 0.04, 0.18]} /></mesh>
      <mesh material={upper} position={[variant % 2 === 0 ? -0.06 : 0.08, 0.82 + upperHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.08, upperHeight, 0.84]} />
      </mesh>
      <mesh material={glass} position={[variant % 2 === 0 ? -0.06 : 0.08, 0.9 + upperHeight * 0.52, 0.43]}>
        <boxGeometry args={[0.74, upperHeight * 0.58, 0.018]} />
      </mesh>
      {Array.from({ length: isOffice ? 1 : level >= 4 ? 3 : 2 }).map((_, index) => (
        <mesh key={`mixed-balcony-${index}`} material={sharedMats.resDarkMetal} position={[variant % 2 === 0 ? 0.33 : -0.31, 0.92 + index * 0.27, 0.53]}>
          <boxGeometry args={[0.26, 0.035, 0.16]} />
        </mesh>
      ))}
      <mesh material={isCommunity || isHospitality ? sharedMats.roofGreen : sharedMats.roofGreen} position={[variant % 2 === 0 ? -0.06 : 0.08, 0.84 + upperHeight, 0]}>
        <boxGeometry args={[1.16, 0.05, 0.92]} />
      </mesh>
      <mesh material={isOffice ? sharedMats.metal : sharedMats.resSolar} position={[0.28, 0.91 + upperHeight, 0]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[0.25, 0.025, 0.34]} />
      </mesh>
    </group>
  );
}

function industrialVariant(tile: TileData): number {
  let hash = (tile.x * 1597334677 + tile.y * 3812015801 + tile.level * 958282183) | 0;
  hash = Math.imul(hash ^ (hash >>> 14), 668265263);
  return (hash ^ (hash >>> 16)) & 7;
}

function ModernOfficeBuilding({ level, variant, abandoned, frontageRotation = 0 }: { level: number; variant: number; abandoned: boolean; frontageRotation?: number }) {
  const safeLevel = Math.min(5, Math.max(1, level));
  const height = 0.28 + safeLevel * 0.34;
  const width = variant % 2 === 0 ? 0.58 : 0.7;
  const material = abandoned ? sharedMats.comL1_abd : (variant % 3 === 0 ? sharedMats.comL4 : sharedMats.comL5);
  return (
    <group rotation={[0, frontageRotation + (variant % 2) * Math.PI / 2, 0]}>
      <mesh material={sharedMats.metal} position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[0.82, 0.08, 0.82]} />
      </mesh>
      <mesh material={material} position={[0, height / 2 + 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, width]} />
      </mesh>
      <mesh material={abandoned ? sharedMats.window_abd : sharedMats.windowCyan} position={[0, height / 2 + 0.08, width / 2 + 0.012]}>
        <planeGeometry args={[width * 0.72, Math.max(0.18, height * 0.68)]} />
      </mesh>
      <mesh material={sharedMats.metal} position={[0, height + 0.12, 0]}>
        <boxGeometry args={[width * 0.72, 0.045, width * 0.72]} />
      </mesh>
    </group>
  );
}

function ModernIndustrialBuilding({ level, variant, abandoned, frontageRotation = 0 }: { level: number; variant: number; abandoned: boolean; frontageRotation?: number }) {
  const facadeOptions = [sharedMats.indFacadeWhite, sharedMats.indFacadeSteel, sharedMats.indFacadeTeal, sharedMats.indFacadeBlue];
  const facade = abandoned ? sharedMats.indFacadeSteel : facadeOptions[variant % facadeOptions.length];
  const facadeAlt = abandoned ? sharedMats.indConcrete : facadeOptions[(variant + 1) % facadeOptions.length];
  const glass = abandoned ? sharedMats.window_abd : sharedMats.indGlass;
  const angle = (variant % 4) * Math.PI / 2;
  const yard = (
    <group>
      <mesh material={sharedMats.resPaving} position={[0, 0.025, 0]} receiveShadow>
        <boxGeometry args={[0.92, 0.05, 0.92]} />
      </mesh>
      <mesh material={sharedMats.indSafety} position={[variant % 2 === 0 ? 0.25 : -0.25, 0.06, 0.31]}>
        <boxGeometry args={[0.3, 0.025, 0.12]} />
      </mesh>
      <mesh material={sharedMats.resGrass} position={[variant % 2 === 0 ? -0.34 : 0.34, 0.058, -0.3]} receiveShadow>
        <boxGeometry args={[0.18, 0.025, 0.28]} />
      </mesh>
      <mesh material={sharedMats.resShrub} position={[variant % 2 === 0 ? -0.34 : 0.34, 0.14, -0.3]} castShadow>
        <sphereGeometry args={[0.08, 7, 5]} />
      </mesh>
    </group>
  );

  if (level === 1) {
    return (
      <group rotation={[0, frontageRotation + angle, 0]}>
        {yard}
        {variant % 4 === 0 && (
          <group>
            <mesh material={facade} position={[0, 0.24, 0]} castShadow receiveShadow><boxGeometry args={[0.62, 0.44, 0.55]} /></mesh>
            <mesh material={glass} position={[0, 0.24, 0.29]}><boxGeometry args={[0.4, 0.2, 0.018]} /></mesh>
            <mesh material={sharedMats.indSafety} position={[0.12, 0.48, 0]}><boxGeometry args={[0.28, 0.05, 0.58]} /></mesh>
          </group>
        )}
        {variant % 4 === 1 && (
          <group>
            <mesh material={facadeAlt} position={[-0.16, 0.27, 0]} castShadow receiveShadow><boxGeometry args={[0.3, 0.5, 0.56]} /></mesh>
            <mesh material={facade} position={[0.16, 0.21, 0]} castShadow receiveShadow><boxGeometry args={[0.3, 0.38, 0.5]} /></mesh>
            <mesh material={glass} position={[-0.16, 0.29, 0.29]}><boxGeometry args={[0.22, 0.24, 0.018]} /></mesh>
          </group>
        )}
        {variant % 4 === 2 && (
          <group>
            <mesh material={sharedMats.indConcrete} position={[0, 0.22, 0]} castShadow receiveShadow><boxGeometry args={[0.68, 0.4, 0.58]} /></mesh>
            <mesh material={facade} position={[0, 0.47, 0]}><boxGeometry args={[0.72, 0.06, 0.62]} /></mesh>
            <mesh material={glass} position={[0.21, 0.22, 0.3]}><boxGeometry args={[0.2, 0.2, 0.018]} /></mesh>
          </group>
        )}
        {variant % 4 === 3 && (
          <group>
            <mesh material={facade} position={[0, 0.29, 0]} castShadow receiveShadow><boxGeometry args={[0.48, 0.56, 0.58]} /></mesh>
            <mesh material={facadeAlt} position={[0.2, 0.18, 0]} castShadow><boxGeometry args={[0.2, 0.34, 0.48]} /></mesh>
            <mesh material={sharedMats.indSafety} position={[0, 0.59, 0]}><boxGeometry args={[0.56, 0.04, 0.64]} /></mesh>
          </group>
        )}
      </group>
    );
  }

  const height = level === 2 ? 0.78 : level === 3 ? 1.15 : level === 4 ? 1.7 : 2.25;
  return (
    <group rotation={[0, frontageRotation + angle, 0]}>
      {yard}
      {variant % 3 === 0 && (
        <group>
          <mesh material={facade} position={[-0.2, height / 2 + 0.06, 0]} castShadow receiveShadow><boxGeometry args={[0.34, height, 0.62]} /></mesh>
          <mesh material={facadeAlt} position={[0.18, height * 0.43, 0]} castShadow receiveShadow><boxGeometry args={[0.34, height * 0.82, 0.56]} /></mesh>
          <mesh material={glass} position={[-0.2, height * 0.52, 0.321]}><boxGeometry args={[0.2, height * 0.56, 0.018]} /></mesh>
        </group>
      )}
      {variant % 3 === 1 && (
        <group>
          <mesh material={sharedMats.indConcrete} position={[0, height / 2 + 0.06, 0]} castShadow receiveShadow><boxGeometry args={[0.72, height, 0.64]} /></mesh>
          <mesh material={glass} position={[0, height * 0.52, 0.331]}><boxGeometry args={[0.5, height * 0.58, 0.018]} /></mesh>
          <mesh material={sharedMats.resSolar} position={[0.16, height + 0.13, 0]} rotation={[0.12, 0, 0]}><boxGeometry args={[0.24, 0.025, 0.3]} /></mesh>
        </group>
      )}
      {variant % 3 === 2 && (
        <group>
          <mesh material={facadeAlt} position={[0, height / 2 + 0.06, 0]} castShadow receiveShadow><boxGeometry args={[0.6, height, 0.62]} /></mesh>
          {Array.from({ length: Math.max(2, Math.round(height * 1.4)) }).map((_, index) => (
            <mesh key={`industrial-window-${index}`} material={glass} position={[0, 0.26 + index * 0.34, 0.321]}><boxGeometry args={[0.42, 0.1, 0.018]} /></mesh>
          ))}
          <mesh material={sharedMats.indSafety} position={[-0.24, height * 0.52, 0.33]}><boxGeometry args={[0.06, height * 0.68, 0.025]} /></mesh>
        </group>
      )}
      <mesh material={sharedMats.resDarkMetal} position={[0, height + 0.14, 0]} castShadow>
        <boxGeometry args={[0.78, 0.08, 0.7]} />
      </mesh>
      {level >= 4 && <mesh material={sharedMats.resSolar} position={[-0.18, height + 0.2, 0]} rotation={[0.12, 0, 0]}><boxGeometry args={[0.24, 0.025, 0.32]} /></mesh>}
    </group>
  );
}

interface BuildingMeshProps {
  tile: TileData;
  nightFactor: number;
  gridWidth?: number;
  gridHeight?: number;
  footprint?: BuildingFootprint;
  frontageRotation?: number;
}

// Global update for window emissive intensity based on day/night cycle
let lastNightFactor = -1;

export function BuildingMesh({ tile, nightFactor, gridWidth, gridHeight, footprint, frontageRotation = 0 }: BuildingMeshProps) {
  const [wx, , wz] = gridToWorld(footprint?.centerX ?? tile.x, footprint?.centerY ?? tile.y, gridWidth, gridHeight);
  const wy = (tile.elevation || 0) * 0.15;
  const { type, level = 1, abandoned, powered, watered } = tile;

  // Update shared global emissive intensities to avoid per-instance React state re-renders
  if (nightFactor !== lastNightFactor) {
    const windowGlow = nightFactor > 0.25 ? Math.min(1.2, (nightFactor - 0.25) * 1.6) : 0;
    sharedMats.window.emissiveIntensity = windowGlow;
    sharedMats.windowCyan.emissiveIntensity = windowGlow * 1.1;
    sharedMats.resGlassBlue.emissiveIntensity = windowGlow * 0.42;
    sharedMats.resGlassDark.emissiveIntensity = windowGlow * 0.56;
    sharedMats.indGlass.emissiveIntensity = windowGlow * 0.48;
    lastNightFactor = nightFactor;
  }

  const mats = {
    resL1: abandoned ? sharedMats.resL1_abd : sharedMats.resL1,
    resL2: abandoned ? sharedMats.resL2_abd : sharedMats.resL2,
    resL3: abandoned ? sharedMats.resL3_abd : sharedMats.resL3,
    resL4: abandoned ? sharedMats.resL4_abd : sharedMats.resL4,
    resL5: abandoned ? sharedMats.resL5_abd : sharedMats.resL5,
    comL1: abandoned ? sharedMats.comL1_abd : sharedMats.comL1,
    comL2: abandoned ? sharedMats.comL2_abd : sharedMats.comL2,
    comL3: abandoned ? sharedMats.comL3_abd : sharedMats.comL3,
    comL4: abandoned ? sharedMats.comL4_abd : sharedMats.comL4,
    comL5: abandoned ? sharedMats.comL5_abd : sharedMats.comL5,
    indL1: abandoned ? sharedMats.indL1_abd : sharedMats.indL1,
    indL2: abandoned ? sharedMats.indL2_abd : sharedMats.indL2,
    indL3: abandoned ? sharedMats.indL3_abd : sharedMats.indL3,
    indL4: abandoned ? sharedMats.indL4_abd : sharedMats.indL4,
    indL5: abandoned ? sharedMats.indL5_abd : sharedMats.indL5,
    roof: sharedMats.roof,
    roofGreen: sharedMats.roofGreen,
    brick: sharedMats.brick,
    metal: sharedMats.metal,
    glass: sharedMats.glass,
    water: sharedMats.water,
    window: abandoned ? sharedMats.window_abd : sharedMats.window,
    windowCyan: abandoned ? sharedMats.windowCyan_abd : sharedMats.windowCyan,
    redAlert: sharedMats.redAlert,
    white: sharedMats.white,
    redCross: sharedMats.redCross,
  };

  // Handle empty or zero occupancy
  const safeLevel = Math.min(5, Math.max(1, level));

  // Render individual building procedural shapes based on TileType & Level
  return (
    <group
      position={[wx, wy, wz]}
      scale={footprint ? [footprint.width * 0.92, 1, footprint.height * 0.92] : undefined}
    >
      {/* ---------------- RESIDENTIAL BUILDINGS (L1 - L5) ---------------- */}
      {type === TileType.RESIDENTIAL && (
        <ModernResidentialBuilding level={safeLevel} variant={residentialVariant(tile)} abandoned={abandoned} frontageRotation={frontageRotation} />
      )}

      {/* Legacy single-blueprint residential kit retained as a reference for
          backwards visual comparison; the modern kit above is authoritative. */}
      {false && type === TileType.RESIDENTIAL && (
        <group>
          {/* Level 1: Suburban Cottage */}
          {safeLevel === 1 && (
            <group position={[0, 0, 0]}>
              <mesh material={mats.resL1} position={[0, 0.2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.55, 0.35, 0.55]} />
              </mesh>
              {/* Pitched Roof */}
              <mesh material={mats.brick} position={[0, 0.45, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[0.45, 0.25, 4]} />
              </mesh>
              {/* Windows */}
              <mesh material={mats.window} position={[0, 0.2, 0.28]}>
                <planeGeometry args={[0.15, 0.12]} />
              </mesh>
            </group>
          )}

          {/* Level 2: Modern Townhouse */}
          {safeLevel === 2 && (
            <group>
              <mesh material={mats.resL2} position={[-0.15, 0.35, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.3, 0.7, 0.55]} />
              </mesh>
              <mesh material={mats.resL2} position={[0.15, 0.38, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.3, 0.75, 0.55]} />
              </mesh>
              <mesh material={mats.roof} position={[0, 0.72, 0]}>
                <boxGeometry args={[0.62, 0.04, 0.57]} />
              </mesh>
              {/* Windows */}
              <mesh material={mats.window} position={[-0.15, 0.45, 0.28]}>
                <planeGeometry args={[0.18, 0.2]} />
              </mesh>
              <mesh material={mats.window} position={[0.15, 0.45, 0.28]}>
                <planeGeometry args={[0.18, 0.2]} />
              </mesh>
            </group>
          )}

          {/* Level 3: Apartment Block */}
          {safeLevel === 3 && (
            <group>
              <mesh material={mats.resL3} position={[0, 0.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.68, 1.2, 0.68]} />
              </mesh>
              <mesh material={mats.roof} position={[0, 1.22, 0]}>
                <boxGeometry args={[0.7, 0.05, 0.7]} />
              </mesh>
              {/* AC Unit on roof */}
              <mesh material={mats.metal} position={[0.15, 1.28, 0.15]} castShadow>
                <boxGeometry args={[0.15, 0.1, 0.15]} />
              </mesh>
              {/* Front windows grid */}
              <mesh material={mats.window} position={[0, 0.7, 0.345]}>
                <planeGeometry args={[0.45, 0.7]} />
              </mesh>
            </group>
          )}

          {/* Level 4: High-Rise Residential */}
          {safeLevel === 4 && (
            <group>
              <mesh material={mats.resL4} position={[0, 0.95, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.7, 1.9, 0.7]} />
              </mesh>
              {/* Green Roof Terrace */}
              <mesh material={mats.roofGreen} position={[0, 1.91, 0]}>
                <boxGeometry args={[0.65, 0.04, 0.65]} />
              </mesh>
              {/* Corner balconies */}
              <mesh material={mats.glass} position={[0, 1.0, 0.355]}>
                <planeGeometry args={[0.5, 1.4]} />
              </mesh>
            </group>
          )}

          {/* Level 5: Luxury Skyscraper */}
          {safeLevel === safeLevel && safeLevel === 5 && (
            <group>
              <mesh material={mats.resL5} position={[0, 1.35, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.65, 2.7, 0.65]} />
              </mesh>
              {/* Penthouse crown */}
              <mesh material={mats.glass} position={[0, 2.8, 0]} castShadow>
                <boxGeometry args={[0.45, 0.3, 0.45]} />
              </mesh>
              {/* Spire */}
              <mesh material={mats.metal} position={[0, 3.1, 0]}>
                <cylinderGeometry args={[0.02, 0.04, 0.4]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 1.4, 0.33]}>
                <planeGeometry args={[0.48, 2.2]} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* ---------------- COMMERCIAL BUILDINGS (L1 - L5) ---------------- */}
      {type === TileType.COMMERCIAL && footprint?.mixedUse && (
        <ModernMixedUseBuilding level={safeLevel} program={tile.mixedUseProgram} variant={commercialVariant(tile)} abandoned={abandoned} frontageRotation={frontageRotation} />
      )}
      {type === TileType.COMMERCIAL && !footprint?.mixedUse && (
        <ModernCommercialBuilding level={safeLevel} variant={commercialVariant(tile)} abandoned={abandoned} frontageRotation={frontageRotation} />
      )}

      {type === TileType.OFFICE && (
        <ModernOfficeBuilding level={safeLevel} variant={commercialVariant(tile)} abandoned={abandoned} frontageRotation={frontageRotation} />
      )}

      {/* Legacy commercial kit kept unreachable while the modern frontage kit
          is the authoritative visual for new cities. */}
      {false && type === TileType.COMMERCIAL && (
        <group>
          {/* Level 1: Shop */}
          {safeLevel === 1 && (
            <group>
              <mesh material={mats.comL1} position={[0, 0.22, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.6, 0.44, 0.6]} />
              </mesh>
              {/* Awning */}
              <mesh material={mats.brick} position={[0, 0.25, 0.32]} rotation={[0.3, 0, 0]}>
                <boxGeometry args={[0.55, 0.03, 0.15]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 0.18, 0.31]}>
                <planeGeometry args={[0.45, 0.22]} />
              </mesh>
            </group>
          )}

          {/* Level 2: Mid-Rise Office */}
          {safeLevel === 2 && (
            <group>
              <mesh material={mats.comL2} position={[0, 0.45, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.65, 0.9, 0.65]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 0.5, 0.33]}>
                <planeGeometry args={[0.48, 0.6]} />
              </mesh>
            </group>
          )}

          {/* Level 3: Commercial Plaza */}
          {safeLevel === 3 && (
            <group>
              <mesh material={mats.comL3} position={[0, 0.75, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.72, 1.5, 0.72]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 0.8, 0.365]}>
                <planeGeometry args={[0.55, 1.1]} />
              </mesh>
            </group>
          )}

          {/* Level 4: Glass Tower */}
          {safeLevel === 4 && (
            <group>
              <mesh material={mats.comL4} position={[0, 1.15, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.68, 2.3, 0.68]} />
              </mesh>
              <mesh material={mats.metal} position={[0, 2.33, 0]}>
                <boxGeometry args={[0.4, 0.1, 0.4]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 1.2, 0.345]}>
                <planeGeometry args={[0.5, 1.8]} />
              </mesh>
            </group>
          )}

          {/* Level 5: Crystal Commercial Skyscraper */}
          {safeLevel === 5 && (
            <group>
              <mesh material={mats.comL5} position={[0, 1.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.65, 3.2, 0.65]} />
              </mesh>
              {/* Spire */}
              <mesh material={mats.metal} position={[0, 3.45, 0]}>
                <coneGeometry args={[0.15, 0.5, 4]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 1.6, 0.33]}>
                <planeGeometry args={[0.5, 2.6]} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* ---------------- INDUSTRIAL BUILDINGS (L1 - L5) ---------------- */}
      {type === TileType.INDUSTRIAL && (
        <ModernIndustrialBuilding level={safeLevel} variant={industrialVariant(tile)} abandoned={abandoned} frontageRotation={frontageRotation} />
      )}

      {/* Legacy industrial kit retained as a reference while the clean-tech
          campus kit above remains the authoritative visual. */}
      {false && type === TileType.INDUSTRIAL && (
        <group>
          {/* Level 1: Workshop */}
          {safeLevel === 1 && (
            <group>
              <mesh material={mats.indL1} position={[0, 0.22, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.65, 0.44, 0.65]} />
              </mesh>
              {/* Chimney */}
              <mesh material={mats.brick} position={[0.2, 0.48, -0.2]} castShadow>
                <cylinderGeometry args={[0.04, 0.05, 0.3]} />
              </mesh>
            </group>
          )}

          {/* Level 2: Factory */}
          {safeLevel === 2 && (
            <group>
              <mesh material={mats.indL2} position={[0, 0.4, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.7, 0.8, 0.7]} />
              </mesh>
              {/* Dual Exhaust Stacks */}
              <mesh material={mats.metal} position={[-0.2, 0.9, -0.2]} castShadow>
                <cylinderGeometry args={[0.04, 0.05, 0.4]} />
              </mesh>
              <mesh material={mats.metal} position={[0.2, 0.9, -0.2]} castShadow>
                <cylinderGeometry args={[0.04, 0.05, 0.4]} />
              </mesh>
            </group>
          )}

          {/* Level 3: Industrial Complex */}
          {safeLevel === 3 && (
            <group>
              <mesh material={mats.indL3} position={[-0.15, 0.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.4, 1.2, 0.65]} />
              </mesh>
              {/* Storage Silo */}
              <mesh material={mats.metal} position={[0.2, 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.18, 1.0, 16]} />
              </mesh>
            </group>
          )}

          {/* Level 4: Clean Tech Factory */}
          {safeLevel === 4 && (
            <group>
              <mesh material={mats.indL4} position={[0, 0.9, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.7, 1.8, 0.7]} />
              </mesh>
              {/* Solar array roof */}
              <mesh material={mats.glass} position={[0, 1.82, 0]} rotation={[0.2, 0, 0]}>
                <boxGeometry args={[0.55, 0.03, 0.55]} />
              </mesh>
            </group>
          )}

          {/* Level 5: High-Tech Industrial Hub */}
          {safeLevel === 5 && (
            <group>
              <mesh material={mats.indL5} position={[0, 1.25, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.68, 2.5, 0.68]} />
              </mesh>
              <mesh material={mats.metal} position={[0, 2.53, 0]}>
                <cylinderGeometry args={[0.25, 0.25, 0.08]} />
              </mesh>
              <mesh material={mats.windowCyan} position={[0, 1.3, 0.345]}>
                <planeGeometry args={[0.48, 1.9]} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* ---------------- SPECIAL CITY SERVICES ---------------- */}
      {/* POWER PLANT */}
      {type === TileType.POWER_PLANT && (
        <group>
          {/* Main generator hall */}
          <mesh material={mats.metal} position={[-0.15, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.45, 0.7, 0.7]} />
          </mesh>
          {/* Cooling Tower */}
          <mesh material={mats.roof} position={[0.22, 0.5, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.15, 0.25, 1.0, 16]} />
          </mesh>
        </group>
      )}

      {/* WATER PUMP */}
      {type === TileType.WATER_PUMP && (
        <group>
          {/* Pump house */}
          <mesh material={mats.comL2} position={[0, 0.25, -0.15]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.5, 0.4]} />
          </mesh>
          {/* Reservoir Basin */}
          <mesh material={mats.water} position={[0, 0.05, 0.2]}>
            <boxGeometry args={[0.6, 0.08, 0.4]} />
          </mesh>
          {/* Cylindrical Water Storage Tank */}
          <mesh material={mats.metal} position={[0.2, 0.55, -0.15]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.6]} />
          </mesh>
        </group>
      )}

      {/* FIRE STATION */}
      {type === TileType.FIRE_STATION && (
        <group>
          <mesh material={mats.brick} position={[0, 0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.7, 0.65]} />
          </mesh>
          {/* Hose Tower */}
          <mesh material={mats.brick} position={[0.22, 0.6, -0.2]} castShadow>
            <boxGeometry args={[0.2, 1.2, 0.2]} />
          </mesh>
          {/* Red garage doors */}
          <mesh material={mats.redAlert} position={[-0.1, 0.22, 0.33]}>
            <planeGeometry args={[0.3, 0.35]} />
          </mesh>
        </group>
      )}

      {/* POLICE STATION */}
      {type === TileType.POLICE_STATION && (
        <group>
          <mesh material={mats.comL3} position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.9, 0.7]} />
          </mesh>
          {/* Rooftop Helipad */}
          <mesh material={mats.metal} position={[0, 0.92, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.04]} />
          </mesh>
        </group>
      )}

      {/* CLINIC / HOSPITAL */}
      {type === TileType.CLINIC && (
        <group>
          <mesh material={mats.white} position={[0, 0.4, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.8, 0.7]} />
          </mesh>
          {/* Red Cross Emblem */}
          <group position={[0, 0.5, 0.352]}>
            <mesh material={mats.redCross}>
              <planeGeometry args={[0.25, 0.08]} />
            </mesh>
            <mesh material={mats.redCross}>
              <planeGeometry args={[0.08, 0.25]} />
            </mesh>
          </group>
        </group>
      )}

      {/* SCHOOL */}
      {type === TileType.SCHOOL && (
        <group>
          <mesh material={mats.brick} position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.75, 0.6, 0.6]} />
          </mesh>
          {/* Clock tower */}
          <mesh material={mats.brick} position={[0, 0.55, 0.2]} castShadow>
            <boxGeometry args={[0.2, 0.9, 0.2]} />
          </mesh>
        </group>
      )}

      {/* WASTE MANAGEMENT */}
      {type === TileType.WASTE_MANAGEMENT && (
        <group>
          <mesh material={mats.roof} position={[-0.1, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.6, 0.65]} />
          </mesh>
          <mesh material={mats.metal} position={[0.22, 0.2, 0]} castShadow>
            <boxGeometry args={[0.25, 0.4, 0.4]} />
          </mesh>
        </group>
      )}

      {/* BUS DEPOT */}
      {type === TileType.BUS_DEPOT && (
        <group>
          <mesh material={mats.comL2} position={[0, 0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.55, 0.62]} />
          </mesh>
          <mesh material={mats.metal} position={[0, 0.62, -0.08]} castShadow>
            <boxGeometry args={[0.56, 0.08, 0.5]} />
          </mesh>
          <mesh material={mats.comL5} position={[0, 0.25, 0.32]}>
            <planeGeometry args={[0.28, 0.25]} />
          </mesh>
        </group>
      )}

      {/* TRAM STATION */}
      {type === TileType.TRAM_STATION && (
        <group>
          <mesh material={mats.glass} position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.68, 0.45, 0.54]} />
          </mesh>
          <mesh material={mats.metal} position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[0.78, 0.05, 0.62]} />
          </mesh>
          <mesh material={mats.windowCyan} position={[0, 0.28, 0.28]}>
            <planeGeometry args={[0.34, 0.2]} />
          </mesh>
        </group>
      )}

      {type === TileType.BUS_STOP && (
        <group>
          <mesh material={mats.metal} position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.12, 0.4, 0.12]} /></mesh>
          <mesh material={mats.glass} position={[0, 0.34, 0]}><boxGeometry args={[0.38, 0.28, 0.08]} /></mesh>
          <mesh material={mats.comL5} position={[0, 0.3, 0.05]}><planeGeometry args={[0.18, 0.12]} /></mesh>
        </group>
      )}

      {type === TileType.TRAM_STOP && (
        <group>
          <mesh material={mats.metal} position={[0, 0.18, 0]} castShadow><boxGeometry args={[0.16, 0.36, 0.16]} /></mesh>
          <mesh material={mats.glass} position={[0, 0.34, 0]}><boxGeometry args={[0.46, 0.3, 0.1]} /></mesh>
          <mesh material={mats.windowCyan} position={[0, 0.3, 0.06]}><planeGeometry args={[0.22, 0.14]} /></mesh>
        </group>
      )}

      {/* WAREHOUSE */}
      {type === TileType.WAREHOUSE && (
        <group>
          <mesh material={mats.metal} position={[0, 0.34, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.78, 0.68, 0.62]} />
          </mesh>
          <mesh material={mats.roof} position={[0, 0.72, 0]} castShadow>
            <boxGeometry args={[0.84, 0.08, 0.68]} />
          </mesh>
          <mesh material={mats.comL5} position={[0, 0.34, 0.32]}>
            <planeGeometry args={[0.28, 0.24]} />
          </mesh>
          <mesh material={mats.redAlert} position={[-0.25, 0.2, 0.33]}>
            <boxGeometry args={[0.1, 0.18, 0.02]} />
          </mesh>
          <mesh material={mats.redAlert} position={[0.25, 0.2, 0.33]}>
            <boxGeometry args={[0.1, 0.18, 0.02]} />
          </mesh>
        </group>
      )}

      {/* CARGO TERMINAL */}
      {type === TileType.CARGO_TERMINAL && (
        <group>
          <mesh material={sharedMats.indFacadeSteel} position={[0, 0.32, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.82, 0.62, 0.66]} />
          </mesh>
          <mesh material={sharedMats.indFacadeWhite} position={[0, 0.67, 0]} castShadow>
            <boxGeometry args={[0.9, 0.08, 0.72]} />
          </mesh>
          <mesh material={sharedMats.indGlass} position={[0, 0.38, 0.34]}>
            <planeGeometry args={[0.5, 0.22]} />
          </mesh>
          <mesh material={sharedMats.indSafety} position={[-0.28, 0.18, 0.36]}>
            <boxGeometry args={[0.08, 0.26, 0.035]} />
          </mesh>
          <mesh material={sharedMats.indSafety} position={[0, 0.18, 0.36]}>
            <boxGeometry args={[0.08, 0.26, 0.035]} />
          </mesh>
          <mesh material={sharedMats.indSafety} position={[0.28, 0.18, 0.36]}>
            <boxGeometry args={[0.08, 0.26, 0.035]} />
          </mesh>
          <mesh material={sharedMats.resDarkMetal} position={[0.28, 0.86, -0.18]} castShadow>
            <boxGeometry args={[0.08, 0.38, 0.08]} />
          </mesh>
          <mesh material={sharedMats.resSolar} position={[0.28, 1.08, -0.18]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.36, 0.025, 0.22]} />
          </mesh>
        </group>
      )}

      {/* PARK */}
      {/* FLOOD BARRIER */}
      {type === TileType.FLOOD_BARRIER && (
        <group>
          <mesh material={sharedMats.resDarkMetal} position={[0, 0.28, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.86, 0.56, 0.34]} />
          </mesh>
          <mesh material={sharedMats.windowCyan} position={[0, 0.58, 0]}>
            <boxGeometry args={[0.9, 0.06, 0.38]} />
          </mesh>
          {[-0.3, 0, 0.3].map((x) => (
            <mesh key={`barrier-marker-${x}`} material={sharedMats.indSafety} position={[x, 0.64, 0.01]}>
              <boxGeometry args={[0.08, 0.1, 0.04]} />
            </mesh>
          ))}
        </group>
      )}

      {/* WATER RESERVOIR */}
      {type === TileType.WATER_RESERVOIR && (
        <group>
          <mesh material={sharedMats.resDarkMetal} position={[0, 0.12, 0]} receiveShadow>
            <cylinderGeometry args={[0.42, 0.46, 0.24, 16]} />
          </mesh>
          <mesh material={mats.water} position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.36, 0.36, 0.05, 16]} />
          </mesh>
          <mesh material={sharedMats.metal} position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.48, 10]} />
          </mesh>
          <mesh material={sharedMats.resSolar} position={[0, 0.76, 0]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.34, 0.025, 0.22]} />
          </mesh>
        </group>
      )}

      {type === TileType.PARK && (
        <group>
          {/* Central Fountain / Pond */}
          <mesh material={mats.water} position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.04]} />
          </mesh>
          {/* Small Park Trees */}
          <mesh material={mats.roofGreen} position={[-0.25, 0.25, -0.25]} castShadow>
            <coneGeometry args={[0.12, 0.3, 6]} />
          </mesh>
          <mesh material={mats.roofGreen} position={[0.25, 0.25, -0.25]} castShadow>
            <coneGeometry args={[0.12, 0.3, 6]} />
          </mesh>
          <mesh material={mats.roofGreen} position={[-0.25, 0.25, 0.25]} castShadow>
            <coneGeometry args={[0.12, 0.3, 6]} />
          </mesh>
          <mesh material={mats.roofGreen} position={[0.25, 0.25, 0.25]} castShadow>
            <coneGeometry args={[0.12, 0.3, 6]} />
          </mesh>
        </group>
      )}

      {/* PARKING LOT */}
      {type === TileType.PARKING && (
        <group>
          <mesh material={sharedMats.resPaving} position={[0, 0.025, 0]} receiveShadow>
            <boxGeometry args={[0.9, 0.05, 0.9]} />
          </mesh>
          {[-0.3, 0, 0.3].map((x) => (
            <group key={`parking-row-${x}`} position={[x, 0.06, 0]}>
              <mesh material={sharedMats.white} position={[0, 0, -0.22]}>
                <boxGeometry args={[0.025, 0.012, 0.3]} />
              </mesh>
              <mesh material={sharedMats.white} position={[0, 0, 0.22]}>
                <boxGeometry args={[0.025, 0.012, 0.3]} />
              </mesh>
            </group>
          ))}
          <mesh material={sharedMats.resDarkMetal} position={[0, 0.2, -0.36]} castShadow>
            <boxGeometry args={[0.62, 0.24, 0.05]} />
          </mesh>
          <mesh material={sharedMats.resSolar} position={[0, 0.34, -0.36]} rotation={[0.08, 0, 0]}>
            <boxGeometry args={[0.62, 0.025, 0.28]} />
          </mesh>
          <mesh material={sharedMats.indSafety} position={[0.32, 0.14, 0.28]}>
            <boxGeometry args={[0.04, 0.16, 0.04]} />
          </mesh>
        </group>
      )}

      {/* ---------------- UNPOWERED / UNWATERED / ABANDONED WARNING BADGE ---------------- */}
      {(type === TileType.RESIDENTIAL ||
        type === TileType.COMMERCIAL ||
        type === TileType.OFFICE ||
        type === TileType.INDUSTRIAL ||
        type === TileType.FIRE_STATION ||
        type === TileType.POLICE_STATION ||
        type === TileType.CLINIC ||
        type === TileType.SCHOOL ||
        type === TileType.WASTE_MANAGEMENT ||
        type === TileType.BUS_DEPOT ||
        type === TileType.TRAM_STATION ||
        type === TileType.BUS_STOP ||
        type === TileType.TRAM_STOP ||
        type === TileType.WAREHOUSE ||
        type === TileType.CARGO_TERMINAL) &&
        (!powered || !watered || abandoned || (tile.disasterImpact ?? 0) > 35) && (
          <mesh position={[0, 1.8 + safeLevel * 0.3, 0]}>
            <octahedronGeometry args={[0.12]} />
            <meshBasicMaterial color={abandoned ? '#64748b' : (tile.disasterImpact ?? 0) > 35 ? '#f97316' : '#ef4444'} wireframe />
          </mesh>
        )}
    </group>
  );
}
