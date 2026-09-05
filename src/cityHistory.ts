import { CityState } from './types';
export type CityHistoryEventType = 'MILESTONE' | 'DISASTER' | 'TRANSIT' | 'ECONOMY' | 'POPULATION' | 'IDENTITY' | 'POLICY' | 'CAMPAIGN';
export interface CityHistoryEvent { id: string; type: CityHistoryEventType; day: number; title: string; summary: string; impact: { population: number; money: number; happiness: number; congestion: number; resilience: number } }
export interface CityHistoryState { events: CityHistoryEvent[]; snapshot: CityHistoryEvent['impact']; seenKeys: string[] }
const snap = (state: CityState): CityHistoryEvent['impact'] => ({ population: state.population, money: state.money, happiness: Math.round(state.happiness), congestion: Math.round(state.congestionIndex), resilience: Math.round(state.disasterPreparationState?.preparedness ?? 0) });
export function advanceCityHistory(previous: CityHistoryState | undefined, state: CityState, prior: CityState): CityHistoryState {
  const base = previous ?? { events: [], snapshot: snap(prior), seenKeys: [] };
  const candidates: Array<{ key: string; type: CityHistoryEventType; title: string; summary: string }> = [];
  if (state.milestoneLevel > prior.milestoneLevel) candidates.push({ key: `milestone:${state.milestoneLevel}`, type: 'MILESTONE', title: 'Kota mencapai milestone baru', summary: `Milestone level ${state.milestoneLevel} membuka keputusan baru.` });
  for (const disaster of state.disasters ?? []) candidates.push({ key: `disaster:${disaster.id}`, type: 'DISASTER', title: `${disaster.type} melanda kota`, summary: `${disaster.affectedTiles} tile terdampak; severity ${disaster.severity}.` });
  for (const identity of state.neighborhoodIdentityState?.identities ?? []) candidates.push({ key: `identity:${identity.districtId}:${identity.type}`, type: 'IDENTITY', title: 'Identitas distrik berkembang', summary: `${identity.districtId} menjadi ${identity.type.replaceAll('_', ' ')} karena ${identity.reasons.slice(1).join(', ')}.` });
  if (state.scenarioCompleted && !prior.scenarioCompleted) candidates.push({ key: `campaign:${state.activeScenarioId}`, type: 'CAMPAIGN', title: 'Campaign selesai', summary: `Target ${state.activeScenarioId} tercapai melalui kondisi kota nyata.` });
  const fresh = candidates.filter((item) => !base.seenKeys.includes(item.key)).map((item) => ({ id: `${item.key}:${state.day}`, type: item.type, day: state.day, title: item.title, summary: item.summary, impact: { population: state.population - base.snapshot.population, money: state.money - base.snapshot.money, happiness: Math.round(state.happiness - base.snapshot.happiness), congestion: Math.round(state.congestionIndex - base.snapshot.congestion), resilience: Math.round((state.disasterPreparationState?.preparedness ?? 0) - base.snapshot.resilience) } }));
  return { events: [...base.events, ...fresh].slice(-80), snapshot: snap(state), seenKeys: [...new Set([...base.seenKeys, ...candidates.map((item) => item.key)])].slice(-160) };
}
