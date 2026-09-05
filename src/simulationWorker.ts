import { simulateTick, getLastSimulationPhaseTimings } from './engine';
import { createSimulationSchedulerState, observeSimulationTick, SimulationSchedulerTelemetry } from './simulationScheduler';
import { CityState, GameSettings, SimulationCommand } from './types';
import { queueSimulationCommand } from './simulationCommands';

export type WorkerInMessage =
  | { type: 'INIT'; state: CityState; settings: GameSettings }
  | { type: 'TICK'; requestedTicks: number; speed: number; settings: GameSettings }
  | { type: 'RESET_STATE'; state: CityState }
  | { type: 'ENQUEUE_COMMAND'; command: SimulationCommand };

export type WorkerOutMessage =
  | {
      type: 'TICK_COMPLETED';
      nextState: CityState;
      elapsedMs: number;
      phaseTimings: Record<string, number>;
      telemetry: SimulationSchedulerTelemetry;
    }
  | { type: 'STATE_RESET_CONFIRMED'; state: CityState }
  | { type: 'COMMAND_QUEUED' };

let authoritativeState: CityState | null = null;
let simulationScheduler = createSimulationSchedulerState();

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const message = event.data;
  if (!message || !message.type) return;

  switch (message.type) {
    case 'INIT': {
      authoritativeState = message.state;
      simulationScheduler = createSimulationSchedulerState();
      break;
    }
    case 'RESET_STATE': {
      authoritativeState = message.state;
      const response: WorkerOutMessage = {
        type: 'STATE_RESET_CONFIRMED',
        state: authoritativeState,
      };
      self.postMessage(response);
      break;
    }
    case 'ENQUEUE_COMMAND': {
      if (authoritativeState) {
        authoritativeState = queueSimulationCommand(authoritativeState, message.command);
      }
      self.postMessage({ type: 'COMMAND_QUEUED' } as WorkerOutMessage);
      break;
    }
    case 'TICK': {
      if (!authoritativeState) return;
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

      const response: WorkerOutMessage = {
        type: 'TICK_COMPLETED',
        nextState: next,
        elapsedMs,
        phaseTimings,
        telemetry: scheduled.telemetry,
      };
      self.postMessage(response);
      break;
    }
  }
};
