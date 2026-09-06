import { useState, useRef, useEffect, useCallback } from 'react';
import { CityState, GameSettings } from '../types';
import { simulateTick, getLastSimulationPhaseTimings, getLastSimulationRenderRevisions } from '../engine';
import {
  createSimulationSchedulerState,
  observeSimulationTick,
  SimulationSchedulerTelemetry,
} from '../simulationScheduler';
import { createExternalRenderRevisions, SimulationRenderRevisions } from '../simulationContext';
import { isCurrentWorkerTickResult, WorkerInMessage, WorkerOutMessage } from '../simulationWorkerProtocol';

export interface SimulationCommit {
  previous: CityState;
  next: CityState;
}

interface UseSimulationControlsOptions {
  settings: GameSettings;
  setGameState: React.Dispatch<React.SetStateAction<CityState>>;
  pendingSimulationCommit: React.MutableRefObject<SimulationCommit | null>;
  gameState?: CityState;
}

interface WorkerRequestIdentity {
  workerGeneration: number;
  requestId: number;
  stateRevision: number;
  tickId: number;
}

const WORKER_HANDSHAKE_TIMEOUT_MS = 3_000;

export function useSimulationControls({
  settings,
  setGameState,
  pendingSimulationCommit,
  gameState,
}: UseSimulationControlsOptions) {
  const [speed, setSpeed] = useState<0 | 1 | 2 | 3>(0);
  const [qualityTier, setQualityTier] = useState<'balanced' | 'reduced'>('balanced');
  const lastSimulationTickMs = useRef(0);
  const lastSimulationPhaseTimings = useRef<Record<string, number>>({});
  const simulationTickId = useRef(0);
  const simulationScheduler = useRef(createSimulationSchedulerState());
  const gameStateRef = useRef<CityState | null>(gameState ?? null);
  const workerGenerationRef = useRef(0);
  const stateRevisionRef = useRef(0);
  const requestIdRef = useRef(0);
  const workerRequestRef = useRef<WorkerRequestIdentity | null>(null);

  const [renderRevisions, setRenderRevisions] = useState<SimulationRenderRevisions>(() => createExternalRenderRevisions(gameState?.grid));
  const [schedulerTelemetry, setSchedulerTelemetry] = useState<SimulationSchedulerTelemetry>({
    budgetMs: 50,
    latestTickMs: 0,
    rollingP95Ms: 0,
    intervalMs: 1000,
    ticksPerInterval: 1,
    qualityTier: 'balanced',
    overloaded: false,
  });

  const handleQualityHint = useCallback((tier: 'balanced' | 'reduced') => {
    setQualityTier((current) => (current === tier ? current : tier));
  }, []);

  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  const workerFailedRef = useRef(false);
  const isTickingRef = useRef(false);
  const handshakeTimerRef = useRef<number | null>(null);

  const nextIdentity = useCallback((tickId: number): WorkerRequestIdentity => ({
    workerGeneration: workerGenerationRef.current,
    requestId: ++requestIdRef.current,
    stateRevision: stateRevisionRef.current,
    tickId,
  }), []);

  const failWorker = useCallback((worker: Worker) => {
    if (workerRef.current !== worker) return;
    workerFailedRef.current = true;
    workerReadyRef.current = false;
    isTickingRef.current = false;
    workerRequestRef.current = null;
    workerGenerationRef.current += 1;
    if (handshakeTimerRef.current !== null) window.clearTimeout(handshakeTimerRef.current);
    handshakeTimerRef.current = null;
    worker.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined' || !gameStateRef.current) return undefined;

    const worker = new Worker(new URL('../simulationWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    workerFailedRef.current = false;
    workerReadyRef.current = false;
    workerGenerationRef.current += 1;
    stateRevisionRef.current = Math.max(1, stateRevisionRef.current);
    const initIdentity = nextIdentity(0);
    workerRequestRef.current = initIdentity;

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const data = event.data;
      if (!data || data.workerGeneration !== workerGenerationRef.current) return;

      if (data.type === 'INIT_ACK') {
        if (data.requestId !== initIdentity.requestId || data.stateRevision !== stateRevisionRef.current) return;
        workerReadyRef.current = true;
        workerRequestRef.current = null;
        if (handshakeTimerRef.current !== null) window.clearTimeout(handshakeTimerRef.current);
        handshakeTimerRef.current = null;
        return;
      }

      if (data.type === 'STATE_RESET_CONFIRMED') {
        const request = workerRequestRef.current;
        if (!request || request.requestId !== data.requestId || request.stateRevision !== data.stateRevision) return;
        workerReadyRef.current = true;
        isTickingRef.current = false;
        workerRequestRef.current = null;
        stateRevisionRef.current = data.stateRevision;
        gameStateRef.current = data.state;
        return;
      }

      if (data.type === 'WORKER_REJECTED') {
        failWorker(worker);
        return;
      }

      if (data.type !== 'TICK_COMPLETED') return;
      const request = workerRequestRef.current;
      if (!request || !isCurrentWorkerTickResult(data, request)) return;

      workerRequestRef.current = null;
      isTickingRef.current = false;
      stateRevisionRef.current = data.stateRevision;
      lastSimulationTickMs.current = data.elapsedMs;
      lastSimulationPhaseTimings.current = data.phaseTimings;
      simulationTickId.current = data.tickId;
      setRenderRevisions(data.renderRevisions);

      setSchedulerTelemetry((prev) => (
        prev.rollingP95Ms === data.telemetry.rollingP95Ms &&
        prev.qualityTier === data.telemetry.qualityTier &&
        prev.intervalMs === data.telemetry.intervalMs
          ? prev
          : data.telemetry
      ));
      handleQualityHint(data.telemetry.qualityTier);

      const previous = gameStateRef.current ?? data.nextState;
      pendingSimulationCommit.current = { previous, next: data.nextState };
      gameStateRef.current = data.nextState;
      setGameState(() => data.nextState);
    };
    worker.onerror = () => failWorker(worker);
    worker.onmessageerror = () => failWorker(worker);

    worker.postMessage({
      type: 'INIT',
      ...initIdentity,
      state: gameStateRef.current,
      settings,
    } satisfies WorkerInMessage);
    handshakeTimerRef.current = window.setTimeout(() => {
      if (!workerReadyRef.current) failWorker(worker);
    }, WORKER_HANDSHAKE_TIMEOUT_MS);

    return () => {
      if (handshakeTimerRef.current !== null) window.clearTimeout(handshakeTimerRef.current);
      handshakeTimerRef.current = null;
      workerGenerationRef.current += 1;
      workerRequestRef.current = null;
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      workerReadyRef.current = false;
      isTickingRef.current = false;
    };
  }, [failWorker, handleQualityHint, nextIdentity, pendingSimulationCommit, setGameState, settings]);

  // Every state change not produced by the worker is a new simulation epoch.
  // This covers builds, undo/redo, new city, load, and any explicit reset.
  useEffect(() => {
    if (!gameState || gameState === gameStateRef.current) return;

    gameStateRef.current = gameState;
    workerGenerationRef.current += 1;
    stateRevisionRef.current += 1;
    simulationTickId.current = 0;
    isTickingRef.current = false;
    pendingSimulationCommit.current = null;
    setRenderRevisions(createExternalRenderRevisions(gameState.grid));

    const worker = workerRef.current;
    if (!worker || workerFailedRef.current) return;

    workerReadyRef.current = false;
    const resetIdentity = nextIdentity(0);
    workerRequestRef.current = resetIdentity;
    worker.postMessage({
      type: 'RESET_STATE',
      ...resetIdentity,
      state: gameState,
    } satisfies WorkerInMessage);
  }, [gameState, nextIdentity, pendingSimulationCommit]);

  useEffect(() => {
    if (speed === 0) return undefined;
    let timer = 0;
    let cancelled = false;

    const runSynchronousTick = () => {
      const current = gameStateRef.current;
      if (!current) return;
      const simulationStartedAt = performance.now();
      let next = current;
      const requestedTicks = schedulerTelemetry.ticksPerInterval;
      for (let i = 0; i < requestedTicks; i += 1) next = simulateTick(next, settings);
      const elapsedMs = performance.now() - simulationStartedAt;
      lastSimulationTickMs.current = elapsedMs;
      lastSimulationPhaseTimings.current = getLastSimulationPhaseTimings();
      simulationTickId.current += requestedTicks;
      stateRevisionRef.current += requestedTicks;

      const scheduled = observeSimulationTick(simulationScheduler.current, elapsedMs, next.population, speed);
      simulationScheduler.current = scheduled.state;
      setSchedulerTelemetry((previous) => (
        previous.rollingP95Ms === scheduled.telemetry.rollingP95Ms &&
        previous.qualityTier === scheduled.telemetry.qualityTier &&
        previous.intervalMs === scheduled.telemetry.intervalMs
          ? previous
          : scheduled.telemetry
      ));
      handleQualityHint(scheduled.telemetry.qualityTier);
      setRenderRevisions(getLastSimulationRenderRevisions());
      pendingSimulationCommit.current = { previous: current, next };
      gameStateRef.current = next;
      setGameState(() => next);
    };

    const runTick = () => {
      if (cancelled) return;
      const worker = workerRef.current;

      if (worker && !workerFailedRef.current) {
        // A worker is not usable until INIT/RESET has been acknowledged. Wait
        // for that acknowledgement instead of running a competing timeline.
        if (workerReadyRef.current && !isTickingRef.current) {
          const tickId = simulationTickId.current + schedulerTelemetry.ticksPerInterval;
          const identity = nextIdentity(tickId);
          workerRequestRef.current = identity;
          isTickingRef.current = true;
          worker.postMessage({
            type: 'TICK',
            ...identity,
            requestedTicks: schedulerTelemetry.ticksPerInterval,
            speed,
            settings,
          } satisfies WorkerInMessage);
        }
      } else {
        runSynchronousTick();
      }

      if (!cancelled) timer = window.setTimeout(runTick, schedulerTelemetry.intervalMs);
    };

    timer = window.setTimeout(runTick, schedulerTelemetry.intervalMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [handleQualityHint, nextIdentity, pendingSimulationCommit, schedulerTelemetry.intervalMs, schedulerTelemetry.ticksPerInterval, setGameState, settings, speed]);

  return {
    speed,
    setSpeed,
    qualityTier,
    setQualityTier,
    handleQualityHint,
    schedulerTelemetry,
    setSchedulerTelemetry,
    lastSimulationTickMs,
    lastSimulationPhaseTimings,
    simulationTickId,
    renderRevisions,
  };
}
