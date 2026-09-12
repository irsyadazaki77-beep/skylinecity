import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TileData, TileType } from '../../../types';
import { BuildingVisualSpec } from '../visualModel';
import { BuildingLod, sharedBuildingGeos, sharedBuildingMats } from './sharedKits';
import type { DistrictVisualTheme } from '../../../neighborhoodIdentity';

type Part = { p: [number, number, number]; s: [number, number, number] };

function massing(spec: BuildingVisualSpec): Part[] {
  const { width: w, depth: d, height: h } = spec;
  const base: Part = { p: [0, h / 2 + .07, 0], s: [w, h, d] };
  if (spec.archetype === 'DETACHED_HOUSE' || spec.archetype === 'VILLA') return [
    { p: [0, h * .48 + .07, -.04], s: [w * .82, h * .94, d * .76] },
    ...(spec.archetype === 'VILLA' ? [{ p: [w * .3, h * .32 + .07, .16], s: [w * .28, h * .56, d * .36] } as Part] : []),
  ];
  if (spec.archetype === 'TOWNHOUSE_ROW' || spec.archetype === 'RETAIL_STRIP') return [-.3, 0, .3].map((x, i) => ({
    p: [x * w, h * (.46 + i * .035) + .07, 0], s: [w * .29, h * (.92 + i * .07), d],
  }));
  if (spec.archetype === 'WAREHOUSE') return [
    { p: [-w * .08, h * .38 + .07, 0], s: [w, h * .76, d] },
    { p: [w * .32, h * .64 + .07, -d * .24], s: [w * .24, h * .52, d * .32] },
  ];
  if (spec.archetype === 'FACTORY' || spec.archetype === 'INDUSTRIAL_CAMPUS') return [
    { p: [-w * .2, h * .42 + .07, 0], s: [w * .58, h * .84, d] },
    { p: [w * .25, h * .28 + .07, d * .16], s: [w * .38, h * .56, d * .58] },
    { p: [w * .27, h * .52 + .07, -d * .27], s: [w * .22, h * .42, d * .25] },
  ];
  if (spec.archetype === 'GLASS_TOWER' || spec.archetype === 'CIVIC_TOWER') return [
    { p: [0, Math.min(.24, spec.podiumHeight) / 2 + .07, 0], s: [w, Math.min(.24, spec.podiumHeight), d] },
    { p: [spec.imperfection, h * .46 + .25, 0], s: [w * .66, h * .82, d * .66] },
    { p: [-spec.imperfection, h * .89 + .25, -.02], s: [w * .46, h * .22, d * .48] },
  ];
  if (spec.silhouette === 'ROW') return [
    { p: [-w * .27, h * .46 + .07, 0], s: [w * .43, h * .92, d] },
    { p: [w * .25, h * .55 + .07, -.03], s: [w * .48, h * 1.1, d * .92] },
  ];
  if (spec.silhouette === 'L_SHAPE') return [
    { p: [-w * .17, h / 2 + .07, 0], s: [w * .66, h, d] },
    { p: [w * .27, h * .37 + .07, d * .18], s: [w * .28, h * .74, d * .62] },
  ];
  if (spec.silhouette === 'U_SHAPE' || spec.silhouette === 'COURTYARD') return [
    { p: [0, h / 2 + .07, -d * .25], s: [w, h, d * .46] },
    { p: [-w * .34, h * .42 + .07, d * .18], s: [w * .28, h * .84, d * .55] },
    { p: [w * .34, h * .48 + .07, d * .18], s: [w * .28, h * .96, d * .55] },
  ];
  if (spec.silhouette === 'CORNER') return [base,
    { p: [w * .27, h * .64 + .07, -d * .2], s: [w * .38, h * .55, d * .46] },
  ];
  return [base,
    { p: [spec.imperfection, h * .82 + .07, 0], s: [w * .72, h * .64, d * .72] },
    { p: [-spec.imperfection, h * 1.08 + .07, 0], s: [w * .42, h * .28, d * .44] },
  ];
}

