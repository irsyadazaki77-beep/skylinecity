import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RendererRecovery } from './RendererRecovery';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ActiveTool, CityIncident, ServiceVehicleAgent, TileData, TileType, OverlayMode, GameSettings, RoadClass, WeatherType } from '../../types';
import { focusFrame, terrainHeight } from './visualModel';
import { LandscapeContext } from './LandscapeContext';
import { TerrainGrid } from './TerrainGrid';
import { RoadMesh } from './RoadMesh';
import { BuildingMesh } from './BuildingMesh';
import { TrafficVehicles } from './TrafficVehicles';
import { EnvironmentProps } from './EnvironmentProps';
import { CameraController } from './CameraController';
import { DayNightSky } from './DayNightSky';
import { CityEnvironment } from './CityEnvironment';
import { Trip } from '../../citizenSimulation/types';
import { FreightTrip } from '../../logistics';
import { TransitVehicleAgent } from '../../transit';
import { isTileInUnlockedRegion } from '../../mapGenerator';
import { BuildingFootprint, deriveBuildingFootprints, getBuildingFrontageRotation } from '../../urbanForm';
import { CityDistrict, getDistrictAt, getDistrictTileSet } from '../../districts';
import { IDENTITY_COLORS, NeighborhoodIdentity } from '../../neighborhoodIdentity';
import { gridToWorld } from './types3D';
import { NetworkOverlays } from './NetworkOverlays';
import { computeRoadRecommendations } from '../../tutorialPathfinder';
import type { SimulationRenderRevisions } from '../../simulationContext';
import { WeatherEffects } from './WeatherEffects';
import { PedestrianRenderer } from './PedestrianRenderer';
import { PremiumCityLayer } from './PremiumCityLayer';
import { getRenderQuality } from '../../renderQuality';
import { recordLodTransition, recordRenderFrame } from '../../performanceTelemetry';

interface City3DCanvasProps {
  grid: TileData[][];
  homeSatisfaction?: Record<string, number>;
  activeTool: ActiveTool;
  money: number;
  activeRoadClass?: RoadClass;
  activeOverlay: OverlayMode;
  speed: number;
  population?: number;
  happiness?: number;
  timeOfDay?: number;
  weather?: WeatherType;
  precipitation?: number;
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
  neighborhoodIdentities?: NeighborhoodIdentity[];
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
  cameraResetRevision?: number;
  cameraPresentation?: 'initial' | 'milestone' | 'incident' | 'recovery';
  onCameraRotationChange?: (rotation: number) => void;
  tutorialHighlight?: 'highway' | 'zoning' | 'utilities' | 'mission' | null;
  onRendererReady?: () => void;
  performanceDiagnostics?: boolean;
  renderRevisions?: SimulationRenderRevisions;
  onSelectCitizen?: (citizenId: string) => void;
}

const BUILDING_CHUNK_SIZE = 10;
type VisibleBuilding = { tile: TileData; footprint?: BuildingFootprint; frontageRotation: number };

interface BuildingChunkCache {
  width: number;
  height: number;
  lastGrid: TileData[][] | null;
  lastTopologyRevision: number;
  lastBuildingRevision: number;
  lastDirtySignature: string;
  lastConfiguration: string;
  chunks: Map<string, VisibleBuilding[]>;
}

function buildingChunkKey(x: number, y: number): string {
  return `${Math.floor(x / BUILDING_CHUNK_SIZE)},${Math.floor(y / BUILDING_CHUNK_SIZE)}`;
}

