import { CityState, RecoveryProject, TileType } from './types';

export interface RecoveryTickResult {
  projects: RecoveryProject[];
  completed: number;
  active: number;
  spending: number;
}

/** Advances multi-day recovery work without making disasters instantly disappear. */
export function simulateRecoveryProjects(state: CityState): RecoveryTickResult {
  let completed = 0;
  let active = 0;
  let spending = 0;
  const projects: RecoveryProject[] = [];

  for (const input of state.recoveryProjects ?? []) {
    const project = { ...input, tiles: input.tiles.map(([x, y]) => [x, y] as [number, number]) };
    if (!project.active || project.completedWork >= project.totalWork) {
      project.active = false;
      projects.push(project);
      continue;
    }

    const remainingBudget = Math.max(0, state.money - spending);
    const workRate = Math.max(1, Math.round(project.totalWork / Math.max(1, project.remainingDays)));
    const unitCost = project.totalCost / Math.max(1, project.totalWork);
    const affordableWork = unitCost > 0 ? Math.floor(remainingBudget / unitCost) : workRate;
    const work = Math.max(0, Math.min(workRate, affordableWork, project.totalWork - project.completedWork));
    const cost = Math.min(project.remainingCost, Math.round(work * unitCost));
    project.completedWork += work;
    project.remainingCost = Math.max(0, project.remainingCost - cost);
    project.remainingDays = Math.max(0, project.remainingDays - 1);
    spending += cost;

    for (const [x, y] of project.tiles) {
      const tile = state.grid[y]?.[x];
      if (!tile) continue;
      if (project.type === 'ROAD_REPAIR' && tile.type === TileType.ROAD) {
        tile.roadCondition = Math.min(100, (tile.roadCondition ?? 100) + Math.max(1, work / Math.max(1, project.tiles.length)));
        tile.disasterImpact = Math.max(0, (tile.disasterImpact ?? 0) - Math.max(0.5, work / Math.max(1, project.tiles.length) * 0.4));
      }
      if (project.type === 'FLOOD_CONTROL') tile.waterDepth = Math.max(0, (tile.waterDepth ?? 0) - work / Math.max(1, project.tiles.length * 20));
      if (project.type === 'REBUILD_DISTRICT' && tile.abandoned && tile.disasterImpact !== undefined) tile.disasterImpact = Math.max(0, tile.disasterImpact - work / Math.max(1, project.tiles.length));
    }

    if (project.completedWork >= project.totalWork || project.remainingDays <= 0 || project.remainingCost <= 0) {
      project.active = false;
      completed += 1;
    } else {
      active += 1;
    }
    projects.push(project);
  }

  return { projects, completed, active, spending };
}

export function createRecoveryProject(
  id: string,
  type: RecoveryProject['type'],
  title: string,
  tiles: [number, number][],
  totalCost: number,
  totalWork = Math.max(10, tiles.length * 10),
  remainingDays = 10,
): RecoveryProject {
  return {
    id,
    type,
    title,
    tiles,
    totalCost: Math.max(0, totalCost),
    remainingCost: Math.max(0, totalCost),
    totalWork: Math.max(1, totalWork),
    completedWork: 0,
    remainingDays: Math.max(1, remainingDays),
    active: true,
  };
}
