import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TileData, TileType } from '../../types';
import { gridToWorld } from './types3D';
import { terrainHeight } from './visualModel';
import { RenderQualityConfig, RENDER_QUALITY } from '../../renderQuality';
import { getLivingCityStage } from '../../progression';

type Anchor = { x: number; y: number; z: number; rotation?: number; sx?: number; sy?: number; sz?: number };
type Frontage = Anchor & { tile: TileData; dx: number; dz: number; seed: number };

function hash(x: number, y: number, salt = 0) {
  let value = (Math.imul(x + 31, 73856093) ^ Math.imul(y + 47, 19349663) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 2246822519) >>> 0;
  return value / 4294967296;
}

function isUrban(tile?: TileData) {
  return Boolean(tile && [TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL, TileType.PARK].includes(tile.type));
}

function deriveFrontages(grid: TileData[][]): Frontage[] {
  const height = grid.length, width = grid[0]?.length ?? 0;
  const directions = [{ dx: 0, dy: 1, rotation: 0 }, { dx: 1, dy: 0, rotation: Math.PI / 2 }, { dx: 0, dy: -1, rotation: Math.PI }, { dx: -1, dy: 0, rotation: -Math.PI / 2 }];
  const result: Frontage[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const tile = grid[y][x];
    if (!isUrban(tile)) continue;
    const roadSides = directions.filter((d) => grid[y + d.dy]?.[x + d.dx]?.type === TileType.ROAD);
    if (!roadSides.length) continue;
    const side = roadSides[Math.floor(hash(x, y, 71) * roadSides.length)];
    const [wx, , wz] = gridToWorld(x, y, width, height);
    result.push({ tile, x: wx, y: terrainHeight(tile.elevation), z: wz, dx: side.dx, dz: side.dy, rotation: side.rotation, seed: hash(x, y, tile.parcelSeed ?? 0) });
  }
  return result;
}

