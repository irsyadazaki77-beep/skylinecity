import { CityState, GameSettings, SimulationCommand } from './types';
import { SimulationSchedulerTelemetry } from './simulationScheduler';
import { SimulationRenderRevisions } from './simulationContext';

export interface WorkerMessageIdentity {
  workerGeneration: number;
  requestId: number;
  stateRevision: number;
  tickId: number;
}

/** Main-thread guard: every identity must match the active simulation epoch. */
export function isCurrentWorkerMessage(
  message: Pick<WorkerMessageIdentity, 'workerGeneration' | 'requestId' | 'stateRevision' | 'tickId'>,
  expected: WorkerMessageIdentity,
): boolean {
  return message.workerGeneration === expected.workerGeneration
    && message.requestId === expected.requestId
    && message.stateRevision === expected.stateRevision
    && message.tickId === expected.tickId;
}

export function isCurrentWorkerTickResult(
  message: Pick<WorkerMessageIdentity, 'workerGeneration' | 'requestId' | 'stateRevision' | 'tickId'>,
  expected: WorkerMessageIdentity,
): boolean {
  return message.workerGeneration === expected.workerGeneration
    && message.requestId === expected.requestId
    && message.tickId === expected.tickId
    && message.stateRevision > expected.stateRevision;
}

export type WorkerInMessage =
  | (WorkerMessageIdentity & { type: 'INIT'; state: CityState; settings: GameSettings })
  | (WorkerMessageIdentity & { type: 'TICK'; requestedTicks: number; speed: number; settings: GameSettings })
  | (WorkerMessageIdentity & { type: 'RESET_STATE'; state: CityState })
  | (WorkerMessageIdentity & { type: 'ENQUEUE_COMMAND'; command: SimulationCommand });

export interface CityStateScalarDelta {
  day: number;
  timeOfDay: number;
  season?: CityState['season'];
  weather?: CityState['weather'];
  temperature?: number;
  precipitation?: number;
  money: number;
  population: number;
  happiness: number;
  desirability: number;
  residentialDemand: number;
  commercialDemand: number;
  officeDemand: number;
  industrialDemand: number;
  powerCapacity: number;
  powerDemand: number;
  waterCapacity: number;
  waterDemand: number;
  trafficAverage: number;
  averageCommuteTime: number;
  congestionIndex: number;
  averageQueuePressure?: number;
  landValueAverage?: number;
  suitabilityAverage?: number;
  pollutionAverage?: number;
  noiseAverage?: number;
  educationLevel?: number;
  healthIndex?: number;
  healthcareCoverage?: number;
  educationCoverage?: number;
  fireSafety?: number;
  crimeRate?: number;
  wasteCapacity?: number;
  wasteProduction?: number;
  wasteCoverage?: number;
  fireServiceCapacity?: number;
  policeServiceCapacity?: number;
  healthcareCapacity?: number;
  educationCapacity?: number;
  serviceResponseQuality?: number;
  income?: number;
  expenses?: number;
  lastTaxRevenue?: number;
  lastExpenses?: number;
  simulationPhase?: CityState['simulationPhase'];
  milestoneLevel?: number;
  unlockedAchievements?: string[];
  completedMissions?: string[];
  activeEvents?: string[];
  eventsData?: CityState['eventsData'];
  activeDisasters?: CityState['activeDisasters'];
  disasters?: CityState['disasters'];
  recoveryProjects?: CityState['recoveryProjects'];
  tradeContracts?: CityState['tradeContracts'];
  districts?: CityState['districts'];
  transitLines?: CityState['transitLines'];
  unlockedUpgrades?: string[];
  activePolicies?: string[];
  buildingLevelCounts?: CityState['buildingLevelCounts'];
  demographics?: CityState['demographics'];
  warehouseInventory?: CityState['warehouseInventory'];
  causalDiagnostics?: CityState['causalDiagnostics'];
  recentSimulationEvents?: CityState['recentSimulationEvents'];
  citizenState?: CityState['citizenState'];
  history?: CityState['history'];
  regions?: CityState['regions'];
  signalStates?: CityState['signalStates'];
  activeTrips?: CityState['activeTrips'];
  parkingDemand?: number;
  parkingSupply?: number;
  parkingCoverage?: number;
  parkingPressure?: number;
  parcelCount?: number;
  developedParcelCount?: number;
  privateParcelCount?: number;
  averageParcelSize?: number;
  freightDemand?: number;
  freightCapacity?: number;
  freightReliability?: number;
  commercialStock?: number;
  commodityDemand?: CityState['commodityDemand'];
  commoditySupply?: CityState['commoditySupply'];
  commodityStock?: CityState['commodityStock'];
}

export interface WorkerTickDelta {
  scalars: CityStateScalarDelta;
  dirtyTiles: any[];
  dirtyChunkKeys: string[];
  payloadSizeKb: number;
  queueLatencyMs: number;
}

export type WorkerOutMessage =
  | (WorkerMessageIdentity & { type: 'INIT_ACK' })
  | (WorkerMessageIdentity & { type: 'STATE_RESET_CONFIRMED'; state: CityState })
  | (WorkerMessageIdentity & {
      type: 'TICK_COMPLETED';
      nextState?: CityState;
      delta?: WorkerTickDelta;
      elapsedMs: number;
      phaseTimings: Record<string, number>;
      telemetry: SimulationSchedulerTelemetry;
      renderRevisions: SimulationRenderRevisions;
    })
  | (WorkerMessageIdentity & { type: 'COMMAND_QUEUED' })
  | (WorkerMessageIdentity & { type: 'WORKER_REJECTED'; reason: 'NOT_INITIALIZED' | 'STALE_STATE' });