function BuildingLodController({ qualityTier, shadowQuality, children }: { qualityTier: 'balanced' | 'reduced'; shadowQuality?: 'low' | 'medium' | 'high'; children: React.ReactNode }) {
  const rootRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);
  const worldPosition = useRef(new THREE.Vector3());
  const { camera } = useThree();

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    if (elapsedRef.current < 0.12 || !rootRef.current) return;
    elapsedRef.current = 0;
    const quality = getRenderQuality(qualityTier, shadowQuality);
    const nearDistance = quality.nearLodDistance;
    const farDistance = quality.farLodDistance;
    const hysteresis = qualityTier === 'reduced' ? 2 : 3;
    const camPos = camera.position;

    // Fast 2-tier iteration over chunk groups
    const chunkGroups = rootRef.current.children;
    for (let i = 0; i < chunkGroups.length; i++) {
      const chunk = chunkGroups[i];
      const buildings = chunk.children;
      for (let j = 0; j < buildings.length; j++) {
        const b = buildings[j];
        if (b.name === 'BuildingRenderRoot') {
          b.getWorldPosition(worldPosition.current);
          const distanceSq = worldPosition.current.distanceToSquared(camPos);

          if (!b.userData.__lodObjects) {
            b.userData.__lodObjects = {
              detail: b.children[0]?.name === 'BuildingNearDetail' ? b.children[0] : b.getObjectByName('BuildingNearDetail'),
              mid: b.getObjectByName('BuildingMid'),
              far: b.getObjectByName('BuildingFar'),
            };
          }
          const { detail, mid, far } = b.userData.__lodObjects as {
            detail?: THREE.Object3D; mid?: THREE.Object3D; far?: THREE.Object3D;
          };
          const currentLod = b.userData.__lod as 'NEAR' | 'MID' | 'FAR' | undefined;
          const nearBoundary = currentLod === 'NEAR' ? nearDistance + hysteresis : nearDistance - hysteresis;
          const farBoundary = currentLod === 'FAR' ? farDistance - hysteresis : farDistance + hysteresis;
          const nextLod = (!mid && !far) || distanceSq <= nearBoundary * nearBoundary
            ? 'NEAR'
            : distanceSq <= farBoundary * farBoundary ? 'MID' : 'FAR';
          const shadowsChanged = b.userData.__shadowTier !== quality.preset;
          const lodChanged = b.userData.__lod !== nextLod;
          if (b.userData.__lod !== nextLod) {
            if (b.userData.__lod !== undefined) recordLodTransition();
            b.userData.__lod = nextLod;
          }
          if (nextLod === 'NEAR') {
            if (detail) detail.visible = true;
            if (mid) mid.visible = false;
            if (far) far.visible = false;
          } else if (nextLod === 'MID') {
            if (detail) detail.visible = false;
            if (mid) mid.visible = true;
            if (far) far.visible = false;
          } else {
            if (detail) detail.visible = false;
            if (mid) mid.visible = false;
            if (far) far.visible = true;
          }
          // Only near buildings participate in the shadow map. Far and mid
          // representations remain visible but cannot become shadow casters.
          if (lodChanged || shadowsChanged) {
            b.userData.__shadowTier = quality.preset;
            b.traverse((object) => {
              if (object instanceof THREE.Mesh) object.castShadow = nextLod === 'NEAR' && quality.shadowCasters > 0;
            });
          }
        }
      }
    }
  });

  return <group ref={rootRef} name="BuildingLodController">{children}</group>;
}