function palette(type: TileType, accent: number, abandoned: boolean, districtTheme?: DistrictVisualTheme) {
  if (abandoned) return { main: sharedBuildingMats.resL3_abd, trim: sharedBuildingMats.resDarkMetal, glass: sharedBuildingMats.windowDark };
  if (districtTheme === 'OLD_TOWN') return { main: sharedBuildingMats.resFacadeClay, trim: sharedBuildingMats.resTimber, glass: sharedBuildingMats.windowWarm };
  if (districtTheme === 'GARDEN_RESIDENTIAL') return { main: sharedBuildingMats.resFacadeWhite, trim: sharedBuildingMats.resPaving, glass: sharedBuildingMats.resGlassBlue };
  if (districtTheme === 'LOGISTICS_INDUSTRIAL') return { main: sharedBuildingMats.indFacadeSteel, trim: sharedBuildingMats.indSafety, glass: sharedBuildingMats.indGlass };
  if (districtTheme === 'MODERN_DOWNTOWN') return { main: sharedBuildingMats.officeSteel, trim: sharedBuildingMats.officeBronze, glass: sharedBuildingMats.officeGlass };
  if (type === TileType.RESIDENTIAL) return { main: [sharedBuildingMats.resFacadeSand, sharedBuildingMats.resFacadeClay, sharedBuildingMats.resFacadeWhite, sharedBuildingMats.resFacadeBlue, sharedBuildingMats.resFacadeSlate][accent], trim: sharedBuildingMats.resTimber, glass: sharedBuildingMats.resGlassBlue };
  if (type === TileType.INDUSTRIAL) return { main: [sharedBuildingMats.indFacadeSteel, sharedBuildingMats.indFacadeWhite, sharedBuildingMats.indFacadeBlue, sharedBuildingMats.indFacadeTeal, sharedBuildingMats.indL2][accent], trim: sharedBuildingMats.indSafety, glass: sharedBuildingMats.indGlass };
  if (type === TileType.OFFICE) return { main: [sharedBuildingMats.officeWhite, sharedBuildingMats.officeBronze, sharedBuildingMats.resConcrete, sharedBuildingMats.resFacadeSlate, sharedBuildingMats.officeSteel][accent], trim: sharedBuildingMats.officeSteel, glass: sharedBuildingMats.officeGlass };
  return { main: [sharedBuildingMats.comL1, sharedBuildingMats.comL2, sharedBuildingMats.comL3, sharedBuildingMats.resFacadeClay, sharedBuildingMats.officeBronze][accent], trim: sharedBuildingMats.retailAwningRed, glass: sharedBuildingMats.glass };
}

export function ProceduralBuilding({ tile, spec, lod, nightFactor = 0, districtTheme }: { tile: TileData; spec: BuildingVisualSpec; lod: BuildingLod; nightFactor?: number; districtTheme?: DistrictVisualTheme }) {
  const mats = palette(tile.type, spec.accentIndex, Boolean(tile.abandoned), districtTheme);
  const parts = massing(spec);
  const near = lod === 'NEAR';
  const mid = lod === 'MID';
  const facadeRows = Math.min(8, Math.max(1, spec.floors));
  const windowMat = nightFactor > .18 && !tile.abandoned ? sharedBuildingMats.windowWarm : mats.glass;
  return <group name={`Procedural-${spec.silhouette}-${lod}`}>
    {near && <mesh geometry={sharedBuildingGeos.contactDisc} material={sharedBuildingMats.contactShadow} position={[0, .068, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.08, .9, 1]} />}
    {parts.map((part, i) => <mesh key={`m-${i}`} geometry={near || mid ? sharedBuildingGeos.bevelBox : sharedBuildingGeos.unitBox} material={i === 0 ? mats.main : (i % 2 ? mats.trim : mats.main)} position={part.p} scale={part.s} castShadow={near} receiveShadow />)}
    {(mid || near) && <mesh geometry={sharedBuildingGeos.bevelBox} material={mats.trim} position={[0, spec.podiumHeight / 2 + .07, .02]} scale={[Math.min(.92, spec.width + .08), spec.podiumHeight, Math.min(.9, spec.depth + .06)]} castShadow={near} />}
    {(mid || near) && <FacadeWindows spec={spec} rows={mid ? Math.min(3, facadeRows) : facadeRows} mid={mid} frameMaterial={mats.trim} windowMaterial={windowMat} />}
    {near && <>
      <mesh geometry={sharedBuildingGeos.unitBox} material={mats.trim} position={[0, .17, spec.depth / 2 + .095]} scale={[.16, .26, .035]} />
      <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.resConcrete} position={[0, .075, spec.depth / 2 + .16]} scale={[.34, .035, .26]} />
      {Array.from({ length: spec.balconyCount }, (_, n) => <mesh key={n} geometry={sharedBuildingGeos.balconyBox} material={sharedBuildingMats.resConcrete} position={[(n % 2 ? -.2 : .2), .48 + n * .2, spec.depth / 2 + .12]} scale={[.68, .65, .7]} />)}
      {spec.hasCanopy && <mesh geometry={sharedBuildingGeos.unitBox} material={mats.trim} position={[0, .31, spec.depth / 2 + .17]} rotation={[.12, 0, 0]} scale={[.52, .035, .2]} />}
      {(tile.type === TileType.COMMERCIAL || spec.archetype === 'MIXED_USE_BLOCK') && <Shopfront spec={spec} accent={mats.trim} window={windowMat} />}
      {spec.hasFireEscape && <FireEscape spec={spec} />}
      {spec.hasCrown && <Crown spec={spec} material={mats.trim} />}
      <RoofProps spec={spec} industrial={tile.type === TileType.INDUSTRIAL} />
      {tile.type === TileType.INDUSTRIAL && <IndustrialYard />}
      {tile.type === TileType.RESIDENTIAL && spec.floors <= 3 && <HouseDetails spec={spec} />}
    </>}
  </group>;
}

