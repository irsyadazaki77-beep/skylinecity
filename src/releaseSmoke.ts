import { createEmptyGrid, createInitialCityState, simulateTick } from './engine';
import { createSimulationCommand, queueSimulationCommand } from './simulationCommands';
import { createSaveEnvelope, importSavePreview } from './saveSystem';
import { getStateHash } from './releaseReadiness';
import { TileType } from './types';

export interface ReleaseSmokeResult {
  passed: boolean;
  checks: Record<string, boolean>;
  stateHash: string;
  day: number;
  population: number;
}

/** Fast, dependency-free release smoke for the authoritative gameplay loop. */
export function runReleaseSmoke(seed = 2088): ReleaseSmokeResult {
  const initial = createInitialCityState(createEmptyGrid(), seed);
  const queued = queueSimulationCommand(initial, createSimulationCommand('BUILD_ROAD', initial.day, { x: 3, y: 3, roadClass: 'LOCAL' }));
  const afterBuild = simulateTick(queued);
  const envelope = JSON.stringify(createSaveEnvelope(afterBuild));
  const preview = importSavePreview(envelope);
  const replay = simulateTick(queued);
  const checks = {
    roadCommandApplied: afterBuild.grid[3][3].type === TileType.ROAD,
    commandQueueDrained: (afterBuild.commandQueue ?? []).length === 0,
    dayAdvanced: afterBuild.day === initial.day + 1,
    stateFinite: Number.isFinite(afterBuild.money) && Number.isFinite(afterBuild.population),
    saveRoundTripValid: preview.valid && Boolean(preview.state),
    deterministicReplay: getStateHash(afterBuild) === getStateHash(replay),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    stateHash: getStateHash(afterBuild),
    day: afterBuild.day,
    population: afterBuild.population,
  };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/releaseSmoke.ts')) {
  const result = runReleaseSmoke();
  console.log(`release smoke: ${result.passed ? 'PASS' : 'FAIL'} · day ${result.day} · pop ${result.population} · hash ${result.stateHash}`);
  for (const [name, passed] of Object.entries(result.checks)) console.log(`  ${passed ? '✓' : '✗'} ${name}`);
  if (!result.passed) process.exitCode = 1;
}
