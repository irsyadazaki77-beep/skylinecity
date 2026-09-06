import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { WeatherType } from '../../types';

interface WeatherEffectsProps {
  weather: WeatherType;
  precipitation: number;
  qualityTier: 'balanced' | 'reduced';
  reducedMotion?: boolean;
}

function seededUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Presentation-only weather driven exclusively by authoritative climate state. */
export function WeatherEffects({ weather, precipitation, qualityTier, reducedMotion = false }: WeatherEffectsProps) {
  const rain = weather === 'RAIN' || weather === 'STORM';
  const storm = weather === 'STORM';
  const count = rain ? (qualityTier === 'reduced' ? (storm ? 280 : 160) : (storm ? 720 : 420)) : 0;
  const pointsRef = useRef<THREE.Points>(null);
  const lightningRef = useRef<THREE.DirectionalLight>(null);
  const elapsedRef = useRef(0);
  const { scene } = useThree();

  const positions = useMemo(() => {
    const data = new Float32Array(Math.max(1, count) * 3);
    for (let index = 0; index < count; index += 1) {
      data[index * 3] = (seededUnit(index, 1) - 0.5) * 62;
      data[index * 3 + 1] = 3 + seededUnit(index, 2) * 25;
      data[index * 3 + 2] = (seededUnit(index, 3) - 0.5) * 62;
    }
    return data;
  }, [count]);

  useEffect(() => {
    const previousFog = scene.fog;
    if (weather === 'RAIN') scene.fog = new THREE.FogExp2('#516676', 0.012);
    else if (weather === 'STORM') scene.fog = new THREE.FogExp2('#263746', 0.022);
    else if (weather === 'HEATWAVE') scene.fog = new THREE.FogExp2('#c9a56b', 0.008);
    else if (weather === 'DROUGHT') scene.fog = new THREE.FogExp2('#ae956b', 0.006);
    else scene.fog = null;
    return () => { scene.fog = previousFog; };
  }, [scene, weather]);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    if (rain && pointsRef.current && !reducedMotion) {
      const attribute = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      const fall = delta * (storm ? 20 : 13) * Math.max(0.65, precipitation / 1.35);
      for (let index = 0; index < count; index += 1) {
        const nextY = attribute.getY(index) - fall;
        attribute.setY(index, nextY < 0.2 ? 24 + seededUnit(index, Math.floor(elapsedRef.current) + 5) * 5 : nextY);
        if (storm) attribute.setX(index, attribute.getX(index) + delta * 1.7);
        if (attribute.getX(index) > 31) attribute.setX(index, -31);
      }
      attribute.needsUpdate = true;
    }
    if (lightningRef.current) {
      const pulse = storm && !reducedMotion && (Math.floor(elapsedRef.current * 1.7) % 19 === 0)
        ? Math.max(0, Math.sin(elapsedRef.current * 48)) * 2.8
        : 0;
      lightningRef.current.intensity = pulse;
    }
  });

  if (!rain) return null;
  return (
    <group name={`WeatherEffects-${weather}`}>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color={storm ? '#b9d8e8' : '#d8eff8'} size={storm ? 0.055 : 0.038} transparent opacity={storm ? 0.72 : 0.52} depthWrite={false} />
      </points>
      {storm && <directionalLight ref={lightningRef} color="#dcecff" position={[8, 24, -4]} intensity={0} />}
    </group>
  );
}
