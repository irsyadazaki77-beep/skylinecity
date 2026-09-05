import React from 'react';

// Open center preserves facade/road readability. Two outlines remain visible
// against both light concrete and dark roofs without recoloring the building.
export function TileMarker({ position, color, invalid = false }: { position: [number, number, number]; color: string; invalid?: boolean }) {
  return <group position={position} renderOrder={20} raycast={() => null}>
    {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(angle => <group key={angle} rotation={[0, angle, 0]}>
      <mesh position={[0, 0, 0.48]}>
        <boxGeometry args={[1.02, 0.025, 0.08]} />
        <meshBasicMaterial color="#172c36" depthWrite={false} depthTest={false} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.02, 0.48]}>
        <boxGeometry args={[0.98, 0.025, 0.035]} />
        <meshBasicMaterial color={color} depthWrite={false} depthTest={false} />
      </mesh>
    </group>)}
    {invalid && <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
      <planeGeometry args={[0.055, 1.1]} />
      <meshBasicMaterial color={color} depthWrite={false} depthTest={false} />
    </mesh>}
  </group>;
}