function FacadeWindows({ spec, rows, mid, frameMaterial, windowMaterial }: { spec: BuildingVisualSpec; rows: number; mid: boolean; frameMaterial: THREE.Material; windowMaterial: THREE.Material }) {
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const matrices = useMemo(() => {
    const result: THREE.Matrix4[] = [];
    const columns = mid ? 2 : Math.max(2, Math.min(5, Math.round(spec.width / .17)));
    const object = new THREE.Object3D();
    for (let row = 0; row < rows; row += 1) {
      const y = .22 + row * Math.max(.13, (spec.height - .18) / Math.max(1, rows));
      for (let col = 0; col < columns; col += 1) {
        if (((row * 7 + col + spec.windowPattern) % 11) === 0) continue;
        const x = (col - (columns - 1) / 2) * (spec.width * .78 / columns);
        object.position.set(x, y, spec.depth / 2 + .076);
        object.scale.set(.62, .28, 1);
        object.updateMatrix();
        result.push(object.matrix.clone());
        if (!mid && col < Math.max(1, columns - 1)) {
          object.position.set(spec.width / 2 + .076, y, x * spec.depth / Math.max(.2, spec.width));
          object.rotation.set(0, Math.PI / 2, 0);
          object.updateMatrix();
          result.push(object.matrix.clone());
          object.rotation.set(0, 0, 0);
        }
      }
    }
    return result;
  }, [mid, rows, spec.depth, spec.height, spec.width, spec.windowPattern]);
  useLayoutEffect(() => {
    matrices.forEach((matrix, index) => {
      frameRef.current?.setMatrixAt(index, matrix);
      const inset = matrix.clone().scale(new THREE.Vector3(.78, .72, 1)).premultiply(new THREE.Matrix4().makeTranslation(0, 0, .006));
      glassRef.current?.setMatrixAt(index, inset);
    });
    if (frameRef.current) frameRef.current.instanceMatrix.needsUpdate = true;
    if (glassRef.current) glassRef.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  if (!matrices.length) return null;
  return <group name="InstancedFacadeWindows">
    <instancedMesh ref={frameRef} args={[sharedBuildingGeos.windowPanel, frameMaterial, matrices.length]} frustumCulled={false} />
    <instancedMesh ref={glassRef} args={[sharedBuildingGeos.windowPanel, windowMaterial, matrices.length]} frustumCulled={false} />
  </group>;
}

function RoofProps({ spec, industrial }: { spec: BuildingVisualSpec; industrial: boolean }) {
  const y = spec.height + .11;
  return <group position={[0, y, 0]}>
    <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.roof} scale={[spec.width * .82, .05, spec.depth * .82]} />
    {spec.roofProp === 'SOLAR' && <mesh geometry={sharedBuildingGeos.solarPanel} material={sharedBuildingMats.resSolar} position={[.08, .07, 0]} rotation={[0, 0, -.18]} />}
    {spec.roofProp === 'TANK' && <mesh geometry={sharedBuildingGeos.waterTank} material={sharedBuildingMats.metal} position={[.1, .14, 0]} />}
    {spec.roofProp === 'HVAC' && <mesh geometry={sharedBuildingGeos.hvacBox} material={sharedBuildingMats.metal} position={[-.1, .09, 0]} />}
    {spec.roofProp === 'ANTENNA' && <mesh geometry={sharedBuildingGeos.antenna} material={sharedBuildingMats.metal} position={[0, .2, 0]} />}
    {industrial && <mesh geometry={sharedBuildingGeos.vent} material={sharedBuildingMats.metal} position={[-.22, .16, -.12]} />}
  </group>;
}

function Shopfront({ spec, accent, window }: { spec: BuildingVisualSpec; accent: THREE.Material; window: THREE.Material }) { return <group position={[0, .2, spec.depth / 2 + .088]}>
  <mesh geometry={sharedBuildingGeos.unitBox} material={window} scale={[spec.width * .72, .26, .025]} />
  <mesh geometry={sharedBuildingGeos.unitBox} material={accent} position={[0, .2, .055]} rotation={[.18, 0, 0]} scale={[spec.width * .82, .035, .16]} />
  <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.windowWarm} position={[-spec.width * .22, .32, .02]} scale={[spec.width * .22, .09, .028]} />
</group>; }

