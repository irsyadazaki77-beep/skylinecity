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
  if (spec.silhouette === 'COMPACT_BOX') return [
    { p: [0, h * 0.48 + 0.07, 0], s: [w * 0.85, h * 0.94, d * 0.85] },
  ];
  if (spec.silhouette === 'SHED') return [
    { p: [0, h * 0.45 + 0.07, 0], s: [w * 0.9, h * 0.88, d * 0.85] },
  ];
  if (spec.silhouette === 'SETBACK') return [
    { p: [0, h * 0.25 + 0.07, 0], s: [w, h * 0.5, d] },
    { p: [0, h * 0.65 + 0.07, 0], s: [w * 0.72, h * 0.45, d * 0.72] },
    { p: [0, h * 0.92 + 0.07, 0], s: [w * 0.46, h * 0.25, d * 0.46] },
  ];
  if (spec.silhouette === 'TWIN_TOWER') return [
    { p: [0, Math.min(0.2, spec.podiumHeight) / 2 + 0.07, 0], s: [w, Math.min(0.2, spec.podiumHeight), d] },
    { p: [-w * 0.22, h * 0.5 + 0.12, 0], s: [w * 0.38, h * 0.85, d * 0.75] },
    { p: [w * 0.22, h * 0.52 + 0.12, 0], s: [w * 0.38, h * 0.9, d * 0.75] },
  ];
  if (spec.silhouette === 'T_SHAPE') return [
    { p: [0, h / 2 + 0.07, -d * 0.15], s: [w * 0.9, h, d * 0.45] },
    { p: [0, h * 0.48 + 0.07, d * 0.18], s: [w * 0.42, h * 0.95, d * 0.5] },
  ];
  if (spec.silhouette === 'ATRIUM') return [
    { p: [-w * 0.32, h / 2 + 0.07, 0], s: [w * 0.32, h, d] },
    { p: [w * 0.32, h / 2 + 0.07, 0], s: [w * 0.32, h, d] },
    { p: [0, h * 0.45 + 0.07, -d * 0.32], s: [w * 0.42, h * 0.9, d * 0.3] },
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
  if (districtTheme === 'OLD_TOWN') return { main: sharedBuildingMats.resBrickRed, trim: sharedBuildingMats.resTimber, glass: sharedBuildingMats.windowWarm };
  if (districtTheme === 'GARDEN_RESIDENTIAL') return { main: sharedBuildingMats.resFacadeWhite, trim: sharedBuildingMats.resPaving, glass: sharedBuildingMats.resGlassBlue };
  if (districtTheme === 'LOGISTICS_INDUSTRIAL') return { main: sharedBuildingMats.indCorrugated, trim: sharedBuildingMats.indSafety, glass: sharedBuildingMats.indGlass };
  if (districtTheme === 'MODERN_DOWNTOWN') return { main: sharedBuildingMats.officeSteel, trim: sharedBuildingMats.officeBronze, glass: sharedBuildingMats.officeGlass };
  if (type === TileType.RESIDENTIAL) {
    return {
      main: [sharedBuildingMats.resFacadeSand, sharedBuildingMats.resBrickRed, sharedBuildingMats.resWeatherboard, sharedBuildingMats.resBrickTan, sharedBuildingMats.resFacadeSlate][accent],
      trim: sharedBuildingMats.resTimber,
      glass: sharedBuildingMats.resGlassBlue,
    };
  }
  if (type === TileType.INDUSTRIAL) {
    return {
      main: [sharedBuildingMats.indCorrugated, sharedBuildingMats.indFacadeSteel, sharedBuildingMats.indRust, sharedBuildingMats.indFacadeTeal, sharedBuildingMats.indL2][accent],
      trim: sharedBuildingMats.indSafety,
      glass: sharedBuildingMats.indGlass,
    };
  }
  if (type === TileType.OFFICE) {
    return {
      main: [sharedBuildingMats.officeWhite, sharedBuildingMats.officeBronze, sharedBuildingMats.resConcrete, sharedBuildingMats.resFacadeSlate, sharedBuildingMats.officeSteel][accent],
      trim: sharedBuildingMats.officeSteel,
      glass: sharedBuildingMats.officeGlass,
    };
  }
  return {
    main: [sharedBuildingMats.comL1, sharedBuildingMats.comL2, sharedBuildingMats.resBrickTan, sharedBuildingMats.resFacadeClay, sharedBuildingMats.officeBronze][accent],
    trim: sharedBuildingMats.retailAwningRed,
    glass: sharedBuildingMats.glass,
  };
}

