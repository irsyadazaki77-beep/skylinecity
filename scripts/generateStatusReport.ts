import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runOfficialBenchmarkSuite } from '../src/benchmarkRunner';
import { runOfficialRenderBenchmark } from '../src/renderBenchmark';
import { runReleaseSmoke } from '../src/releaseSmoke';

function runCmd(cmd: string): { stdout: string; success: boolean } {
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout: stdout.trim(), success: true };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    return { stdout: (e.stdout || e.stderr || '').trim(), success: false };
  }
}

console.log('Generating automated STATUS.md report...');

// 1. Git metadata
const gitCommit = runCmd('git rev-parse --short HEAD').stdout || 'local-head';
const gitBranch = runCmd('git rev-parse --abbrev-ref HEAD').stdout || 'main';
const gitStatus = runCmd('git status --short').stdout;

// 2. Run Smoke
const smoke = runReleaseSmoke();

// 3. Run Simulation Benchmarks
const simBench = runOfficialBenchmarkSuite(20);

// 4. Run Render Benchmarks
const renderBench = runOfficialRenderBenchmark();

// 5. Generate STATUS.md content
let content = `# Skyline City — Autonomous Engineering & Performance Status\n\n`;
content += `> **Auto-generated**: ${new Date().toISOString()}  \n`;
content += `> **Commit**: \`${gitCommit}\` (${gitBranch})  \n`;
content += `> **Smoke Day/Hash**: Day ${smoke.day} · Hash \`${smoke.stateHash}\` · ${smoke.passed ? '✅ PASS' : '❌ FAIL'}\n\n`;

content += `## 1. Simulation Performance Gate (Target: Normal <= 50ms, 100K <= 120ms)\n\n`;
content += `| Scenario | Pop (Rep) | Entities | p50 | p95 | p99 | Budget | Status |\n`;
content += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

for (const rep of simBench.reports) {
  const status = !rep.budgetExceeded && !rep.regressionExceeded ? '✅ PASSED' : '❌ EXCEEDED';
  content += `| **${rep.scenario}** | ${rep.population.toLocaleString()} | ${rep.entities} | ${rep.tickMs.p50.toFixed(1)}ms | ${rep.tickMs.p95.toFixed(1)}ms | ${rep.tickMs.p99.toFixed(1)}ms | <= ${rep.budgetMs}ms | ${status} |\n`;
}

content += `\n**Gate Result**: ${simBench.performanceGate.passed ? '✅ ALL BUDGETS & REGRESSION GATES PASSED' : '❌ REGRESSION DETECTED'}\n\n`;

content += `## 2. Three.js Render Benchmark (Prioritas 5)\n\n`;
content += `| Scenario | Pop | Buildings | Triangles | Draw Calls | Peds | Vehs | Estimated FPS | p95 Frame |\n`;
content += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

for (const r of renderBench) {
  content += `| **${r.scenarioName}** | ${r.population.toLocaleString()} | ${r.visibleBuildings} | ${r.triangles.toLocaleString()} | ${r.drawCalls} | ${r.visiblePedestrians} | ${r.visibleVehicles} | ${r.estimatedFps60Hz} fps | ${r.p95FrameTimeMs}ms |\n`;
}

content += `\n## 3. Subsystem Audit Summary\n\n`;
content += `- **Pedestrian System**: Representative agent sampling from live trips; sidewalk offsets (±0.28); crosswalk state machine.\n`;
content += `- **Construction Lifecycle**: Deterministic stages (SITE_PREP → FOUNDATION → FRAME → STRUCTURE → FACADE → FINISHING → OCCUPIED).\n`;
content += `- **Building Renderer 3.0**: Fully modularized kits (Residential, Commercial, Office, Industrial, Service, Construction, Shared Materials).\n`;
content += `- **Traffic Motion**: Physics acceleration/deceleration, red light queueing, transit dwells (1.8s), freight delivery dwells (2.0s).\n`;
content += `- **Causal UX**: WHAT → WHY → WHERE → ACTION → TRADEOFF structure with camera focus action.\n`;
content += `- **Citizen Profile & Business Identity**: Deterministic seed identity, workplace, commute, revenue, expenses, and freight reliability.\n`;
content += `- **Tropical Aesthetic & Audio**: Adaptive music crossfade (CALM, GROWTH, BUSY_CITY, CRISIS, DISASTER, METROPOLIS), sirens, weather haze/fog.\n`;

const targetPath = path.resolve(process.cwd(), 'STATUS.md');
fs.writeFileSync(targetPath, content, 'utf8');
console.log(`STATUS.md written to ${targetPath}`);
