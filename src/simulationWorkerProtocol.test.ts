import { describe, expect, it } from 'vitest';
import { isCurrentWorkerMessage, isCurrentWorkerTickResult } from './simulationWorkerProtocol';

describe('simulation worker epoch protocol', () => {
  it('rejects a slow tick from an older city after reset', () => {
    const slowTick = { workerGeneration: 7, requestId: 41, stateRevision: 12, tickId: 8 };
    const reset = { workerGeneration: 8, requestId: 42, stateRevision: 13, tickId: 0 };

    expect(isCurrentWorkerMessage(slowTick, slowTick)).toBe(true);
    expect(isCurrentWorkerMessage(slowTick, reset)).toBe(false);
    expect(isCurrentWorkerTickResult({ ...slowTick, stateRevision: 13 }, slowTick)).toBe(true);
    expect(isCurrentWorkerTickResult({ ...slowTick, stateRevision: 13 }, reset)).toBe(false);
  });

  it('requires request, revision, and tick identity in addition to generation', () => {
    const expected = { workerGeneration: 3, requestId: 9, stateRevision: 24, tickId: 5 };
    expect(isCurrentWorkerMessage({ ...expected, requestId: 8 }, expected)).toBe(false);
    expect(isCurrentWorkerMessage({ ...expected, stateRevision: 23 }, expected)).toBe(false);
    expect(isCurrentWorkerMessage({ ...expected, tickId: 4 }, expected)).toBe(false);
  });
});
