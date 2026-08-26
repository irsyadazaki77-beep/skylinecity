import { CityState } from './types';

export function deriveCitySpecialization(state: CityState): NonNullable<CityState['specialization']> {
  if (state.population < 50) return 'BALANCED';
  const scores: Record<NonNullable<CityState['specialization']>, number> = {
    BALANCED: 40,
    TOURISM: (state.desirability ?? 0) * 0.7 + (state.commercialUtilization ?? 0) * 35,
    EDUCATION: (state.educationLevel ?? 0) * 0.8 + (state.educationCoverage ?? 0) * 0.35,
    TECHNOLOGY: (state.educationLevel ?? 0) * 0.9 + (state.mixedUseJobs ?? 0) * 0.04,
    LOGISTICS: (state.freightReliability ?? 0) * 0.45 + (state.cargoThroughput ?? 0) * 0.2 + (state.industrialAccess ?? 0) * 0.25,
    GREEN_INDUSTRY: Math.max(0, 100 - (state.pollutionAverage ?? 0) * 1.4) * 0.5 + (state.productionEfficiency ?? 0) * 45,
  };
  return (Object.entries(scores).sort(([, left], [, right]) => right - left)[0]?.[0] ?? 'BALANCED') as NonNullable<CityState['specialization']>;
}
