import React, { useEffect, useRef, useState } from 'react';
import { Activity, Gauge, MemoryStick } from 'lucide-react';
import { CityState } from '../../types';
import { recordPerformanceSnapshot } from '../../releaseReadiness';
import { SimulationSchedulerTelemetry } from '../../simulationScheduler';

interface PerformanceOverlayProps {
  state: CityState;
  speed: number;
  simulationTickMs?: number;
  simulationTickId?: number;
  simulationPhaseTimings?: Record<string, number>;
  adaptiveQuality?: boolean;
  onQualityHint?: (tier: 'balanced' | 'reduced') => void;
  schedulerTelemetry?: SimulationSchedulerTelemetry;
  enabled?: boolean;
}

interface PerformanceView {
  fps: number;
  frameTime: number;
  simulationMs: number;
  simulationP95Ms: number;
  phaseP95: Record<string, number>;
  memoryMb?: number;
}

export function PerformanceOverlay({ state, speed, simulationTickMs = 0, simulationTickId = 0, simulationPhaseTimings = {}, adaptiveQuality = true, onQualityHint, schedulerTelemetry, enabled = false }: PerformanceOverlayProps) {
  const [view, setView] = useState<PerformanceView>({ fps: 0, frameTime: 0, simulationMs: 0, simulationP95Ms: 0, phaseP95: {} });
  const frameTimes = useRef<number[]>([]);
  const simulationTimes = useRef<number[]>([]);
  const phaseTimes = useRef<Record<string, number[]>>({});
  const lastFrame = useRef<number | null>(null);
  const lastSample = useRef(0);
  const lastRecordedTickId = useRef(simulationTickId);
  const stateRef = useRef(state);
  stateRef.current = state;
  const simulationTickMsRef = useRef(simulationTickMs);
  simulationTickMsRef.current = simulationTickMs;

  // Record simulation samples from the React tick boundary instead of waiting
  // for an animation frame to notice the ref change. This keeps phase timing
  // visible even when a heavy tick temporarily starves requestAnimationFrame.
  useEffect(() => {
    if (simulationTickId === lastRecordedTickId.current || simulationTickMs <= 0) return;
    simulationTimes.current.push(simulationTickMs);
    for (const [phase, duration] of Object.entries(simulationPhaseTimings)) {
      if (!Number.isFinite(duration)) continue;
      (phaseTimes.current[phase] ??= []).push(duration);
    }
    lastRecordedTickId.current = simulationTickId;
  }, [simulationPhaseTimings, simulationTickId, simulationTickMs]);

  useEffect(() => {
    let frameId = 0;
    const sample = (now: number) => {
      if (lastFrame.current !== null) frameTimes.current.push(Math.min(100, now - lastFrame.current));
      lastFrame.current = now;
      if (now - lastSample.current >= 1000) {
        const values = frameTimes.current.splice(0);
        const simulationValues = simulationTimes.current.splice(0);
        const average = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
        const sorted = [...values].sort((a, b) => a - b);
        const p95 = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
        const simulationSorted = [...simulationValues].sort((a, b) => a - b);
        const simulationP95 = simulationSorted.length > 0
          ? simulationSorted[Math.min(simulationSorted.length - 1, Math.floor(simulationSorted.length * 0.95))]
          : simulationTickMsRef.current;
        const phaseP95 = Object.fromEntries(Object.entries(phaseTimes.current).map(([phase, values]) => {
          const sortedPhase = [...values].sort((a, b) => a - b);
          const p95Phase = sortedPhase.length > 0
            ? sortedPhase[Math.min(sortedPhase.length - 1, Math.floor(sortedPhase.length * 0.95))]
            : 0;
          return [phase, p95Phase];
        }));
        phaseTimes.current = {};
        const memory = 'memory' in performance
          ? (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize
          : undefined;
        const next = {
          fps: average > 0 ? 1000 / average : 0,
          frameTime: p95,
          simulationMs: simulationTickMsRef.current,
          simulationP95Ms: simulationP95,
          phaseP95,
          memoryMb: memory ? memory / 1024 / 1024 : undefined,
        };
        setView(next);
        if (adaptiveQuality && onQualityHint) {
          if (next.fps > 0 && next.fps < 48) onQualityHint('reduced');
          else if (next.fps >= 58) onQualityHint('balanced');
        }
        recordPerformanceSnapshot({
          fps: next.fps,
          frameTimeMs: average,
          frameTimeP95Ms: p95,
          simulationTickMs: next.simulationMs,
          entityCount: (stateRef.current.activeTrips?.length ?? 0) + (stateRef.current.activeFreightTrips?.length ?? 0) + (stateRef.current.serviceVehicles?.length ?? 0),
          activeRegionCount: stateRef.current.activeRegionKeys?.length ?? stateRef.current.unlockedRegions?.length ?? 0,
          memoryUsedMb: next.memoryMb,
        });
        lastSample.current = now;
      }
      frameId = requestAnimationFrame(sample);
    };
    frameId = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frameId);
  }, [adaptiveQuality, onQualityHint]);

  if (!enabled) return null;

  const phaseDisplay = Object.keys(view.phaseP95).length > 0 ? view.phaseP95 : simulationPhaseTimings;
  const hottestPhases = Object.entries(phaseDisplay)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 3)
    .map(([phase, duration]) => `${phase} ${duration.toFixed(1)}ms`)
    .join(' · ');

  return (
    <div className="performance-overlay" aria-label="Performance diagnostics">
      <div><Gauge size={13} /> {view.fps.toFixed(0)} FPS</div>
      <div><Activity size={13} /> p95 {view.frameTime.toFixed(1)} ms</div>
      <div>Sim {view.simulationMs.toFixed(1)} ms · p95 {view.simulationP95Ms.toFixed(1)} ms</div>
      {schedulerTelemetry && <div className={schedulerTelemetry.overloaded ? 'text-amber-300' : 'text-slate-400'}>
        Tick budget {schedulerTelemetry.budgetMs} ms · scheduler p95 {schedulerTelemetry.rollingP95Ms.toFixed(1)} ms · {schedulerTelemetry.qualityTier}
      </div>}
      {hottestPhases && <div className="text-[9px] text-slate-400">{hottestPhases}</div>}
      <div>{state.population.toLocaleString()} pop · {state.activeRegionKeys?.length ?? 0} regions</div>
      {view.memoryMb !== undefined && <div><MemoryStick size={13} /> {view.memoryMb.toFixed(0)} MB</div>}
      {speed === 0 && <div className="text-amber-300">PAUSED</div>}
    </div>
  );
}