/** Render-only urban composition. All placements derive deterministically from existing TileData. */
export function PremiumCityLayer({
  grid,
  quality = RENDER_QUALITY.balanced,
  population = 0,
  happiness = 50,
  nightFactor = 0,
}: {
  grid: TileData[][];
  quality?: RenderQualityConfig;
  population?: number;
  happiness?: number;
  nightFactor?: number;
}) {
  const mobile = quality.preset === 'mobile';
  const stage = getLivingCityStage(population);
  const frontageLimit = Math.min(mobile ? 72 : 180, (mobile ? 22 : 36) + stage * (mobile ? 12 : 32));
  const frontages = useMemo(() => deriveFrontages(grid).slice(0, frontageLimit), [frontageLimit, grid]);
  const access = useMemo(() => frontages.map((f) => ({ x: f.x + f.dx * .28, y: f.y + .04, z: f.z + f.dz * .28, rotation: f.rotation, sx: .22, sz: .58 })), [frontages]);
  const curbs = useMemo(() => frontages.map((f) => ({ x: f.x + f.dx * .47, y: f.y + .075, z: f.z + f.dz * .47, rotation: f.rotation, sx: .72 })), [frontages]);
  const trees = useMemo(() => frontages.filter((f) => [TileType.RESIDENTIAL, TileType.OFFICE, TileType.PARK].includes(f.tile.type) && f.seed > .25 + Math.min(.5, (f.tile.pollution ?? 0) / 150) - Math.max(0, happiness - 65) / 300).map((f) => ({ x: f.x - f.dz * .34 + f.dx * .34, y: f.y + .12, z: f.z + f.dx * .34 + f.dz * .34, sx: .72 + f.seed * .35, sy: .82 + f.seed * .35, sz: .72 + f.seed * .35 })), [frontages, happiness]);
  const lights = useMemo(() => frontages.filter((f, i) => f.tile.powered && i % (mobile ? 5 : 3) === 0).map((f) => ({ x: f.x + f.dz * .36 + f.dx * .4, y: f.y + .34, z: f.z - f.dx * .36 + f.dz * .4 })), [frontages, mobile]);
  const bins = useMemo(() => frontages.filter((f, i) => i % 2 === 0 && [TileType.COMMERCIAL, TileType.OFFICE].includes(f.tile.type)).map((f) => ({ x: f.x - f.dz * .32 + f.dx * .4, y: f.y + .1, z: f.z + f.dx * .32 + f.dz * .4, rotation: f.rotation })), [frontages]);
  const cars = useMemo(() => frontages.filter((f) => {
    const activity = Math.min(.88, .12 + stage * .14 + Math.min(.3, (f.tile.traffic ?? 0) / 260));
    return ([TileType.COMMERCIAL, TileType.OFFICE].includes(f.tile.type) || f.tile.type === TileType.RESIDENTIAL) && f.seed < activity;
  }).map((f) => ({ x: f.x + f.dz * .24 - f.dx * .08, y: f.y + .075, z: f.z - f.dx * .24 - f.dz * .08, rotation: f.rotation })), [frontages, stage]);
  const crates = useMemo(() => frontages.filter((f) => f.tile.type === TileType.INDUSTRIAL).flatMap((f) => [-.2, .2].map((side) => ({ x: f.x + f.dz * side - f.dx * .27, y: f.y + .11, z: f.z - f.dx * side - f.dz * .27, rotation: f.rotation }))), [frontages]);
  const waterfront = useMemo(() => {
    const result: Anchor[] = [], h = grid.length, w = grid[0]?.length ?? 0;
    const edges = [[0, -1, 0], [1, 0, Math.PI / 2], [0, 1, 0], [-1, 0, Math.PI / 2]] as const;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const tile = grid[y][x];
      if (tile.water || (!isUrban(tile) && tile.type !== TileType.ROAD)) continue;
      for (const [dx, dy, rotation] of edges) if (grid[y + dy]?.[x + dx]?.water) {
        const [wx, , wz] = gridToWorld(x, y, w, h);
        result.push({ x: wx + dx * .43, y: terrainHeight(tile.elevation) + .04, z: wz + dy * .43, rotation, sz: .22 });
      }
    }
    return result.slice(0, mobile ? 56 : 160);
  }, [grid, mobile]);
  const water = useMemo(() => grid.flat().filter((tile) => tile.water).slice(0, mobile ? 5 : 14).map((tile) => worldAnchor(grid, tile)), [grid, mobile]);
  const steam = useMemo(() => frontages.filter((f) => f.tile.type === TileType.INDUSTRIAL && (f.tile.level ?? 1) > 1).slice(0, mobile ? 3 : 8), [frontages, mobile]);
  const geos = useMemo(() => ({ access: new THREE.BoxGeometry(1, .025, 1), curb: new THREE.BoxGeometry(1, .07, .055), tree: new THREE.IcosahedronGeometry(.15, 1), trunk: new THREE.CylinderGeometry(.025, .035, .24, 6), light: new THREE.CylinderGeometry(.018, .024, .68, 6), bulb: new THREE.SphereGeometry(.045, 6, 5), bin: new THREE.BoxGeometry(.1, .18, .1), car: new THREE.BoxGeometry(.28, .09, .14), crate: new THREE.BoxGeometry(.2, .2, .2), promenade: new THREE.BoxGeometry(1, .035, 1) }), []);
  const mats = useMemo(() => ({ pavement: new THREE.MeshStandardMaterial({ color: '#b8b1a2', roughness: .94 }), curb: new THREE.MeshStandardMaterial({ color: '#d2d0c7', roughness: .9 }), foliage: new THREE.MeshStandardMaterial({ color: happiness >= 70 ? '#3f7a49' : '#52664a', roughness: .88 }), trunk: new THREE.MeshStandardMaterial({ color: '#654b37', roughness: .95 }), metal: new THREE.MeshStandardMaterial({ color: '#35414a', roughness: .36, metalness: .68 }), lamp: new THREE.MeshStandardMaterial({ color: '#ffe2a1', emissive: '#ffb85c', emissiveIntensity: nightFactor > .2 ? .92 : .08 }), bin: new THREE.MeshStandardMaterial({ color: '#365c50', roughness: .7 }), car: new THREE.MeshStandardMaterial({ color: '#6f3541', roughness: .38, metalness: .48 }), crate: new THREE.MeshStandardMaterial({ color: '#9a7448', roughness: .86 }), promenade: new THREE.MeshStandardMaterial({ color: '#c8b896', roughness: .92 }) }), [happiness, nightFactor]);
  return <group name="PremiumCityPresentation" raycast={() => null}>
    <Instances name="FrontageAccessPaths" positions={access} geometry={geos.access} material={mats.pavement} /><Instances name="ContinuousParcelCurbs" positions={curbs} geometry={geos.curb} material={mats.curb} />
    <Instances name="StreetTreeTrunks" positions={trees} geometry={geos.trunk} material={mats.trunk} /><Instances name="StreetTreeCanopies" positions={trees.map((p) => ({ ...p, y: p.y + .2 }))} geometry={geos.tree} material={mats.foliage} />
    <Instances name="StreetLightPoles" positions={lights} geometry={geos.light} material={mats.metal} /><Instances name="StreetLightGlow" positions={lights.map((p) => ({ ...p, y: p.y + .34 }))} geometry={geos.bulb} material={mats.lamp} />
    {!mobile && <Instances name="StreetBinsAndSigns" positions={bins} geometry={geos.bin} material={mats.bin} />}<Instances name="DeterministicParkedCars" positions={cars} geometry={geos.car} material={mats.car} />
    {!mobile && <Instances name="IndustrialStorageYards" positions={crates} geometry={geos.crate} material={mats.crate} />}<Instances name="WaterfrontPromenade" positions={waterfront} geometry={geos.promenade} material={mats.promenade} />
    {quality.waterSheen && <WaterMotion positions={water} />}{quality.steam && <IndustrialAtmosphere positions={steam} />}
  </group>;
}

