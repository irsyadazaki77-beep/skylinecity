import { runOfficialBenchmarkSuite } from './benchmarkRunner';

const ticks = Math.max(1, Number(process.env.SKYLINE_BENCHMARK_TICKS ?? 10));
const report = runOfficialBenchmarkSuite(ticks);
for (const item of report.reports) {
  const budgetStatus = item.budgetExceeded ? `OVER budget ${item.budgetMs}ms` : `within budget ${item.budgetMs}ms`;
  console.log(`${item.scenario}: p50 ${item.tickMs.p50.toFixed(1)}ms · p95 ${item.tickMs.p95.toFixed(1)}ms · p99 ${item.tickMs.p99.toFixed(1)}ms · ${budgetStatus} · ${item.population.toLocaleString()} represented pop · ${item.gridPopulation.toLocaleString()} grid pop · ${item.citizenAgents.toLocaleString()} agents ×${item.populationScale} · ${item.entities} entities · hash ${item.stateHash}`);
}
if (!report.passed) {
  console.error('Benchmark integrity gate failed: non-finite state or non-deterministic replay.');
  process.exitCode = 1;
} else if (report.reports.some((item) => item.budgetExceeded)) {
  console.warn('Benchmark performance advisory: one or more scenarios exceeded the target tick budget; scheduler fallback remains enabled.');
}
