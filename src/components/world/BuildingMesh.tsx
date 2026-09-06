import React from 'react';
import { TileData, TileType } from '../../types';
import { buildingVariant, buildingScale } from './visualModel';
import { gridToWorld } from './types3D';
import { getConstructionStage } from '../../constructionPresentation';
import { BuildingFootprint } from '../../urbanForm';
import { BuildingLod } from './buildings/sharedKits';
import { ResidentialKit } from './buildings/ResidentialKit';
import { CommercialKit } from './buildings/CommercialKit';
import { OfficeKit } from './buildings/OfficeKit';
import { IndustrialKit } from './buildings/IndustrialKit';
import { ServiceKit } from './buildings/ServiceKit';
import { ConstructionKit } from './buildings/ConstructionKit';

interface BuildingMeshProps {
  tile: TileData;
  footprint?: BuildingFootprint;
  frontageRotation?: number;
  lod?: BuildingLod;
  nightFactor?: number;
  gridWidth?: number;
  gridHeight?: number;
}

export function BuildingMesh({
  tile,
  footprint: _footprint,
  frontageRotation = 0,
  lod: _lod = 'NEAR',
}: BuildingMeshProps) {
  const { type, level = 1, abandoned, powered, watered } = tile;
  const safeLevel = Math.max(1, Math.min(5, level));
  const variant = buildingVariant(tile);
  const scale = buildingScale(tile);
  const [worldX, , worldZ] = gridToWorld(tile.x, tile.y);
  const elevation = (tile.elevation || 0) * 0.5;

  const isZoned = [TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL].includes(type);
  const constructionStage = getConstructionStage(tile);
  const isUnderConstruction = [
    'SITE_PREPARATION',
    'PREPARATION',
    'FOUNDATION',
    'FRAME',
    'STRUCTURE',
    'FACADE',
    'FINISHING',
    'RENOVATING',
  ].includes(constructionStage);

  // Rotation: combine base quadrant rotation with frontage alignment
  const rotationY = (variant * Math.PI) / 2 + frontageRotation;

  return (
    <group
      name="BuildingRenderRoot"
      position={[worldX, elevation, worldZ]}
      rotation={[0, rotationY, 0]}
      scale={[scale, scale, scale]}
    >
      {/* 1. NEAR DETAIL TIER */}
      <group name="BuildingDetail">
        {isUnderConstruction ? (
          <ConstructionKit stage={constructionStage} level={safeLevel} type={type} />
        ) : (
          <>
            {type === TileType.RESIDENTIAL && (
              <ResidentialKit level={safeLevel} abandoned={abandoned} lod="NEAR" />
            )}
            {type === TileType.COMMERCIAL && (
              <CommercialKit level={safeLevel} abandoned={abandoned} lod="NEAR" />
            )}
            {type === TileType.OFFICE && (
              <OfficeKit level={safeLevel} abandoned={abandoned} lod="NEAR" />
            )}
            {type === TileType.INDUSTRIAL && (
              <IndustrialKit level={safeLevel} abandoned={abandoned} lod="NEAR" />
            )}
            {!isZoned && <ServiceKit type={type} />}
          </>
        )}
      </group>

      {/* 2. MID SIMPLIFIED TIER */}
      {isZoned && !isUnderConstruction && (
        <group name="BuildingMid" visible={false}>
          {type === TileType.RESIDENTIAL && (
            <ResidentialKit level={safeLevel} abandoned={abandoned} lod="MID" />
          )}
          {type === TileType.COMMERCIAL && (
            <CommercialKit level={safeLevel} abandoned={abandoned} lod="MID" />
          )}
          {type === TileType.OFFICE && (
            <OfficeKit level={safeLevel} abandoned={abandoned} lod="MID" />
          )}
          {type === TileType.INDUSTRIAL && (
            <IndustrialKit level={safeLevel} abandoned={abandoned} lod="MID" />
          )}
        </group>
      )}

      {/* 3. FAR GEOMETRIC PROXY MASS */}
      {isZoned && (
        <group name="BuildingFar" visible={false}>
          {type === TileType.RESIDENTIAL && (
            <ResidentialKit level={safeLevel} abandoned={abandoned} lod="FAR" />
          )}
          {type === TileType.COMMERCIAL && (
            <CommercialKit level={safeLevel} abandoned={abandoned} lod="FAR" />
          )}
          {type === TileType.OFFICE && (
            <OfficeKit level={safeLevel} abandoned={abandoned} lod="FAR" />
          )}
          {type === TileType.INDUSTRIAL && (
            <IndustrialKit level={safeLevel} abandoned={abandoned} lod="FAR" />
          )}
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
    </group>
  );
}
