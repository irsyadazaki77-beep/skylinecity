import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ActiveTool, CityIncident, ServiceVehicleAgent, TileData, TileType, OverlayMode, GameSettings, RoadClass } from '../../types';
import { focusFrame, terrainHeight } from './visualModel';
import { LandscapeContext } from './LandscapeContext';
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
import { NetworkOverlays } from './NetworkOverlays';
import { computeRoadRecommendations } from '../../tutorialPathfinder';

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
  selectedTile?: { x: number; y: number } | null;
  focusTile?: [number, number] | null;
  qualityTier?: 'balanced' | 'reduced';
  viewMode?: '2D' | '3D';
  cameraZoom?: number;
  cameraRotation?: number;
  onCameraRotationChange?: (rotation: number) => void;
  tutorialHighlight?: 'highway' | 'zoning' | 'utilities' | 'mission' | null;
  onRendererReady?: () => void;
}

function computeBuildingTopologyHash(grid: TileData[][]): number {
  let h = 0x811c9dc5;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (tile.type === TileType.EMPTY && !tile.elevation && !tile.water) continue;
      h = Math.imul(h ^ tile.x, 16777619);
      h = Math.imul(h ^ (tile.y << 6), 16777619);
      h = Math.imul(h ^ (tile.level || 0), 16777619);
      h = Math.imul(h ^ (tile.abandoned ? 1 : 0), 16777619);
      h = Math.imul(h ^ Math.round((tile.elevation || 0) * 10), 16777619);
      h = Math.imul(h ^ (tile.mixedUseFloorCount || 0), 16777619);
      const s = (tile.type || '') + (tile.parcelId || '') + (tile.mixedUseProgram || '');
      for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 16777619);
      }
    }
  }
  return h >>> 0;
}

function computeBuildingRenderHash(grid: TileData[][]): number {
  let h = 0x811c9dc5;
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (tile.type === TileType.EMPTY && !tile.elevation && !tile.water) continue;
      h = Math.imul(h ^ tile.x, 16777619);
      h = Math.imul(h ^ (tile.y << 6), 16777619);
      h = Math.imul(h ^ (tile.level || 0), 16777619);
      h = Math.imul(h ^ (tile.abandoned ? 1 : 0), 16777619);
      h = Math.imul(h ^ (tile.powered ? 2 : 0), 16777619);
      h = Math.imul(h ^ (tile.watered ? 4 : 0), 16777619);
      h = Math.imul(h ^ (tile.disasterImpact || 0), 16777619);
      h = Math.imul(h ^ Math.round((tile.elevation || 0) * 10), 16777619);
      h = Math.imul(h ^ (tile.mixedUseFloorCount || 0), 16777619);
      const s = (tile.type || '') + (tile.parcelId || '') + (tile.mixedUseProgram || '');
      for (let i = 0; i < s.length; i++) {
        h = Math.imul(h ^ s.charCodeAt(i), 16777619);
      }
    }
  }
  return h >>> 0;
}

