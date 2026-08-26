import { runOfficialBenchmarkSuite } from './benchmarkRunner';

const ticks = Math.max(1, Number(process.env.SKYLINE_BENCHMARK_TICKS ?? 10));
const report = runOfficialBenchmarkSuite(ticks);
for (const item of report.reports) {
  console.log(`${item.scenario}: p50 ${item.tickMs.p50.toFixed(1)}ms · p95 ${item.tickMs.p95.toFixed(1)}ms · p99 ${item.tickMs.p99.toFixed(1)}ms · ${item.population.toLocaleString()} represented pop · ${item.gridPopulation.toLocaleString()} grid pop · ${item.citizenAgents.toLocaleString()} agents ×${item.populationScale} · ${item.entities} entities · hash ${item.stateHash}`);
}
if (!report.passed) {
  console.error('Benchmark integrity gate failed: non-finite state or non-deterministic replay.');
  process.exitCode = 1;
}
