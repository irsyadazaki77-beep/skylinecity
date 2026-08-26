export type SimulationQualityTier = 'balanced' | 'reduced';

export interface SimulationSchedulerTelemetry {
  budgetMs: number;
  latestTickMs: number;
  rollingP95Ms: number;
  intervalMs: number;
  ticksPerInterval: number;
  qualityTier: SimulationQualityTier;
  overloaded: boolean;
}

export interface SimulationSchedulerState {
  samples: number[];
  qualityTier: SimulationQualityTier;
  recoverySamples: number;
}

const SAMPLE_WINDOW = 30;

export function getSimulationBudgetMs(population: number): number {
  return population >= 100_000 ? 120 : 50;
}

export function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].filter(Number.isFinite).sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index];
}

export function createSimulationSchedulerState(): SimulationSchedulerState {
  return { samples: [], qualityTier: 'balanced', recoverySamples: 0 };
}

/**
 * Keeps scheduling data outside CityState. A slow tick reduces visual quality
 * and simulation cadence before it ever changes the deterministic tick logic.
 */
export function observeSimulationTick(
  previous: SimulationSchedulerState,
  tickMs: number,
  population: number,
  requestedSpeed: number,
): { state: SimulationSchedulerState; telemetry: SimulationSchedulerTelemetry } {
  const samples = [...previous.samples, Math.max(0, tickMs)].slice(-SAMPLE_WINDOW);
  const budgetMs = getSimulationBudgetMs(population);
  const rollingP95Ms = percentile(samples, 0.95);
  const overloaded = rollingP95Ms > budgetMs;
  const recovered = rollingP95Ms <= budgetMs * 0.7;
  const recoverySamples = overloaded ? 0 : recovered ? previous.recoverySamples + 1 : 0;
  const qualityTier: SimulationQualityTier = overloaded
    ? 'reduced'
    : previous.qualityTier === 'reduced' && recoverySamples < 5
      ? 'reduced'
      : 'balanced';
  const ticksPerInterval = overloaded ? Math.min(1, Math.max(1, requestedSpeed)) : Math.max(1, requestedSpeed);
  const intervalMs = overloaded
    ? Math.min(2_000, Math.max(1_000, Math.ceil(rollingP95Ms * 3)))
    : 1_000;

  return {
    state: { samples, qualityTier, recoverySamples },
    telemetry: {
      budgetMs,
      latestTickMs: tickMs,
      rollingP95Ms,
      intervalMs,
      ticksPerInterval,
      qualityTier,
      overloaded,
    },
  };
}
