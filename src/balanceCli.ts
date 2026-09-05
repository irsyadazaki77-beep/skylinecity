import { runBalanceSuite } from './balanceScenarioRunner';

const ticks = Math.max(1, Number(process.env.SKYLINE_BALANCE_TICKS ?? 90));
const report = runBalanceSuite({
  SMALL_TOWN: ticks,
  CONGESTED_CORRIDOR: ticks,
  INDUSTRIAL_CITY: ticks,
  FLOOD_RECOVERY: ticks,
  PERFORMANCE_100K: Math.min(ticks, 10),
});

for (const item of report.reports) {
  const isStressBenchmark = item.scenario === 'PERFORMANCE_100K';
  const tag = isStressBenchmark
    ? ' [Stress benchmark: high-density load fixture without civic services; low happiness expected]'
    : '';
  console.log(`${item.scenario}${tag}: day ${item.samples.at(-1)?.day ?? 0} · pop ${item.finalPopulation.toLocaleString()} · min treasury $${item.minMoney.toLocaleString()} · debt $${item.maxDebt.toLocaleString()} · happiness ${item.minHappiness.toFixed(1)} · bankruptcy ${item.bankruptcyDays}d${item.warnings.length ? ` · WARN ${item.warnings.join(', ')}` : ''}`);
}
if (!report.passed) {
  console.error('Balance integrity gate failed.');
  process.exitCode = 1;
}
