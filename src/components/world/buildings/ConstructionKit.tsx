import React from 'react';
import { sharedBuildingMats, sharedBuildingGeos } from './sharedKits';
import { ConstructionStage } from '../../../constructionPresentation';

interface ConstructionKitProps {
  stage: ConstructionStage;
  level?: number;
  type?: string;
}

export function ConstructionCrane({ height, rotation = 0 }: { height: number; rotation?: number }) {
  return (
    <group name="Construction-Crane" position={[0.42, height, -0.32]} rotation={[0, rotation, 0]}>
      {/* Tower Mast */}
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={sharedBuildingMats.indSafety}
        position={[0, -height * 0.5, 0]}
        scale={[0.04, height, 0.04]}
        castShadow
      />
      {/* Slewing unit & Operator cab */}
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={sharedBuildingMats.officeSteel}
        position={[0, 0.02, 0]}
        scale={[0.07, 0.06, 0.07]}
      />
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={sharedBuildingMats.resGlassBlue}
        position={[0.05, 0.01, 0.03]}
        scale={[0.03, 0.04, 0.03]}
      />
      {/* Jib / Boom */}
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={sharedBuildingMats.indSafety}
        position={[-0.26, 0.04, 0]}
        scale={[0.56, 0.028, 0.028]}
        castShadow
      />
      {/* Counter-jib & ballast weights */}
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={sharedBuildingMats.indSafety}
        position={[0.14, 0.04, 0]}
        scale={[0.22, 0.024, 0.024]}
      />
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={sharedBuildingMats.resConcrete}
        position={[0.2, 0.02, 0]}
        scale={[0.08, 0.04, 0.05]}
      />
      {/* Hoist cable & hook placeholder */}
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={sharedBuildingMats.metal}
        position={[-0.38, -0.12, 0]}
        scale={[0.015, 0.24, 0.015]}
      />
    </group>
  );
}

/**
 * Renovation Scaffolding Overlay for buildings advancing from L1->L2, L2->L3, etc.
 * Keeps the existing base building visible while adding upper-floor scaffolding,
 * rooftop crane, and construction netting without visual popping.
 */
export function RenovationScaffoldingKit({
  currentLevel,
  targetLevel: _targetLevel,
  buildingHeight,
  type = 'RESIDENTIAL',
}: {
  currentLevel: number;
  targetLevel?: number;
  buildingHeight: number;
  type?: string;
}) {
  const roofY = Math.max(0.3, buildingHeight + 0.04);
  const isHighRise = currentLevel >= 3;

  return (
    <group name="BuildingRenovationScaffold" position={[0, 0, 0]}>
      {/* Perimeter scaffolding along one side and rooftop */}
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={sharedBuildingMats.metal}
        position={[0.38, roofY * 0.55, 0]}
        scale={[0.06, roofY * 0.9, 0.84]}
      />
      {/* Safety netting in warning orange */}
      <mesh
        geometry={sharedBuildingGeos.unitBox}
        material={sharedBuildingMats.indSafety}
        position={[0.39, roofY * 0.55, 0]}
        scale={[0.02, roofY * 0.65, 0.8]}
      />
      {/* Rooftop structural staging: new floor columns & materials */}
      <group position={[0, roofY, 0]}>
        {/* Concrete floor extension slab */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.resConcrete}
          position={[0, 0.03, 0]}
          scale={[0.74, 0.04, 0.7]}
        />
        {/* Vertical starter columns */}
        {[-0.26, 0.26].flatMap((x) =>
          [-0.24, 0.24].map((z) => (
            <mesh
              key={`col-${x}-${z}`}
              geometry={sharedBuildingGeos.unitBox}
              material={type === 'RESIDENTIAL' ? sharedBuildingMats.resTimber : sharedBuildingMats.metal}
              position={[x, 0.16, z]}
              scale={[0.035, 0.24, 0.035]}
            />
          )),
        )}
        {/* Pallets of construction materials */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={type === 'RESIDENTIAL' ? sharedBuildingMats.resBrickRed : sharedBuildingMats.indCorrugated}
          position={[-0.14, 0.07, 0.12]}
          scale={[0.15, 0.08, 0.15]}
        />
      </group>
      {/* Rooftop / site crane */}
      {isHighRise ? (
        <ConstructionCrane height={roofY + 0.38} rotation={0.4} />
      ) : (
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.indSafety}
          position={[0.35, roofY + 0.18, -0.25]}
          scale={[0.03, 0.36, 0.03]}
        />
      )}
    </group>
  );
}

