import {
  BUILD_COSTS,
  CityState,
  RecoveryProject,
  RoadClass,
  SimulationCommand,
  TileType,
  TransitLine,
  ROAD_BUILD_COSTS,
  createTile,
} from './types';

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createSimulationCommand<TPayload extends Record<string, unknown>>(
  type: SimulationCommand<TPayload>['type'],
  issuedDay: number,
  payload: TPayload,
  source: SimulationCommand<TPayload>['source'] = 'PLAYER',
): SimulationCommand<TPayload> {
  const fingerprint = stableHash(stableSerialize({ type, issuedDay, source, payload }));
  return {
    id: `command-${issuedDay}-${type.toLowerCase()}-${fingerprint}`,
    type,
    issuedDay,
    source,
    payload,
  };
}

export function queueSimulationCommand<TPayload extends Record<string, unknown>>(
  state: CityState,
  command: SimulationCommand<TPayload>,
): CityState {
  return {
    ...state,
    commandQueue: [...(state.commandQueue ?? []), command as SimulationCommand],
  };
}

function isInsideGrid(state: CityState, x: unknown, y: unknown): x is number {
  return Number.isInteger(x) && Number.isInteger(y)
    && (x as number) >= 0 && (y as number) >= 0
    && (y as number) < state.grid.length
    && (x as number) < (state.grid[0]?.length ?? 0);
}

function applyBuildRoad(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { x?: number; y?: number; roadClass?: RoadClass; roadStructure?: 'GROUND' | 'BRIDGE' | 'TUNNEL'; cost?: number };
  if (!isInsideGrid(state, payload.x, payload.y)) return;
  const tile = state.grid[payload.y as number][payload.x as number];
  const roadClass = payload.roadClass ?? 'LOCAL';
  const roadStructure = payload.roadStructure ?? 'GROUND';
  const cost = Math.max(0, payload.cost ?? ROAD_BUILD_COSTS[roadClass]);
  if (tile.type === TileType.ROAD && tile.roadClass === roadClass && (tile.roadStructure ?? 'GROUND') === roadStructure) return;
  const canUpgrade = tile.type === TileType.ROAD && tile.roadClass !== undefined;
  const validWaterStructure = !tile.water || roadStructure === 'BRIDGE';
  if ((!canUpgrade && tile.type !== TileType.EMPTY) || !validWaterStructure || state.money < cost) return;
  tile.type = TileType.ROAD;
  tile.roadClass = roadClass;
  tile.roadCondition = 100;
  tile.roadStructure = roadStructure;
  state.money -= cost;
}

function applyBuildTile(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { x?: number; y?: number; type?: TileType; cost?: number; zoneDensity?: 'LOW' | 'MEDIUM' | 'HIGH' };
  if (!isInsideGrid(state, payload.x, payload.y) || !payload.type || payload.type === TileType.EMPTY || payload.type === TileType.ROAD) return;
  const tile = state.grid[payload.y as number][payload.x as number];
  const cost = Math.max(0, payload.cost ?? BUILD_COSTS[payload.type]);
  if (tile.type !== TileType.EMPTY || tile.water || state.money < cost) return;
  tile.type = payload.type;
  tile.zoneDensity = payload.zoneDensity;
  tile.level = 1;
  tile.population = 0;
  tile.jobs = 0;
  tile.abandoned = false;
  tile.upgradeProgress = 0;
  state.money -= cost;
}

function applyZoneLand(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { x?: number; y?: number; type?: TileType; zoneDensity?: 'LOW' | 'MEDIUM' | 'HIGH'; cost?: number };
  if (!isInsideGrid(state, payload.x, payload.y)) return;
  const zoneType = payload.type;
  if (!zoneType || ![TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.INDUSTRIAL].includes(zoneType)) return;
  const tile = state.grid[payload.y as number][payload.x as number];
  const cost = Math.max(0, payload.cost ?? BUILD_COSTS[zoneType]);
  if (tile.type !== TileType.EMPTY || state.money < cost) return;
  tile.type = zoneType;
  tile.level = 1;
  tile.zoneDensity = payload.zoneDensity;
  tile.abandoned = false;
  tile.parcelStatus = 'ZONED';
  state.money -= cost;
}

function applyDemolish(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { x?: number; y?: number; refund?: number };
  if (!isInsideGrid(state, payload.x, payload.y)) return;
  const tile = state.grid[payload.y as number][payload.x as number];
  if (tile.type === TileType.EMPTY || tile.water) return;
  state.grid[payload.y as number][payload.x as number] = createTile(
    payload.x as number,
    payload.y as number,
    { elevation: tile.elevation, resource: tile.resource },
  );
  state.money += Math.max(0, payload.refund ?? 0);
}