export function ProceduralBuilding({ tile, spec, lod, nightFactor = 0, districtTheme }: { tile: TileData; spec: BuildingVisualSpec; lod: BuildingLod; nightFactor?: number; districtTheme?: DistrictVisualTheme }) {
  const mats = palette(tile.type, spec.accentIndex, Boolean(tile.abandoned), districtTheme);
  const parts = massing(spec);
  const near = lod === 'NEAR';
  const mid = lod === 'MID';
  const facadeRows = Math.min(8, Math.max(1, spec.floors));
  const isNight = nightFactor > 0.18 && !tile.abandoned;
  const windowMat = isNight
    ? (tile.type === TileType.OFFICE ? sharedBuildingMats.windowCoolLit : tile.type === TileType.COMMERCIAL ? sharedBuildingMats.windowShopLit : sharedBuildingMats.windowWarm)
    : mats.glass;

  return (
    <group name={`Procedural-${spec.silhouette}-${lod}`}>
      {near && (
        <mesh
          geometry={sharedBuildingGeos.contactDisc}
          material={sharedBuildingMats.contactShadow}
          position={[0, 0.068, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1.08, 0.9, 1]}
        />
      )}
      {parts.map((part, i) => (
        <mesh
          key={`m-${i}`}
          geometry={near || mid ? sharedBuildingGeos.bevelBox : sharedBuildingGeos.unitBox}
          material={i === 0 ? mats.main : (i % 2 ? mats.trim : mats.main)}
          position={part.p}
          scale={part.s}
          castShadow={near}
          receiveShadow
        />
      ))}
      {(mid || near) && (
        <mesh
          geometry={sharedBuildingGeos.bevelBox}
          material={mats.trim}
          position={[0, spec.podiumHeight / 2 + 0.07, 0.02]}
          scale={[Math.min(0.92, spec.width + 0.08), spec.podiumHeight, Math.min(0.9, spec.depth + 0.06)]}
          castShadow={near}
        />
      )}
      {(mid || near) && (
        <FacadeWindows
          spec={spec}
          rows={mid ? Math.min(3, facadeRows) : facadeRows}
          mid={mid}
          frameMaterial={mats.trim}
          windowMaterial={windowMat}
        />
      )}
      {/* Architectural Roof Styles */}
      {(near || mid) && (
        <ArchitecturalRoof spec={spec} type={tile.type} near={near} />
      )}
      {near && (
        <>
          <mesh
            geometry={sharedBuildingGeos.unitBox}
            material={mats.trim}
            position={[0, 0.17, spec.depth / 2 + 0.095]}
            scale={[0.16, 0.26, 0.035]}
          />
          <mesh
            geometry={sharedBuildingGeos.unitBox}
            material={sharedBuildingMats.resConcrete}
            position={[0, 0.075, spec.depth / 2 + 0.16]}
            scale={[0.34, 0.035, 0.26]}
          />
          {Array.from({ length: spec.balconyCount }, (_, n) => (
            <mesh
              key={n}
              geometry={sharedBuildingGeos.balconyRailing}
              material={sharedBuildingMats.resConcrete}
              position={[(n % 2 ? -0.2 : 0.2), 0.48 + n * 0.2, spec.depth / 2 + 0.12]}
              scale={[0.68, 0.65, 0.7]}
            />
          ))}
          {spec.hasCanopy && (
            <mesh
              geometry={sharedBuildingGeos.awningSloped}
              material={mats.trim}
              position={[0, 0.31, spec.depth / 2 + 0.17]}
              rotation={[0.12, 0, 0]}
              scale={[0.52, 0.035, 0.2]}
            />
          )}
          {(tile.type === TileType.COMMERCIAL || spec.archetype === 'MIXED_USE_BLOCK') && (
            <Shopfront spec={spec} accent={mats.trim} window={windowMat} isNight={isNight} />
          )}
          {spec.signageStyle !== 'NONE' && (
            <ArchitecturalSignage spec={spec} style={spec.signageStyle} isNight={isNight} />
          )}
          {spec.hasChimney && (
            <group position={[spec.width * 0.3, spec.height + 0.18, -spec.depth * 0.2]}>
              <mesh geometry={sharedBuildingGeos.chimney} material={sharedBuildingMats.resBrickRed} castShadow />
              <mesh geometry={sharedBuildingGeos.chimneyCap} material={sharedBuildingMats.resConcrete} position={[0, 0.18, 0]} />
            </group>
          )}
          {spec.hasFireEscape && <FireEscape spec={spec} />}
          {spec.hasCrown && <Crown spec={spec} material={mats.trim} />}
          <RoofProps spec={spec} industrial={tile.type === TileType.INDUSTRIAL} office={tile.type === TileType.OFFICE} />
          {tile.type === TileType.INDUSTRIAL && <IndustrialYard />}
          {tile.type === TileType.RESIDENTIAL && spec.floors <= 3 && <HouseDetails spec={spec} />}
        </>
      )}
    </group>
  );
}

