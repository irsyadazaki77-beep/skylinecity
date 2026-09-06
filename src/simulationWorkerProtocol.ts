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

export type WorkerOutMessage =
  | (WorkerMessageIdentity & { type: 'INIT_ACK' })
  | (WorkerMessageIdentity & { type: 'STATE_RESET_CONFIRMED'; state: CityState })
  | (WorkerMessageIdentity & {
      type: 'TICK_COMPLETED';
      nextState: CityState;
      elapsedMs: number;
      phaseTimings: Record<string, number>;
      telemetry: SimulationSchedulerTelemetry;
      renderRevisions: SimulationRenderRevisions;
    })
  | (WorkerMessageIdentity & { type: 'COMMAND_QUEUED' })
  | (WorkerMessageIdentity & { type: 'WORKER_REJECTED'; reason: 'NOT_INITIALIZED' | 'STALE_STATE' });
