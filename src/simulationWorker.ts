import { simulateTick, getLastSimulationPhaseTimings, getLastSimulationRenderRevisions } from './engine';
import { createSimulationSchedulerState, observeSimulationTick } from './simulationScheduler';
import { queueSimulationCommand } from './simulationCommands';
import { CityState } from './types';
import { WorkerInMessage, WorkerOutMessage } from './simulationWorkerProtocol';

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

      post({
        type: 'TICK_COMPLETED',
        workerGeneration: authoritativeGeneration,
        requestId: message.requestId,
        stateRevision: authoritativeRevision,
        tickId: authoritativeTickId,
        nextState: next,
        elapsedMs,
        phaseTimings,
        telemetry: scheduled.telemetry,
        renderRevisions: getLastSimulationRenderRevisions(),
      });
      break;
    }
  }
};
