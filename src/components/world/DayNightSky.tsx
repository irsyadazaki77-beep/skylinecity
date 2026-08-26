import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface DayNightSkyProps {
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

export function DayNightSky({ timeOfDay = 6, dayNightCycle = 'enabled' }: DayNightSkyProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemisphereRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const { scene } = useThree();
  const backgroundColor = useMemo(() => new THREE.Color('#17283f'), []);
  const nightColor = useMemo(() => new THREE.Color('#07101d'), []);
  const timeRef = useRef<number>(timeOfDay / 24); // Follow the simulation clock without forcing React renders.

  useFrame((_, delta) => {
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
    backgroundColor.copy(nightColor);
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
      sunRef.current.position.set(sunX, Math.max(2, sunY), sunZ);
      
      // Sun intensity & color gradient
      if (sunY > 0) {
        // Keep direct light in a conservative range so standard materials do
        // not clip to white at noon, while dawn/dusk remain visible.
        sunRef.current.intensity = 0.12 + Math.min(1, sunY / 35) * 0.88;
        const sunsetBlend = Math.max(0, 1 - sunY / 15);
        // Blend white sunlight to golden/orange sunset
        const r = 1.0;
        const g = 0.95 - sunsetBlend * 0.4;
        const b = 0.85 - sunsetBlend * 0.6;
        sunRef.current.color.setRGB(r, g, b);
      } else {
        // Moon / Night light
        sunRef.current.intensity = 0.12 + twilight * 0.08;
        sunRef.current.color.setHex(0x3b82f6); // Soft blue moonlight
      }
    }
    if (ambientRef.current) ambientRef.current.intensity = 0.34 + twilight * 0.16;
    if (hemisphereRef.current) hemisphereRef.current.intensity = 0.34 + twilight * 0.1;
  });

  return (
    <>
      {/* Directional Sun / Moon Light with Crisp Shadows */}
      <directionalLight
        ref={sunRef}
        position={[25, 30, 20]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0005}
      />

      {/* Ambient & Hemisphere lighting for smooth global illumination */}
      <ambientLight ref={ambientRef} intensity={0.42} color="#e0e7ff" />
      <hemisphereLight ref={hemisphereRef} args={['#dbeafe', '#1e293b', 0.38]} />

      {/* Atmospheric Distance Fog */}
      <fog ref={fogRef} attach="fog" args={['#17283f', 34, 105]} />
    </>
  );
}