export function ConstructionKit({
  stage,
  level = 1,
  type = 'RESIDENTIAL',
}: ConstructionKitProps) {
  const safeLevel = Math.max(1, Math.min(5, level));
  const isResidential = type === 'RESIDENTIAL';
  const isIndustrial = type === 'INDUSTRIAL';
  const isOfficeOrCommercial = type === 'COMMERCIAL' || type === 'OFFICE';

  // Stage 0: Empty Zoned Lot / Cleared Land
  if (stage === 'SITE_PREPARATION' || stage === 'PREPARATION' || stage === 'EMPTY_LOT') {
    return (
      <group name="Construction-Stage0-SitePrep">
        {/* Graded dirt & gravel plot */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.resPaving}
          position={[0, 0.02, 0]}
          scale={[0.92, 0.04, 0.92]}
          receiveShadow
        />
        {/* Excavation soil mound */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.resL1}
          position={[-0.22, 0.06, -0.2]}
          scale={[0.36, 0.08, 0.3]}
          castShadow
        />
        {/* Boundary survey stakes with safety markers */}
        {[
          [-0.4, -0.4],
          [0.4, -0.4],
          [-0.4, 0.4],
          [0.4, 0.4],
        ].map(([x, z]) => (
          <group key={`${x}-${z}`} position={[x, 0.1, z]}>
            <mesh
              geometry={sharedBuildingGeos.unitCylinder}
              material={sharedBuildingMats.resTimber}
              scale={[0.012, 0.18, 0.012]}
            />
            <mesh
              geometry={sharedBuildingGeos.unitBox}
              material={sharedBuildingMats.indSafety}
              position={[0, 0.08, 0]}
              scale={[0.04, 0.02, 0.01]}
            />
          </group>
        ))}
      </group>
    );
  }

  // Stage 1: Foundation & Excavation
  if (stage === 'FOUNDATION') {
    return (
      <group name="Construction-Stage1-Foundation">
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.resPaving}
          position={[0, 0.02, 0]}
          scale={[0.92, 0.04, 0.92]}
          receiveShadow
        />
        {/* Excavation trench / foundation pit */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.resConcrete}
          position={[0, 0.06, 0]}
          scale={[0.82, 0.09, 0.78]}
          castShadow
          receiveShadow
        />
        {/* Vertical starter rebar grid */}
        {[-0.32, 0, 0.32].flatMap((x) =>
          [-0.28, 0.28].map((z) => (
            <mesh
              key={`${x}-${z}`}
              geometry={sharedBuildingGeos.unitCylinder}
              material={sharedBuildingMats.metal}
              position={[x, 0.16, z]}
              scale={[0.01, 0.16, 0.01]}
            />
          )),
        )}
        {/* Material pallet / site generator box */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={isIndustrial ? sharedBuildingMats.indCorrugated : sharedBuildingMats.indSafety}
          position={[0.32, 0.1, -0.28]}
          scale={[0.16, 0.1, 0.16]}
          castShadow
        />
      </group>
    );
  }

  // Stage 2: Structural Frame & Scaffolding
  if (stage === 'FRAME') {
    const frameHeight = 0.5 + safeLevel * 0.14;
    return (
      <group name="Construction-Stage2-Frame">
        {/* Foundation slab */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.resConcrete}
          position={[0, 0.05, 0]}
          scale={[0.82, 0.08, 0.78]}
          castShadow
        />
        {/* Structural vertical columns */}
        {[-0.32, 0.32].flatMap((x) =>
          [-0.3, 0.3].map((z) => (
            <mesh
              key={`${x}-${z}`}
              geometry={sharedBuildingGeos.unitBox}
              material={isResidential ? sharedBuildingMats.resTimber : sharedBuildingMats.resDarkMetal}
              position={[x, frameHeight * 0.5 + 0.05, z]}
              scale={[0.038, frameHeight, 0.038]}
              castShadow
            />
          )),
        )}
        {/* Intermediate floor slabs */}
        {[frameHeight * 0.45, frameHeight * 0.9].map((h) => (
          <mesh
            key={h}
            geometry={sharedBuildingGeos.unitBox}
            material={sharedBuildingMats.resConcrete}
            position={[0, h, 0]}
            scale={[0.78, 0.035, 0.74]}
          />
        ))}
        {/* Perimeter scaffolding cage */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.metal}
          position={[0, frameHeight * 0.5, 0.38]}
          scale={[0.8, frameHeight * 0.95, 0.04]}
        />
        {/* Warning safety netting */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.indSafety}
          position={[0, frameHeight * 0.4, 0.39]}
          scale={[0.76, frameHeight * 0.45, 0.02]}
        />
        {safeLevel >= 2 && <ConstructionCrane height={frameHeight + 0.35} rotation={0.25} />}
      </group>
    );
  }

  // Stage 3: Partial Walls & Unfinished Facade
  if (stage === 'STRUCTURE') {
    const structHeight = 0.65 + safeLevel * 0.18;
    const facadeMat = isResidential
      ? sharedBuildingMats.resBrickTan
      : isIndustrial
        ? sharedBuildingMats.indCorrugated
        : sharedBuildingMats.resConcrete;

    return (
      <group name="Construction-Stage3-Structure">
        {/* Concrete core / partial exterior masonry walls */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={facadeMat}
          position={[0, structHeight * 0.48, 0]}
          scale={[0.76, structHeight * 0.88, 0.72]}
          castShadow
        />
        {/* Upper floor unfinished concrete columns */}
        {[-0.3, 0.3].flatMap((x) =>
          [-0.26, 0.26].map((z) => (
            <mesh
              key={`col-${x}-${z}`}
              geometry={sharedBuildingGeos.unitBox}
              material={sharedBuildingMats.resConcrete}
              position={[x, structHeight + 0.08, z]}
              scale={[0.04, 0.16, 0.04]}
            />
          )),
        )}
        {/* Full scaffolding facade cage */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.metal}
          position={[0, structHeight * 0.52, 0.38]}
          scale={[0.82, structHeight * 0.96, 0.04]}
        />
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.indSafety}
          position={[0, structHeight * 0.5, 0.39]}
          scale={[0.8, structHeight * 0.6, 0.02]}
        />
        <ConstructionCrane height={structHeight + 0.4} rotation={-0.3} />
      </group>
    );
  }

  // Stage 4: Nearly Finished Building
  if (stage === 'FACADE' || stage === 'FINISHING' || stage === 'RENOVATING') {
    const finishHeight = 0.75 + safeLevel * 0.2;
    const mainMat = isResidential
      ? sharedBuildingMats.resFacadeSand
      : isIndustrial
        ? sharedBuildingMats.indFacadeSteel
        : isOfficeOrCommercial
          ? sharedBuildingMats.officeWhite
          : sharedBuildingMats.resConcrete;

    return (
      <group name="Construction-Stage4-Finishing">
        {/* Main envelope nearly complete */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={mainMat}
          position={[0, finishHeight * 0.5, 0]}
          scale={[0.8, finishHeight, 0.76]}
          castShadow
          receiveShadow
        />
        {/* Window glazing being installed (semi-glazed strips) */}
        {[-0.22, 0.22].map((x) => (
          <mesh
            key={`win-${x}`}
            geometry={sharedBuildingGeos.unitPlane}
            material={sharedBuildingMats.resGlassBlue}
            position={[x, finishHeight * 0.55, 0.39]}
            scale={[0.16, finishHeight * 0.65, 1]}
          />
        ))}
        {/* Partial scaffolding being dismantled on one side */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.metal}
          position={[0.34, finishHeight * 0.45, 0.39]}
          scale={[0.18, finishHeight * 0.85, 0.03]}
        />
        {/* Ground security fence & cones */}
        <mesh
          geometry={sharedBuildingGeos.unitBox}
          material={sharedBuildingMats.indSafety}
          position={[0, 0.08, 0.42]}
          scale={[0.65, 0.06, 0.02]}
        />
        {safeLevel >= 3 && <ConstructionCrane height={finishHeight + 0.32} rotation={0.8} />}
      </group>
    );
  }

  return null;
}
