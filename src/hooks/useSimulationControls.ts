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
}

export function useSimulationControls({
  settings,
  setGameState,
  pendingSimulationCommit,
}: UseSimulationControlsOptions) {
  // Game starts paused by requirement B
  const [speed, setSpeed] = useState<0 | 1 | 2 | 3>(0);
  const [qualityTier, setQualityTier] = useState<'balanced' | 'reduced'>('balanced');
  const lastSimulationTickMs = useRef(0);
  const lastSimulationPhaseTimings = useRef<Record<string, number>>({});
  const simulationTickId = useRef(0);
  const simulationScheduler = useRef(createSimulationSchedulerState());

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

  // Scheduler state stays outside CityState/save files. Under load it slows the
  // wall-clock cadence and requests reduced rendering before changing any
  // deterministic simulation rule.
  useEffect(() => {
    if (speed === 0) return undefined;
    let timer = 0;
    let cancelled = false;

    const runTick = () => {
      setGameState((current) => {
        const simulationStartedAt = performance.now();
        let next = current;
        const requestedTicks = schedulerTelemetry.ticksPerInterval;
        for (let i = 0; i < requestedTicks; i += 1) next = simulateTick(next, settings);
        const elapsedMs = performance.now() - simulationStartedAt;
        lastSimulationTickMs.current = elapsedMs;
        lastSimulationPhaseTimings.current = getLastSimulationPhaseTimings();
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
        return next;
      });
      if (!cancelled) timer = window.setTimeout(runTick, schedulerTelemetry.intervalMs);
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