function BuildingLodController({ qualityTier, children }: { qualityTier: 'balanced' | 'reduced'; children: React.ReactNode }) {
  const rootRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const worldPosition = useRef(new THREE.Vector3());
  const { camera } = useThree();

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    // A low-frequency check keeps LOD responsive to camera movement while
    // avoiding a React update or a per-building frame callback.
    if (elapsedRef.current < 0.12 || !rootRef.current) return;
    elapsedRef.current = 0;
    const farDistance = qualityTier === 'reduced' ? 38 : 58;
    const farDistanceSq = farDistance * farDistance;
    const camPos = camera.position;

    // Fast 2-tier iteration over chunk groups avoiding full scene-graph recursive traversal
    const chunkGroups = rootRef.current.children;
    for (let i = 0; i < chunkGroups.length; i++) {
      const chunk = chunkGroups[i];
      const buildings = chunk.children;
      for (let j = 0; j < buildings.length; j++) {
        const b = buildings[j];
        if (b.name === 'BuildingRenderRoot') {
          b.getWorldPosition(worldPosition.current);
          const distanceSq = worldPosition.current.distanceToSquared(camPos);
          const detail = b.children[0]?.name === 'BuildingDetail' ? b.children[0] : b.getObjectByName('BuildingDetail');
          if (detail) {
            detail.visible = distanceSq <= farDistanceSq;
          }
        }
      }
    }
  });

  return <group ref={rootRef} name="BuildingLodController">{children}</group>;
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
  selectedTile = null,
  focusTile = null,
  qualityTier = 'balanced',
  viewMode = '3D',
  cameraZoom = 1.25,
  cameraRotation = 0,
  onCameraRotationChange,
  tutorialHighlight = null,
  onRendererReady,
}: City3DCanvasProps) {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  // The first frame should show the actual settlement, not the geometric
  // center of the whole 60x60 sandbox. Keep this target stable after mount so
  // normal simulation updates do not yank the player's camera around.
  const initialFocus = useRef<[number, number, number] | null>(null);
  if (initialFocus.current === null) {
    let sumX = 0, sumY = 0, sumElev = 0, count = 0;
    for (let y = 0; y < height; y++) {
      const row = grid[y];
      for (let x = 0; x < width; x++) {
        const tile = row[x];
        if (tile.type !== TileType.EMPTY && tile.type !== TileType.ROAD && !tile.water) {
          sumX += tile.x;
          sumY += tile.y;
          sumElev += (tile.elevation || 0);
          count++;
        }
      }
    }
    if (count > 0) {
      const avgX = sumX / count;
      const avgY = sumY / count;
      const avgElevation = sumElev / count;
      const [wx, , wz] = gridToWorld(avgX, avgY, width, height);
      initialFocus.current = [wx, terrainHeight(avgElevation), wz];
    } else {
      initialFocus.current = [0, 0, 0];
    }
  }

  // Footprints only depend on topology, not population/traffic telemetry. Keep
  // the expensive urban-form pass out of the per-tick render path.
  const topologyHash = useMemo(() => computeBuildingTopologyHash(grid), [grid]);
  const buildingRenderHash = useMemo(() => computeBuildingRenderHash(grid), [grid]);
  const globalMixedUse = unlockedUpgrades.includes('mixed_use') || activePolicies.includes('mixed_use');
  const districtSignature = districts.map((district) => `${district.id}:${district.policy}:${district.center[0]}:${district.center[1]}:${district.radius}`).join('|');
  const mixedUseTiles = useMemo(() => globalMixedUse ? undefined : getDistrictTileSet(districts, 'MIXED_USE'), [districtSignature, globalMixedUse]);
  const allowMixedUse = globalMixedUse || mixedUseTiles.size > 0;
  const footprints = useMemo(() => deriveBuildingFootprints(grid, { allowMixedUse, mixedUseTiles }), [allowMixedUse, mixedUseTiles, topologyHash]);

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
  }, [buildingRenderHash, height, width, unlockedRegions, activeRegionKeys, footprints]);

  const renderScale = settings?.renderScale ?? 100;
  const focusTarget = focusTile
    ? gridToWorld(focusTile[0], focusTile[1], width, height)
    : (initialFocus.current ?? [0, 0, 0]);
  focusTarget[1] = focusTile ? terrainHeight(grid[focusTile[1]]?.[focusTile[0]]?.elevation) : focusTarget[1];
  const framing = focusFrame(focusTarget, initialFocus.current ?? [0, 0, 0], Boolean(focusTile && tutorialHighlight));
  const cameraTarget = framing.target;
  const terrainCeiling = useMemo(() => {
    let max = 0;
    for (let y = 0; y < height; y++) {
      const row = grid[y];
      for (let x = 0; x < width; x++) {
        const th = terrainHeight(row[x].elevation);
        if (th > max) max = th;
      }
    }
    return max;
  }, [topologyHash, height, width]);
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

  const targetHighwayTile = useMemo(() => {
    if (tutorialHighlight !== 'highway') return null;
    return computeRoadRecommendations(grid, unlockedRegions).targetHighwayTile;
  }, [grid, unlockedRegions, tutorialHighlight]);

  return (
    <Canvas
      dpr={[dprMin, dprMax]}
      shadows={effectiveShadowMode}
      camera={{ position: [0, 24, 22], fov: 44, near: 0.1, far: 220 }}
      gl={{ antialias, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#070b14');
        onRendererReady?.();
      }}
    >
      <CameraController
        reducedMotion={settings?.reducedMotion}
        terrainCeiling={terrainCeiling}
        focusDistance={focusTile && tutorialHighlight ? framing.distance : undefined}
        viewMode={viewMode}
        zoom={cameraZoom}
        pitch={viewMode === '2D' ? 90 : 50}
        rotation={cameraRotation}
        gridWidth={width}
        gridHeight={height}
        target={cameraTarget}
        onRotationChange={onCameraRotationChange}
      />
      <DayNightSky shadowSize={effectiveShadowMode === 'soft' ? 1024 : 512} timeOfDay={timeOfDay} dayNightCycle={settings?.dayNightCycle} />
      <LandscapeContext grid={grid} unlockedRegions={unlockedRegions} />
      <TerrainGrid
        selectedTile={selectedTile}
        districts={districts}
        grid={grid}
        activeTool={activeTool}
        activeRoadClass={activeRoadClass}
        money={money}
        activeOverlay={activeOverlay}
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
        tutorialHighlight={tutorialHighlight}
      />
      <RoadMesh grid={grid} nightFactor={nightFactor} tutorialHighlight={tutorialHighlight === 'highway'} targetHighwayTile={targetHighwayTile} />
      <TrafficVehicles
        grid={grid}
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
      <BuildingLodController qualityTier={qualityTier}>
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
      </BuildingLodController>
      <EnvironmentProps grid={grid} vegetationDensity={effectiveVegetationDensity} />
    </Canvas>
  );
}

