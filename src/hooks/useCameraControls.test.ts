import { describe, expect, it } from 'vitest';
import { useCameraControls } from './useCameraControls';

describe('useCameraControls', () => {
  it('is exported as a callable hook function', () => {
    expect(typeof useCameraControls).toBe('function');
  });
});
