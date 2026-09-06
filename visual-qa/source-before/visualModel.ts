import { RoadClass, TileData, TileType } from '../../types';

// Render-only mapping. Simulation elevation and parcel ownership stay untouched.
export const terrainHeight = (elevation = 0) => (Number.isFinite(elevation) ? elevation : 0) * 0.15;
export const roadHeight = (tile?: Pick<TileData, 'elevation' | 'roadStructure'>) => terrainHeight(tile?.elevation) + (tile?.roadStructure === 'BRIDGE' ? 0.22 : tile?.roadStructure === 'TUNNEL' ? -0.08 : 0);
export function buildingVariant(tile: Pick<TileData, 'x' | 'y' | 'parcelSeed'>) {
  let hash = (Math.imul(tile.x, 374761393) ^ Math.imul(tile.y, 668265263) ^ (tile.parcelSeed ?? 0)) | 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) & 7;
}
export function buildingScale(tile: TileData): number {
  if (![TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL].includes(tile.type)) return 1;
  return (tile.zoneDensity === 'HIGH' ? 1.35 : tile.zoneDensity === 'MEDIUM' ? 1.15 : 1) * (0.94 + buildingVariant(tile) * 0.035);
}
export const roadVisual = (roadClass: RoadClass) => ({
  width: roadClass === 'HIGHWAY' ? 1 : roadClass === 'ARTERIAL' ? 0.995 : 0.985,
  color: roadClass === 'HIGHWAY' ? '#4c5962' : roadClass === 'ARTERIAL' ? '#647177' : '#717b7d',
});
export function focusFrame(target: [number, number, number], settlement: [number, number, number], context: boolean) {
  const span = context ? Math.hypot(target[0] - settlement[0], target[2] - settlement[2]) : 0;
  return { target: context ? target.map((v, i) => (v + settlement[i]) / 2) as [number, number, number] : target,
    distance: Math.min(90, Math.max(24, span * 1.7 + 12)) };
}