function ArchitecturalRoof({ spec, type, near: _near }: { spec: BuildingVisualSpec; type: TileType; near: boolean }) {
  const y = spec.height + 0.08;
  const w = spec.width;
  const d = spec.depth;

  if (spec.roofStyle === 'HIPPED') {
    return (
      <mesh
        geometry={sharedBuildingGeos.hippedRoof}
        material={sharedBuildingMats.resTerracotta}
        position={[0, y + 0.16, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[w * 0.82, 0.36, d * 0.82]}
        castShadow
      />
    );
  }

  if (spec.roofStyle === 'GABLE') {
    return (
      <mesh
        geometry={sharedBuildingGeos.pitchedRoof}
        material={sharedBuildingMats.roof}
        position={[0, y + 0.18, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[w * 0.86, 0.38, d * 0.86]}
        castShadow
      />
    );
  }

  if (spec.roofStyle === 'MANSARD') {
    return (
      <mesh
        geometry={sharedBuildingGeos.mansardRoof}
        material={sharedBuildingMats.roof}
        position={[0, y + 0.12, 0]}
        scale={[w * 0.85, 0.28, d * 0.85]}
        castShadow
      />
    );
  }

  if (spec.roofStyle === 'SAWTOOTH') {
    return (
      <group position={[0, y + 0.14, 0]}>
        {[-0.2, 0.2].map((xOffset) => (
          <mesh
            key={xOffset}
            geometry={sharedBuildingGeos.sawtoothRoof}
            material={sharedBuildingMats.indCorrugated}
            position={[xOffset * w, 0, 0]}
            rotation={[0, 0, Math.PI / 6]}
            scale={[w * 0.38, 0.24, d * 0.85]}
            castShadow
          />
        ))}
      </group>
    );
  }

  if (spec.roofStyle === 'SPIRE') {
    return (
      <group position={[0, y + 0.28, 0]}>
        <mesh geometry={sharedBuildingGeos.spireCrown} material={sharedBuildingMats.metal} position={[0, 0.24, 0]} castShadow />
        <mesh geometry={sharedBuildingGeos.antenna} material={sharedBuildingMats.metal} position={[0, 0.55, 0]} />
      </group>
    );
  }

  // Flat roof with parapet rim
  return (
    <mesh
      geometry={sharedBuildingGeos.roofParapet}
      material={type === TileType.INDUSTRIAL ? sharedBuildingMats.indConcrete : sharedBuildingMats.resConcrete}
      position={[0, y + 0.02, 0]}
      scale={[w * 0.94, 0.8, d * 0.94]}
    />
  );
}

function ArchitecturalSignage({ spec, style, isNight }: { spec: BuildingVisualSpec; style: string; isNight: boolean }) {
  const z = spec.depth / 2 + 0.088;
  const signY = 0.38;

  if (style === 'AWNING') {
    return (
      <group position={[0, signY - 0.06, z]}>
        <mesh
          geometry={sharedBuildingGeos.awningSloped}
          material={sharedBuildingMats.retailAwningRed}
          rotation={[0.18, 0, 0]}
          scale={[spec.width * 0.85, 0.035, 0.2]}
        />
        <mesh
          geometry={sharedBuildingGeos.storeSign}
          material={isNight ? sharedBuildingMats.comNeonAmber : sharedBuildingMats.resTimber}
          position={[0, 0.12, 0.03]}
          scale={[spec.width * 0.6, 0.08, 0.02]}
        />
      </group>
    );
  }

  if (style === 'NEON') {
    return (
      <group position={[spec.width * 0.25, signY + 0.08, z]}>
        <mesh
          geometry={sharedBuildingGeos.storeSign}
          material={isNight ? sharedBuildingMats.comNeonPink : sharedBuildingMats.comNeonCyan}
          scale={[0.34, 0.14, 0.025]}
        />
      </group>
    );
  }

  if (style === 'CORPORATE') {
    return (
      <group position={[0, Math.min(0.65, spec.height * 0.85), z]}>
        <mesh
          geometry={sharedBuildingGeos.storeSign}
          material={isNight ? sharedBuildingMats.comNeonCyan : sharedBuildingMats.officeSteel}
          scale={[spec.width * 0.65, 0.1, 0.02]}
        />
      </group>
    );
  }

  // BILLBOARD
  return (
    <group position={[0, spec.height + 0.22, 0]}>
      <mesh
        geometry={sharedBuildingGeos.storeSign}
        material={isNight ? sharedBuildingMats.comNeonAmber : sharedBuildingMats.indSafety}
        scale={[spec.width * 0.7, 0.2, 0.03]}
        castShadow
      />
    </group>
  );
}

function FacadeWindows({ spec, rows, mid, frameMaterial, windowMaterial }: { spec: BuildingVisualSpec; rows: number; mid: boolean; frameMaterial: THREE.Material; windowMaterial: THREE.Material }) {
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const glassRef = useRef<THREE.InstancedMesh>(null);
  const matrices = useMemo(() => {
    const result: THREE.Matrix4[] = [];
    const columns = mid ? 2 : Math.max(2, Math.min(5, Math.round(spec.width / 0.17)));
    const object = new THREE.Object3D();
    for (let row = 0; row < rows; row += 1) {
      const y = 0.22 + row * Math.max(0.13, (spec.height - 0.18) / Math.max(1, rows));
      for (let col = 0; col < columns; col += 1) {
        if (((row * 7 + col + spec.windowPattern) % 11) === 0) continue;
        const x = (col - (columns - 1) / 2) * (spec.width * 0.78 / columns);
        object.position.set(x, y, spec.depth / 2 + 0.076);
        object.scale.set(0.62, 0.28, 1);
        object.updateMatrix();
        result.push(object.matrix.clone());
        if (!mid && col < Math.max(1, columns - 1)) {
          object.position.set(spec.width / 2 + 0.076, y, x * spec.depth / Math.max(0.2, spec.width));
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
      const inset = matrix.clone().scale(new THREE.Vector3(0.78, 0.72, 1)).premultiply(new THREE.Matrix4().makeTranslation(0, 0, 0.006));
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

function RoofProps({ spec, industrial, office }: { spec: BuildingVisualSpec; industrial: boolean; office?: boolean }) {
  const y = spec.height + 0.11;
  const isHighRise = spec.floors >= 5 || spec.height >= 0.85;
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.roof} scale={[spec.width * 0.82, 0.05, spec.depth * 0.82]} />
      {spec.floors >= 3 && (
        <mesh
          geometry={sharedBuildingGeos.bevelBox}
          material={sharedBuildingMats.resConcrete}
          position={[-spec.width * 0.15, 0.1, -spec.depth * 0.12]}
          scale={[spec.width * 0.32, 0.16, spec.depth * 0.32]}
        />
      )}
      {spec.roofProp === 'SOLAR' && <mesh geometry={sharedBuildingGeos.solarPanel} material={sharedBuildingMats.resSolar} position={[0.08, 0.07, 0]} rotation={[0, 0, -0.18]} />}
      {spec.roofProp === 'TANK' && <mesh geometry={sharedBuildingGeos.waterTank} material={sharedBuildingMats.metal} position={[0.1, 0.14, 0]} />}
      {spec.roofProp === 'HVAC' && <mesh geometry={sharedBuildingGeos.hvacBox} material={sharedBuildingMats.metal} position={[-0.1, 0.09, 0]} />}
      {spec.roofProp === 'ANTENNA' && <mesh geometry={sharedBuildingGeos.antenna} material={sharedBuildingMats.metal} position={[0, 0.2, 0]} />}
      {industrial && (
        <>
          <mesh geometry={sharedBuildingGeos.vent} material={sharedBuildingMats.metal} position={[-0.22, 0.16, -0.12]} />
          <mesh geometry={sharedBuildingGeos.exhaustStack} material={sharedBuildingMats.metal} position={[spec.width * 0.24, 0.28, -spec.depth * 0.2]} />
          {spec.floors >= 3 && (
            <mesh geometry={sharedBuildingGeos.coolingTower} material={sharedBuildingMats.indFacadeSteel} position={[-spec.width * 0.25, 0.18, 0.12]} />
          )}
        </>
      )}
      {office && (
        <mesh geometry={sharedBuildingGeos.satelliteDish} material={sharedBuildingMats.metal} position={[spec.width * 0.2, 0.12, spec.depth * 0.15]} rotation={[0.3, 0.5, 0]} />
      )}
      {isHighRise && (
        <>
          <mesh geometry={sharedBuildingGeos.hvacBox} material={sharedBuildingMats.metal} position={[spec.width * 0.18, 0.08, spec.depth * 0.12]} scale={[0.85, 0.85, 0.85]} />
          <mesh geometry={sharedBuildingGeos.antenna} material={sharedBuildingMats.metal} position={[0, 0.28, 0]} />
          <mesh position={[0, 0.52, 0]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color="#ef4444" toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Shopfront({ spec, accent, window, isNight }: { spec: BuildingVisualSpec; accent: THREE.Material; window: THREE.Material; isNight: boolean }) {
  return (
    <group position={[0, 0.2, spec.depth / 2 + 0.088]}>
      <mesh geometry={sharedBuildingGeos.unitBox} material={window} scale={[spec.width * 0.72, 0.26, 0.025]} />
      <mesh geometry={sharedBuildingGeos.unitBox} material={accent} position={[0, 0.2, 0.055]} rotation={[0.18, 0, 0]} scale={[spec.width * 0.82, 0.035, 0.16]} />
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={isNight ? sharedBuildingMats.windowShopLit : sharedBuildingMats.windowWarm}
        position={[-spec.width * 0.22, 0.32, 0.02]}
        scale={[spec.width * 0.22, 0.09, 0.028]}
      />
    </group>
  );
}

function FireEscape({ spec }: { spec: BuildingVisualSpec }) {
  return (
    <group position={[-spec.width / 2 - 0.07, spec.height * 0.55, 0]}>
      {[0, 0.22, 0.44].map((y) => (
        <mesh
          key={y}
          geometry={sharedBuildingGeos.balconyBox}
          material={sharedBuildingMats.metal}
          position={[0, y - 0.22, 0]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[0.7, 0.5, 0.72]}
        />
      ))}
      <mesh geometry={sharedBuildingGeos.pipe} material={sharedBuildingMats.metal} rotation={[0, 0, -0.48]} scale={[1.35, 1, 1]} />
    </group>
  );
}

function Crown({ spec, material }: { spec: BuildingVisualSpec; material: THREE.Material }) {
  return (
    <group position={[0, spec.height + 0.28, 0]}>
      <mesh geometry={sharedBuildingGeos.bevelBox} material={material} scale={[spec.width * 0.48, 0.25, spec.depth * 0.48]} />
      <mesh geometry={sharedBuildingGeos.antenna} material={sharedBuildingMats.metal} position={[0, 0.32, 0]} />
    </group>
  );
}

function IndustrialYard() {
  return (
    <group>
      <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.indSafety} position={[0.22, 0.18, 0.43]} scale={[0.28, 0.3, 0.035]} />
      <mesh geometry={sharedBuildingGeos.silo} material={sharedBuildingMats.indFacadeSteel} position={[-0.31, 0.3, -0.2]} />
      <mesh geometry={sharedBuildingGeos.pipe} material={sharedBuildingMats.metal} position={[-0.12, 0.22, -0.31]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.indFacadeBlue} position={[0.3, 0.12, -0.33]} scale={[0.22, 0.18, 0.16]} />
      <mesh geometry={sharedBuildingGeos.fence} material={sharedBuildingMats.metal} position={[0, 0.13, -0.46]} />
    </group>
  );
}

function HouseDetails(_props: { spec: BuildingVisualSpec }) {
  return (
    <group>
      <mesh geometry={sharedBuildingGeos.unitBox} material={sharedBuildingMats.resPaving} position={[-0.28, 0.045, 0.2]} scale={[0.2, 0.04, 0.48]} />
      <mesh geometry={sharedBuildingGeos.fence} material={sharedBuildingMats.resTimber} position={[0, 0.12, -0.45]} />
    </group>
  );
}
