import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** One small, prefiltered reflection map shared by all PBR materials.
 * No downloads, per-frame cube cameras, or full-screen render passes. */
export function CityEnvironment({ nightFactor, reduced }: { nightFactor: number; reduced: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const previous = scene.environment;
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04, 0.1, 100, { size: reduced ? 64 : 128 });
    scene.environment = target.texture;
    room.dispose();
    generator.dispose();
    return () => {
      scene.environment = previous;
      target.dispose();
    };
  }, [gl, scene, reduced]);

  useEffect(() => {
    const previous = scene.environmentIntensity;
    scene.environmentIntensity = THREE.MathUtils.lerp(0.38, 0.12, nightFactor);
    return () => { scene.environmentIntensity = previous; };
  }, [scene, nightFactor]);
  return null;
}
