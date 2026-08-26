import { Season, WeatherType } from './types';
import { SeededRandom } from './citizenSimulation/prng';

export interface ClimateState {
  season: Season;
  weather: WeatherType;
  temperature: number;
  precipitation: number;
  powerDemandMultiplier: number;
  waterDemandMultiplier: number;
  trafficMultiplier: number;
  fireRisk: number;
  happinessImpact: number;
}

const SEASONS: Season[] = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];

export function simulateClimate(day: number, seed: number, previous?: Partial<ClimateState>): ClimateState {
  const season = SEASONS[Math.floor(Math.max(0, day - 1) / 90) % SEASONS.length];
  const random = new SeededRandom(((seed ^ (day * 0x9e3779b9)) >>> 0));
  const roll = random.next();
  let weather: WeatherType = 'CLEAR';
  if (season === 'SUMMER' && roll < 0.08) weather = 'HEATWAVE';
  else if (season === 'SUMMER' && roll < 0.14) weather = 'DROUGHT';
  else if (roll < (season === 'SPRING' || season === 'AUTUMN' ? 0.28 : 0.18)) weather = 'RAIN';
  else if (roll < 0.34) weather = 'STORM';
  if (previous?.weather && roll < 0.22) weather = previous.weather;

  const baseTemperature = season === 'SUMMER' ? 31 : season === 'WINTER' ? 20 : season === 'AUTUMN' ? 26 : 28;
  const temperature = Math.round((baseTemperature + (random.next() - 0.5) * 8) * 10) / 10;
  const precipitation = weather === 'STORM' ? 1.9 : weather === 'RAIN' ? 1.35 : weather === 'DROUGHT' ? 0.12 : season === 'SPRING' ? 1.08 : 0.75;
  const powerDemandMultiplier = weather === 'HEATWAVE' ? 1.38 : season === 'WINTER' ? 1.16 : weather === 'DROUGHT' ? 1.08 : 1;
  const waterDemandMultiplier = weather === 'HEATWAVE' ? 1.3 : weather === 'DROUGHT' ? 1.45 : weather === 'RAIN' || weather === 'STORM' ? 0.78 : 1;
  const trafficMultiplier = weather === 'STORM' ? 1.32 : weather === 'RAIN' ? 1.16 : weather === 'DROUGHT' ? 1.05 : 1;
  const fireRisk = weather === 'DROUGHT' || weather === 'HEATWAVE' ? 1.75 : season === 'SUMMER' ? 1.18 : 1;
  const happinessImpact = weather === 'STORM' || weather === 'HEATWAVE' ? -3 : weather === 'RAIN' ? -1 : 0;

  return { season, weather, temperature, precipitation, powerDemandMultiplier, waterDemandMultiplier, trafficMultiplier, fireRisk, happinessImpact };
}

export function seasonLabel(season: Season | undefined): string {
  return season === 'SPRING' ? 'Spring' : season === 'SUMMER' ? 'Summer' : season === 'AUTUMN' ? 'Autumn' : 'Winter';
}

export function weatherLabel(weather: WeatherType | undefined): string {
  return weather === 'HEATWAVE' ? 'Heatwave' : weather === 'DROUGHT' ? 'Drought' : weather === 'STORM' ? 'Storm' : weather === 'RAIN' ? 'Rain' : 'Clear';
}
