import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUILD_COSTS, OverlayMode, ROAD_BUILD_COSTS, ROAD_REPAIR_COST, RoadClass, TERRAFORM_COST, TileData, TileType, TUNNEL_BUILD_COST } from '../../types';
import { TileMarker } from './TileMarker';
import { roadHeight, terrainHeight } from './visualModel';
import { TileOverlayInstances } from './TileOverlayInstances';
import { GAME_CONFIG } from '../../config';
import { gridToWorld, worldToGrid, TILE_SIZE } from './types3D';
import { CityDistrict } from '../../districts';
import { computeRoadRecommendations, computeUtilityRecommendations, computeZoningRecommendations } from '../../tutorialPathfinder';

interface TerrainGridProps {
  grid: TileData[][];
  homeSatisfaction?: Record<string, number>;
  selectedTile?: { x: number; y: number } | null;
  activeTool: import('../../types').ActiveTool;
  money: number;
  activeOverlay?: OverlayMode | 'NATURAL_RESOURCES';
  unlockedRegions?: string[]; // e.g. ["1,1"]
  mapExpansionMode?: boolean;
  brushSize?: number; // 1 to 3
  activeRoadClass?: RoadClass;
  onTileClick: (x: number, y: number) => void;
  onTilePointerEnter: (x: number, y: number) => void;
  onTilePointerLeave?: () => void;
  onCancelInteraction?: () => void;
  onUnlockRegion?: (rx: number, ry: number) => void;
  dragPreviewTiles?: [number, number][];
  dragPreviewColor?: string;
  districts?: CityDistrict[];
  tutorialHighlight?: 'highway' | 'zoning' | 'utilities' | 'mission' | null;
  terrainRevision?: number;
  nightFactor?: number;
}


function isRenderableTile(tile: TileData | undefined, unlockedRegions: string[], mapExpansionMode: boolean) {
  if (!tile) return false;
  return mapExpansionMode || unlockedRegions.includes(`${Math.floor(tile.x / 20)},${Math.floor(tile.y / 20)}`);
}

function getTerrainTileColor(tile: TileData, isNearWater = false): THREE.Color {
  if (tile.type === TileType.FLOOD_BARRIER) return new THREE.Color('#0ea5e9');
  if (tile.type === TileType.WATER_RESERVOIR) return new THREE.Color('#2563eb');
  if (tile.type !== TileType.EMPTY) return new THREE.Color('#64748b');

  const elev = Math.max(0, tile.elevation || 0);
  const hash = Math.sin(tile.x * 12.9898 + tile.y * 78.233) * 43758.5453;
  const jitter = (hash - Math.floor(hash)) * 0.07 - 0.035;

  if (tile.resource === 'fertile') {
    const base = elev > 2 ? new THREE.Color('#58723c') : new THREE.Color('#688c3a');
    base.offsetHSL(0, 0, jitter);
    return base;
  }
  if (tile.resource === 'forest') {
    const base = elev > 3 ? new THREE.Color('#284e34') : new THREE.Color('#315d3f');
    base.offsetHSL(0, 0, jitter);
    return base;
  }
  if (tile.resource === 'ore') {
    const base = elev > 2 ? new THREE.Color('#855030') : new THREE.Color('#74492f');
    base.offsetHSL(0, 0, jitter);
    return base;
  }
  if (tile.resource === 'oil') {
    const base = new THREE.Color('#343d4a');
    base.offsetHSL(0, 0, jitter);
    return base;
  }

  // Coastline sand fringe
  if (isNearWater && elev === 0) {
    const sandBase = new THREE.Color('#c4b07f');
    sandBase.offsetHSL(0, 0, jitter * 0.5);
    return sandBase;
  }

  // Natural elevation gradient:
  let col: THREE.Color;
  if (elev === 0) col = new THREE.Color('#4a7844');
  else if (elev <= 2) col = new THREE.Color('#41683b');
  else if (elev <= 4) col = new THREE.Color('#51634d');
  else col = new THREE.Color('#636c62');

  col.offsetHSL(0, 0, jitter);
  return col;
}

function getTerrainCliffColor(tile: TileData, isUpper = false): THREE.Color {
  if (tile.resource === 'ore') return isUpper ? new THREE.Color('#4c2e1c') : new THREE.Color('#5c3b26');
  if (tile.resource === 'oil') return isUpper ? new THREE.Color('#222830') : new THREE.Color('#2b323d');
  if (tile.resource === 'fertile') return isUpper ? new THREE.Color('#3e3529') : new THREE.Color('#4d4233');
  const elev = Math.max(0, tile.elevation || 0);
  if (elev >= 4) return isUpper ? new THREE.Color('#3f4341') : new THREE.Color('#4f5351');
  return isUpper ? new THREE.Color('#373833') : new THREE.Color('#464742');
}