function applyTerraform(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { changes?: Array<{ x: number; y: number; elevation: number }>; cost?: number };
  if (!Array.isArray(payload.changes) || payload.changes.length === 0) return;
  const validChanges = payload.changes.filter((change) => isInsideGrid(state, change.x, change.y) && Number.isFinite(change.elevation));
  const cost = Math.max(0, payload.cost ?? 0);
  const pendingChanges = validChanges.filter((change) => state.grid[change.y][change.x].elevation !== change.elevation);
  if (pendingChanges.length === 0 || state.money < cost) return;
  for (const change of pendingChanges) state.grid[change.y][change.x].elevation = change.elevation;
  state.money -= Math.min(cost, Math.max(0, Math.round(cost * pendingChanges.length / validChanges.length)));
}

function applyRoadRepair(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { x?: number; y?: number; roadCondition?: number; cost?: number };
  if (!isInsideGrid(state, payload.x, payload.y)) return;
  const tile = state.grid[payload.y as number][payload.x as number];
  const cost = Math.max(0, payload.cost ?? 0);
  const targetCondition = Math.max(0, Math.min(100, payload.roadCondition ?? 100));
  if (tile.type !== TileType.ROAD || tile.roadCondition === targetCondition || state.money < cost) return;
  tile.roadCondition = targetCondition;
  state.money -= cost;
}

function applyServiceUpgrade(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { x?: number; y?: number; upgradeId?: string; cost?: number };
  if (!isInsideGrid(state, payload.x, payload.y) || !payload.upgradeId) return;
  const tile = state.grid[payload.y as number][payload.x as number];
  const cost = Math.max(0, payload.cost ?? 0);
  if (state.money < cost || tile.serviceUpgrades?.includes(payload.upgradeId)) return;
  tile.serviceUpgrades = [...(tile.serviceUpgrades ?? []), payload.upgradeId];
  state.money -= cost;
}

function applyServiceMaintenance(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { order?: CityState['serviceMaintenanceOrders'] extends Array<infer T> ? T : never; cost?: number };
  const order = payload.order;
  if (!order) return;
  const key = `${order.facility.x},${order.facility.y}`;
  if ((state.serviceMaintenanceOrders ?? []).some((candidate) => `${candidate.facility.x},${candidate.facility.y}` === key)) return;
  const cost = Math.max(0, payload.cost ?? order.cost ?? 0);
  if (state.money < cost) return;
  state.money -= cost;
  state.serviceMaintenanceOrders = [...(state.serviceMaintenanceOrders ?? []), { ...order, cost }];
}

function applySignal(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as {
    x?: number;
    y?: number;
    intersectionControl?: 'AUTO' | 'SIGNAL' | 'STOP' | 'ROUNDABOUT';
    signalTimingMode?: 'ADAPTIVE' | 'FIXED_NS' | 'FIXED_EW';
    signalOffsetHours?: number;
  };
  if (!isInsideGrid(state, payload.x, payload.y)) return;
  const tile = state.grid[payload.y as number][payload.x as number];
  if (tile.type !== TileType.ROAD) return;
  if (payload.intersectionControl) tile.intersectionControl = payload.intersectionControl;
  if (payload.signalTimingMode) tile.signalTimingMode = payload.signalTimingMode;
  if (typeof payload.signalOffsetHours === 'number') tile.signalOffsetHours = Math.max(0, Math.min(5, payload.signalOffsetHours));
}

function applyTransitLine(state: CityState, command: SimulationCommand): void {
  const line = (command.payload as { line?: TransitLine }).line;
  if (!line || !line.id || line.stops.length < 2) return;
  if ((state.transitLines ?? []).some((candidate) => candidate.id === line.id)) return;
  state.transitLines = [...(state.transitLines ?? []), {
    ...line,
    stops: line.stops.map(([x, y]) => [x, y] as [number, number]),
  }];
}

function applyTransitLineMutation(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { lineId?: string; active?: boolean; patch?: Partial<TransitLine> };
  if (!payload.lineId) return;
  const lines = state.transitLines ?? [];
  if (command.type === 'REMOVE_TRANSIT_LINE') {
    state.transitLines = lines.filter((line) => line.id !== payload.lineId);
    return;
  }
  state.transitLines = lines.map((line) => line.id !== payload.lineId
    ? line
    : {
      ...line,
      ...(command.type === 'TOGGLE_TRANSIT_LINE' ? { active: payload.active ?? !line.active } : {}),
      ...(command.type === 'UPDATE_TRANSIT_LINE' ? (payload.patch ?? {}) : {}),
    });
}

function applyRecoveryProject(state: CityState, command: SimulationCommand): void {
  const project = (command.payload as { project?: RecoveryProject }).project;
  if (!project || !project.id || project.tiles.length === 0) return;
  if ((state.recoveryProjects ?? []).some((candidate) => candidate.id === project.id)) return;
  state.recoveryProjects = [...(state.recoveryProjects ?? []), { ...project, active: true }];
}

function applyPolicy(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { policyId?: string; enabled?: boolean };
  if (!payload.policyId) return;
  const policies = new Set(state.activePolicies ?? []);
  if (payload.enabled === false) policies.delete(payload.policyId);
  else policies.add(payload.policyId);
  state.activePolicies = [...policies];
}

