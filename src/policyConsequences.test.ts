import { describe, expect, it } from 'vitest';
import { createInitialCityState } from './engine';
import { createStarterGrid } from './starterCity';
import { derivePolicyConsequences, POLICY_CONTRACTS } from './policyConsequences';

describe('policy trade-off contracts', () => {
  it('documents every selectable policy with cost, winners, losers, and both horizons', () => {
    for (const contract of Object.values(POLICY_CONTRACTS)) {
      expect(contract.costPerDay).toBeGreaterThan(0);
      expect(contract.benefit).toBeTruthy();
      expect(contract.beneficiary).toBeTruthy();
      expect(contract.disadvantaged).toBeTruthy();
      expect(contract.shortTerm).toBeTruthy();
      expect(contract.longTerm).toBeTruthy();
    }
  });

  it('reports an observed live metric without fabricating a counterfactual value', () => {
    const state = createInitialCityState(createStarterGrid(), 91);
    state.activePolicies = ['small_biz'];
    state.income = 123;
    const [consequence] = derivePolicyConsequences(state);
    expect(consequence.measuredMetric).toBe('income');
    expect(consequence.observedValue).toBe(123);
    expect('before' in consequence).toBe(false);
    expect('after' in consequence).toBe(false);
  });

  it('does not present an expected direction as a measured projected value', () => {
    const state = createInitialCityState(createStarterGrid(), 92);
    state.activePolicies = ['green_roofs'];
    state.pollutionAverage = 47;
    const [consequence] = derivePolicyConsequences(state);
    expect(consequence.observedValue).toBe(47);
    expect(consequence.expectedDirection).toBe('DOWN');
    expect(Object.keys(consequence)).not.toContain('projectedValue');
    expect(Object.keys(consequence)).not.toContain('projectedChange');
  });
});
