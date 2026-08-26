import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Trip, TransitMode } from '../../citizenSimulation/types';
import { FreightTrip } from '../../logistics';
import { CityIncident, ServiceVehicleAgent } from '../../types';
import { TransitVehicleAgent } from '../../transit';
import { gridToWorld } from './types3D';

interface TrafficVehiclesProps {
  trips?: Trip[];
  transitVehicles?: TransitVehicleAgent[];
  freightTrips?: FreightTrip[];
  incidents?: CityIncident[];
  serviceVehicles?: ServiceVehicleAgent[];
  gridWidth: number;
  gridHeight: number;
  speed: number;
  nightFactor: number;
  trafficDensity?: 'low' | 'medium' | 'high';
}

interface VehicleActor {
  id: string;
  path: [number, number][];
  progress: number;
  speed: number;
  color: THREE.Color;
}

const VEHICLE_COLORS = [
  new THREE.Color('#38bdf8'), // sky blue
  new THREE.Color('#fbbf24'), // yellow cab
  new THREE.Color('#f87171'), // red
  new THREE.Color('#a3e635'), // green
  new THREE.Color('#e2e8f0'), // white
  new THREE.Color('#475569'), // slate
];

export function TrafficVehicles({
  trips = [],
  transitVehicles: lineTransitVehicles = [],
  freightTrips = [],
  incidents = [],
  serviceVehicles: fleetServiceVehicles = [],
  gridWidth,
  gridHeight,
  speed,
  nightFactor,
  trafficDensity = 'medium',
}: TrafficVehiclesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const transitMeshRef = useRef<THREE.InstancedMesh>(null);
  const lineTransitMeshRef = useRef<THREE.InstancedMesh>(null);
  const freightMeshRef = useRef<THREE.InstancedMesh>(null);
  const serviceMeshRef = useRef<THREE.InstancedMesh>(null);
  const headlightMeshRef = useRef<THREE.InstancedMesh>(null);
  const progressById = useRef(new Map<string, number>());
  const stableProgress = (id: string, initial: number) => progressById.current.get(id) ?? initial;
  const advanceProgress = (vehicle: VehicleActor, dt: number) => {
    vehicle.progress = (vehicle.progress + dt * vehicle.speed * 0.4) % 1;
    progressById.current.set(vehicle.id, vehicle.progress);
  };

  // Filter vehicular trips with valid paths
  const carTrips = useMemo(() => {
    const renderLimit = trafficDensity === 'low' ? 30 : trafficDensity === 'high' ? 160 : 80;
    return trips.filter((t) => t.mode === TransitMode.CAR && t.path.length >= 2).slice(0, renderLimit);
  }, [trafficDensity, trips]);
  const transitTrips = useMemo(() => {
    const renderLimit = trafficDensity === 'low' ? 12 : trafficDensity === 'high' ? 48 : 24;
    return trips.filter((t) => t.mode === TransitMode.TRANSIT && t.path.length >= 2).slice(0, renderLimit);
  }, [trafficDensity, trips]);
  const visibleFreightTrips = useMemo(() => {
    const renderLimit = trafficDensity === 'low' ? 8 : trafficDensity === 'high' ? 32 : 16;
    return freightTrips.filter((trip) => trip.path.length >= 2).slice(0, renderLimit);
  }, [freightTrips, trafficDensity]);

  // Create vehicle simulation actors
  const vehicles = useMemo(() => {
    return carTrips.map((trip, idx) => {
      const color = VEHICLE_COLORS[idx % VEHICLE_COLORS.length];
      return {
        id: trip.id,
        path: trip.path,
        progress: stableProgress(trip.id, (idx * 0.17) % 1),
        speed: 0.15 + (idx % 3) * 0.05,
        color,
      } as VehicleActor;
    });
  }, [carTrips]);
  const transitVehicles = useMemo(() => {
    return transitTrips.map((trip, idx) => ({
      id: trip.id,
      path: trip.path,
      progress: stableProgress(trip.id, (idx * 0.23) % 1),
      speed: 0.11 + (idx % 2) * 0.025,
      color: new THREE.Color(idx % 2 === 0 ? '#22d3ee' : '#a78bfa'),
    } as VehicleActor));
  }, [transitTrips]);
  const lineVehicles = useMemo(() => lineTransitVehicles.map((agent, idx) => ({
    id: agent.id,
    path: agent.path,
    progress: stableProgress(agent.id, agent.routeProgress ?? (idx * 0.19) % 1),
    speed: agent.mode === 'TRAM' ? 0.095 : 0.11,
    color: new THREE.Color(agent.mode === 'TRAM' ? '#a78bfa' : '#22d3ee'),
  } as VehicleActor)), [lineTransitVehicles]);
  const freightVehicles = useMemo(() => {
    return visibleFreightTrips.map((trip, idx) => ({
      id: trip.id,
      path: trip.path,
      progress: stableProgress(trip.id, (idx * 0.29) % 1),
      speed: 0.08 + (idx % 2) * 0.018,
      color: new THREE.Color(idx % 2 === 0 ? '#fb923c' : '#f59e0b'),
    } as VehicleActor));
  }, [visibleFreightTrips]);
  const serviceIncidents = useMemo(() => incidents
    .filter((incident) => (incident.dispatchPath?.length ?? 0) >= 2)
    .slice(0, 24), [incidents]);
  const serviceVehicles = useMemo(() => {
    if (fleetServiceVehicles.length > 0) {
      return fleetServiceVehicles.slice(0, 48).map((agent, idx) => {
        const returning = agent.status === 'RETURNING';
        const path = returning ? [...agent.path].reverse() : agent.path;
        const progress = agent.status === 'ON_SCENE'
          ? 0.98
          : returning
            ? Math.max(0, Math.min(1, agent.routeProgress - 1))
            : Math.max(0, Math.min(1, agent.routeProgress));
        const color = agent.role === 'FIRE_ENGINE'
          ? '#ef4444'
          : agent.role === 'AMBULANCE'
            ? '#f8fafc'
            : agent.role === 'POLICE_CAR'
              ? '#60a5fa'
              : '#f59e0b';
        return {
          id: agent.id,
          path,
          progress,
          speed: returning ? 0.1 : 0.14 + (idx % 3) * 0.006,
          color: new THREE.Color(color),
        } as VehicleActor;
      });
    }
    return serviceIncidents.map((incident, idx) => ({
      incident,
      idx,
    })).flatMap(({ incident, idx }) => Array.from({ length: Math.max(0, incident.dispatchedUnits ?? 1) }, (_, unitIndex) => ({
      id: `${incident.id}-unit-${unitIndex}`,
      path: incident.dispatchPath!,
      progress: (idx * 0.31 + unitIndex * 0.08) % 1,
      speed: 0.13 + unitIndex * 0.006,
      color: new THREE.Color(incident.type === 'FIRE' ? '#ef4444' : incident.type === 'MEDICAL' ? '#f8fafc' : '#60a5fa'),
    } as VehicleActor)));
  }, [fleetServiceVehicles, serviceIncidents]);

  // Trips are recreated by the simulation, so remove progress entries for
  // actors that have left the render window instead of growing this map forever.
  useEffect(() => {
    const activeIds = new Set([
      ...vehicles.map((vehicle) => vehicle.id),
      ...transitVehicles.map((vehicle) => vehicle.id),
      ...lineVehicles.map((vehicle) => vehicle.id),
      ...freightVehicles.map((vehicle) => vehicle.id),
    ]);
    for (const id of progressById.current.keys()) {
      if (!activeIds.has(id)) progressById.current.delete(id);
    }
  }, [freightVehicles, lineVehicles, transitVehicles, vehicles]);

  const carGeometry = useMemo(() => new THREE.BoxGeometry(0.24, 0.12, 0.44), []);
  const carMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.6,
  }), []);
  const transitGeometry = useMemo(() => new THREE.BoxGeometry(0.32, 0.18, 0.72), []);
  const transitMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.28,
    metalness: 0.55,
    emissive: '#082f49',
    emissiveIntensity: 0.35,
  }), []);
  const freightGeometry = useMemo(() => new THREE.BoxGeometry(0.38, 0.22, 0.9), []);
  const freightMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.45,
    metalness: 0.35,
    emissive: '#431407',
    emissiveIntensity: 0.25,
  }), []);
  const serviceGeometry = useMemo(() => new THREE.BoxGeometry(0.28, 0.16, 0.62), []);
  const serviceMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.35,
    metalness: 0.45,
    emissive: '#450a0a',
    emissiveIntensity: 0.3,
  }), []);

  const headlightGeometry = useMemo(() => new THREE.SphereGeometry(0.03, 6, 6), []);
  const headlightMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fef08a',
  }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (speed === 0) return;

    const dt = Math.min(delta, 0.1) * (speed === 1 ? 1 : speed === 2 ? 2 : speed === 3 ? 3.5 : 0);

    if (meshRef.current) for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      advanceProgress(v, dt);

      const path = v.path;
      const totalSegments = path.length - 1;
      const exactIndex = v.progress * totalSegments;
      const segIndex = Math.min(Math.floor(exactIndex), totalSegments - 1);
      const segT = exactIndex - segIndex;

      const p0 = path[segIndex];
      const p1 = path[segIndex + 1];

      if (!p0 || !p1) continue;

      const [w0x, , w0z] = gridToWorld(p0[0], p0[1], gridWidth, gridHeight);
      const [w1x, , w1z] = gridToWorld(p1[0], p1[1], gridWidth, gridHeight);

      const curX = THREE.MathUtils.lerp(w0x, w1x, segT);
      const curZ = THREE.MathUtils.lerp(w0z, w1z, segT);

      // Slight lane offset
      const dx = w1x - w0x;
      const dz = w1z - w0z;
      const angle = Math.atan2(dx, dz);

      const sideX = Math.cos(angle) * 0.12;
      const sideZ = -Math.sin(angle) * 0.12;

      dummy.position.set(curX + sideX, 0.08, curZ + sideZ);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, v.color);

      if (headlightMeshRef.current) {
        dummy.position.set(curX + sideX, 0.09, curZ + sideZ);
        dummy.updateMatrix();
        headlightMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
    }

    if (transitMeshRef.current) for (let i = 0; i < transitVehicles.length; i++) {
      const v = transitVehicles[i];
      advanceProgress(v, dt);

      const path = v.path;
      const totalSegments = path.length - 1;
      const exactIndex = v.progress * totalSegments;
      const segIndex = Math.min(Math.floor(exactIndex), totalSegments - 1);
      const segT = exactIndex - segIndex;
      const p0 = path[segIndex];
      const p1 = path[segIndex + 1];
      if (!p0 || !p1) continue;

      const [w0x, , w0z] = gridToWorld(p0[0], p0[1], gridWidth, gridHeight);
      const [w1x, , w1z] = gridToWorld(p1[0], p1[1], gridWidth, gridHeight);
      const curX = THREE.MathUtils.lerp(w0x, w1x, segT);
      const curZ = THREE.MathUtils.lerp(w0z, w1z, segT);
      const angle = Math.atan2(w1x - w0x, w1z - w0z);

      dummy.position.set(curX, 0.13, curZ);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      transitMeshRef.current.setMatrixAt(i, dummy.matrix);
      transitMeshRef.current.setColorAt(i, v.color);
    }

    if (lineTransitMeshRef.current) for (let i = 0; i < lineVehicles.length; i++) {
      const v = lineVehicles[i];
      advanceProgress(v, dt);
      const totalSegments = v.path.length - 1;
      const exactIndex = v.progress * totalSegments;
      const segIndex = Math.min(Math.floor(exactIndex), totalSegments - 1);
      const segT = exactIndex - segIndex;
      const p0 = v.path[segIndex];
      const p1 = v.path[segIndex + 1];
      if (!p0 || !p1) continue;
      const [w0x, , w0z] = gridToWorld(p0[0], p0[1], gridWidth, gridHeight);
      const [w1x, , w1z] = gridToWorld(p1[0], p1[1], gridWidth, gridHeight);
      const curX = THREE.MathUtils.lerp(w0x, w1x, segT);
      const curZ = THREE.MathUtils.lerp(w0z, w1z, segT);
      const angle = Math.atan2(w1x - w0x, w1z - w0z);
      dummy.position.set(curX, 0.14, curZ);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      lineTransitMeshRef.current.setMatrixAt(i, dummy.matrix);
      lineTransitMeshRef.current.setColorAt(i, v.color);
    }

    if (freightMeshRef.current) for (let i = 0; i < freightVehicles.length; i++) {
      const v = freightVehicles[i];
      advanceProgress(v, dt);
      const totalSegments = v.path.length - 1;
      const exactIndex = v.progress * totalSegments;
      const segIndex = Math.min(Math.floor(exactIndex), totalSegments - 1);
      const segT = exactIndex - segIndex;
      const p0 = v.path[segIndex];
      const p1 = v.path[segIndex + 1];
      if (!p0 || !p1) continue;

      const [w0x, , w0z] = gridToWorld(p0[0], p0[1], gridWidth, gridHeight);
      const [w1x, , w1z] = gridToWorld(p1[0], p1[1], gridWidth, gridHeight);
      const curX = THREE.MathUtils.lerp(w0x, w1x, segT);
      const curZ = THREE.MathUtils.lerp(w0z, w1z, segT);
      const angle = Math.atan2(w1x - w0x, w1z - w0z);
      dummy.position.set(curX, 0.16, curZ);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      freightMeshRef.current.setMatrixAt(i, dummy.matrix);
      freightMeshRef.current.setColorAt(i, v.color);
    }

    if (serviceMeshRef.current) for (let i = 0; i < serviceVehicles.length; i++) {
      const v = serviceVehicles[i];
      v.progress = (v.progress + dt * v.speed * 0.4) % 1;
      const totalSegments = v.path.length - 1;
      const exactIndex = v.progress * totalSegments;
      const segIndex = Math.min(Math.floor(exactIndex), totalSegments - 1);
      const segT = exactIndex - segIndex;
      const p0 = v.path[segIndex];
      const p1 = v.path[segIndex + 1];
      if (!p0 || !p1) continue;
      const [w0x, , w0z] = gridToWorld(p0[0], p0[1], gridWidth, gridHeight);
      const [w1x, , w1z] = gridToWorld(p1[0], p1[1], gridWidth, gridHeight);
      const curX = THREE.MathUtils.lerp(w0x, w1x, segT);
      const curZ = THREE.MathUtils.lerp(w0z, w1z, segT);
      const angle = Math.atan2(w1x - w0x, w1z - w0z);
      dummy.position.set(curX, 0.2, curZ);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      serviceMeshRef.current.setMatrixAt(i, dummy.matrix);
      serviceMeshRef.current.setColorAt(i, v.color);
    }

    if (meshRef.current) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }
    if (transitMeshRef.current) {
      transitMeshRef.current.instanceMatrix.needsUpdate = true;
      if (transitMeshRef.current.instanceColor) transitMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (lineTransitMeshRef.current) {
      lineTransitMeshRef.current.instanceMatrix.needsUpdate = true;
      if (lineTransitMeshRef.current.instanceColor) lineTransitMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (freightMeshRef.current) {
      freightMeshRef.current.instanceMatrix.needsUpdate = true;
      if (freightMeshRef.current.instanceColor) freightMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (serviceMeshRef.current) {
      serviceMeshRef.current.instanceMatrix.needsUpdate = true;
      if (serviceMeshRef.current.instanceColor) serviceMeshRef.current.instanceColor.needsUpdate = true;
    }

    if (headlightMeshRef.current) {
      headlightMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (vehicles.length === 0 && transitVehicles.length === 0 && lineVehicles.length === 0 && freightVehicles.length === 0 && serviceVehicles.length === 0) return null;

  return (
    <group name="TrafficVehicles">
      {vehicles.length > 0 && (
        <instancedMesh
          ref={meshRef}
          args={[carGeometry, carMaterial, vehicles.length]}
          castShadow
        />
      )}
      {transitVehicles.length > 0 && (
        <instancedMesh
          ref={transitMeshRef}
          args={[transitGeometry, transitMaterial, transitVehicles.length]}
          castShadow
        />
      )}
      {lineVehicles.length > 0 && (
        <instancedMesh
          ref={lineTransitMeshRef}
          args={[transitGeometry, transitMaterial, lineVehicles.length]}
          castShadow
        />
      )}
      {freightVehicles.length > 0 && (
        <instancedMesh
          ref={freightMeshRef}
          args={[freightGeometry, freightMaterial, freightVehicles.length]}
          castShadow
        />
      )}
      {serviceVehicles.length > 0 && (
        <instancedMesh
          ref={serviceMeshRef}
          args={[serviceGeometry, serviceMaterial, serviceVehicles.length]}
          castShadow
        />
      )}
      {nightFactor > 0.3 && vehicles.length > 0 && (
        <instancedMesh
          ref={headlightMeshRef}
          args={[headlightGeometry, headlightMaterial, vehicles.length]}
        />
      )}
    </group>
  );
}