function PerformanceProbe() {
  const { gl, scene, camera, controls } = useThree();
  useEffect(() => {
    // Read-only projection diagnostics allow browser tests to click real world
    // coordinates without bypassing the game's pointer or build handlers.
    const host = window as Window & { __SKYLINE_CAMERA__?: unknown };
    host.__SKYLINE_CAMERA__ = {
      snapshot: () => ({ position: camera.position.toArray(), target: (controls as unknown as { target?: THREE.Vector3 })?.target?.toArray() }),
      project: (x: number, z: number, elevation = -0.01) => {
        const point = new THREE.Vector3(x, elevation, z).project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
      },
    };
    return () => { delete host.__SKYLINE_CAMERA__; };
  }, [camera, controls, gl]);
  const sample = useRef({
    elapsed: 1, visibleObjects: 0, materials: 0, mountedBuildings: 0, mountedProps: 0,
    activeVehicles: 0, activePedestrians: 0, lodNear: 0, lodMid: 0, lodFar: 0,
  });
  const gpuTimerAvailable = useMemo(() => {
    const context = gl.getContext();
    return Boolean(context.getExtension('EXT_disjoint_timer_query_webgl2') || context.getExtension('EXT_disjoint_timer_query'));
  }, [gl]);
  useFrame((_, delta) => {
    sample.current.elapsed += delta;
    if (sample.current.elapsed >= 0.5) {
      sample.current.elapsed = 0;
      const inventory = sample.current;
      inventory.visibleObjects = 0;
      inventory.mountedBuildings = 0;
      inventory.mountedProps = 0;
      inventory.activeVehicles = 0;
      inventory.activePedestrians = 0;
      inventory.lodNear = 0;
      inventory.lodMid = 0;
      inventory.lodFar = 0;
      const materials = new Set<THREE.Material>();
      scene.traverseVisible((object) => {
        if (object instanceof THREE.Mesh) {
          inventory.visibleObjects += 1;
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of objectMaterials) materials.add(material);
          const instances = object instanceof THREE.InstancedMesh ? object.count : 1;
          if (/vehicle|car|transit|freight|service/i.test(object.name)) inventory.activeVehicles += instances;
          else if (/pedestrian/i.test(object.name)) inventory.activePedestrians += instances;
          else if (/prop|tree|shrub|rock|light|landscape/i.test(object.name)) inventory.mountedProps += instances;
        }
        if (object.name === 'BuildingRenderRoot') {
          inventory.mountedBuildings += 1;
          if (object.userData.__lod === 'NEAR') inventory.lodNear += 1;
          else if (object.userData.__lod === 'MID') inventory.lodMid += 1;
          else if (object.userData.__lod === 'FAR') inventory.lodFar += 1;
        }
      });
      inventory.materials = materials.size;
    }
    recordRenderFrame({
      frameTimeMs: delta * 1000,
      drawCalls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      visibleObjects: sample.current.visibleObjects,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      materials: sample.current.materials,
      mountedBuildings: sample.current.mountedBuildings,
      mountedProps: sample.current.mountedProps,
      activeVehicles: sample.current.activeVehicles,
      activePedestrians: sample.current.activePedestrians,
      lodNear: sample.current.lodNear,
      lodMid: sample.current.lodMid,
      lodFar: sample.current.lodFar,
      gpuTimerAvailable,
    });
  });
  return null;
}

