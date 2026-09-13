export interface PerformanceTelemetrySnapshot {
  frameTimeMs: number;
  frameTimeP50Ms: number;
  frameTimeP95Ms: number;
  frameTimeP99Ms: number;
  fps: number;
  simulationTickMs: number;
  workerMessageLatencyMs: number;
  reactCommitMs: number;
  threeFrameMs: number;
  gpuTimeMs?: number;
  gpuTimerAvailable: boolean;
  drawCalls: number;
  triangles: number;
  visibleObjects: number;
  visibleChunks?: number;
  geometries: number;
  textures: number;
  materials: number;
  mountedBuildings: number;
  mountedProps: number;
  activeVehicles: number;
  activePedestrians: number;
  lodNear: number;
  lodMid: number;
  lodFar: number;
  lodTransitions: number;
  reactCommitCount: number;
  jsHeapMb?: number;
  gcCount: number;
  soakElapsedMs: number;
  soakHeapStartMb?: number;
  soakHeapDeltaMb?: number;
}

type SampleKey = 'frame' | 'worker' | 'react' | 'three' | 'gpu';
const samples: Record<SampleKey, number[]> = { frame: [], worker: [], react: [], three: [], gpu: [] };
const listeners = new Set<() => void>();
const snapshot: PerformanceTelemetrySnapshot = {
  frameTimeMs: 0, frameTimeP50Ms: 0, frameTimeP95Ms: 0, frameTimeP99Ms: 0, fps: 0,
  simulationTickMs: 0, workerMessageLatencyMs: 0,
  reactCommitMs: 0, threeFrameMs: 0, gpuTimerAvailable: false, drawCalls: 0, triangles: 0,
  visibleObjects: 0, geometries: 0, textures: 0, materials: 0, mountedBuildings: 0,
  mountedProps: 0, activeVehicles: 0, activePedestrians: 0, lodNear: 0, lodMid: 0,
  lodFar: 0, lodTransitions: 0, reactCommitCount: 0, gcCount: 0, soakElapsedMs: 0,
};
const soakStartedAt = typeof performance !== 'undefined' ? performance.now() : 0;
let soakHeapStartMb: number | undefined;
let lastPublishedAt = -Infinity;

function push(key: SampleKey, value: number): void {
  if (!Number.isFinite(value) || value < 0) return;
  const list = samples[key];
  list.push(value);
  if (list.length > 240) list.shift();
}

