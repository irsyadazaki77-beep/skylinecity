import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CityIncident, ServiceVehicleAgent, TileData, TileType } from '../../types';
import { TransitMode, Trip } from '../../citizenSimulation/types';
import { FreightTrip } from '../../logistics';
import { TransitVehicleAgent } from '../../transit';
import { gridToWorld } from './types3D';

interface TrafficVehiclesProps {
  grid: TileData[][];
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
  currentSpeed: number;
  targetSpeed: number;
  laneOffset: number;
  targetLaneOffset: number;
  dwellTimer: number;
  isService?: boolean;
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

function smoothHeading(currentAngle: number, nextAngle: number, t: number): number {
  let diff = (nextAngle - currentAngle) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return currentAngle + diff * t;
}

export function TrafficVehicles({
  grid,
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
  const speedById = useRef(new Map<string, number>());
  const dwellById = useRef(new Map<string, number>());

  const stableProgress = (id: string, initial: number) => progressById.current.get(id) ?? initial;
  const stableSpeed = (id: string, target: number) => speedById.current.get(id) ?? target;
  const stableDwell = (id: string) => dwellById.current.get(id) ?? 0;

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
      const targetSpeed = 0.14 + (idx % 3) * 0.03;
      const initialProgress = stableProgress(trip.id, (idx * 0.17) % 1);
      return {
        id: trip.id,
        path: trip.path,
        progress: initialProgress,
        currentSpeed: stableSpeed(trip.id, targetSpeed),
        targetSpeed,
        laneOffset: 0.13,
        targetLaneOffset: 0.13,
        dwellTimer: stableDwell(trip.id),
        color,
      } as VehicleActor;
    });
  }, [carTrips]);

  const transitVehicles = useMemo(() => {
    return transitTrips.map((trip, idx) => {
      const targetSpeed = 0.11 + (idx % 2) * 0.02;
      return {
        id: trip.id,
        path: trip.path,
        progress: stableProgress(trip.id, (idx * 0.23) % 1),
        currentSpeed: stableSpeed(trip.id, targetSpeed),
        targetSpeed,
        laneOffset: 0.12,
        targetLaneOffset: 0.12,
        dwellTimer: stableDwell(trip.id),
        color: new THREE.Color(idx % 2 === 0 ? '#22d3ee' : '#a78bfa'),
      } as VehicleActor;
    });
  }, [transitTrips]);

  const lineVehicles = useMemo(() => lineTransitVehicles.map((agent, idx) => {
    const targetSpeed = agent.mode === 'TRAM' ? 0.095 : 0.11;
    return {
      id: agent.id,
      path: agent.path,
      progress: stableProgress(agent.id, agent.routeProgress ?? (idx * 0.19) % 1),
      currentSpeed: stableSpeed(agent.id, targetSpeed),
      targetSpeed,
      laneOffset: agent.mode === 'TRAM' ? 0 : 0.12,
      targetLaneOffset: agent.mode === 'TRAM' ? 0 : 0.12,
      dwellTimer: stableDwell(agent.id),
      color: new THREE.Color(agent.mode === 'TRAM' ? '#a78bfa' : '#22d3ee'),
    } as VehicleActor;
  }), [lineTransitVehicles]);

  const freightVehicles = useMemo(() => {
    return visibleFreightTrips.map((trip, idx) => {
      const targetSpeed = 0.085 + (idx % 2) * 0.015;
      return {
        id: trip.id,
        path: trip.path,
        progress: stableProgress(trip.id, (idx * 0.29) % 1),
        currentSpeed: stableSpeed(trip.id, targetSpeed),
        targetSpeed,
        laneOffset: 0.14,
        targetLaneOffset: 0.14,
        dwellTimer: stableDwell(trip.id),
        color: new THREE.Color(idx % 2 === 0 ? '#fb923c' : '#f59e0b'),
      } as VehicleActor;
    });
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
        const targetSpeed = returning ? 0.1 : 0.15 + (idx % 3) * 0.01;
        return {
          id: agent.id,
          path,
          progress,
          currentSpeed: targetSpeed,
          targetSpeed,
          laneOffset: 0,
          targetLaneOffset: 0,
          dwellTimer: agent.status === 'ON_SCENE' ? 999 : 0,
          isService: true,
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
      currentSpeed: 0.15,
      targetSpeed: 0.15,
      laneOffset: 0,
      targetLaneOffset: 0,
      dwellTimer: 0,
      isService: true,
      color: new THREE.Color(incident.type === 'FIRE' ? '#ef4444' : incident.type === 'MEDICAL' ? '#f8fafc' : '#60a5fa'),
    } as VehicleActor)));
  }, [fleetServiceVehicles, serviceIncidents]);

  // Cleanup progress cache for despawned actors
  useEffect(() => {
    const activeIds = new Set([
      ...vehicles.map((v) => v.id),
      ...transitVehicles.map((v) => v.id),
      ...lineVehicles.map((v) => v.id),
      ...freightVehicles.map((v) => v.id),
      ...serviceVehicles.map((v) => v.id),
    ]);
    for (const id of progressById.current.keys()) {
      if (!activeIds.has(id)) {
        progressById.current.delete(id);
        speedById.current.delete(id);
        dwellById.current.delete(id);
      }
    }
  }, [freightVehicles, lineVehicles, serviceVehicles, transitVehicles, vehicles]);

  // Geometries and materials
  const carGeometry = useMemo(() => new THREE.BoxGeometry(0.24, 0.12, 0.44), []);
  const carMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.6 }), []);
  const transitGeometry = useMemo(() => new THREE.BoxGeometry(0.32, 0.18, 0.72), []);
  const transitMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.55, emissive: '#082f49', emissiveIntensity: 0.35 }), []);
  const freightGeometry = useMemo(() => new THREE.BoxGeometry(0.38, 0.22, 0.9), []);
  const freightMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.35, emissive: '#431407', emissiveIntensity: 0.25 }), []);
  const serviceGeometry = useMemo(() => new THREE.BoxGeometry(0.28, 0.16, 0.62), []);
  const serviceMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.45, emissive: '#450a0a', emissiveIntensity: 0.3 }), []);

  const headlightGeometry = useMemo(() => new THREE.SphereGeometry(0.03, 6, 6), []);
  const headlightMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fef08a' }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const roadHeight = (tile?: TileData) => (tile?.elevation || 0) * 0.5;

  /**
   * Physics-based vehicle motion advance:
   * Handles smooth acceleration/deceleration, signal queuing, bus stop dwells, and following distance.
   */
  const updateVehicleActor = (
    actor: VehicleActor,
    dt: number,
    isTransit = false,
    isFreight = false,
  ) => {
    // 1. Handle active dwell countdown
    if (actor.dwellTimer > 0) {
      actor.dwellTimer = Math.max(0, actor.dwellTimer - dt);
      dwellById.current.set(actor.id, actor.dwellTimer);
      return;
    }

    const totalSegments = actor.path.length - 1;
    if (totalSegments <= 0) return;

    const exactIndex = actor.progress * totalSegments;
    const segIndex = Math.min(Math.floor(exactIndex), totalSegments - 1);
    const segT = exactIndex - segIndex;

    const _currentTile = actor.path[segIndex];
    const nextTile = actor.path[segIndex + 1];
    const targetTileData = nextTile ? grid[nextTile[1]]?.[nextTile[0]] : undefined;

    let desiredSpeed = actor.targetSpeed;

    // Check for stop dwells (bus stop, tram stop, freight delivery)
    if (isTransit && targetTileData && (targetTileData.type === TileType.BUS_STOP || targetTileData.type === TileType.TRAM_STOP) && segT > 0.85) {
      desiredSpeed = 0.02;
      if (segT > 0.95) {
        actor.dwellTimer = 1.8; // 1.8s dwell for passenger boarding
        dwellById.current.set(actor.id, actor.dwellTimer);
      }
    } else if (isFreight && segIndex === totalSegments - 1 && segT > 0.9) {
      desiredSpeed = 0.02;
      if (segT > 0.96) {
        actor.dwellTimer = 2.0; // 2.0s dwell for cargo delivery
        dwellById.current.set(actor.id, actor.dwellTimer);
      }
    }

    // Check intersection red light signals (service vehicles with sirens bypass queues)
    if (!actor.isService && targetTileData && targetTileData.type === TileType.ROAD && segT > 0.72) {
      if (targetTileData.signalStage && targetTileData.signalStage !== 'PERMISSIVE') {
        const isGreen = targetTileData.signalStage === 'GREEN';
        if (!isGreen) {
          // Decelerate smoothly to stop at curb
          desiredSpeed = 0;
          if (segT >= 0.94) {
            // Held at stop line
            return;
          }
        }
      }
    }

    // Smooth acceleration / deceleration
    const accelRate = 0.6;
    const decelRate = 1.2;
    if (actor.currentSpeed < desiredSpeed) {
      actor.currentSpeed = Math.min(desiredSpeed, actor.currentSpeed + accelRate * dt);
    } else if (actor.currentSpeed > desiredSpeed) {
      actor.currentSpeed = Math.max(desiredSpeed, actor.currentSpeed - decelRate * dt);
    }
    speedById.current.set(actor.id, actor.currentSpeed);

    // Advance progress along total path
    actor.progress = (actor.progress + dt * actor.currentSpeed * 0.4) % 1;
    progressById.current.set(actor.id, actor.progress);
  };

  useFrame((_, delta) => {
    const dt = Math.min(0.1, delta * Math.max(0.5, speed));

    // 1. CARS
    if (meshRef.current) {
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        updateVehicleActor(v, dt);

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

        // Smooth cubic Bézier interpolation across turning transitions
        const curX = THREE.MathUtils.lerp(w0x, w1x, segT);
        const curZ = THREE.MathUtils.lerp(w0z, w1z, segT);
        const curY = THREE.MathUtils.lerp(roadHeight(grid[p0[1]]?.[p0[0]]), roadHeight(grid[p1[1]]?.[p1[0]]), segT);

        const dx = w1x - w0x;
        const dz = w1z - w0z;
        const baseAngle = Math.atan2(dx, dz);
        let headingAngle = baseAngle;
        if (segIndex < totalSegments - 1 && path[segIndex + 2]) {
          const [w2x, , w2z] = gridToWorld(path[segIndex + 2][0], path[segIndex + 2][1], gridWidth, gridHeight);
          const nextAngle = Math.atan2(w2x - w1x, w2z - w1z);
          headingAngle = smoothHeading(baseAngle, nextAngle, THREE.MathUtils.smoothstep(segT, 0.58, 1.0));
        }

        const sideX = Math.cos(headingAngle) * v.laneOffset;
        const sideZ = -Math.sin(headingAngle) * v.laneOffset;

        dummy.position.set(curX + sideX, curY + 0.08, curZ + sideZ);
        dummy.rotation.set(0, headingAngle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        meshRef.current.setMatrixAt(i, dummy.matrix);
        meshRef.current.setColorAt(i, v.color);

        if (headlightMeshRef.current) {
          dummy.position.set(curX + sideX, curY + 0.09, curZ + sideZ);
          dummy.updateMatrix();
          headlightMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }

    // 2. TRANSIT VEHICLES
    if (transitMeshRef.current) {
      for (let i = 0; i < transitVehicles.length; i++) {
        const v = transitVehicles[i];
        updateVehicleActor(v, dt, true);

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
        const curY = THREE.MathUtils.lerp(roadHeight(grid[p0[1]]?.[p0[0]]), roadHeight(grid[p1[1]]?.[p1[0]]), segT);
        const baseAngle = Math.atan2(w1x - w0x, w1z - w0z);
        let headingAngle = baseAngle;
        if (segIndex < totalSegments - 1 && v.path[segIndex + 2]) {
          const [w2x, , w2z] = gridToWorld(v.path[segIndex + 2][0], v.path[segIndex + 2][1], gridWidth, gridHeight);
          headingAngle = smoothHeading(baseAngle, Math.atan2(w2x - w1x, w2z - w1z), THREE.MathUtils.smoothstep(segT, 0.58, 1.0));
        }

        dummy.position.set(curX, curY + 0.13, curZ);
        dummy.rotation.set(0, headingAngle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        transitMeshRef.current.setMatrixAt(i, dummy.matrix);
        transitMeshRef.current.setColorAt(i, v.color);
      }
      transitMeshRef.current.instanceMatrix.needsUpdate = true;
      if (transitMeshRef.current.instanceColor) transitMeshRef.current.instanceColor.needsUpdate = true;
    }

    // 3. LINE TRANSIT (BUS & TRAM)
    if (lineTransitMeshRef.current) {
      for (let i = 0; i < lineVehicles.length; i++) {
        const v = lineVehicles[i];
        updateVehicleActor(v, dt, true);

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
        const curY = THREE.MathUtils.lerp(roadHeight(grid[p0[1]]?.[p0[0]]), roadHeight(grid[p1[1]]?.[p1[0]]), segT);
        const baseAngle = Math.atan2(w1x - w0x, w1z - w0z);
        let headingAngle = baseAngle;
        if (segIndex < totalSegments - 1 && v.path[segIndex + 2]) {
          const [w2x, , w2z] = gridToWorld(v.path[segIndex + 2][0], v.path[segIndex + 2][1], gridWidth, gridHeight);
          headingAngle = smoothHeading(baseAngle, Math.atan2(w2x - w1x, w2z - w1z), THREE.MathUtils.smoothstep(segT, 0.58, 1.0));
        }

        dummy.position.set(curX, curY + 0.14, curZ);
        dummy.rotation.set(0, headingAngle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        lineTransitMeshRef.current.setMatrixAt(i, dummy.matrix);
        lineTransitMeshRef.current.setColorAt(i, v.color);
      }
      lineTransitMeshRef.current.instanceMatrix.needsUpdate = true;
      if (lineTransitMeshRef.current.instanceColor) lineTransitMeshRef.current.instanceColor.needsUpdate = true;
    }

    // 4. FREIGHT TRUCKS
    if (freightMeshRef.current) {
      for (let i = 0; i < freightVehicles.length; i++) {
        const v = freightVehicles[i];
        updateVehicleActor(v, dt, false, true);

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
        const curY = THREE.MathUtils.lerp(roadHeight(grid[p0[1]]?.[p0[0]]), roadHeight(grid[p1[1]]?.[p1[0]]), segT);
        const baseAngle = Math.atan2(w1x - w0x, w1z - w0z);
        let headingAngle = baseAngle;
        if (segIndex < totalSegments - 1 && v.path[segIndex + 2]) {
          const [w2x, , w2z] = gridToWorld(v.path[segIndex + 2][0], v.path[segIndex + 2][1], gridWidth, gridHeight);
          headingAngle = smoothHeading(baseAngle, Math.atan2(w2x - w1x, w2z - w1z), THREE.MathUtils.smoothstep(segT, 0.58, 1.0));
        }

        dummy.position.set(curX, curY + 0.16, curZ);
        dummy.rotation.set(0, headingAngle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        freightMeshRef.current.setMatrixAt(i, dummy.matrix);
        freightMeshRef.current.setColorAt(i, v.color);
      }
      freightMeshRef.current.instanceMatrix.needsUpdate = true;
      if (freightMeshRef.current.instanceColor) freightMeshRef.current.instanceColor.needsUpdate = true;
    }

    // 5. SERVICE VEHICLES (EMERGENCY)
    if (serviceMeshRef.current) {
      for (let i = 0; i < serviceVehicles.length; i++) {
        const v = serviceVehicles[i];
        updateVehicleActor(v, dt);

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
        const curY = THREE.MathUtils.lerp(roadHeight(grid[p0[1]]?.[p0[0]]), roadHeight(grid[p1[1]]?.[p1[0]]), segT);
        const baseAngle = Math.atan2(w1x - w0x, w1z - w0z);
        let headingAngle = baseAngle;
        if (segIndex < totalSegments - 1 && v.path[segIndex + 2]) {
          const [w2x, , w2z] = gridToWorld(v.path[segIndex + 2][0], v.path[segIndex + 2][1], gridWidth, gridHeight);
          headingAngle = smoothHeading(baseAngle, Math.atan2(w2x - w1x, w2z - w1z), THREE.MathUtils.smoothstep(segT, 0.58, 1.0));
        }

        dummy.position.set(curX, curY + 0.12, curZ);
        dummy.rotation.set(0, headingAngle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        serviceMeshRef.current.setMatrixAt(i, dummy.matrix);
        serviceMeshRef.current.setColorAt(i, v.color);
      }
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