function worldAnchor(grid: TileData[][], tile: TileData): Anchor { const [x, , z] = gridToWorld(tile.x, tile.y, grid[0]?.length ?? 60, grid.length); return { x, y: terrainHeight(tile.elevation), z }; }

function Instances({ name, positions, geometry, material }: { name: string; positions: Anchor[]; geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => { if (!ref.current) return; const object = new THREE.Object3D(); positions.forEach((p, i) => { object.position.set(p.x, p.y, p.z); object.rotation.set(0, p.rotation ?? 0, 0); object.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1); object.updateMatrix(); ref.current!.setMatrixAt(i, object.matrix); }); ref.current.count = positions.length; ref.current.instanceMatrix.needsUpdate = true; ref.current.computeBoundingSphere(); }, [positions]);
  return <instancedMesh ref={ref} name={name} args={[geometry, material, Math.max(1, positions.length)]} count={positions.length} castShadow receiveShadow />;
}

function WaterMotion({ positions }: { positions: Anchor[] }) { const ref = useRef<THREE.Group>(null); const geo = useMemo(() => new THREE.RingGeometry(.14, .16, 12), []); const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#d5c49a', transparent: true, opacity: .18, side: THREE.DoubleSide }), []); useFrame(({ clock }) => ref.current?.children.forEach((child, i) => child.scale.setScalar(.8 + Math.sin(clock.elapsedTime * 1.4 + i) * .16))); return <group ref={ref} name="WaterSheen">{positions.map((p, i) => <mesh key={i} geometry={geo} material={mat} position={[p.x, p.y + .025, p.z]} rotation={[-Math.PI / 2, 0, 0]} />)}</group>; }

function IndustrialAtmosphere({ positions }: { positions: Frontage[] }) { const ref = useRef<THREE.Group>(null); const geo = useMemo(() => new THREE.SphereGeometry(.1, 6, 5), []); const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#d5d0c1', transparent: true, opacity: .2, depthWrite: false }), []); useFrame(({ clock }) => ref.current?.children.forEach((child, i) => { child.position.y = positions[i].y + .8 + ((clock.elapsedTime * .18 + i * .13) % .55); })); return <group ref={ref} name="IndustrialSteam">{positions.map((p, i) => <mesh key={i} geometry={geo} material={mat} position={[p.x + .22, p.y + .8, p.z - .18]} />)}</group>; }
