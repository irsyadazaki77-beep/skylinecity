import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const phase = process.argv[2];
if (!/^phase-[1-8]$/.test(phase ?? '')) throw new Error('Specify phase-1 through phase-8');
const results = [];
for (const command of ['npm run lint', 'npm test -- --run', 'npm run build']) {
  const result = spawnSync('cmd.exe', ['/d', '/s', '/c', command], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const name = command.includes('lint') ? 'lint' : command.includes('test') ? 'test' : 'build';
  writeFileSync(`visual-qa/${phase}-${name}.log`, `${result.stdout ?? ''}${result.stderr ?? ''}`);
  results.push({ command, exitCode: result.status, error: result.error?.message });
  writeFileSync(`visual-qa/${phase}-checks.json`, JSON.stringify(results, null, 2));
  console.log(`${phase}: ${command}: exit ${result.status}`);
  if (result.status !== 0) process.exit(1);
}
