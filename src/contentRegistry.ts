import { CityEventData, ModManifest, ScenarioDefinition, TileType } from './types';
import { POLICIES, TECH_NODES, MISSIONS } from './progression';
import { PRODUCTION_RECIPES } from './logistics';

export interface BuildingDefinition {
  id: string;
  tileType: TileType;
  displayName: string;
  category: 'ZONE' | 'SERVICE' | 'UTILITY' | 'TRANSIT' | 'LOGISTICS' | 'ENVIRONMENT';
  maxLevel: number;
  tags: string[];
}

export interface ContentRegistry {
  buildings: Map<string, BuildingDefinition>;
  policies: typeof POLICIES;
  technologies: typeof TECH_NODES;
  recipes: typeof PRODUCTION_RECIPES;
  events: CityEventData[];
  missions: typeof MISSIONS;
  scenarios: ScenarioDefinition[];
  mods: ModManifest[];
}

export interface ModContentPack {
  manifest: ModManifest;
  buildings?: BuildingDefinition[];
  scenarios?: ScenarioDefinition[];
}

const buildingDefinitions: BuildingDefinition[] = [
  { id: 'residential', tileType: TileType.RESIDENTIAL, displayName: 'Residential', category: 'ZONE', maxLevel: 5, tags: ['housing'] },
  { id: 'commercial', tileType: TileType.COMMERCIAL, displayName: 'Commercial', category: 'ZONE', maxLevel: 5, tags: ['retail', 'jobs'] },
  { id: 'office', tileType: TileType.OFFICE, displayName: 'Office', category: 'ZONE', maxLevel: 5, tags: ['office', 'knowledge', 'jobs'] },
  { id: 'industrial', tileType: TileType.INDUSTRIAL, displayName: 'Industrial', category: 'ZONE', maxLevel: 5, tags: ['production', 'jobs'] },
  { id: 'power_plant', tileType: TileType.POWER_PLANT, displayName: 'Power Plant', category: 'UTILITY', maxLevel: 1, tags: ['power'] },
  { id: 'water_pump', tileType: TileType.WATER_PUMP, displayName: 'Water Pump', category: 'UTILITY', maxLevel: 1, tags: ['water'] },
  { id: 'bus_depot', tileType: TileType.BUS_DEPOT, displayName: 'Bus Depot', category: 'TRANSIT', maxLevel: 3, tags: ['transit'] },
  { id: 'tram_station', tileType: TileType.TRAM_STATION, displayName: 'Tram Station', category: 'TRANSIT', maxLevel: 3, tags: ['transit'] },
  { id: 'bus_stop', tileType: TileType.BUS_STOP, displayName: 'Bus Stop', category: 'TRANSIT', maxLevel: 1, tags: ['transit', 'stop'] },
  { id: 'tram_stop', tileType: TileType.TRAM_STOP, displayName: 'Tram Stop', category: 'TRANSIT', maxLevel: 1, tags: ['transit', 'stop'] },
  { id: 'warehouse', tileType: TileType.WAREHOUSE, displayName: 'Warehouse', category: 'LOGISTICS', maxLevel: 5, tags: ['freight', 'storage'] },
  { id: 'cargo_terminal', tileType: TileType.CARGO_TERMINAL, displayName: 'Cargo Terminal', category: 'LOGISTICS', maxLevel: 5, tags: ['freight', 'gateway'] },
];

export const SCENARIO_DEFINITIONS: ScenarioDefinition[] = [
  { id: 'flood-resilience', name: 'Flood Resilience', description: 'Protect a growing river city while maintaining a balanced budget.', seed: 2088, tags: ['flood', 'recovery'], targetDays: 180, objectives: [{ id: 'population', label: 'Reach 250 residents', target: 250 }, { id: 'flood-control', label: 'Build flood control capacity', target: 3 }] },
  { id: 'industrial-transition', name: 'Industrial Transition', description: 'Move from a resource economy to clean production without collapsing employment.', seed: 4096, tags: ['industry', 'green'], targetDays: 240, objectives: [{ id: 'efficiency', label: 'Maintain 85% production efficiency', target: 85 }, { id: 'pollution', label: 'Keep pollution below 25', target: 25 }] },
  { id: 'transit-metropolis', name: 'Transit Metropolis', description: 'Create a regional transit network that keeps commute pressure under control.', seed: 8192, tags: ['transit', 'traffic'], targetDays: 300, objectives: [{ id: 'ridership', label: 'Reach 65% transit coverage', target: 65 }, { id: 'congestion', label: 'Keep congestion below 35', target: 35 }] },
];

