import React from 'react';
import { TileData, TileType } from '../../types';
import { buildingVariant, buildingScale, buildingVisualSpec } from './visualModel';
import { gridToWorld } from './types3D';
import { getConstructionStage } from '../../constructionPresentation';
import { BuildingFootprint } from '../../urbanForm';
import { BuildingLod, BuildingLotKit } from './buildings/sharedKits';
import { ServiceKit } from './buildings/ServiceKit';
import { ConstructionKit, RenovationScaffoldingKit } from './buildings/ConstructionKit';
import { ProceduralBuilding } from './buildings/ProceduralBuilding';
import type { DistrictVisualTheme } from '../../neighborhoodIdentity';

interface BuildingMeshProps {
  tile: TileData;
  footprint?: BuildingFootprint;
  frontageRotation?: number;
  lod?: BuildingLod;
  nightFactor?: number;
  gridWidth?: number;
  gridHeight?: number;
  identityColor?: string;
  districtTheme?: DistrictVisualTheme;
}

export function BuildingMesh({
  tile,
  footprint: _footprint,
  frontageRotation = 0,
  lod: _lod = 'NEAR',
  nightFactor = 0,
  gridWidth = 30,
  gridHeight = 20,
  identityColor,
  districtTheme,
}: BuildingMeshProps) {
  const { type, level = 1, abandoned, powered, watered } = tile;
  const safeLevel = Math.max(1, Math.min(5, level));
  const variant = buildingVariant(tile);
  const scale = buildingScale(tile);
  const visualSpec = buildingVisualSpec(tile);
  const [worldX, , worldZ] = gridToWorld(tile.x, tile.y, gridWidth, gridHeight);
  const elevation = (tile.elevation || 0) * 0.15;
  const footprintWidth = _footprint?.width ?? 1;
  const footprintHeight = _footprint?.height ?? 1;
  const footprintCenter = _footprint ? gridToWorld(_footprint.centerX, _footprint.centerY, gridWidth, gridHeight) : [worldX, 0, worldZ] as [number, number, number];
  const constructionStage = getConstructionStage(tile);

  const isZoned = [TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL].includes(type);
  const lotKind = type === TileType.RESIDENTIAL ? 'RESIDENTIAL'
    : type === TileType.COMMERCIAL ? 'COMMERCIAL'
      : type === TileType.OFFICE ? 'OFFICE'
        : type === TileType.INDUSTRIAL ? 'INDUSTRIAL' : 'SERVICE';
  const isInitialConstruction = [
    'SITE_PREPARATION',
    'PREPARATION',
    'FOUNDATION',
    'FRAME',
    'STRUCTURE',
    'FACADE',
    'FINISHING',
  ].includes(constructionStage) && (tile.type === TileType.RESIDENTIAL ? (tile.population ?? 0) === 0 : (tile.jobs ?? 0) === 0);
  const isRenovating = constructionStage === 'RENOVATING' || ((tile.upgradeProgress ?? 0) > 0 && !isInitialConstruction && !abandoned);

  // The procedural front (+Z) follows the closest road. Shape variation stays
  // inside the parcel so it cannot rotate entrances away from their frontage.
  const rotationY = frontageRotation;

  return (
    <group
      name="BuildingRenderRoot"
      position={[footprintCenter[0], elevation, footprintCenter[2]]}
      rotation={[0, rotationY, 0]}
      scale={[footprintWidth, scale, footprintHeight]}
    >
      {/* 1. NEAR DETAIL TIER */}
      <group name="BuildingNearDetail">
        <BuildingLotKit kind={lotKind} variant={variant} lod="NEAR" />
        {isInitialConstruction ? (
          <ConstructionKit stage={constructionStage} level={safeLevel} type={type} />
        ) : (
          <>
            {isZoned && <ProceduralBuilding tile={tile} spec={visualSpec} lod="NEAR" nightFactor={nightFactor} districtTheme={districtTheme} />}
            {!isZoned && <ServiceKit type={type} lod="NEAR" />}
            {isZoned && districtTheme && <DistrictCharacterKit theme={districtTheme} type={type} />}
            {isRenovating && (
              <RenovationScaffoldingKit
                currentLevel={tile.previousLevel ?? safeLevel}
                targetLevel={tile.targetLevel ?? Math.min(5, safeLevel + 1)}
                buildingHeight={visualSpec.height}
                type={type}
              />
            )}
          </>
        )}
        {isZoned && !isInitialConstruction && nightFactor !== undefined && nightFactor > 0.18 && (
          <>
            <mesh position={[-0.22, Math.min(1.25, 0.2 + safeLevel * 0.16), 0.43]}>
              <planeGeometry args={[0.14, 0.1]} />
              <meshBasicMaterial color="#ffd88a" toneMapped={false} transparent opacity={Math.min(0.92, nightFactor + 0.25)} />
            </mesh>
            <mesh position={[0.18, Math.min(1.45, 0.26 + safeLevel * 0.18), 0.43]}>
              <planeGeometry args={[0.12, 0.09]} />
              <meshBasicMaterial color="#f4b86a" toneMapped={false} transparent opacity={Math.min(0.8, nightFactor + 0.18)} />
            </mesh>
          </>
        )}
      </group>

      {isZoned && identityColor && !isInitialConstruction && (
        <mesh name="DistrictIdentityAccent" position={[0, 0.035, 0.42]}>
          <boxGeometry args={[0.34, 0.018, 0.018]} />
          <meshBasicMaterial color={identityColor} toneMapped={false} transparent opacity={0.78} />
        </mesh>
      )}

      {/* 2. MID SIMPLIFIED TIER */}
      {!isInitialConstruction && (
        <group name="BuildingMid" visible={false}>
          <BuildingLotKit kind={lotKind} variant={variant} lod="MID" />
          {isZoned && <ProceduralBuilding tile={tile} spec={visualSpec} lod="MID" nightFactor={nightFactor} districtTheme={districtTheme} />}
          {!isZoned && <ServiceKit type={type} lod="MID" />}
        </group>
      )}

      {/* 3. FAR GEOMETRIC PROXY MASS */}
      {!isInitialConstruction && (
        <group name="BuildingFar" visible={false}>
          {isZoned && <ProceduralBuilding tile={tile} spec={visualSpec} lod="FAR" nightFactor={nightFactor} districtTheme={districtTheme} />}
          {!isZoned && <ServiceKit type={type} lod="FAR" />}
        </group>
      )}

      {/* 4. UNPOWERED / UNWATERED / ABANDONED WARNING BADGE */}
      {isZoned && (!powered || !watered || abandoned || (tile.disasterImpact ?? 0) > 35) && (
        <mesh position={[0, 1.8 + safeLevel * 0.25, 0]}>
          <octahedronGeometry args={[0.12]} />
          <meshBasicMaterial
            color={abandoned ? '#64748b' : (tile.disasterImpact ?? 0) > 35 ? '#f97316' : '#ef4444'}
            wireframe
          />
        </mesh>
      )}

      {/* 5. READY TO LEVEL UP VISUAL FEEDBACK BEACON */}
      {isZoned && !abandoned && powered && watered && (tile.upgradeProgress ?? 0) >= 90 && safeLevel < 5 && (
        <group position={[0, 2.0 + safeLevel * 0.25, 0]}>
          <mesh>
            <octahedronGeometry args={[0.14]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshBasicMaterial color="#7dd3fc" />
          </mesh>
        </group>
      )}
    </group>
  );
}

function DistrictCharacterKit({ theme, type }: { theme: DistrictVisualTheme; type: TileType }) {
  const color = theme === 'OLD_TOWN' ? '#8f5f42'
    : theme === 'GARDEN_RESIDENTIAL' ? '#3f8f57'
      : theme === 'COMMERCIAL_CORE' ? '#f59e0b'
        : theme === 'LOGISTICS_INDUSTRIAL' ? '#f97316'
          : theme === 'WATERFRONT' ? '#38bdf8'
            : theme === 'CIVIC_CENTER' ? '#e2e8f0' : '#818cf8';
  const isGarden = theme === 'GARDEN_RESIDENTIAL' || theme === 'WATERFRONT';
  const isCommerce = theme === 'COMMERCIAL_CORE' || theme === 'MODERN_DOWNTOWN';
  return <group name={`DistrictCharacter-${theme}`}>
    {isGarden && <>
      <mesh position={[-.34, .1, .34]}><cylinderGeometry args={[.055, .07, .18, 6]} /><meshStandardMaterial color="#526b3f" roughness={.9} /></mesh>
      <mesh position={[-.34, .25, .34]}><icosahedronGeometry args={[.11, 1]} /><meshStandardMaterial color={color} roughness={.86} /></mesh>
    </>}
    {isCommerce && type !== TileType.RESIDENTIAL && <mesh position={[.31, .3, .44]}><boxGeometry args={[.2, .12, .025]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.18} /></mesh>}
    {theme === 'LOGISTICS_INDUSTRIAL' && <mesh position={[.3, .11, .37]}><boxGeometry args={[.3, .18, .22]} /><meshStandardMaterial color={color} roughness={.72} /></mesh>}
    {theme === 'CIVIC_CENTER' && <mesh position={[0, .08, .42]}><boxGeometry args={[.5, .04, .22]} /><meshStandardMaterial color={color} roughness={.82} /></mesh>}
    {theme === 'OLD_TOWN' && <mesh position={[-.3, .22, .43]}><boxGeometry args={[.08, .28, .025]} /><meshStandardMaterial color={color} roughness={.9} /></mesh>}
  </group>;
}
