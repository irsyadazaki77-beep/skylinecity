import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { CityIncident, OverlayMode, ServiceVehicleAgent, TileData, TransitLine } from '../../types';
import { TransitVehicleAgent } from '../../transit';
import { deriveTransitRouteGeometry } from '../../transitRouteMap';
import { incidentOverlayColor, sampleGridPath, serviceVehicleOverlayColor } from '../../networkOverlayGeometry';
import { gridToWorld } from './types3D';

interface NetworkOverlaysProps {
  activeOverlay: OverlayMode;
  grid: TileData[][];
  timeOfDay?: number;
  transitLines?: TransitLine[];
  transitVehicles?: TransitVehicleAgent[];
  incidents?: CityIncident[];
  serviceVehicles?: ServiceVehicleAgent[];
}

const TRANSIT_ROUTE_COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#fb7185', '#34d399', '#f97316'];

function pointToWorld(
  [x, y]: [number, number],
  grid: TileData[][],
  yOffset: number,
): [number, number, number] {
  const width = grid[0]?.length ?? 1;
  const height = grid.length || 1;
  const tile = grid[Math.round(y)]?.[Math.round(x)];
  const structureOffset = tile?.roadStructure === 'BRIDGE' ? 0.22 : tile?.roadStructure === 'TUNNEL' ? -0.08 : 0;
  const [wx, , wz] = gridToWorld(x, y, width, height);
  return [wx, (tile?.elevation ?? 0) * 0.15 + structureOffset + yOffset, wz];
}

function linePoints(path: [number, number][], grid: TileData[][], yOffset: number): [number, number, number][] {
  return path.map((point) => pointToWorld(point, grid, yOffset));
}

export function NetworkOverlays({
  activeOverlay,
  grid,
  timeOfDay = 6,
  transitLines = [],
  transitVehicles = [],
  incidents = [],
  serviceVehicles = [],
}: NetworkOverlaysProps) {
  const transitRoutes = useMemo(() => deriveTransitRouteGeometry(transitLines, transitVehicles, timeOfDay), [transitLines, transitVehicles, timeOfDay]);
  const activeIncidents = useMemo(() => incidents.filter((incident) => incident.dispatchPath && incident.dispatchPath.length > 1), [incidents]);

  if (activeOverlay === 'TRANSIT_ROUTES') {
    return (
      <group name="TransitRouteOverlay">
        {transitRoutes.map(({ line, path, operating }, index) => {
          const color = TRANSIT_ROUTE_COLORS[index % TRANSIT_ROUTE_COLORS.length];
          const routeOpacity = operating ? 0.92 : line.active ? 0.55 : 0.4;
          return (
            <group key={`route-${line.id}`}>
              {path.length > 1 && <Line points={linePoints(path, grid, 0.3)} color={color} lineWidth={operating ? 2.8 : 1.8} transparent opacity={routeOpacity} />}
              {line.stops.map(([x, y], stopIndex) => {
                const [wx, wy, wz] = pointToWorld([x, y], grid, 0.42);
                return (
                  <mesh key={`stop-${line.id}-${stopIndex}`} position={[wx, wy, wz]}>
                    <sphereGeometry args={[0.13, 10, 10]} />
                    <meshBasicMaterial color={color} transparent opacity={operating ? 1 : line.active ? 0.65 : 0.5} />
                  </mesh>
                );
              })}
            </group>
          );
        })}
      </group>
    );
  }

  if (activeOverlay === 'DISPATCH') {
    return (
      <group name="EmergencyDispatchOverlay">
        {activeIncidents.map((incident) => {
          const color = incidentOverlayColor(incident.type);
          const [wx, wy, wz] = pointToWorld([incident.x, incident.y], grid, 0.48);
          return (
            <group key={`incident-path-${incident.id}`}>
              <Line points={linePoints(incident.dispatchPath!, grid, 0.36)} color={color} lineWidth={Math.max(2, incident.severity)} transparent opacity={0.9} />
              <mesh position={[wx, wy, wz]}>
                <sphereGeometry args={[0.12 + incident.severity * 0.045, 12, 12]} />
                <meshBasicMaterial color={color} />
              </mesh>
            </group>
          );
        })}
        {serviceVehicles.map((vehicle) => {
          const sampled = sampleGridPath(vehicle.path, vehicle.routeProgress);
          if (!sampled) return null;
          const [wx, wy, wz] = pointToWorld(sampled, grid, 0.58);
          return (
            <mesh key={`service-unit-${vehicle.id}`} position={[wx, wy, wz]}>
              <boxGeometry args={[0.18, 0.12, 0.18]} />
              <meshBasicMaterial color={serviceVehicleOverlayColor(vehicle.role)} />
            </mesh>
          );
        })}
      </group>
    );
  }

  return null;
}
