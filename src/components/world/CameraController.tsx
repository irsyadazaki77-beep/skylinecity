import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface CameraControllerProps {
  building?: boolean;
  resetRevision?: number;
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
  presentation?: 'initial' | 'milestone' | 'incident' | 'recovery';
  onRotationChange?: (rotation: number) => void;
}

export function CameraController({ building = false, resetRevision = 0, reducedMotion = false, terrainCeiling = 0, focusDistance, viewMode, zoom, pitch, rotation, gridWidth = 60, gridHeight = 60, target = [0, 0, 0], presentation = 'initial', onRotationChange }: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const transition = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const rotationRef = useRef(rotation);
  const previousCommand = useRef<{ target: string; zoom: number; rotation: number; resetRevision: number } | null>(null);
  const onRotationChangeRef = useRef(onRotationChange);
  rotationRef.current = rotation;
  onRotationChangeRef.current = onRotationChange;

  const halfW = gridWidth / 2;
  const halfH = gridHeight / 2;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[aria-modal="true"]') || (e.target as HTMLElement)?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key.toLowerCase() === 'q' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        const direction = e.key.toLowerCase() === 'q' ? -15 : 15;
        onRotationChangeRef.current?.(((rotationRef.current + direction) % 360 + 360) % 360);
        return;
      }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        keysRef.current[e.key.toLowerCase()] = true;
      }
    };

    const clearKeys = () => { keysRef.current = {}; };
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', clearKeys);
    window.addEventListener('focusin', clearKeys);
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', clearKeys);
      window.removeEventListener('focusin', clearKeys);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!controlsRef.current) return;

    const oldPosition = camera.position.clone();
    const oldTarget = controlsRef.current.target.clone();
    const targetKey = target.join(',');
    const previous = previousCommand.current;
    const reposition = !previous || previous.target !== targetKey || previous.resetRevision !== resetRevision;
    const destinationTarget = reposition ? new THREE.Vector3(...target) : oldTarget.clone();
    previousCommand.current = { target: targetKey, zoom, rotation, resetRevision };
    if (viewMode === '2D') {
      camera.position.set(target[0], target[1] + 28 / zoom, target[2] + 0.01);
      controlsRef.current.target.set(target[0], target[1], target[2]);
      controlsRef.current.maxPolarAngle = 0.01;
      controlsRef.current.minPolarAngle = 0;
    } else {
      const pitchRad = (pitch * Math.PI) / 180;
      const rotRad = reposition ? ((rotation + 45) * Math.PI) / 180
        : Math.atan2(camera.position.x - oldTarget.x, camera.position.z - oldTarget.z) + ((rotation - previous!.rotation) * Math.PI) / 180;

      // A modest 8% closer gameplay frame keeps the starter blocks readable
      // while preserving the surrounding road connection and river context.
      const presentationDistance = presentation === 'incident' ? 13.5 : presentation === 'milestone' ? 17.5 : presentation === 'recovery' ? 16.5 : 15.5;
      const distance = reposition ? (focusDistance ?? presentationDistance / zoom)
        : camera.position.distanceTo(oldTarget) * previous!.zoom / zoom;
      const actualPitch = reposition ? pitchRad : Math.asin(THREE.MathUtils.clamp((camera.position.y - oldTarget.y) / camera.position.distanceTo(oldTarget), -1, 1));
      const camY = Math.sin(actualPitch) * distance;
      const planeDist = Math.cos(actualPitch) * distance;
      const camX = Math.sin(rotRad) * planeDist;
      const camZ = Math.cos(rotRad) * planeDist;

      camera.position.set(destinationTarget.x + camX, destinationTarget.y + camY, destinationTarget.z + camZ);
      controlsRef.current.target.copy(destinationTarget);
      controlsRef.current.maxPolarAngle = Math.PI / 2 - 0.32;
      controlsRef.current.minPolarAngle = 0.1;
    }

    camera.position.y = Math.max(camera.position.y, terrainCeiling + 2);
    transition.current = reducedMotion ? null : { position: camera.position.clone(), target: controlsRef.current.target.clone() };
    if (!reducedMotion) { camera.position.copy(oldPosition); controlsRef.current.target.copy(oldTarget); }
    controlsRef.current.update();
  }, [viewMode, zoom, pitch, rotation, camera, target[0], target[1], target[2], focusDistance, reducedMotion, presentation, resetRevision]);

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
    const speed = 12 * Math.min(delta, 0.05);

    let moveX = 0;
    let moveZ = 0;

    if (keys['w'] || keys['arrowup']) moveZ -= speed;
    if (keys['s'] || keys['arrowdown']) moveZ += speed;
    if (keys['a'] || keys['arrowleft']) moveX -= speed;
    if (keys['d'] || keys['arrowright']) moveX += speed;

    if (moveX !== 0 || moveZ !== 0) {
      transition.current = null;
      const angle = controls.getAzimuthalAngle();
      const length = Math.hypot(moveX, moveZ);
      const right = moveX / length * speed;
      const forward = moveZ / length * speed;
      moveX = right * Math.cos(angle) + forward * Math.sin(angle);
      moveZ = -right * Math.sin(angle) + forward * Math.cos(angle);
      const target = controlsRef.current.target;
      const beforeX = target.x, beforeZ = target.z;
      target.x = THREE.MathUtils.clamp(target.x + moveX, -halfW, halfW);
      target.z = THREE.MathUtils.clamp(target.z + moveZ, -halfH, halfH);

      camera.position.x += target.x - beforeX;
      camera.position.z += target.z - beforeZ;

      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      mouseButtons={{ LEFT: building ? undefined : THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE }}
      touches={{ ONE: building ? undefined : THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      screenSpacePanning={false}
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={6}
      maxDistance={100}
      onStart={() => { transition.current = null; }}
    />
  );
}