function percentile(list: number[], ratio: number): number {
  if (list.length === 0) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function notify(): void {
  const now = performance.now();
  if (now - lastPublishedAt < 250) return;
  lastPublishedAt = now;
  if (typeof window !== 'undefined') (window as Window & { __SKYLINE_PERF__?: PerformanceTelemetrySnapshot }).__SKYLINE_PERF__ = { ...snapshot };
  listeners.forEach((listener) => listener());
}

function heapMb(): number | undefined {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory ? memory.usedJSHeapSize / 1024 / 1024 : undefined;
}

export function recordPerformanceSample(kind: SampleKey, value: number): void {
  push(kind, value);
  if (kind === 'frame') {
    snapshot.frameTimeMs = value;
    snapshot.frameTimeP50Ms = percentile(samples.frame, 0.5);
    snapshot.frameTimeP95Ms = percentile(samples.frame, 0.95);
    snapshot.frameTimeP99Ms = percentile(samples.frame, 0.99);
    snapshot.fps = snapshot.frameTimeP50Ms > 0 ? 1000 / snapshot.frameTimeP50Ms : 0;
  }
  if (kind === 'worker') snapshot.workerMessageLatencyMs = value;
  if (kind === 'react') snapshot.reactCommitMs = value;
  if (kind === 'three') snapshot.threeFrameMs = value;
  if (kind === 'gpu') snapshot.gpuTimeMs = value;
  notify();
}

export function recordSimulationTick(elapsedMs: number): void { snapshot.simulationTickMs = elapsedMs; notify(); }
export function recordWorkerMessageLatency(elapsedMs: number): void { recordPerformanceSample('worker', elapsedMs); }
export function recordReactCommit(elapsedMs: number): void {
  snapshot.reactCommitCount += 1;
  // A Profiler callback runs during React's commit. Notifying the overlay here
  // triggers another commit and an unbounded setState -> Profiler loop.
  // The next renderer/worker sample publishes this measurement safely.
  push('react', elapsedMs);
  snapshot.reactCommitMs = elapsedMs;
}
export function recordRenderFrame(metrics: {
  frameTimeMs: number; drawCalls: number; triangles: number; visibleObjects: number;
  visibleChunks?: number;
  geometries?: number; textures?: number; materials?: number; mountedBuildings?: number;
  mountedProps?: number; activeVehicles?: number; activePedestrians?: number;
  lodNear?: number; lodMid?: number; lodFar?: number;
  gpuTimeMs?: number; gpuTimerAvailable?: boolean;
}): void {
  push('frame', metrics.frameTimeMs);
  push('three', metrics.frameTimeMs);
  snapshot.frameTimeMs = metrics.frameTimeMs;
  snapshot.threeFrameMs = metrics.frameTimeMs;
  // Percentiles and React HUD publication are sampled, not sorted every frame.
  if (performance.now() - lastPublishedAt >= 250) {
    snapshot.frameTimeP50Ms = percentile(samples.frame, 0.5);
    snapshot.frameTimeP95Ms = percentile(samples.frame, 0.95);
    snapshot.frameTimeP99Ms = percentile(samples.frame, 0.99);
    snapshot.fps = snapshot.frameTimeP50Ms > 0 ? 1000 / snapshot.frameTimeP50Ms : 0;
  }
  snapshot.drawCalls = metrics.drawCalls;
  snapshot.triangles = metrics.triangles;
  snapshot.visibleObjects = metrics.visibleObjects;
  if (metrics.visibleChunks !== undefined) snapshot.visibleChunks = metrics.visibleChunks;
  if (metrics.geometries !== undefined) snapshot.geometries = metrics.geometries;
  if (metrics.textures !== undefined) snapshot.textures = metrics.textures;
  if (metrics.materials !== undefined) snapshot.materials = metrics.materials;
  if (metrics.mountedBuildings !== undefined) snapshot.mountedBuildings = metrics.mountedBuildings;
  if (metrics.mountedProps !== undefined) snapshot.mountedProps = metrics.mountedProps;
  if (metrics.activeVehicles !== undefined) snapshot.activeVehicles = metrics.activeVehicles;
  if (metrics.activePedestrians !== undefined) snapshot.activePedestrians = metrics.activePedestrians;
  if (metrics.lodNear !== undefined) snapshot.lodNear = metrics.lodNear;
  if (metrics.lodMid !== undefined) snapshot.lodMid = metrics.lodMid;
  if (metrics.lodFar !== undefined) snapshot.lodFar = metrics.lodFar;
  if (metrics.gpuTimerAvailable !== undefined) snapshot.gpuTimerAvailable = metrics.gpuTimerAvailable;
  if (metrics.gpuTimeMs !== undefined) recordPerformanceSample('gpu', metrics.gpuTimeMs);
  notify();
}
export function recordLodTransition(): void { snapshot.lodTransitions += 1; }
export function getPerformanceTelemetry(): PerformanceTelemetrySnapshot { return { ...snapshot }; }
export function subscribePerformanceTelemetry(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }

export function startPerformanceObservers(): () => void {
  const start = heapMb();
  if (start !== undefined && soakHeapStartMb === undefined) soakHeapStartMb = start;
  let observer: PerformanceObserver | undefined;
  if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('gc')) {
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'gc') snapshot.gcCount += 1;
        }
        notify();
      });
      observer.observe({ entryTypes: ['gc'] });
    } catch { /* GC entries are not exposed in every browser. */ }
  }
  const timer = window.setInterval(() => {
    const heap = heapMb();
    snapshot.jsHeapMb = heap;
    snapshot.soakElapsedMs = performance.now() - soakStartedAt;
    snapshot.soakHeapStartMb = soakHeapStartMb;
    snapshot.soakHeapDeltaMb = heap !== undefined && soakHeapStartMb !== undefined ? heap - soakHeapStartMb : undefined;
    notify();
  }, 1000);
  return () => { observer?.disconnect(); window.clearInterval(timer); };
}
