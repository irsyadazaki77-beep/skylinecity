import { CityState, ScenarioDefinition } from './types';

export interface ScenarioProgress {
  id: string;
  completed: boolean;
  objectiveValues: Record<string, number>;
}

export function evaluateScenario(state: CityState, scenario: ScenarioDefinition): ScenarioProgress {
  const objectiveValues: Record<string, number> = {
    population: state.population,
    'flood-control': state.floodBarrierCount ?? 0,
    efficiency: Math.round((state.productionEfficiency ?? 0) * 100),
    pollution: state.pollutionAverage ?? 0,
    ridership: state.transitCoverage ?? 0,
    congestion: state.congestionIndex ?? 0,
  };
  const completed = scenario.objectives.every((objective) => {
    const value = objectiveValues[objective.id] ?? 0;
    return objective.id === 'pollution' || objective.id === 'congestion' ? value <= objective.target : value >= objective.target;
  });
  return { id: scenario.id, completed, objectiveValues };
}
