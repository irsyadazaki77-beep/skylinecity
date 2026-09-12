import { runOfficialRenderBenchmark } from './renderBenchmark';

console.log('========================================================================================');
console.log(' SKYLINE CITY — THREE.JS RENDER INVENTORY (SYNTHETIC BUDGET ESTIMATE)');
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
  'Synth FPS'.padEnd(10) +
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
console.log('Geometry/draw-call inventory completed with modularized kits & shared materials.');
console.log('FPS and p95 are synthetic estimates; real-browser FPS is not claimed by this command.');