function FireEscape({ spec }: { spec: BuildingVisualSpec }) { return <group position={[-spec.width / 2 - .07, spec.height * .55, 0]}>
  {[0, .22, .44].map((y) => <mesh key={y} geometry={sharedBuildingGeos.balconyBox} material={sharedBuildingMats.metal} position={[0, y - .22, 0]} rotation={[0, Math.PI / 2, 0]} scale={[.7, .5, .72]} />)}
  <mesh geometry={sharedBuildingGeos.pipe} material={sharedBuildingMats.metal} rotation={[0, 0, -.48]} scale={[1.35, 1, 1]} />
</group>; }

function Crown({ spec, material }: { spec: BuildingVisualSpec; material: THREE.Material }) { return <group position={[0, spec.height + .28, 0]}>
  <mesh geometry={sharedBuildingGeos.bevelBox} material={material} scale={[spec.width * .48, .25, spec.depth * .48]} />
  <mesh geometry={sharedBuildingGeos.antenna} material={sharedBuildingMats.metal} position={[0, .32, 0]} />
</group>; }

function IndustrialYard() { return <group>
  <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.indSafety} position={[.22, .18, .43]} scale={[.28, .3, .035]} />
  <mesh geometry={sharedBuildingGeos.silo} material={sharedBuildingMats.indFacadeSteel} position={[-.31, .3, -.2]} />
  <mesh geometry={sharedBuildingGeos.pipe} material={sharedBuildingMats.metal} position={[-.12, .22, -.31]} rotation={[0, 0, Math.PI / 2]} />
  <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.indFacadeBlue} position={[.3, .12, -.33]} scale={[.22, .18, .16]} />
  <mesh geometry={sharedBuildingGeos.fence} material={sharedBuildingMats.metal} position={[0, .13, -.46]} />
</group>; }

function HouseDetails({ spec }: { spec: BuildingVisualSpec }) { return <group>
  <mesh geometry={sharedBuildingGeos.pitchedRoof} material={sharedBuildingMats.roof} position={[0, spec.height + .14, 0]} scale={[spec.width * .75, .25, spec.depth * .7]} rotation={[0, Math.PI / 4, 0]} />
  <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.resPaving} position={[-.28, .045, .2]} scale={[.2, .04, .48]} />
  <mesh geometry={sharedBuildingGeos.fence} material={sharedBuildingMats.resTimber} position={[0, .12, -.45]} />
</group>; }
