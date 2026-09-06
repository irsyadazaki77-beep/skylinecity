import { describe, expect, it } from 'vitest';
import { formatFovLabel, calculateCameraDistanceForFov } from './PhotoModeModal';

describe('PhotoModeModal helpers', () => {
  it('formats human-readable FOV labels accurately', () => {
    expect(formatFovLabel(30)).toBe('Telephoto (Detail)');
    expect(formatFovLabel(45)).toBe('Standard');
    expect(formatFovLabel(70)).toBe('Ultra-Wide (Panorama)');
  });

  it('calculates focal distance scaling with safe bounds', () => {
    const stdDistance = calculateCameraDistanceForFov(45, 20);
    expect(stdDistance).toBeCloseTo(20, 1);

    const teleDistance = calculateCameraDistanceForFov(25, 20);
    expect(teleDistance).toBeGreaterThan(stdDistance);

    const wideDistance = calculateCameraDistanceForFov(75, 20);
    expect(wideDistance).toBeLessThan(stdDistance);
  });
});