function applyTax(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { type?: 'residential' | 'commercial' | 'industrial'; value?: number };
  if (!payload.type || typeof payload.value !== 'number' || !Number.isFinite(payload.value)) return;
  const key = `${payload.type}TaxRate` as 'residentialTaxRate' | 'commercialTaxRate' | 'industrialTaxRate';
  state[key] = Math.max(1, Math.min(20, payload.value));
}

function applyDistrictMutation(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { districtId?: string; district?: CityState['districts'] extends Array<infer T> ? T : never };
  if (command.type === 'REMOVE_DISTRICT') {
    if (!payload.districtId) return;
    state.districts = (state.districts ?? []).filter((district) => district.id !== payload.districtId);
    return;
  }
  if (!payload.district || (state.districts ?? []).some((district) => district.id === payload.district!.id)) return;
  state.districts = [...(state.districts ?? []), payload.district];
}

function applyRegionUnlock(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { rx?: number; ry?: number; cost?: number };
  if (!Number.isInteger(payload.rx) || !Number.isInteger(payload.ry)) return;
  const key = `${payload.rx},${payload.ry}`;
  if ((state.unlockedRegions ?? []).includes(key)) return;
  const cost = Math.max(0, payload.cost ?? 0);
  if (state.money < cost) return;
  state.money -= cost;
  state.unlockedRegions = [...(state.unlockedRegions ?? []), key];
  state.activeRegionKeys = Array.from(new Set([...(state.activeRegionKeys ?? []), key]));
}

function applyTechUnlock(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { id?: string; cost?: number };
  if (!payload.id || state.unlockedUpgrades.includes(payload.id)) return;
  const cost = Math.max(0, payload.cost ?? 0);
  if (state.money < cost) return;
  state.money -= cost;
  state.unlockedUpgrades = [...state.unlockedUpgrades, payload.id];
}

function applyMissionAndScenario(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { missionId?: string; reward?: number; scenarioId?: string };
  if (command.type === 'CLAIM_MISSION') {
    if (!payload.missionId || (state.completedMissions ?? []).includes(payload.missionId)) return;
    state.completedMissions = [...(state.completedMissions ?? []), payload.missionId];
    state.money += Math.max(0, payload.reward ?? 0);
    return;
  }
  if (payload.scenarioId) {
    state.activeScenarioId = payload.scenarioId;
    state.scenarioCompleted = false;
    state.scenarioObjectiveValues = {};
  }
}

function applyTradeContract(state: CityState, command: SimulationCommand): void {
  const payload = command.payload as { contract?: CityState['tradeContracts'] extends Array<infer T> ? T : never; fee?: number };
  const contract = payload.contract;
  if (!contract || (state.tradeContracts ?? []).some((candidate) => candidate.id === contract.id)) return;
  const fee = Math.max(0, payload.fee ?? 0);
  if (state.money < fee) return;
  state.money -= fee;
  state.tradeContracts = [...(state.tradeContracts ?? []), contract];
}

/** Applies queued player/system commands at the beginning of a deterministic tick. */
export function applySimulationCommands(state: CityState, commands: SimulationCommand[] = []): SimulationCommand[] {
  const applied: SimulationCommand[] = [];
  for (const command of commands) {
    switch (command.type) {
      case 'BUILD_ROAD': applyBuildRoad(state, command); break;
      case 'BUILD_TILE': applyBuildTile(state, command); break;
      case 'ZONE_LAND': applyZoneLand(state, command); break;
      case 'DEMOLISH_TILE': applyDemolish(state, command); break;
      case 'TERRAFORM': applyTerraform(state, command); break;
      case 'REPAIR_ROAD': applyRoadRepair(state, command); break;
      case 'UPGRADE_SERVICE': applyServiceUpgrade(state, command); break;
      case 'ORDER_SERVICE_MAINTENANCE': applyServiceMaintenance(state, command); break;
      case 'SET_SIGNAL': applySignal(state, command); break;
      case 'CREATE_TRANSIT_LINE': applyTransitLine(state, command); break;
      case 'REMOVE_TRANSIT_LINE':
      case 'TOGGLE_TRANSIT_LINE':
      case 'UPDATE_TRANSIT_LINE': applyTransitLineMutation(state, command); break;
      case 'START_RECOVERY_PROJECT': applyRecoveryProject(state, command); break;
      case 'SET_POLICY': applyPolicy(state, command); break;
      case 'SET_TAX': applyTax(state, command); break;
      case 'CREATE_DISTRICT':
      case 'REMOVE_DISTRICT': applyDistrictMutation(state, command); break;
      case 'UNLOCK_REGION': applyRegionUnlock(state, command); break;
      case 'UNLOCK_TECH': applyTechUnlock(state, command); break;
      case 'CLAIM_MISSION':
      case 'START_SCENARIO': applyMissionAndScenario(state, command); break;
      case 'CREATE_TRADE_CONTRACT': applyTradeContract(state, command); break;
      default: break;
    }
    applied.push(command);
  }
  return applied;
}