function createTerrainSurfaceGeometry(grid: TileData[][], unlockedRegions: string[], mapExpansionMode: boolean) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const offsetX = -(width / 2) + 0.5;
  const offsetZ = -(height / 2) + 0.5;

  const pushQuad = (vertices: Array<[number, number, number]>, color: THREE.Color) => {
    const start = positions.length / 3;
    vertices.forEach(([x, y, z]) => {
      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
    });
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.water || !isRenderableTile(tile, unlockedRegions, mapExpansionMode)) continue;

      const worldX = offsetX + x;
      const worldZ = offsetZ + y;
      const top = terrainHeight(tile.elevation);
      const x0 = worldX - 0.502;
      const x1 = worldX + 0.502;
      const z0 = worldZ - 0.502;
      const z1 = worldZ + 0.502;

      const neighbors: Array<{ tile: TileData | undefined; edge: 'north' | 'east' | 'south' | 'west' }> = [
        { tile: grid[y - 1]?.[x], edge: 'north' },
        { tile: grid[y]?.[x + 1], edge: 'east' },
        { tile: grid[y + 1]?.[x], edge: 'south' },
        { tile: grid[y]?.[x - 1], edge: 'west' },
      ];
      const isNearWater = neighbors.some((n) => n.tile?.water);
      const topColor = getTerrainTileColor(tile, isNearWater);
      pushQuad([[x0, top, z0], [x0, top, z1], [x1, top, z1], [x1, top, z0]], topColor);

      neighbors.forEach(({ tile: neighbor, edge }) => {
        if (neighbor?.water) return;
        const neighborTop = neighbor ? terrainHeight(neighbor.elevation) : -0.55;
        if (neighbor && neighborTop >= top - 0.001) return;
        const bottom = Math.min(top - 0.02, neighborTop);
        const drop = top - bottom;
        if (drop > 0.25) {
          const midH = top - 0.12;
          const upperColor = getTerrainCliffColor(tile, true);
          const lowerColor = getTerrainCliffColor(tile, false);
          if (edge === 'north') {
            pushQuad([[x0, top, z0], [x1, top, z0], [x1, midH, z0], [x0, midH, z0]], upperColor);
            pushQuad([[x0, midH, z0], [x1, midH, z0], [x1, bottom, z0], [x0, bottom, z0]], lowerColor);
          } else if (edge === 'east') {
            pushQuad([[x1, top, z0], [x1, top, z1], [x1, midH, z1], [x1, midH, z0]], upperColor);
            pushQuad([[x1, midH, z0], [x1, midH, z1], [x1, bottom, z1], [x1, bottom, z0]], lowerColor);
          } else if (edge === 'south') {
            pushQuad([[x1, top, z1], [x0, top, z1], [x0, midH, z1], [x1, midH, z1]], upperColor);
            pushQuad([[x1, midH, z1], [x0, midH, z1], [x0, bottom, z1], [x1, bottom, z1]], lowerColor);
          } else if (edge === 'west') {
            pushQuad([[x0, top, z1], [x0, top, z0], [x0, midH, z0], [x0, midH, z1]], upperColor);
            pushQuad([[x0, midH, z1], [x0, midH, z0], [x0, bottom, z0], [x0, bottom, z1]], lowerColor);
          }
        } else {
          const cliffColor = getTerrainCliffColor(tile, false);
          if (edge === 'north') pushQuad([[x0, top, z0], [x1, top, z0], [x1, bottom, z0], [x0, bottom, z0]], cliffColor);
          if (edge === 'east') pushQuad([[x1, top, z0], [x1, top, z1], [x1, bottom, z1], [x1, bottom, z0]], cliffColor);
          if (edge === 'south') pushQuad([[x1, top, z1], [x0, top, z1], [x0, bottom, z1], [x1, bottom, z1]], cliffColor);
          if (edge === 'west') pushQuad([[x0, top, z1], [x0, top, z0], [x0, bottom, z0], [x0, bottom, z1]], cliffColor);
        }
      });
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function getWaterTileColor(tile: TileData, neighbors: Array<TileData | undefined>): THREE.Color {
  const isNearLand = neighbors.some((n) => !n || !n.water);
  const depth = tile.waterDepth ?? 0;
  if (isNearLand) {
    return new THREE.Color('#38bdf8'); // Shallow coastal turquoise
  }
  if (depth > 0.6) {
    return new THREE.Color('#0369a1'); // Deep oceanic blue
  }
  return new THREE.Color('#0284c7'); // Vibrant river cerulean
}

