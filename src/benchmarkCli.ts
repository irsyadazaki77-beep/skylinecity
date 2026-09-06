import { runOfficialBenchmarkSuite } from './benchmarkRunner';

// Twenty measured ticks keeps p95 from degenerating into the single maximum
// sample on shared runners. The workload is unchanged; only the sample
// confidence is higher. Set SKYLINE_BENCHMARK_TICKS for a longer local run.
const ticks = Math.max(1, Number(process.env.SKYLINE_BENCHMARK_TICKS ?? 20));
const report = runOfficialBenchmarkSuite(ticks);
for (const item of report.reports) {
  const budgetStatus = item.budgetExceeded ? `OVER budget ${item.budgetMs}ms` : `within budget ${item.budgetMs}ms`;
  const regressionStatus = item.regressionExceeded ? 'REGRESSION' : 'baseline-stable';
  console.log(`${item.scenario}: p50 ${item.tickMs.p50.toFixed(1)}ms · p95 ${item.tickMs.p95.toFixed(1)}ms · p99 ${item.tickMs.p99.toFixed(1)}ms · ${budgetStatus} · ${regressionStatus} · ${item.population.toLocaleString()} represented pop · ${item.gridPopulation.toLocaleString()} grid pop · ${item.citizenAgents.toLocaleString()} agents ×${item.populationScale} · ${item.entities} entities · hash ${item.stateHash}`);
}
if (!report.integrityGate.passed) {
  console.error(`Benchmark integrity gate failed: ${report.integrityGate.failures.join('; ')}.`);
  process.exitCode = 1;
}
if (!report.performanceGate.passed) {
  console.error(`Benchmark performance gate failed: ${report.performanceGate.failures.join('; ')}.`);
  process.exitCode = 1;
} else {
  console.log('Benchmark performance gate passed: every official scenario is within budget and regression tolerance.');
}
