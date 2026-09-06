import React from 'react';
import { sharedBuildingMats } from './sharedKits';
import { TileType } from '../../../types';

interface ServiceKitProps {
  type: TileType;
}

export function ServiceKit({ type }: ServiceKitProps) {
  // POWER PLANT
  if (type === TileType.POWER_PLANT) {
    return (
      <group>
        <mesh material={sharedBuildingMats.brick} position={[-0.15, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.7, 0.7]} />
        </mesh>
        <mesh material={sharedBuildingMats.metal} position={[0.2, 0.55, -0.15]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.6]} />
        </mesh>
      </group>
    );
  }

  // WATER PUMP
  if (type === TileType.WATER_PUMP) {
    return (
      <group>
        <mesh material={sharedBuildingMats.comL2} position={[0, 0.25, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.35, 0.35, 0.5, 16]} />
        </mesh>
        <mesh material={sharedBuildingMats.metal} position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.2, 8]} />
        </mesh>
      </group>
    );
  }

  // FIRE STATION
  if (type === TileType.FIRE_STATION) {
    return (
      <group>
        <mesh material={sharedBuildingMats.brick} position={[0, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.7, 0.65]} />
        </mesh>
        <mesh material={sharedBuildingMats.brick} position={[0.22, 0.6, -0.2]} castShadow>
          <boxGeometry args={[0.2, 1.2, 0.2]} />
        </mesh>
        <mesh material={sharedBuildingMats.retailAwningRed} position={[-0.1, 0.22, 0.33]}>
          <planeGeometry args={[0.3, 0.35]} />
        </mesh>
      </group>
    );
  }

  // POLICE STATION
  if (type === TileType.POLICE_STATION) {
    return (
      <group>
        <mesh material={sharedBuildingMats.comL3} position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.9, 0.7]} />
        </mesh>
        <mesh material={sharedBuildingMats.metal} position={[0, 0.92, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04]} />
        </mesh>
      </group>
    );
  }

  // CLINIC
  if (type === TileType.CLINIC) {
    return (
      <group>
        <mesh material={sharedBuildingMats.white} position={[0, 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.7, 0.8, 0.7]} />
        </mesh>
        <group position={[0, 0.5, 0.352]}>
          <mesh material={sharedBuildingMats.retailAwningRed}>
            <planeGeometry args={[0.25, 0.08]} />
          </mesh>
          <mesh material={sharedBuildingMats.retailAwningRed}>
            <planeGeometry args={[0.08, 0.25]} />
          </mesh>
        </group>
      </group>
    );
  }

  // SCHOOL
  if (type === TileType.SCHOOL) {
    return (
      <group>
        <mesh material={sharedBuildingMats.brick} position={[0, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.75, 0.6, 0.6]} />
        </mesh>
        <mesh material={sharedBuildingMats.brick} position={[0, 0.55, 0.2]} castShadow>
          <boxGeometry args={[0.2, 0.9, 0.2]} />
        </mesh>
      </group>
    );
  }

  // WASTE MANAGEMENT
  if (type === TileType.WASTE_MANAGEMENT) {
    return (
      <group>
        <mesh material={sharedBuildingMats.roof} position={[-0.1, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.6, 0.65]} />
        </mesh>
        <mesh material={sharedBuildingMats.metal} position={[0.22, 0.2, 0]} castShadow>
          <boxGeometry args={[0.25, 0.4, 0.4]} />
        </mesh>
      </group>
    );
  }

  // BUS DEPOT
  if (type === TileType.BUS_DEPOT) {
    return (
      <group>
        <mesh material={sharedBuildingMats.comL2} position={[0, 0.28, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.72, 0.55, 0.62]} />
        </mesh>
        <mesh material={sharedBuildingMats.metal} position={[0, 0.62, -0.08]} castShadow>
          <boxGeometry args={[0.56, 0.08, 0.5]} />
        </mesh>
        <mesh material={sharedBuildingMats.comL5} position={[0, 0.25, 0.32]}>
          <planeGeometry args={[0.28, 0.25]} />
        </mesh>
      </group>
    );
  }

  // TRAM STATION
  if (type === TileType.TRAM_STATION) {
    return (
      <group>
        <mesh material={sharedBuildingMats.glass} position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.68, 0.45, 0.54]} />
        </mesh>
        <mesh material={sharedBuildingMats.metal} position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.78, 0.05, 0.62]} />
        </mesh>
        <mesh material={sharedBuildingMats.windowCyan} position={[0, 0.28, 0.28]}>
          <planeGeometry args={[0.34, 0.2]} />
        </mesh>
      </group>
    );
  }

  // BUS STOP
  if (type === TileType.BUS_STOP) {
    return (
      <group>
        <mesh material={sharedBuildingMats.metal} position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.12, 0.4, 0.12]} />
        </mesh>
        <mesh material={sharedBuildingMats.glass} position={[0, 0.34, 0]}>
          <boxGeometry args={[0.38, 0.28, 0.08]} />
        </mesh>
        <mesh material={sharedBuildingMats.comL5} position={[0, 0.3, 0.05]}>
          <planeGeometry args={[0.18, 0.12]} />
        </mesh>
      </group>
    );
  }

  // TRAM STOP
  if (type === TileType.TRAM_STOP) {
    return (
      <group>
        <mesh material={sharedBuildingMats.metal} position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.16, 0.36, 0.16]} />
        </mesh>
        <mesh material={sharedBuildingMats.glass} position={[0, 0.34, 0]}>
          <boxGeometry args={[0.46, 0.3, 0.1]} />
        </mesh>
        <mesh material={sharedBuildingMats.windowCyan} position={[0, 0.3, 0.06]}>
          <planeGeometry args={[0.22, 0.14]} />
        </mesh>
      </group>
    );
  }

  // WAREHOUSE
  if (type === TileType.WAREHOUSE) {
    return (
      <group>
        <mesh material={sharedBuildingMats.metal} position={[0, 0.34, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.78, 0.68, 0.62]} />
        </mesh>
        <mesh material={sharedBuildingMats.roof} position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[0.84, 0.08, 0.68]} />
        </mesh>
        <mesh material={sharedBuildingMats.comL5} position={[0, 0.34, 0.32]}>
          <planeGeometry args={[0.28, 0.24]} />
        </mesh>
      </group>
    );
  }

  // CARGO TERMINAL
  if (type === TileType.CARGO_TERMINAL) {
    return (
      <group>
        <mesh material={sharedBuildingMats.indFacadeSteel} position={[0, 0.32, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.82, 0.62, 0.66]} />
        </mesh>
        <mesh material={sharedBuildingMats.indFacadeWhite} position={[0, 0.67, 0]} castShadow>
          <boxGeometry args={[0.9, 0.08, 0.72]} />
        </mesh>
        <mesh material={sharedBuildingMats.indGlass} position={[0, 0.38, 0.34]}>
          <planeGeometry args={[0.5, 0.22]} />
        </mesh>
        <mesh material={sharedBuildingMats.indSafety} position={[0, 0.18, 0.36]}>
          <boxGeometry args={[0.4, 0.26, 0.035]} />
        </mesh>
      </group>
    );
  }

  // FLOOD BARRIER
  if (type === TileType.FLOOD_BARRIER) {
    return (
      <group>
        <mesh material={sharedBuildingMats.resDarkMetal} position={[0, 0.28, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.86, 0.56, 0.34]} />
        </mesh>
        <mesh material={sharedBuildingMats.windowCyan} position={[0, 0.58, 0]}>
          <boxGeometry args={[0.9, 0.06, 0.38]} />
        </mesh>
      </group>
    );
  }

  // WATER RESERVOIR
  if (type === TileType.WATER_RESERVOIR) {
    return (
      <group>
        <mesh material={sharedBuildingMats.resDarkMetal} position={[0, 0.12, 0]} receiveShadow>
          <cylinderGeometry args={[0.42, 0.46, 0.24, 16]} />
        </mesh>
        <mesh material={sharedBuildingMats.water} position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.05, 16]} />
        </mesh>
      </group>
    );
  }

  // PARK
  if (type === TileType.PARK) {
    return (
      <group>
        <mesh material={sharedBuildingMats.water} position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04]} />
        </mesh>
        {[-0.25, 0.25].flatMap((x) =>
          [-0.25, 0.25].map((z) => (
            <mesh key={`${x}-${z}`} material={sharedBuildingMats.roofGreen} position={[x, 0.25, z]} castShadow>
              <coneGeometry args={[0.12, 0.3, 6]} />
            </mesh>
          )),
        )}
      </group>
    );
  }

  // PARKING
  if (type === TileType.PARKING) {
    return (
      <group>
        <mesh material={sharedBuildingMats.resPaving} position={[0, 0.025, 0]} receiveShadow>
          <boxGeometry args={[0.9, 0.05, 0.9]} />
        </mesh>
        {[-0.3, 0, 0.3].map((x) => (
          <group key={`parking-row-${x}`} position={[x, 0.06, 0]}>
            <mesh material={sharedBuildingMats.white} position={[0, 0, -0.22]}>
              <boxGeometry args={[0.025, 0.012, 0.3]} />
            </mesh>
            <mesh material={sharedBuildingMats.white} position={[0, 0, 0.22]}>
              <boxGeometry args={[0.025, 0.012, 0.3]} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  return null;
}