function createWaterSurfaceGeometry(grid: TileData[][], unlockedRegions: string[], mapExpansionMode: boolean) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const offsetX = -(width / 2) + 0.5;
  const offsetZ = -(height / 2) + 0.5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (!tile.water || !isRenderableTile(tile, unlockedRegions, mapExpansionMode)) continue;
      const worldX = offsetX + x;
      const worldZ = offsetZ + y;
      const waterY = terrainHeight(tile.elevation) + 0.014;
      const start = positions.length / 3;
      positions.push(
        worldX - 0.502, waterY, worldZ - 0.502,
        worldX - 0.502, waterY, worldZ + 0.502,
        worldX + 0.502, waterY, worldZ + 0.502,
        worldX + 0.502, waterY, worldZ - 0.502,
      );
      const neighbors: Array<TileData | undefined> = [
        grid[y - 1]?.[x],
        grid[y]?.[x + 1],
        grid[y + 1]?.[x],
        grid[y]?.[x - 1],
      ];
      const waterColor = getWaterTileColor(tile, neighbors);
      for (let i = 0; i < 4; i++) {
        colors.push(waterColor.r, waterColor.g, waterColor.b);
      }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createShorelineGeometry(grid: TileData[][], unlockedRegions: string[], mapExpansionMode: boolean) {
  const positions: number[] = [];
  const indices: number[] = [];
  const width = grid[0]?.length ?? 0;
  const height = grid.length;
  const offsetX = -(width / 2) + 0.5;
  const offsetZ = -(height / 2) + 0.5;
  const band = 0.1;
  const pushQuad = (vertices: Array<[number, number, number]>) => {
    const start = positions.length / 3;
    vertices.forEach(([x, y, z]) => positions.push(x, y, z));
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (!tile.water || !isRenderableTile(tile, unlockedRegions, mapExpansionMode)) continue;
      const worldX = offsetX + x;
      const worldZ = offsetZ + y;
      const waterY = terrainHeight(tile.elevation) + 0.022;
      const x0 = worldX - 0.5;
      const x1 = worldX + 0.5;
      const z0 = worldZ - 0.5;
      const z1 = worldZ + 0.5;
      const neighbors: Array<{ tile: TileData | undefined; edge: 'north' | 'east' | 'south' | 'west' }> = [
        { tile: grid[y - 1]?.[x], edge: 'north' },
        { tile: grid[y]?.[x + 1], edge: 'east' },
        { tile: grid[y + 1]?.[x], edge: 'south' },
        { tile: grid[y]?.[x - 1], edge: 'west' },
      ];

      neighbors.forEach(({ tile: neighbor, edge }) => {
        if (neighbor?.water) return;
        if (edge === 'north') pushQuad([[x0, waterY, z0], [x1, waterY, z0], [x1, waterY, z0 + band], [x0, waterY, z0 + band]]);
        if (edge === 'east') pushQuad([[x1 - band, waterY, z0], [x1, waterY, z0], [x1, waterY, z1], [x1 - band, waterY, z1]]);
        if (edge === 'south') pushQuad([[x1, waterY, z1 - band], [x0, waterY, z1 - band], [x0, waterY, z1], [x1, waterY, z1]]);
        if (edge === 'west') pushQuad([[x0 + band, waterY, z1], [x0, waterY, z1], [x0, waterY, z0], [x0 + band, waterY, z0]]);
      });
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function TerrainGrid({
  grid,
  homeSatisfaction,
  selectedTile = null,
  activeTool,
  money,
  activeOverlay = 'NONE',
  unlockedRegions = ['1,1'],
  mapExpansionMode = false,
  brushSize = 1,
  activeRoadClass = 'LOCAL',
  onTileClick,
  onTilePointerEnter,
  onTilePointerLeave,
  onCancelInteraction,
  onUnlockRegion,
  dragPreviewTiles = [],
  dragPreviewColor = 'green',
  districts = [],
  tutorialHighlight = null,
  terrainRevision = 0,
  nightFactor = 0,
}: TerrainGridProps) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  const [hoveredTile, setHoveredTile] = useState<[number, number] | null>(null);
  const roadPointer = useRef<{ x: number; y: number } | null>(null);
  const touchPointers = useRef(new Set<number>());
  const gestureCancelled = useRef(false);
  useEffect(() => {
    const down = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') { gestureCancelled.current = false; return; }
      if ((event.target as HTMLElement)?.tagName !== 'CANVAS') return;
      touchPointers.current.add(event.pointerId);
      if (touchPointers.current.size === 1) gestureCancelled.current = false;
      if (touchPointers.current.size > 1) {
        gestureCancelled.current = true;
        roadPointer.current = null;
        onCancelInteraction?.();
      }
    };
    const up = (event: PointerEvent) => { touchPointers.current.delete(event.pointerId); };
    const cancel = () => { roadPointer.current = null; touchPointers.current.clear(); gestureCancelled.current = true; };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
    };
  }, [onCancelInteraction]);

  // Check if a tile is inside any unlocked region
  const isTileUnlocked = (x: number, y: number): boolean => {
    const rx = Math.floor(x / 20);
    const ry = Math.floor(y / 20);
    return unlockedRegions.includes(`${rx},${ry}`);
  };
  const roadRec = useMemo(() => {
    if (tutorialHighlight !== 'highway') return null;
    return computeRoadRecommendations(grid, unlockedRegions);
  }, [grid, unlockedRegions, tutorialHighlight]);

  const utilityRec = useMemo(() => {
    if (tutorialHighlight !== 'utilities') return null;
    return computeUtilityRecommendations(grid, unlockedRegions);
  }, [grid, unlockedRegions, tutorialHighlight]);

  const zoningRec = useMemo(() => {
    if (tutorialHighlight !== 'zoning') return null;
    return computeZoningRecommendations(grid, unlockedRegions);
  }, [grid, unlockedRegions, tutorialHighlight]);

  const isRecommendedMissionTile = (x: number, y: number, tile: TileData): boolean => tutorialHighlight === 'mission' && (tile.type !== TileType.EMPTY && !tile.water);

  const unlockedSignature = unlockedRegions.join('|');

  // Ground plane geometry (base level underneath the grid)
  const groundGeo = useMemo(() => {
    return new THREE.BoxGeometry(width * TILE_SIZE + 4, 0.2, height * TILE_SIZE + 4);
  }, [width, height]);

  const terrainMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#35433d',
      roughness: 0.95,
    });
  }, []);

  const waterTimeRef = useRef({ value: 0 });
  const waterTileMat = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.06,
      metalness: 0.18,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = waterTimeRef.current;
      shader.vertexShader = `
        uniform float uWaterTime;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        transformed.y += sin(position.x * 2.6 + position.z * 2.2 + uWaterTime * 1.5) * 0.007 + cos(position.x * 1.4 - position.z * 1.8 + uWaterTime * 1.1) * 0.004;
        `
      );
    };
    return mat;
  }, []);

  useFrame((_, delta) => {
    waterTimeRef.current.value += delta;
  });

  const terrainSurfaceGeo = useMemo(() => (
    createTerrainSurfaceGeometry(grid, unlockedRegions, mapExpansionMode)
  ), [terrainRevision, unlockedSignature, mapExpansionMode]);
  const terrainSurfaceMat = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    side: THREE.DoubleSide,
  }), []);
  const waterSurfaceGeo = useMemo(() => (
    createWaterSurfaceGeometry(grid, unlockedRegions, mapExpansionMode)
  ), [terrainRevision, unlockedSignature, mapExpansionMode]);
  const shorelineGeo = useMemo(() => (
    createShorelineGeometry(grid, unlockedRegions, mapExpansionMode)
  ), [terrainRevision, unlockedSignature, mapExpansionMode]);
  useEffect(() => () => {
    terrainSurfaceGeo.dispose();
    waterSurfaceGeo.dispose();
    shorelineGeo.dispose();
  }, [terrainSurfaceGeo, waterSurfaceGeo, shorelineGeo]);
  const shorelineMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#dfcfab',
    roughness: 0.42,
    metalness: 0.02,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), []);
  useEffect(() => {
    waterTileMat.color.set('#f2d5a1').lerp(new THREE.Color('#294b61'), Math.min(1, Math.max(0, nightFactor) * 0.72));
    shorelineMat.color.set('#dfcfab').lerp(new THREE.Color('#405466'), Math.min(1, Math.max(0, nightFactor) * 0.6));
  }, [nightFactor, shorelineMat, waterTileMat]);
  const placementGhostGeo = useMemo(() => new THREE.BoxGeometry(0.68, 1, 0.68), []);
  const placementPodiumGeo = useMemo(() => new THREE.BoxGeometry(0.9, 0.12, 0.9), []);
  const placementRoofGeo = useMemo(() => new THREE.BoxGeometry(0.5, 0.1, 0.5), []);
  const placementAccessGeo = useMemo(() => new THREE.PlaneGeometry(0.18, 0.42), []);
  const placementRangeGeo = useMemo(() => new THREE.RingGeometry(0.96, 1, 64), []);

  // Compute preview info for cursor hovered tile or brushes
  const previewInfo = useMemo(() => {
    if (!hoveredTile) return null;
    const [hx, hy] = hoveredTile;

    if (hx < 0 || hx >= width || hy < 0 || hy >= height) return null;
    const targetTile = grid[hy][hx];
    const tileUnlocked = isTileUnlocked(hx, hy);

    let color = '#38bdf8'; // Blue for pointer
    let isValid = true;

    const isTerraforming = ['RAISE_TERRAIN', 'LOWER_TERRAIN', 'LEVEL_TERRAIN', 'SMOOTH_TERRAIN'].includes(activeTool as any);

    if (mapExpansionMode) {
      color = '#eab308'; // Orange for expansion clicks
      isValid = !tileUnlocked;
    } else if (!tileUnlocked && activeTool !== 'POINTER') {
      color = '#ef4444'; // Cannot construct on locked tiles
      isValid = false;
    } else if (activeTool === 'BULLDOZER') {
      color = '#ef4444';
      isValid = targetTile.type !== TileType.EMPTY;
    } else if (activeTool === 'DISTRICT') {
      color = '#a78bfa';
      isValid = !targetTile.water;
    } else if (activeTool === 'ROAD_REPAIR') {
      color = '#f59e0b';
      isValid = targetTile.type === TileType.ROAD && (targetTile.roadCondition ?? 100) < 100 && money >= Math.min(ROAD_REPAIR_COST, Math.max(1, Math.ceil(((100 - (targetTile.roadCondition ?? 100)) / 20) * ROAD_REPAIR_COST)));
    } else if (isTerraforming) {
      color = '#06b6d4'; // Cyan for terrain modifications
      isValid = !targetTile.water && money >= TERRAFORM_COST;
    } else if (activeTool !== 'POINTER') {
      const cost = activeTool === 'RESIDENTIAL_MEDIUM'
        ? BUILD_COSTS[TileType.RESIDENTIAL] + 20
        : activeTool === 'RESIDENTIAL_HIGH'
          ? BUILD_COSTS[TileType.RESIDENTIAL] + 45
          : BUILD_COSTS[activeTool as TileType] || 0;
      // Normal placement
      const isTunnel = activeTool === 'TUNNEL_ROAD';
      const canPlace = targetTile.type === TileType.EMPTY && (isTunnel ? !targetTile.water : (!targetTile.water || activeRoadClass === 'HIGHWAY'));
      // Water pump must be placed adjacent to water
      let adjWaterOk = true;
      if (activeTool === TileType.WATER_PUMP) {
        // Must be built on ground next to water
        let hasAdjWater = false;
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of dirs) {
          const nx = hx + dx;
          const ny = hy + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (grid[ny][nx].water) hasAdjWater = true;
          }
        }
        adjWaterOk = hasAdjWater;
      }
      if (activeTool === TileType.FLOOD_BARRIER || activeTool === TileType.WATER_RESERVOIR) {
        const hasHydrologySite = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => {
          const neighbor = grid[hy + dy]?.[hx + dx];
          return Boolean(neighbor?.water || (neighbor?.waterDepth ?? 0) >= 0.2);
        });
        adjWaterOk = hasHydrologySite;
      }

      const placementCost = isTunnel
        ? TUNNEL_BUILD_COST
        : activeTool === TileType.ROAD && targetTile.water && activeRoadClass === 'HIGHWAY'
        ? Math.round(ROAD_BUILD_COSTS.HIGHWAY * GAME_CONFIG.BRIDGE_COST_MULTIPLIER)
        : cost;
      isValid = canPlace && adjWaterOk && money >= placementCost;
      color = isValid ? '#22c55e' : '#ef4444';
    }

    const [wx, , wz] = gridToWorld(hx, hy, width, height);
    const wy = roadHeight(targetTile);
    return { wx, wy, wz, color, isValid };
  }, [hoveredTile, activeTool, activeRoadClass, money, grid, width, height, unlockedRegions, mapExpansionMode]);

  const isBrushTool = ['RESIDENTIAL', 'RESIDENTIAL_MEDIUM', 'RESIDENTIAL_HIGH', 'COMMERCIAL', 'OFFICE', 'INDUSTRIAL', 'RAISE_TERRAIN', 'LOWER_TERRAIN', 'LEVEL_TERRAIN', 'SMOOTH_TERRAIN'].includes(activeTool as string);
  const ghostBuildingType = activeTool === 'RESIDENTIAL_MEDIUM' || activeTool === 'RESIDENTIAL_HIGH'
    ? TileType.RESIDENTIAL
    : Object.values(TileType).includes(activeTool as TileType) ? activeTool as TileType : null;
  const ghostHeight = activeTool === 'RESIDENTIAL_HIGH' ? 1.65
    : activeTool === 'RESIDENTIAL_MEDIUM' ? 1.05
      : ghostBuildingType === TileType.OFFICE ? 1.35
        : ghostBuildingType === TileType.INDUSTRIAL ? 0.58
          : ghostBuildingType === TileType.ROAD ? 0 : 0.72;
  const servicePreviewRadius = [TileType.FIRE_STATION, TileType.POLICE_STATION, TileType.CLINIC, TileType.SCHOOL, TileType.WASTE_MANAGEMENT]
    .includes(ghostBuildingType as TileType) ? 5 : 0;

  // Compute set of coordinates within the brush radius
  const brushTiles = useMemo(() => {
    if (!hoveredTile || brushSize <= 1 || !isBrushTool) return [];
    const [hx, hy] = hoveredTile;
    const tiles: [number, number][] = [];
    const radius = brushSize - 1;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = hx + dx;
        const ty = hy + dy;
        if (tx >= 0 && tx < width && ty >= 0 && ty < height) {
          tiles.push([tx, ty]);
        }
      }
    }
    return tiles;
  }, [hoveredTile, activeTool, brushSize, isBrushTool, width, height]);

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    const point = e.point;
    const coords = worldToGrid(point.x, point.z, width, height);
    if (coords) {
      const [x, y] = coords;
      if (!hoveredTile || hoveredTile[0] !== x || hoveredTile[1] !== y) {
        setHoveredTile([x, y]);
        onTilePointerEnter(x, y);
      }
    } else {
      setHoveredTile(null);
    }
  };

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    // Inspect on click release, so a camera drag cannot select a parcel.
    if (activeTool === 'POINTER' && !mapExpansionMode) return;
    if (e.pointerType === 'touch') return;
    if (activeTool === TileType.ROAD || activeTool === 'TUNNEL_ROAD') roadPointer.current = { x: e.clientX, y: e.clientY };
    const hit = worldToGrid(e.point.x, e.point.z, width, height);
    if (hit) {
      const [hx, hy] = hit;
      const tileUnlocked = isTileUnlocked(hx, hy);
      if (mapExpansionMode && !tileUnlocked) {
        const rx = Math.floor(hx / 20);
        const ry = Math.floor(hy / 20);
        if (onUnlockRegion) onUnlockRegion(rx, ry);
      } else {
        onTileClick(hx, hy);
      }
    }
  };

  // Solid block to hide locked regions
  const lockedRegionMesh = useMemo(() => {
    return new THREE.PlaneGeometry(20, 20);
  }, []);

  const lockedRegionMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#15283a',
      roughness: 0.9,
      transparent: true,
      opacity: 0.22,
    });
  }, []);

  const roadBestPathSet = useMemo(() => new Set((roadRec?.bestPath || []).map(([x, y]) => `${x},${y}`)), [roadRec]);
  const roadValidSet = useMemo(() => new Set((roadRec?.validTiles || []).map(([x, y]) => `${x},${y}`)), [roadRec]);
  const roadBlockedSet = useMemo(() => new Set((roadRec?.blockedTiles || []).map(([x, y]) => `${x},${y}`)), [roadRec]);
  const roadSuboptimalSet = useMemo(() => new Set((roadRec?.suboptimalTiles || []).map(([x, y]) => `${x},${y}`)), [roadRec]);
  const zoningRecSet = useMemo(() => new Set((zoningRec?.recommendedTiles || []).map(([x, y]) => `${x},${y}`)), [zoningRec]);
  const zoningValidSet = useMemo(() => new Set((zoningRec?.validTiles || []).map(([x, y]) => `${x},${y}`)), [zoningRec]);
  const utilityValidSet = useMemo(() => new Set((utilityRec?.validCandidates || []).map(([x, y]) => `${x},${y}`)), [utilityRec]);

  const roadBestPathGeo = useMemo(() => new THREE.PlaneGeometry(0.92, 0.92), []);
  const roadValidGeo = useMemo(() => new THREE.PlaneGeometry(0.74, 0.74), []);
  const roadBlockedGeo = useMemo(() => new THREE.PlaneGeometry(0.62, 0.62), []);
  const roadSuboptimalGeo = useMemo(() => new THREE.PlaneGeometry(0.55, 0.55), []);
  const zoningRecGeo = useMemo(() => new THREE.PlaneGeometry(0.85, 0.85), []);
  const zoningValidGeo = useMemo(() => new THREE.PlaneGeometry(0.68, 0.68), []);
  const utilityTargetGeo = useMemo(() => new THREE.PlaneGeometry(0.88, 0.88), []);
  const utilityValidGeo = useMemo(() => new THREE.PlaneGeometry(0.72, 0.72), []);
  const missionTileGeo = useMemo(() => new THREE.PlaneGeometry(0.78, 0.78), []);

  const roadBestPathMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.72, side: THREE.DoubleSide }), []);
  const roadValidMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.38, side: THREE.DoubleSide }), []);
  const roadBlockedMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#f43f5e', transparent: true, opacity: 0.42, side: THREE.DoubleSide }), []);
  const roadSuboptimalMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#64748b', transparent: true, opacity: 0.22, side: THREE.DoubleSide }), []);
  const zoningRecMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.52, side: THREE.DoubleSide }), []);
  const zoningValidMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.3, side: THREE.DoubleSide }), []);
  const utilityTargetMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.65, side: THREE.DoubleSide }), []);
  const utilityValidMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.32, side: THREE.DoubleSide }), []);
  const missionTileMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e879f9', transparent: true, opacity: 0.42, side: THREE.DoubleSide }), []);


  return (
    <group name="TerrainGrid">
      <TileOverlayInstances homeSatisfaction={homeSatisfaction} grid={grid} overlay={activeOverlay} districts={districts} unlockedRegions={unlockedRegions} expansion={mapExpansionMode} />
      {/* Absolute base floor under the world */}
      <mesh geometry={groundGeo} material={terrainMat} position={[0, -0.65, 0]} receiveShadow />

      {/* Shared render-only surface. Interaction remains on the transparent
          tile planes below so worldToGrid and placement behavior are unchanged. */}
      <mesh geometry={terrainSurfaceGeo} material={terrainSurfaceMat} receiveShadow />
      <mesh geometry={waterSurfaceGeo} material={waterTileMat} receiveShadow />
      <mesh geometry={shorelineGeo} material={shorelineMat} />

      {/* Main interaction canvas plane */}
      <mesh
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={(event) => {
          if (gestureCancelled.current && event.pointerType === 'touch') return;
          if (event.pointerType === 'touch' && activeTool !== 'POINTER') {
            const hit = worldToGrid(event.point.x, event.point.z, width, height);
            if (hit) onTileClick(hit[0], hit[1]);
            return;
          }
          const start = roadPointer.current;
          roadPointer.current = null;
          if (!start || event.button !== 0 || Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 5) return;
          const hit = worldToGrid(event.point.x, event.point.z, width, height);
          if (hit) onTileClick(hit[0], hit[1]);
        }}
        onClick={(event) => {
          if (activeTool !== 'POINTER' || mapExpansionMode || event.button !== 0 || event.delta > 5 || gestureCancelled.current) return;
          event.stopPropagation();
          const hit = worldToGrid(event.point.x, event.point.z, width, height);
          if (hit) onTileClick(hit[0], hit[1]);
        }}
        onPointerOut={() => {
          setHoveredTile(null);
          onTilePointerLeave?.();
        }}
        onContextMenu={(event) => {
          event.stopPropagation();
          event.nativeEvent.preventDefault();
          onCancelInteraction?.();
        }}
        receiveShadow
      >
        <planeGeometry args={[width * TILE_SIZE, height * TILE_SIZE]} />
        <meshStandardMaterial color="#0b0f19" roughness={0.9} transparent opacity={0.0} />
      </mesh>

      {/* 1. Draw Grid Tiles with elevation-responsive coordinate positions */}
      {grid.map((row, y) =>
        row.map((tile, x) => {
          const tileUnlocked = isTileUnlocked(x, y);
          // Performance Optimization: Skip detailed grids if tile is locked and we're not in expansion mode
          if (!tileUnlocked && !mapExpansionMode) return null;

          const [wx, , wz] = gridToWorld(x, y, width, height);
          const tileY = (tile.elevation || 0) * 0.15;
          const coordKey = `${x},${y}`;
          const isBestRoadPath = roadBestPathSet.has(coordKey);
          const isValidRoadTile = roadValidSet.has(coordKey);
          const isBlockedRoadTile = roadBlockedSet.has(coordKey);
          const isSuboptimalRoadTile = roadSuboptimalSet.has(coordKey);

          const isRecommendedZoningTile = zoningRecSet.has(coordKey);
          const isValidZoningTile = zoningValidSet.has(coordKey);

          const isTargetUtilityTile = Boolean((utilityRec?.powerTile?.[0] === x && utilityRec?.powerTile?.[1] === y) || (utilityRec?.pumpTile?.[0] === x && utilityRec?.pumpTile?.[1] === y));
          const isValidUtilityTile = utilityValidSet.has(coordKey);
          const tutorialMissionTile = isRecommendedMissionTile(x, y, tile);

          return (
            <React.Fragment key={`tile-${x}-${y}`}>
              {/* Tutorial Differentiated Road Corridor Highlights */}
              {isBestRoadPath && (
                <mesh geometry={roadBestPathGeo} material={roadBestPathMat} position={[wx, tileY + 0.06, wz]} rotation={[-Math.PI / 2, 0, 0]} />
              )}
              {isValidRoadTile && !isBestRoadPath && (
                <mesh geometry={roadValidGeo} material={roadValidMat} position={[wx, tileY + 0.055, wz]} rotation={[-Math.PI / 2, 0, 0]} />
              )}
              {isBlockedRoadTile && (
                <mesh geometry={roadBlockedGeo} material={roadBlockedMat} position={[wx, tileY + 0.055, wz]} rotation={[-Math.PI / 2, 0, 0]} />
              )}
              {isSuboptimalRoadTile && (
                <mesh geometry={roadSuboptimalGeo} material={roadSuboptimalMat} position={[wx, tileY + 0.055, wz]} rotation={[-Math.PI / 2, 0, 0]} />
              )}

              {/* Tutorial Differentiated Zoning Highlights */}
              {isRecommendedZoningTile && (
                <mesh geometry={zoningRecGeo} material={zoningRecMat} position={[wx, tileY + 0.055, wz]} rotation={[-Math.PI / 2, 0, 0]} />
              )}
              {isValidZoningTile && !isRecommendedZoningTile && (
                <mesh geometry={zoningValidGeo} material={zoningValidMat} position={[wx, tileY + 0.055, wz]} rotation={[-Math.PI / 2, 0, 0]} />
              )}

              {/* Tutorial Utility Highlights */}
              {isTargetUtilityTile && (
                <mesh geometry={utilityTargetGeo} material={utilityTargetMat} position={[wx, tileY + 0.055, wz]} rotation={[-Math.PI / 2, 0, 0]} />
              )}
              {isValidUtilityTile && !isTargetUtilityTile && (
                <mesh geometry={utilityValidGeo} material={utilityValidMat} position={[wx, tileY + 0.055, wz]} rotation={[-Math.PI / 2, 0, 0]} />
              )}

              {tutorialMissionTile && (
                <mesh geometry={missionTileGeo} material={missionTileMat} position={[wx, tileY + 0.055, wz]} rotation={[-Math.PI / 2, 0, 0]} />
              )}
            </React.Fragment>
          );
        })
      )}

      {/* 2. Lock Overlay meshes for Region Expansions */}
      {Array.from({ length: 3 }).map((_, ry) =>
        Array.from({ length: 3 }).map((_, rx) => {
          const key = `${rx},${ry}`;
          const isUnlocked = unlockedRegions.includes(key);
          if (isUnlocked) return null;

          // Compute absolute center of region in world coords
          const rxCenter = rx * 20 + 10;
          const ryCenter = ry * 20 + 10;
          const [wx, , wz] = gridToWorld(rxCenter - 0.5, ryCenter - 0.5, width, height);

          return (
            <group key={`locked-region-${key}`}>
              {/* Translucent fog cover */}
              <mesh geometry={lockedRegionMesh} material={lockedRegionMat} position={[wx, 0.045, wz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
              
              {/* Solid bounding border of locked region */}
              <mesh position={[wx, 0.05, wz]}>
                <boxGeometry args={[20, 0.1, 20]} />
                <meshBasicMaterial color={mapExpansionMode ? '#f5c451' : '#30465e'} wireframe transparent opacity={mapExpansionMode ? 0.9 : 0.55} />
              </mesh>
            </group>
          );
        })
      )}

      {selectedTile && grid[selectedTile.y]?.[selectedTile.x] && <TileMarker
        position={[gridToWorld(selectedTile.x, selectedTile.y, width, height)[0], roadHeight(grid[selectedTile.y][selectedTile.x]) + 0.14, gridToWorld(selectedTile.x, selectedTile.y, width, height)[2]]}
        color="#f8f4cf" />}
      {/* 3. Drag Placement Previews */}
      {dragPreviewTiles.length > 0 && dragPreviewTiles.map(([px, py], idx) => {
        const [pwx, , pwz] = gridToWorld(px, py, width, height);
        const tileY = roadHeight(grid[py]?.[px]);
        const color = dragPreviewColor === 'green' ? '#22c55e' : '#ef4444';
        return (
          <group key={`drag-tile-${px}-${py}-${idx}`} position={[pwx, tileY + 0.045, pwz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.98, 0.98]} />
              <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.98, 0.2, 0.98]} />
              <meshBasicMaterial color={color} wireframe />
            </mesh>
          </group>
        );
      })}

      {/* 4. Circular Terraforming Brush Overlay Preview */}
      {brushTiles.length > 0 && brushTiles.map(([bx, by], idx) => {
        const [bwx, , bwz] = gridToWorld(bx, by, width, height);
        const tileY = (grid[by]?.[bx]?.elevation || 0) * 0.15;
        return (
          <group key={`brush-preview-${bx}-${by}-${idx}`} position={[bwx, tileY + 0.042, bwz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.98, 0.98]} />
              <meshBasicMaterial color="#06b6d4" transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[0.98, 0.1, 0.98]} />
              <meshBasicMaterial color="#22d3ee" wireframe />
            </mesh>
          </group>
        );
      })}

      {/* 5. Standard Build Cursor Box (when no drag active) */}
      {previewInfo && dragPreviewTiles.length === 0 && brushTiles.length === 0 && (
        <group position={[previewInfo.wx, previewInfo.wy + 0.12, previewInfo.wz]}>
          <TileMarker position={[0, 0.04, 0]} color={previewInfo.color} invalid={!previewInfo.isValid} />
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.98, 0.98]} />
            <meshBasicMaterial color={previewInfo.color} transparent opacity={0.15} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.98, 0.2, 0.98]} />
            <meshBasicMaterial color={previewInfo.color} wireframe />
          </mesh>
          {ghostBuildingType && ghostHeight > 0 && (
            <group name="PlacementGhost" position={[0, 0.08, 0]}>
              <mesh geometry={placementPodiumGeo} position={[0, 0.06, 0]}>
                <meshBasicMaterial color={previewInfo.color} transparent opacity={0.22} depthWrite={false} />
              </mesh>
              <mesh geometry={placementGhostGeo} position={[0, ghostHeight / 2 + 0.12, 0]} scale={[1, ghostHeight, 1]}>
                <meshBasicMaterial color={previewInfo.color} transparent opacity={0.28} wireframe={!previewInfo.isValid} depthWrite={false} />
              </mesh>
              <mesh geometry={placementRoofGeo} position={[0.08, ghostHeight + 0.2, -0.08]}>
                <meshBasicMaterial color={previewInfo.color} transparent opacity={0.4} depthWrite={false} />
              </mesh>
              <mesh geometry={placementAccessGeo} position={[0, 0.08, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
                <meshBasicMaterial color={previewInfo.color} transparent opacity={0.58} depthWrite={false} />
              </mesh>
            </group>
          )}
          {servicePreviewRadius > 0 && (
            <mesh geometry={placementRangeGeo} position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[servicePreviewRadius, servicePreviewRadius, 1]}>
              <meshBasicMaterial color={previewInfo.color} transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}
        </group>
      )}

      {/* Thicker 3D Grid borders dividing the regions */}
      <group name="RegionGridBorders" visible={mapExpansionMode}>
        {/* Border line 1 (x = 20) */}
        <mesh position={[getOffsetX(width) + 19.5, 0.1, 0]}>
          <boxGeometry args={[0.1, 0.2, height]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.4} />
        </mesh>
        {/* Border line 2 (x = 40) */}
        <mesh position={[getOffsetX(width) + 39.5, 0.1, 0]}>
          <boxGeometry args={[0.1, 0.2, height]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.4} />
        </mesh>
        {/* Border line 3 (y = 20) */}
        <mesh position={[0, 0.1, getOffsetZ(height) + 19.5]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.1, 0.2, width]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.4} />
        </mesh>
        {/* Border line 4 (y = 40) */}
        <mesh position={[0, 0.1, getOffsetZ(height) + 39.5]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.1, 0.2, width]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.4} />
        </mesh>
      </group>
    </group>
  );
}

function getOffsetX(width: number) {
  return -(width * TILE_SIZE) / 2 + TILE_SIZE / 2;
}

function getOffsetZ(height: number) {
  return -(height * TILE_SIZE) / 2 + TILE_SIZE / 2;
}

