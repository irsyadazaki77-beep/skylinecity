import { useState, useRef, useEffect, useCallback } from 'react';
import { CityState, GameSettings } from '../types';
import { simulateTick, getLastSimulationPhaseTimings } from '../engine';
import {
  createSimulationSchedulerState,
  observeSimulationTick,
  SimulationSchedulerTelemetry,
} from '../simulationScheduler';

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

export function useSimulationControls({
  settings,
  setGameState,
  pendingSimulationCommit,
  gameState,
}: UseSimulationControlsOptions) {
  // Game starts paused by requirement B
  const [speed, setSpeed] = useState<0 | 1 | 2 | 3>(0);
  const [qualityTier, setQualityTier] = useState<'balanced' | 'reduced'>('balanced');
  const lastSimulationTickMs = useRef(0);
  const lastSimulationPhaseTimings = useRef<Record<string, number>>({});
  const simulationTickId = useRef(0);
  const simulationScheduler = useRef(createSimulationSchedulerState());

  const gameStateRef = useRef<CityState | null>(gameState ?? null);
  gameStateRef.current = gameState ?? gameStateRef.current;

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

  // Web Worker reference
  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  const isTickingRef = useRef(false);

  // Initialize Web Worker when supported
  useEffect(() => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;
    try {
      const worker = new Worker(new URL('../simulationWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<any>) => {
        const data = event.data;
        if (!data) return;

        if (data.type === 'STATE_RESET_CONFIRMED') {
          workerReadyRef.current = true;
        } else if (data.type === 'TICK_COMPLETED') {
          isTickingRef.current = false;
          const { nextState, elapsedMs, phaseTimings, telemetry } = data;
          lastSimulationTickMs.current = elapsedMs;
          lastSimulationPhaseTimings.current = phaseTimings;
          simulationTickId.current += 1;

          setSchedulerTelemetry((prev) => (
            prev.rollingP95Ms === telemetry.rollingP95Ms &&
            prev.qualityTier === telemetry.qualityTier &&
            prev.intervalMs === telemetry.intervalMs
              ? prev
              : telemetry
          ));
          handleQualityHint(telemetry.qualityTier);

          const previous = gameStateRef.current ?? nextState;
          pendingSimulationCommit.current = { previous, next: nextState };
          gameStateRef.current = nextState;

          // Pure React state updater: no side effects inside!
          setGameState(() => nextState);
        }
      };

      if (gameStateRef.current) {
        worker.postMessage({ type: 'INIT', state: gameStateRef.current, settings });
        workerReadyRef.current = true;
      }

      return () => {
        worker.terminate();
        workerRef.current = null;
        workerReadyRef.current = false;
      };
    } catch {
      workerRef.current = null;
      workerReadyRef.current = false;
    }
  }, []);

  // Sync external state changes (e.g. build commands, loads) to worker
  useEffect(() => {
    if (!workerRef.current || !workerReadyRef.current || !gameState) return;
    if (gameState !== gameStateRef.current) {
      gameStateRef.current = gameState;
      workerRef.current.postMessage({ type: 'RESET_STATE', state: gameState });
    }
  }, [gameState]);

  // Simulation tick loop
  useEffect(() => {
    if (speed === 0) return undefined;
    let timer = 0;
    let cancelled = false;

    const runTick = () => {
      if (cancelled) return;

      const worker = workerRef.current;
      const workerReady = workerReadyRef.current;

      if (worker && workerReady) {
        if (!isTickingRef.current) {
          isTickingRef.current = true;
          worker.postMessage({
            type: 'TICK',
            requestedTicks: schedulerTelemetry.ticksPerInterval,
            speed,
            settings,
          });
        }
        if (!cancelled) timer = window.setTimeout(runTick, schedulerTelemetry.intervalMs);
      } else {
        // Synchronous execution fallback (used when Worker is not available / in tests)
        // All side-effects are performed OUTSIDE of setGameState!
        const current = gameStateRef.current;
        if (current) {
          const simulationStartedAt = performance.now();
          let next = current;
          const requestedTicks = schedulerTelemetry.ticksPerInterval;
          for (let i = 0; i < requestedTicks; i += 1) next = simulateTick(next, settings);
          const elapsedMs = performance.now() - simulationStartedAt;
          lastSimulationTickMs.current = elapsedMs;
          lastSimulationPhaseTimings.current = getLastSimulationPhaseTimings();
          simulationTickId.current += 1;

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
          pendingSimulationCommit.current = { previous: current, next };
          gameStateRef.current = next;

          // Pure React updater
          setGameState(() => next);
        }
        if (!cancelled) timer = window.setTimeout(runTick, schedulerTelemetry.intervalMs);
      }
    };

    timer = window.setTimeout(runTick, schedulerTelemetry.intervalMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [handleQualityHint, pendingSimulationCommit, schedulerTelemetry.intervalMs, schedulerTelemetry.ticksPerInterval, setGameState, settings, speed]);

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
  };
}
