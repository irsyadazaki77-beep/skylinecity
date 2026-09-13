import {
  simulateTick,
  getLastSimulationPhaseTimings,
  getLastSimulationRenderRevisions,
  getLastSimulationChangedTileKeys,
  getLastSimulationDirtyChunkKeys,
} from './engine';
import { createSimulationSchedulerState, observeSimulationTick } from './simulationScheduler';
import { queueSimulationCommand } from './simulationCommands';
import { CityState, TileData } from './types';
import { WorkerInMessage, WorkerOutMessage, CityStateScalarDelta } from './simulationWorkerProtocol';

let authoritativeState: CityState | null = null;
let authoritativeGeneration = -1;
let authoritativeRevision = -1;
let authoritativeTickId = -1;
let simulationScheduler = createSimulationSchedulerState();

function post(message: WorkerOutMessage): void {
  self.postMessage(message);
}

function reject(message: WorkerInMessage, reason: 'NOT_INITIALIZED' | 'STALE_STATE'): void {
  post({
    type: 'WORKER_REJECTED',
    workerGeneration: message.workerGeneration,
    requestId: message.requestId,
    stateRevision: authoritativeRevision,
    tickId: authoritativeTickId,
    reason,
  });
}

function acceptsCurrentState(message: WorkerInMessage): boolean {
  return authoritativeState !== null
    && message.workerGeneration === authoritativeGeneration
    && message.stateRevision === authoritativeRevision;
}

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const message = event.data;
  if (!message || !message.type) return;

  switch (message.type) {
    case 'INIT': {
      authoritativeState = message.state;
      authoritativeGeneration = message.workerGeneration;
      authoritativeRevision = message.stateRevision;
      authoritativeTickId = message.tickId;
      simulationScheduler = createSimulationSchedulerState();
      post({
        type: 'INIT_ACK',
        workerGeneration: authoritativeGeneration,
        requestId: message.requestId,
        stateRevision: authoritativeRevision,
        tickId: authoritativeTickId,
      });
      break;
    }
    case 'RESET_STATE': {
      authoritativeState = message.state;
      authoritativeGeneration = message.workerGeneration;
      authoritativeRevision = message.stateRevision;
      authoritativeTickId = message.tickId;
      simulationScheduler = createSimulationSchedulerState();
      post({
        type: 'STATE_RESET_CONFIRMED',
        workerGeneration: authoritativeGeneration,
        requestId: message.requestId,
        stateRevision: authoritativeRevision,
        tickId: authoritativeTickId,
        state: authoritativeState,
      });
      break;
    }
    case 'ENQUEUE_COMMAND': {
      if (!authoritativeState) {
        reject(message, 'NOT_INITIALIZED');
        break;
      }
      if (!acceptsCurrentState(message)) {
        reject(message, 'STALE_STATE');
        break;
      }
      authoritativeState = queueSimulationCommand(authoritativeState, message.command);
      post({
        type: 'COMMAND_QUEUED',
        workerGeneration: authoritativeGeneration,
        requestId: message.requestId,
        stateRevision: authoritativeRevision,
        tickId: authoritativeTickId,
      });
      break;
    }
    case 'TICK': {
      if (!authoritativeState) {
        reject(message, 'NOT_INITIALIZED');
        return;
      }
      if (!acceptsCurrentState(message)) {
        reject(message, 'STALE_STATE');
        return;
      }
      const startedAt = performance.now();
      let next = authoritativeState;
      const requestedTicks = Math.max(1, message.requestedTicks);
      for (let i = 0; i < requestedTicks; i += 1) {
        next = simulateTick(next, message.settings);
      }
      const elapsedMs = performance.now() - startedAt;
      const phaseTimings = getLastSimulationPhaseTimings();
      const scheduled = observeSimulationTick(
        simulationScheduler,
        elapsedMs,
        next.population,
        message.speed as 0 | 1 | 2 | 3,
      );
      simulationScheduler = scheduled.state;
      authoritativeState = next;
      authoritativeRevision += requestedTicks;
      authoritativeTickId = message.tickId;

      const changedKeys = getLastSimulationChangedTileKeys();
      const dirtyTiles: TileData[] = [];
      for (const key of changedKeys) {
        const comma = key.indexOf(',');
        if (comma !== -1) {
          const x = Number(key.slice(0, comma));
          const y = Number(key.slice(comma + 1));
          const t = next.grid[y]?.[x];
          if (t) dirtyTiles.push(t);
        }
      }
      const dirtyChunkKeys = [...getLastSimulationDirtyChunkKeys()];

      const scalarDelta: CityStateScalarDelta = {
        day: next.day,
        timeOfDay: next.timeOfDay,
        season: next.season,
        weather: next.weather,
        temperature: next.temperature,
        precipitation: next.precipitation,
        money: next.money,
        population: next.population,
        happiness: next.happiness,
        desirability: next.desirability,
        residentialDemand: next.residentialDemand,
        commercialDemand: next.commercialDemand,
        officeDemand: next.officeDemand,
        industrialDemand: next.industrialDemand,
        powerCapacity: next.powerCapacity,
        powerDemand: next.powerDemand,
        waterCapacity: next.waterCapacity,
        waterDemand: next.waterDemand,
        trafficAverage: next.trafficAverage,
        averageCommuteTime: next.averageCommuteTime,
        congestionIndex: next.congestionIndex,
        averageQueuePressure: next.averageQueuePressure,
        landValueAverage: next.landValueAverage,
        suitabilityAverage: next.suitabilityAverage,
        pollutionAverage: next.pollutionAverage,
        noiseAverage: next.noiseAverage,
        educationLevel: next.educationLevel,
        healthIndex: next.healthIndex,
        healthcareCoverage: next.healthcareCoverage,
        educationCoverage: next.educationCoverage,
        fireSafety: next.fireSafety,
        crimeRate: next.crimeRate,
        wasteCapacity: next.wasteCapacity,
        wasteProduction: next.wasteProduction,
        wasteCoverage: next.wasteCoverage,
        fireServiceCapacity: next.fireServiceCapacity,
        policeServiceCapacity: next.policeServiceCapacity,
        healthcareCapacity: next.healthcareCapacity,
        educationCapacity: next.educationCapacity,
        serviceResponseQuality: next.serviceResponseQuality,
        income: next.income,
        expenses: next.expenses,
        simulationPhase: next.simulationPhase,
        milestoneLevel: next.milestoneLevel,
        unlockedAchievements: next.unlockedAchievements,
        completedMissions: next.completedMissions,
        activeEvents: next.activeEvents,
        eventsData: next.eventsData,
        activeDisasters: next.activeDisasters,
        disasters: next.disasters,
        recoveryProjects: next.recoveryProjects,
        tradeContracts: next.tradeContracts,
        districts: next.districts,
        transitLines: next.transitLines,
        unlockedUpgrades: next.unlockedUpgrades,
        activePolicies: next.activePolicies,
        buildingLevelCounts: next.buildingLevelCounts,
        demographics: next.demographics,
        warehouseInventory: next.warehouseInventory,
        causalDiagnostics: next.causalDiagnostics,
        recentSimulationEvents: next.recentSimulationEvents,
        citizenState: next.citizenState,
        history: next.history,
        regions: next.regions,
        signalStates: next.signalStates,
        activeTrips: next.activeTrips,
        parkingDemand: next.parkingDemand,
        parkingSupply: next.parkingSupply,
        parkingCoverage: next.parkingCoverage,
        parkingPressure: next.parkingPressure,
        parcelCount: next.parcelCount,
        developedParcelCount: next.developedParcelCount,
        privateParcelCount: next.privateParcelCount,
        averageParcelSize: next.averageParcelSize,
        freightDemand: next.freightDemand,
        freightCapacity: next.freightCapacity,
        freightReliability: next.freightReliability,
        commercialStock: next.commercialStock,
        commodityDemand: next.commodityDemand,
        commoditySupply: next.commoditySupply,
        commodityStock: next.commodityStock,
      };

      const approxBytes = dirtyTiles.length * 150 + 2048;
      const payloadSizeKb = Math.round((approxBytes / 1024) * 10) / 10;

      post({
        type: 'TICK_COMPLETED',
        workerGeneration: authoritativeGeneration,
        requestId: message.requestId,
        stateRevision: authoritativeRevision,
        tickId: authoritativeTickId,
        nextState: next,
        delta: {
          scalars: scalarDelta,
          dirtyTiles,
          dirtyChunkKeys,
          payloadSizeKb,
          queueLatencyMs: Math.round(elapsedMs * 10) / 10,
        },
        elapsedMs,
        phaseTimings,
        telemetry: scheduled.telemetry,
        renderRevisions: getLastSimulationRenderRevisions(),
      });
      break;
    }
  }
};
