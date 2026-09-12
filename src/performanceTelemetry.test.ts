import { expect, it, vi } from 'vitest';
import { getPerformanceTelemetry, recordReactCommit, subscribePerformanceTelemetry } from './performanceTelemetry';

it('records React commits without recursively notifying the React profiler', () => {
  const listener = vi.fn();
  const unsubscribe = subscribePerformanceTelemetry(listener);
  const previous = getPerformanceTelemetry().reactCommitCount;
  recordReactCommit(8);
  expect(listener).not.toHaveBeenCalled();
  expect(getPerformanceTelemetry().reactCommitMs).toBe(8);
  expect(getPerformanceTelemetry().reactCommitCount).toBe(previous + 1);
  unsubscribe();
});
