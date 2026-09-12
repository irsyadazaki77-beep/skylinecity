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

export type BuildingSilhouette = 'L_SHAPE' | 'U_SHAPE' | 'STEPPED' | 'CORNER' | 'ROW' | 'COURTYARD';
export type BuildingArchetype =
  | 'DETACHED_HOUSE' | 'TOWNHOUSE_ROW' | 'VILLA' | 'COURTYARD_APARTMENT' | 'APARTMENT_BLOCK'
  | 'CORNER_SHOP' | 'RETAIL_STRIP' | 'MIXED_USE_BLOCK'
  | 'OFFICE_MIDRISE' | 'GLASS_TOWER' | 'CIVIC_TOWER'
  | 'WAREHOUSE' | 'FACTORY' | 'INDUSTRIAL_CAMPUS';
export interface BuildingVisualSpec {
  archetype: BuildingArchetype;
  silhouette: BuildingSilhouette;
  floors: number;
  width: number;
  depth: number;
  height: number;
  podiumHeight: number;
  accentIndex: number;
  windowPattern: number;
  roofProp: 'HVAC' | 'SOLAR' | 'TANK' | 'ANTENNA';
  imperfection: number;
  balconyCount: number;
  hasCanopy: boolean;
  hasFireEscape: boolean;
  hasCrown: boolean;
}

/** Pure render metadata: stable across React renders and save/load, and never
 * mutates the simulation tile. Every LOD consumes the same specification. */
export function buildingVisualSpec(tile: TileData): BuildingVisualSpec {
  const variant = buildingVariant(tile);
  const level = Math.max(1, Math.min(5, tile.level ?? 1));
  const density = tile.zoneDensity === 'HIGH' ? 2 : tile.zoneDensity === 'MEDIUM' ? 1 : 0;
  let seed = (Math.imul(tile.x + 17, 1597334677) ^ Math.imul(tile.y + 31, 3812015801) ^ (tile.parcelSeed ?? 0)) >>> 0;
  const random = () => {
    seed = (Math.imul(seed ^ (seed >>> 15), 2246822519) + 3266489917) >>> 0;
    return seed / 4294967296;
  };
  const silhouettes: BuildingSilhouette[] = tile.type === TileType.RESIDENTIAL && level < 3
    ? ['ROW', 'L_SHAPE', 'CORNER', 'COURTYARD']
    : tile.type === TileType.INDUSTRIAL
      ? ['L_SHAPE', 'COURTYARD', 'U_SHAPE', 'STEPPED']
      : ['STEPPED', 'L_SHAPE', 'U_SHAPE', 'CORNER', 'COURTYARD'];
  const floors = Math.max(1, Math.round(1 + level * (0.8 + density * 0.55) + random() * (level + density)));
  const heightPerFloor = tile.type === TileType.INDUSTRIAL ? 0.17 : 0.205;
  const residentialArchetypes: BuildingArchetype[] = level <= 1
    ? ['DETACHED_HOUSE', 'VILLA']
    : level === 2 ? ['VILLA', 'TOWNHOUSE_ROW']
      : level === 3 ? ['TOWNHOUSE_ROW', 'COURTYARD_APARTMENT', 'APARTMENT_BLOCK']
        : ['APARTMENT_BLOCK', 'COURTYARD_APARTMENT', 'CIVIC_TOWER'];
  const commercialArchetypes: BuildingArchetype[] = level <= 2
    ? ['CORNER_SHOP', 'RETAIL_STRIP']
    : level === 3 ? ['RETAIL_STRIP', 'MIXED_USE_BLOCK'] : ['MIXED_USE_BLOCK', 'GLASS_TOWER'];
  const officeArchetypes: BuildingArchetype[] = level <= 2
    ? ['OFFICE_MIDRISE'] : level === 3 ? ['OFFICE_MIDRISE', 'MIXED_USE_BLOCK'] : ['GLASS_TOWER', 'CIVIC_TOWER'];
  const industrialArchetypes: BuildingArchetype[] = level <= 2
    ? ['WAREHOUSE', 'FACTORY'] : ['FACTORY', 'INDUSTRIAL_CAMPUS'];
  const archetypes = tile.type === TileType.RESIDENTIAL ? residentialArchetypes
    : tile.type === TileType.COMMERCIAL ? commercialArchetypes
      : tile.type === TileType.OFFICE ? officeArchetypes
        : tile.type === TileType.INDUSTRIAL ? industrialArchetypes : ['CIVIC_TOWER'] as BuildingArchetype[];
  const archetype = archetypes[(variant + Math.floor(random() * archetypes.length)) % archetypes.length];
  return {
    archetype,
    silhouette: silhouettes[(variant + Math.floor(random() * silhouettes.length)) % silhouettes.length],
    floors,
    width: 0.62 + random() * 0.24,
    depth: 0.58 + random() * 0.27,
    height: Math.max(0.42, floors * heightPerFloor),
    podiumHeight: level >= 3 || tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE ? 0.26 + random() * 0.12 : 0.1,
    accentIndex: (variant + Math.floor(random() * 5)) % 5,
    windowPattern: Math.floor(random() * 4),
    roofProp: (['HVAC', 'SOLAR', 'TANK', 'ANTENNA'] as const)[Math.floor(random() * 4)],
    imperfection: random() * 0.06 - 0.03,
    balconyCount: tile.type === TileType.RESIDENTIAL || archetype === 'MIXED_USE_BLOCK' ? Math.max(0, Math.min(4, level - 1 + (variant & 1))) : 0,
    hasCanopy: tile.type === TileType.COMMERCIAL || tile.type === TileType.OFFICE || level >= 4,
    hasFireEscape: (archetype === 'APARTMENT_BLOCK' || archetype === 'COURTYARD_APARTMENT') && (variant & 1) === 1,
    hasCrown: level >= 5 || archetype === 'CIVIC_TOWER',
  };
}
export const roadVisual = (roadClass: RoadClass) => ({
  width: roadClass === 'HIGHWAY' ? 1 : roadClass === 'ARTERIAL' ? 0.99 : 0.92,
  color: roadClass === 'HIGHWAY' ? '#30353a' : roadClass === 'ARTERIAL' ? '#454b4d' : '#5b5d59',
});
export function focusFrame(target: [number, number, number], settlement: [number, number, number], context: boolean) {
  const span = context ? Math.hypot(target[0] - settlement[0], target[2] - settlement[2]) : 0;
  return { target: context ? target.map((v, i) => (v + settlement[i]) / 2) as [number, number, number] : target,
    distance: Math.min(90, Math.max(24, span * 1.7 + 12)) };
}
