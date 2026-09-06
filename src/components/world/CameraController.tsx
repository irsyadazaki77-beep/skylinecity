import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface CameraControllerProps {
  reducedMotion?: boolean;
  terrainCeiling?: number;
  focusDistance?: number;
  viewMode: '2D' | '3D';
  zoom: number;
  pitch: number;
  rotation: number;
  gridWidth?: number;
  gridHeight?: number;
  target?: [number, number, number];
  onRotationChange?: (rotation: number) => void;
}

export function CameraController({ reducedMotion = false, terrainCeiling = 0, focusDistance, viewMode, zoom, pitch, rotation, gridWidth = 60, gridHeight = 60, target = [0, 0, 0], onRotationChange }: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const transition = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const rotationRef = useRef(rotation);
  const onRotationChangeRef = useRef(onRotationChange);
  rotationRef.current = rotation;
  onRotationChangeRef.current = onRotationChange;

  const halfW = gridWidth / 2;
  const halfH = gridHeight / 2;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        const direction = e.key.toLowerCase() === 'q' ? -15 : 15;
        onRotationChangeRef.current?.(((rotationRef.current + direction) % 360 + 360) % 360);
        return;
      }
      keysRef.current[e.key.toLowerCase()] = true;
    };

    const clearKeys = () => { keysRef.current = {}; };
    window.addEventListener('blur', clearKeys);
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('blur', clearKeys);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!controlsRef.current) return;

    const oldPosition = camera.position.clone();
    const oldTarget = controlsRef.current.target.clone();
    if (viewMode === '2D') {
      camera.position.set(target[0], target[1] + 28 / zoom, target[2] + 0.01);
      controlsRef.current.target.set(target[0], target[1], target[2]);
      controlsRef.current.maxPolarAngle = 0.01;
      controlsRef.current.minPolarAngle = 0;
    } else {
      const pitchRad = (pitch * Math.PI) / 180;
      const rotRad = ((rotation + 45) * Math.PI) / 180;

      // A modest 8% closer gameplay frame keeps the starter blocks readable
      // while preserving the surrounding road connection and river context.
      const distance = focusDistance ?? 22 / zoom;
      const camY = Math.sin(pitchRad) * distance;
      const planeDist = Math.cos(pitchRad) * distance;
      const camX = Math.sin(rotRad) * planeDist;
      const camZ = Math.cos(rotRad) * planeDist;

      camera.position.set(target[0] + camX, target[1] + camY, target[2] + camZ);
      controlsRef.current.target.set(target[0], target[1], target[2]);
      controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.32;
      controlsRef.current.minPolarAngle = 0.1;
    }

    camera.position.y = Math.max(camera.position.y, terrainCeiling + 2);
    transition.current = reducedMotion ? null : { position: camera.position.clone(), target: controlsRef.current.target.clone() };
    if (!reducedMotion) { camera.position.copy(oldPosition); controlsRef.current.target.copy(oldTarget); }
    controlsRef.current.update();
  }, [viewMode, zoom, pitch, rotation, camera, target[0], target[1], target[2], focusDistance, reducedMotion]);

  // Keyboard Panning WASD / Arrows
  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    if (transition.current) {
      const alpha = 1 - Math.exp(-8 * Math.min(delta, 0.1));
      camera.position.lerp(transition.current.position, alpha);
      controls.target.lerp(transition.current.target, alpha);
      if (camera.position.distanceToSquared(transition.current.position) < 0.001) transition.current = null;
      controls.update();
    }
    const oldX = controls.target.x, oldZ = controls.target.z;
    controls.target.x = THREE.MathUtils.clamp(oldX, -halfW, halfW);
    controls.target.z = THREE.MathUtils.clamp(oldZ, -halfH, halfH);
    camera.position.x += controls.target.x - oldX;
    camera.position.z += controls.target.z - oldZ;
    camera.position.y = Math.max(camera.position.y, terrainCeiling + 1.5);
    const keys = keysRef.current;
    const speed = 12 * delta;

    let moveX = 0;
    let moveZ = 0;

    if (keys['w'] || keys['arrowup']) moveZ -= speed;
    if (keys['s'] || keys['arrowdown']) moveZ += speed;
    if (keys['a'] || keys['arrowleft']) moveX -= speed;
    if (keys['d'] || keys['arrowright']) moveX += speed;

    if (moveX !== 0 || moveZ !== 0) {
      transition.current = null;
      const target = controlsRef.current.target;
      target.x = THREE.MathUtils.clamp(target.x + moveX, -halfW, halfW);
      target.z = THREE.MathUtils.clamp(target.z + moveZ, -halfH, halfH);

      camera.position.x = THREE.MathUtils.clamp(camera.position.x + moveX, -halfW - 20, halfW + 20);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z + moveZ, -halfH - 20, halfH + 20);

      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={6}
      maxDistance={100}
      onStart={() => { transition.current = null; }}
    />
  );
}