export function createContentRegistry(): ContentRegistry {
  return {
    buildings: new Map(buildingDefinitions.map((definition) => [definition.id, definition])),
    policies: [...POLICIES],
    technologies: [...TECH_NODES],
    recipes: { ...PRODUCTION_RECIPES },
    events: [],
    missions: [...MISSIONS],
    scenarios: SCENARIO_DEFINITIONS.map((scenario) => ({ ...scenario, objectives: scenario.objectives.map((objective) => ({ ...objective })) })),
    mods: [],
  };
}

export function validateModManifest(manifest: unknown): { valid: boolean; errors: string[]; manifest?: ModManifest } {
  const value = manifest as Partial<ModManifest> | null;
  const errors: string[] = [];
  if (!value || typeof value !== 'object') errors.push('Manifest harus berupa object.');
  if (!value?.id || !/^[a-z0-9][a-z0-9._-]*$/.test(value.id)) errors.push('id harus lowercase dan hanya berisi a-z, 0-9, titik, underscore, atau strip.');
  if (!value?.name || typeof value.name !== 'string') errors.push('name wajib diisi.');
  if (!value?.version || typeof value.version !== 'string') errors.push('version wajib diisi.');
  if (!value?.gameVersion || typeof value.gameVersion !== 'string') errors.push('gameVersion wajib diisi.');
  if (!value?.namespace || !/^[a-z0-9][a-z0-9._-]*$/.test(value.namespace)) errors.push('namespace tidak valid.');
  if (!Array.isArray(value?.content)) errors.push('content harus berupa array.');
  if (value?.dependencies && (!Array.isArray(value.dependencies) || value.dependencies.some((item) => typeof item !== 'string'))) errors.push('dependencies harus berupa array string.');
  return errors.length > 0 ? { valid: false, errors } : { valid: true, errors, manifest: value as ModManifest };
}

export function registerMod(registry: ContentRegistry, manifest: unknown): { registry: ContentRegistry; errors: string[] } {
  const validation = validateModManifest(manifest);
  if (!validation.valid || !validation.manifest) return { registry, errors: validation.errors };
  if (registry.mods.some((mod) => mod.id === validation.manifest!.id)) return { registry, errors: [`Mod '${validation.manifest.id}' sudah terdaftar.`] };
  return { registry: { ...registry, mods: [...registry.mods, validation.manifest] }, errors: [] };
}

/** Registers JSON content only; arbitrary functions/scripts are intentionally rejected. */
export function registerModContentPack(registry: ContentRegistry, pack: unknown): { registry: ContentRegistry; errors: string[] } {
  const value = pack as Partial<ModContentPack> | null;
  const registered = registerMod(registry, value?.manifest);
  if (registered.errors.length > 0 || !registered.registry.mods.length) return registered;
  const errors: string[] = [];
  const buildings = value?.buildings ?? [];
  const scenarios = value?.scenarios ?? [];
  if (!Array.isArray(buildings) || buildings.some((building) => !building || typeof building.id !== 'string' || typeof building.displayName !== 'string')) errors.push('buildings harus berupa definisi data yang valid.');
  if (!Array.isArray(scenarios) || scenarios.some((scenario) => !scenario || typeof scenario.id !== 'string' || !Array.isArray(scenario.objectives))) errors.push('scenarios harus berupa definisi data yang valid.');
  const manifest = registered.registry.mods[registered.registry.mods.length - 1];
  const namespace = `${manifest.namespace}.`;
  if (buildings.some((building) => !building.id.startsWith(namespace))) errors.push(`Semua building ID harus memakai namespace '${namespace}'.`);
  if (scenarios.some((scenario) => !scenario.id.startsWith(namespace))) errors.push(`Semua scenario ID harus memakai namespace '${namespace}'.`);
  if (errors.length > 0) return { registry, errors };
  const nextBuildings = new Map(registered.registry.buildings);
  for (const building of buildings) nextBuildings.set(building.id, building);
  return {
    registry: {
      ...registered.registry,
      buildings: nextBuildings,
      scenarios: [...registered.registry.scenarios, ...scenarios],
    },
    errors: [],
  };
}

export function loadModContentJson(registry: ContentRegistry, json: string): { registry: ContentRegistry; errors: string[] } {
  try {
    return registerModContentPack(registry, JSON.parse(json));
  } catch {
    return { registry, errors: ['Mod JSON tidak dapat diparse.'] };
  }
}
