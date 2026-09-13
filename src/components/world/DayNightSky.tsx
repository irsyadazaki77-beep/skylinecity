import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface DayNightSkyProps {
  shadowSize?: number;
  timeOfDay?: number;
  dayNightCycle?: 'enabled' | 'disabled' | 'locked_day' | 'locked_night';
}

export function getNightFactor(timeOfDay: number): number {
  const hour = ((timeOfDay % 24) + 24) % 24;
  // Keep dawn and dusk readable instead of switching from a dark scene to a
  // fully lit scene at one mathematical horizon. This also keeps building
  // emissive details in sync with the light rig.
  const dawn = 4;
  const dusk = 20;
  if (hour <= dawn || hour >= dusk) return 1;
  const daylight = Math.sin(((hour - dawn) / (dusk - dawn)) * Math.PI);
  return Math.max(0, Math.min(1, 1 - Math.pow(daylight, 0.72)));
}

export function DayNightSky({ shadowSize = 1024, timeOfDay = 6, dayNightCycle = 'enabled' }: DayNightSkyProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemisphereRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const { scene } = useThree();
  const backgroundColor = useMemo(() => new THREE.Color('#101c2e'), []);
  const nightColor = useMemo(() => new THREE.Color('#0d1726'), []);
  const dayColor = useMemo(() => new THREE.Color('#8dc1e8'), []);
  const duskColor = useMemo(() => new THREE.Color('#e69968'), []);
  const timeRef = useRef<number>(timeOfDay / 24); // Follow the simulation clock without forcing React renders.

  useFrame((state, delta) => {
    const camera = state.camera;
    const targetTime = dayNightCycle === 'locked_day' || dayNightCycle === 'disabled'
      ? 0.5
      : dayNightCycle === 'locked_night'
        ? 0
        : ((timeOfDay % 24) + 24) % 24 / 24;
    const distance = Math.abs(targetTime - timeRef.current);
    const wrappedDistance = Math.min(distance, 1 - distance);
    if (wrappedDistance > 0.0001) {
      const direction = ((targetTime - timeRef.current + 1.5) % 1) - 0.5;
      timeRef.current = (timeRef.current + direction * Math.min(1, delta * 4) + 1) % 1;
    }

    const t = timeRef.current; // 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk
    const hour = t * 24;
    const dawn = 4;
    const dusk = 20;
    const daylight = hour <= dawn || hour >= dusk
      ? 0
      : Math.pow(Math.sin(((hour - dawn) / (dusk - dawn)) * Math.PI), 0.72);
    const twilight = Math.max(0, Math.min(1, daylight * 1.25 + 0.08));

    // Explicitly drive the scene background and fog. Relying only on the
    // renderer clear color made the canvas fall back to white on some WebGL
    // paths when the sun crossed the horizon.
    // Keep the playable map on a stable deep-slate background. Daylight is
    // communicated by the surface and buildings; a bright scene background
    // combined with renderer color management can otherwise wash out the map.
    backgroundColor.copy(nightColor).lerp(dayColor, daylight);
    backgroundColor.lerp(duskColor, Math.max(0, 1 - Math.abs(daylight - 0.35) / 0.35) * 0.35);
    scene.background = backgroundColor;
    if (fogRef.current) fogRef.current.color.copy(backgroundColor);
    
    // Use the same 04:00–20:00 daylight window as getNightFactor so the sun
    // position, shadows, building glow, and UI state never disagree.
    const sunPhase = ((hour - dawn) / (dusk - dawn)) * Math.PI;
    const sunIsUp = hour > dawn && hour < dusk;
    const sunX = Math.cos(sunPhase) * 35;
    const sunY = sunIsUp ? Math.sin(sunPhase) * 35 : -8;
    const sunZ = Math.sin(sunPhase * 0.5) * 15 + 10;

    // Calculate night factor (0 = day, 1 = deep night)
    if (sunRef.current) {
      const groundX = camera.position.x * 0.7;
      const groundZ = camera.position.z * 0.7;
      sunRef.current.position.set(sunX + groundX, Math.max(2, sunY), sunZ + groundZ);
      sunRef.current.target.position.set(groundX, 0, groundZ);
      sunRef.current.target.updateMatrixWorld();
      
      // Sun intensity & color gradient
      if (sunY > 0) {
        // Keep direct light vibrant with warm morning golden tint and rich amber dusk
        const isMorning = hour >= 4.5 && hour <= 9.0;
        const isDusk = hour >= 16.5 && hour <= 19.5;
        const morningBoost = isMorning ? 0.18 : 0;
        sunRef.current.intensity = Math.min(2.5, 1.25 + morningBoost + Math.min(1, sunY / 35) * 1.15);
        const sunsetBlend = isDusk ? Math.max(0, 1 - sunY / 22) : Math.max(0, 1 - sunY / 18);
        const r = 1.0;
        const g = 0.98 - sunsetBlend * 0.28;
        const b = 0.92 - sunsetBlend * 0.42;
        sunRef.current.color.setRGB(r, g, b);
      } else {
        // Moon / Night light
        sunRef.current.intensity = 0.15 + twilight * 0.08;
        sunRef.current.color.setHex(0x4f6fa5); // Soft blue moonlight
      }
    }
    // Rich contrast between direct sun, sky ambient and ground bounce
    if (ambientRef.current) ambientRef.current.intensity = 0.38 + daylight * 0.32;
    if (hemisphereRef.current) hemisphereRef.current.intensity = 0.34 + daylight * 0.28;
  });

  return (
    <>
      {/* Directional Sun / Moon Light with Crisp Shadows and clean Normal Bias */}
      <directionalLight
        ref={sunRef}
        position={[25, 30, 20]}
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-camera-near={1}
        shadow-camera-far={130}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={36}
        shadow-camera-bottom={-36}
        shadow-bias={-0.0002}
        shadow-normalBias={0.024}
      />

      {/* Ambient & Hemisphere lighting for smooth global illumination */}
      <ambientLight ref={ambientRef} intensity={0.42} color="#f4ead5" />
      <hemisphereLight ref={hemisphereRef} args={['#dbe9ef', '#4a5140', 0.38]} />

      {/* Atmospheric Distance Fog */}
      <fog ref={fogRef} attach="fog" args={['#101c2e', 64, 150]} />
    </>
  );
}
