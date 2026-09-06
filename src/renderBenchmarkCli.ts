import { runOfficialRenderBenchmark } from './renderBenchmark';

console.log('========================================================================================');
console.log(' SKYLINE CITY — THREE.JS RENDER PERFORMANCE BENCHMARK (PRIORITAS 5)');
console.log('========================================================================================');

const results = runOfficialRenderBenchmark();

console.log(
  'Scenario'.padEnd(30) +
  'Pop'.padEnd(10) +
  'Bldgs'.padEnd(8) +
  'Tris'.padEnd(10) +
  'DrawCalls'.padEnd(12) +
  'Peds'.padEnd(8) +
  'Vehs'.padEnd(8) +
  'FPS'.padEnd(8) +
  'p95 Frame'
);
console.log('-'.repeat(100));

for (const res of results) {
  console.log(
    res.scenarioName.padEnd(30) +
    String(res.population).padEnd(10) +
    String(res.visibleBuildings).padEnd(8) +
    String(res.triangles.toLocaleString()).padEnd(10) +
    String(res.drawCalls).padEnd(12) +
    String(res.visiblePedestrians).padEnd(8) +
    String(res.visibleVehicles).padEnd(8) +
    `${res.estimatedFps60Hz} fps`.padEnd(8) +
    `${res.p95FrameTimeMs}ms`
  );
}

console.log('========================================================================================');
console.log('All render benchmarks completed with modularized kits & shared materials.');
