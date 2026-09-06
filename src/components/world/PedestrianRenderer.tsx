import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TileData } from '../../types';
import { Trip } from '../../citizenSimulation/types';
import { RoadGraph } from '../../traffic';
import { PedestrianAgent, sampleRepresentativePedestrians, updatePedestrianAgent } from '../../pedestrianModel';
import { gridToWorld } from './types3D';

interface PedestrianRendererProps {
  grid: TileData[][];
  trips?: Trip[];
  roadGraph?: RoadGraph | null;
  timeOfDay?: number;
  population?: number;
  qualityTier?: 'balanced' | 'reduced';
  onSelectCitizen?: (citizenId: string) => void;
}

export function PedestrianRenderer({
  grid,
  trips = [],
  roadGraph = null,
  timeOfDay = 12,
  population = 0,
  qualityTier = 'balanced',
  onSelectCitizen,
}: PedestrianRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;

  const maxAgents = qualityTier === 'reduced' ? 48 : 120;

  // Derive sampled representative pedestrians from real trips and city state
  const agents = useMemo<PedestrianAgent[]>(() => {
    return sampleRepresentativePedestrians(grid, trips, roadGraph, timeOfDay, population, maxAgents);
  }, [grid, trips, roadGraph, timeOfDay, population, maxAgents]);

  // Shared low-poly geometry and material for high performance
  const geometry = useMemo(() => new THREE.CapsuleGeometry(0.045, 0.12, 4, 6), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.1 }), []);

  const walkCycleRef = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current || agents.length === 0) return;

    walkCycleRef.current += delta * 6;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      updatePedestrianAgent(agent, delta, grid, width, height, gridToWorld);

      dummy.position.set(agent.worldPos[0], agent.worldPos[1], agent.worldPos[2]);

      // Subtle natural vertical bobbing and stride rhythm while walking/crossing
      if (agent.state === 'WALKING' || agent.state === 'CROSSING') {
        const bob = Math.abs(Math.sin(walkCycleRef.current * (agent.speed * 20) + i)) * 0.02;
        dummy.position.y += bob;
      } else if (agent.state === 'WAITING' || agent.state === 'TRANSIT_WAIT') {
        // Slight subtle breathing/idle sway
        const idle = Math.sin(walkCycleRef.current * 0.8 + i) * 0.005;
        dummy.position.y += idle;
      }

      dummy.rotation.set(0, agent.heading, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
      tempColor.set(agent.color);
      meshRef.current.setColorAt(i, tempColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  if (agents.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, agents.length]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && agents[e.instanceId] && onSelectCitizen) {
          onSelectCitizen(agents[e.instanceId].citizenId);
        }
      }}
    />
  );
}