export function City3DCanvas({
  grid,
  homeSatisfaction,
  activeTool,
  money,
  activeRoadClass = 'LOCAL',
  activeOverlay,
  speed,
  population = 0,
  happiness = 50,
  timeOfDay = 6,
  weather = 'CLEAR',
  precipitation = 1,
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
  neighborhoodIdentities = [],
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
  cameraResetRevision = 0,
  cameraPresentation = 'initial',
  onCameraRotationChange,
  tutorialHighlight = null,
  onRendererReady,
  performanceDiagnostics = false,
  renderRevisions,
  onSelectCitizen,
}: City3DCanvasProps) {
  const [rendererEpoch, setRendererEpoch] = useState(0);
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

  // The simulation emits explicit render revisions. The renderer consumes
  // those revisions instead of hashing the entire grid whenever a state
  // object arrives from the worker.
  const topologyRevision = renderRevisions?.topologyRevision ?? 0;
  const buildingVisualRevision = renderRevisions?.buildingVisualRevision ?? 0;
  const terrainRevision = renderRevisions?.terrainRevision ?? 0;
  const roadRevision = renderRevisions?.roadRevision ?? 0;
  const dirtyChunkSignature = renderRevisions?.dirtyChunkKeys.join('|') ?? '';
  const chunkRevisions = renderRevisions?.chunkRevisions ?? {};
  const globalMixedUse = unlockedUpgrades.includes('mixed_use') || activePolicies.includes('mixed_use');
  const districtSignature = districts.map((district) => `${district.id}:${district.policy}:${district.center[0]}:${district.center[1]}:${district.radius}`).join('|');
  const mixedUseTiles = useMemo(() => globalMixedUse ? undefined : getDistrictTileSet(districts, 'MIXED_USE'), [districtSignature, globalMixedUse]);
  const identityByDistrict = useMemo(() => new Map(neighborhoodIdentities.map((identity) => [identity.districtId, identity])), [neighborhoodIdentities]);
  const allowMixedUse = globalMixedUse || mixedUseTiles.size > 0;
  const footprints = useMemo(() => deriveBuildingFootprints(grid, { allowMixedUse, mixedUseTiles }), [allowMixedUse, mixedUseTiles, topologyRevision, buildingVisualRevision]);
  const unlockedRegionSignature = unlockedRegions.join('|');
  const activeRegionSignature = activeRegionKeys.join('|');
  const buildingConfiguration = `${unlockedRegionSignature}|${activeRegionSignature}|${allowMixedUse ? 1 : 0}`;
  const buildingChunkCacheRef = useRef<BuildingChunkCache>({
    width: 0,
    height: 0,
    lastGrid: null,
    lastTopologyRevision: -1,
    lastBuildingRevision: -1,
    lastDirtySignature: '',
    lastConfiguration: '',
    chunks: new Map(),
  });

  // Chunk-based building visibility. Most simulation ticks only update
  // population/traffic fields, so the cached tile entries are retained. A
  // building/topology revision rebuilds only the dirty chunks supplied by the
  // simulation; unlock/district changes intentionally invalidate all chunks.
  const visibleBuildingsByChunk = useMemo(() => {
    const cache = buildingChunkCacheRef.current;
    const dimensionsChanged = cache.width !== width || cache.height !== height;
    const configurationChanged = cache.lastConfiguration !== buildingConfiguration;
    const revisionsChanged = cache.lastTopologyRevision !== topologyRevision || cache.lastBuildingRevision !== buildingVisualRevision;
    const dirtyKeys = new Set(dirtyChunkSignature ? dirtyChunkSignature.split('|') : []);
    const gridReferenceChanged = cache.lastGrid !== grid;
    const rebuildAll = dimensionsChanged || configurationChanged || cache.lastGrid === null
      || (revisionsChanged && dirtyKeys.size === 0);

    if (rebuildAll) {
      cache.chunks.clear();
      cache.width = width;
      cache.height = height;
      for (let y = 0; y < height; y += BUILDING_CHUNK_SIZE) {
        for (let x = 0; x < width; x += BUILDING_CHUNK_SIZE) {
          const key = buildingChunkKey(x, y);
          cache.chunks.set(key, []);
        }
      }
    }

    const rebuildChunk = (key: string): VisibleBuilding[] => {
      const [chunkX, chunkY] = key.split(',').map(Number);
      const startX = Math.max(0, chunkX * BUILDING_CHUNK_SIZE);
      const startY = Math.max(0, chunkY * BUILDING_CHUNK_SIZE);
      const endX = Math.min(width, startX + BUILDING_CHUNK_SIZE);
      const endY = Math.min(height, startY + BUILDING_CHUNK_SIZE);
      const result: VisibleBuilding[] = [];
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const tile = grid[y][x];
          if (tile.type === TileType.EMPTY || tile.type === TileType.ROAD) continue;
          const regionKey = `${Math.floor(x / 20)},${Math.floor(y / 20)}`;
          if (!isTileInUnlockedRegion(x, y, unlockedRegions) || !activeRegionKeys.includes(regionKey)) continue;
          const footprint = footprints.get(`${x},${y}`);
          if (footprint && (footprint.rootX !== x || footprint.rootY !== y)) continue;
          result.push({ tile, footprint, frontageRotation: getBuildingFrontageRotation(tile, grid) });
        }
      }
      return result;
    };

    if (rebuildAll) {
      for (const key of cache.chunks.keys()) cache.chunks.set(key, rebuildChunk(key));
    } else if (gridReferenceChanged || revisionsChanged || cache.lastDirtySignature !== dirtyChunkSignature) {
      for (const key of dirtyKeys) cache.chunks.set(key, rebuildChunk(key));
    }

    cache.lastGrid = grid;
    cache.lastTopologyRevision = topologyRevision;
    cache.lastBuildingRevision = buildingVisualRevision;
    cache.lastDirtySignature = dirtyChunkSignature;
    cache.lastConfiguration = buildingConfiguration;
    const chunks: Record<string, VisibleBuilding[]> = {};
    for (const key of [...cache.chunks.keys()].sort()) chunks[key] = cache.chunks.get(key) ?? [];
    return chunks;
  }, [activeRegionSignature, activeRegionKeys, buildingConfiguration, buildingVisualRevision, dirtyChunkSignature, footprints, grid, height, topologyRevision, unlockedRegionSignature, unlockedRegions, width]);

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
  }, [terrainRevision, height, width]);
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
  const quality = getRenderQuality(qualityTier, settings?.shadowQuality);
  const effectiveShadowMode = quality.shadowCasters === 0 ? false : shadowMode;
  const effectiveTrafficDensity = qualityTier === 'reduced' ? 'low' : (settings?.trafficDensity ?? 'medium');
  const effectiveVegetationDensity = qualityTier === 'reduced' ? 'low' : (settings?.vegetationDensity ?? 'medium');

  const targetHighwayTile = useMemo(() => {
    if (tutorialHighlight !== 'highway') return null;
    return computeRoadRecommendations(grid, unlockedRegions).targetHighwayTile;
  }, [grid, unlockedRegions, tutorialHighlight]);

  return (
    <Canvas
      key={rendererEpoch}
      dpr={[dprMin, dprMax]}
      shadows={effectiveShadowMode}
      camera={{ position: [0, 18, 16], fov: 42, near: 0.1, far: 220 }}
      gl={{ antialias, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#070b14');
        onRendererReady?.();
      }}
    >
      <RendererRecovery onRetry={() => setRendererEpoch((value) => value + 1)} />
      <CameraController
        building={activeTool !== 'POINTER' || mapExpansionMode}
        resetRevision={cameraResetRevision}
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
        presentation={cameraPresentation}
        onRotationChange={onCameraRotationChange}
      />
      {performanceDiagnostics && <PerformanceProbe />}
      <CityEnvironment nightFactor={nightFactor} reduced={qualityTier === 'reduced'} />
      <DayNightSky shadowSize={effectiveShadowMode === 'soft' ? 1024 : 512} timeOfDay={timeOfDay} dayNightCycle={settings?.dayNightCycle} />
      <WeatherEffects weather={weather} precipitation={precipitation} qualityTier={qualityTier} reducedMotion={settings?.reducedMotion} />
      <LandscapeContext grid={grid} unlockedRegions={unlockedRegions} />
      <TerrainGrid homeSatisfaction={homeSatisfaction}
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
        terrainRevision={terrainRevision}
        nightFactor={nightFactor}
      />
      <RoadMesh grid={grid} nightFactor={nightFactor} tutorialHighlight={tutorialHighlight === 'highway'} targetHighwayTile={targetHighwayTile} roadRevision={roadRevision} dirtyChunkKeys={renderRevisions?.dirtyChunkKeys} />
      <PremiumCityLayer grid={grid} quality={quality} population={population} happiness={happiness} nightFactor={nightFactor} />
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
      <PedestrianRenderer
        grid={grid}
        trips={activeTrips}
        timeOfDay={timeOfDay}
        population={population}
        weather={weather}
        activeIncidentCount={incidents?.length ?? 0}
        qualityTier={qualityTier}
        onSelectCitizen={onSelectCitizen}
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
      <BuildingLodController qualityTier={qualityTier} shadowQuality={settings?.shadowQuality}>
        {Object.entries(visibleBuildingsByChunk).map(([chunkKey, chunkBuildings]) => (
            <group key={`chunk-${chunkKey}-${chunkRevisions[chunkKey] ?? 0}`} name={`BuildingChunk-${chunkKey}`}>
            {chunkBuildings.map(({ tile, footprint, frontageRotation }) => (
              <BuildingMesh
                key={`building-${tile.x}-${tile.y}`}
                tile={tile}
                footprint={footprint}
                frontageRotation={frontageRotation}
                nightFactor={nightFactor}
                gridWidth={width}
                gridHeight={height}
                identityColor={(() => {
                  const district = getDistrictAt(districts, tile.x, tile.y);
                  const identity = district ? identityByDistrict.get(district.id) : undefined;
                  return identity ? IDENTITY_COLORS[identity.type] : undefined;
                })()}
                districtTheme={(() => {
                  const district = getDistrictAt(districts, tile.x, tile.y);
                  return district ? identityByDistrict.get(district.id)?.visualTheme : undefined;
                })()}
              />
            ))}
          </group>
        ))}
      </BuildingLodController>
      <EnvironmentProps grid={grid} vegetationDensity={effectiveVegetationDensity} weather={weather} environmentRevision={Math.max(topologyRevision, terrainRevision, buildingVisualRevision)} />
    </Canvas>
  );
}

