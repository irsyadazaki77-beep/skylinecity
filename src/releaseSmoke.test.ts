import { describe, expect, it } from 'vitest';
import { runReleaseSmoke } from './releaseSmoke';

describe('release smoke', () => {
  it('covers build, simulate, save validation, and deterministic replay', () => {
    const result = runReleaseSmoke(8080);
    expect(result.passed).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
  });
});
