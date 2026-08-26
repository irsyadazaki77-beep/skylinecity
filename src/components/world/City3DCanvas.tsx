import React, { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { ActiveTool, CityIncident, ServiceVehicleAgent, TileData, TileType, OverlayMode, GameSettings, RoadClass } from '../../types';
import { TerrainGrid } from './TerrainGrid';
import { RoadMesh } from './RoadMesh';
import { BuildingMesh } from './BuildingMesh';
import { TrafficVehicles } from './TrafficVehicles';
import { EnvironmentProps } from './EnvironmentProps';
import { CameraController } from './CameraController';
import { DayNightSky } from './DayNightSky';
import { Trip } from '../../citizenSimulation/types';
import { FreightTrip } from '../../logistics';
import { TransitVehicleAgent } from '../../transit';
import { isTileInUnlockedRegion } from '../../mapGenerator';
import { BuildingFootprint, deriveBuildingFootprints, getBuildingFrontageRotation } from '../../urbanForm';
import { CityDistrict, getDistrictTileSet } from '../../districts';
import { gridToWorld } from './types3D';
import { WebGLFallback } from '../ReleaseBoundary';
import { hasWebGLSupport } from '../../releaseReadiness';
import { NetworkOverlays } from './NetworkOverlays';

interface City3DCanvasProps {
  grid: TileData[][];
  activeTool: ActiveTool;
  money: number;
  activeRoadClass?: RoadClass;
  activeOverlay: OverlayMode;
  speed: number;
  timeOfDay?: number;
  activeTrips?: Trip[];
  transitLines?: import('../../types').TransitLine[];
  transitVehicles?: TransitVehicleAgent[];
  activeFreightTrips?: FreightTrip[];
  incidents?: CityIncident[];
  serviceVehicles?: ServiceVehicleAgent[];
  unlockedRegions?: string[];
  activeRegionKeys?: string[];
  unlockedUpgrades?: string[];
  activePolicies?: string[];
  districts?: CityDistrict[];
  mapExpansionMode?: boolean;
  brushSize?: number;
  dragPreviewTiles?: [number, number][];
  dragPreviewColor?: string;
  settings?: GameSettings;
  onTileClick: (x: number, y: number) => void;
  onTilePointerEnter: (x: number, y: number) => void;
  onTilePointerLeave?: () => void;
  onCancelInteraction?: () => void;
  onUnlockRegion?: (rx: number, ry: number) => void;
  nightFactor: number;
  focusTile?: [number, number] | null;
  qualityTier?: 'balanced' | 'reduced';
  viewMode?: '2D' | '3D';
  cameraZoom?: number;
  cameraRotation?: number;
  onCameraRotationChange?: (rotation: number) => void;
}

export function City3DCanvas({
  grid,
  activeTool,
  money,
  activeRoadClass = 'LOCAL',
  activeOverlay,
  speed,
  timeOfDay = 6,
  activeTrips,
  transitLines = [],
  transitVehicles,
  activeFreightTrips,
  incidents,
  serviceVehicles,
  unlockedRegions = ['1,1'],
  activeRegionKeys = unlockedRegions,
  unlockedUpgrades = [],
  activePolicies = [],
  districts = [],
  mapExpansionMode = false,
  brushSize = 1,
  dragPreviewTiles = [],
  dragPreviewColor = 'green',
  settings,
  onTileClick,
  onTilePointerEnter,
  onTilePointerLeave,
  onCancelInteraction,
  onUnlockRegion,
  nightFactor,
  focusTile = null,
  qualityTier = 'balanced',
  viewMode = '3D',
  cameraZoom = 1.25,
  cameraRotation = 0,
  onCameraRotationChange,
}: City3DCanvasProps) {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  // The first frame should show the actual settlement, not the geometric
  // center of the whole 60x60 sandbox. Keep this target stable after mount so
  // normal simulation updates do not yank the player's camera around.
  const initialFocus = useRef<[number, number, number] | null>(null);
  if (initialFocus.current === null) {
    const developed = grid.flat().filter((tile) => (
      tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD && !tile.water
    ));
    if (developed.length > 0) {
      const avgX = developed.reduce((sum, tile) => sum + tile.x, 0) / developed.length;
      const avgY = developed.reduce((sum, tile) => sum + tile.y, 0) / developed.length;
      initialFocus.current = gridToWorld(avgX, avgY, width, height);
    } else {
      initialFocus.current = [0, 0, 0];
    }
  }

  // Footprints only depend on topology, not population/traffic telemetry. Keep
  // the expensive urban-form pass out of the per-tick render path.
  const topologySignature = useMemo(() => grid.flat().map((tile) => (
    `${tile.x},${tile.y}:${tile.type}:${tile.level}:${tile.abandoned ? 1 : 0}:${tile.elevation}:${tile.parcelId ?? ''}:${tile.mixedUseProgram ?? ''}:${tile.mixedUseFloorCount ?? 0}`
  )).join('|'), [grid]);
  const buildingRenderSignature = useMemo(() => grid.flat().map((tile) => (
    `${tile.x},${tile.y}:${tile.type}:${tile.level}:${tile.abandoned ? 1 : 0}:${tile.powered ? 1 : 0}:${tile.watered ? 1 : 0}:${tile.disasterImpact ?? 0}:${tile.elevation}:${tile.parcelId ?? ''}:${tile.mixedUseProgram ?? ''}:${tile.mixedUseFloorCount ?? 0}`
  )).join('|'), [grid]);
  const globalMixedUse = unlockedUpgrades.includes('mixed_use') || activePolicies.includes('mixed_use');
  const districtSignature = districts.map((district) => `${district.id}:${district.policy}:${district.center[0]}:${district.center[1]}:${district.radius}`).join('|');
  const mixedUseTiles = useMemo(() => globalMixedUse ? undefined : getDistrictTileSet(districts, 'MIXED_USE'), [districtSignature, globalMixedUse]);
  const allowMixedUse = globalMixedUse || mixedUseTiles.size > 0;
  const footprints = useMemo(() => deriveBuildingFootprints(grid, { allowMixedUse, mixedUseTiles }), [allowMixedUse, mixedUseTiles, topologySignature]);

  // Chunk-based building visibility: only render buildings in unlocked regions
  const visibleBuildingsByChunk = useMemo(() => {
    const chunks: Record<string, Array<{ tile: TileData; footprint?: BuildingFootprint; frontageRotation: number }>> = {};
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD) {
            const regionKey = `${Math.floor(x / 20)},${Math.floor(y / 20)}`;
            if (isTileInUnlockedRegion(x, y, unlockedRegions) && activeRegionKeys.includes(regionKey)) {
            const footprint = footprints.get(`${x},${y}`);
            if (footprint && (footprint.rootX !== x || footprint.rootY !== y)) continue;
            const key = regionKey;
            if (!chunks[key]) chunks[key] = [];
            chunks[key].push({ tile, footprint, frontageRotation: getBuildingFrontageRotation(tile, grid) });
          }
        }
      }
    }
    return chunks;
  }, [buildingRenderSignature, height, width, unlockedRegions, activeRegionKeys, footprints]);

  const renderScale = settings?.renderScale ?? 100;
  const cameraTarget = focusTile
    ? gridToWorld(focusTile[0], focusTile[1], width, height)
    : (initialFocus.current ?? [0, 0, 0]);
  const adaptiveMultiplier = settings?.adaptiveQuality === false
    ? 1
    : qualityTier === 'reduced'
      ? 0.62
      : (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency ?? 8) <= 4 ? 0.72 : 0.82);
  const dprMin = Math.max(0.5, (renderScale / 100) * 0.8 * adaptiveMultiplier);
  const dprMax = Math.min(1.25, Math.max(0.7, (renderScale / 100) * 1.35 * adaptiveMultiplier));
  const shadowMode = settings?.shadowQuality === 'low'
    ? false
    : settings?.shadowQuality === 'high'
      ? 'soft'
      : 'basic';
  const antialias = settings?.antialiasing ?? true;
  const effectiveShadowMode = qualityTier === 'reduced' ? false : shadowMode;
  const effectiveTrafficDensity = qualityTier === 'reduced' ? 'low' : (settings?.trafficDensity ?? 'medium');
  const effectiveVegetationDensity = qualityTier === 'reduced' ? 'low' : (settings?.vegetationDensity ?? 'medium');

  if (!hasWebGLSupport()) return <WebGLFallback />;

  return (
    <Canvas
      fallback={<WebGLFallback />}
      dpr={[dprMin, dprMax]}
      shadows={effectiveShadowMode}
      camera={{ position: [0, 30, 28], fov: 48, near: 0.1, far: 220 }}
      gl={{ antialias, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor('#070b14')}
    >
      <DayNightSky
        timeOfDay={timeOfDay}
        dayNightCycle={settings?.dayNightCycle ?? 'enabled'}
      />
      <CameraController viewMode={viewMode} zoom={cameraZoom} pitch={52} rotation={cameraRotation} gridWidth={width} gridHeight={height} target={cameraTarget} onRotationChange={onCameraRotationChange} />
      <TerrainGrid
        grid={grid}
        activeTool={activeTool}
        money={money}
        activeRoadClass={activeRoadClass}
        activeOverlay={activeOverlay}
        districts={districts}
        unlockedRegions={unlockedRegions}
        mapExpansionMode={mapExpansionMode}
        brushSize={brushSize}
        dragPreviewTiles={dragPreviewTiles}
        dragPreviewColor={dragPreviewColor}
        onTileClick={onTileClick}
        onTilePointerEnter={onTilePointerEnter}
        onTilePointerLeave={onTilePointerLeave}
        onCancelInteraction={onCancelInteraction}
        onUnlockRegion={onUnlockRegion}
      />
      <RoadMesh grid={grid} nightFactor={nightFactor} />
      <TrafficVehicles
        trips={activeTrips}
        transitVehicles={transitVehicles}
        freightTrips={activeFreightTrips}
        incidents={incidents}
        serviceVehicles={serviceVehicles}
        gridWidth={width}
        gridHeight={height}
        speed={speed}
        nightFactor={nightFactor}
        trafficDensity={effectiveTrafficDensity}
      />
      <NetworkOverlays
        activeOverlay={activeOverlay}
        grid={grid}
        timeOfDay={timeOfDay}
        transitLines={transitLines}
        transitVehicles={transitVehicles}
        incidents={incidents}
        serviceVehicles={serviceVehicles}
      />
      {Object.entries(visibleBuildingsByChunk).map(([chunkKey, chunkBuildings]) => (
        <group key={`chunk-${chunkKey}`} name={`BuildingChunk-${chunkKey}`}>
          {chunkBuildings.map(({ tile, footprint, frontageRotation }) => (
            <BuildingMesh
              key={`building-${tile.x}-${tile.y}`}
              tile={tile}
              footprint={footprint}
              frontageRotation={frontageRotation}
              nightFactor={nightFactor}
              gridWidth={width}
              gridHeight={height}
            />
          ))}
        </group>
      ))}
      <EnvironmentProps grid={grid} vegetationDensity={effectiveVegetationDensity} />
    </Canvas>
  );
}
