import { describe, expect, it } from 'vitest';
import { createEmptyGrid } from '../../engine';
import { TileType } from '../../types';
import { buildingScale, buildingVariant, buildingVisualSpec, focusFrame, roadHeight, roadVisual, terrainHeight } from './visualModel';
import { getNightFactor } from './DayNightSky';

describe('render-only P0 contracts', () => {
  it('keeps parcel identity through evolution and save round trip', () => {
    const tile = { ...createEmptyGrid(1, 1)[0][0], parcelSeed: 2026, type: TileType.RESIDENTIAL };
    const before = JSON.stringify(tile);
    expect(buildingVariant({ ...tile, level: 5 } as typeof tile)).toBe(buildingVariant(tile));
    expect(buildingVariant(JSON.parse(before))).toBe(buildingVariant(tile));
    expect(new Set(Array.from({ length: 32 }, (_, x) => buildingVariant({ ...tile, x }))).size).toBeGreaterThan(4);
    expect(buildingScale({ ...tile, zoneDensity: 'HIGH' })).toBeGreaterThan(buildingScale({ ...tile, zoneDensity: 'LOW' }));
    expect(JSON.stringify(tile)).toBe(before);
  });
  it('generates stable multi-part architectural specifications without mutating simulation data', () => {
    const tile = { ...createEmptyGrid(1, 1)[0][0], x: 7, y: 9, parcelSeed: 8128, level: 4, zoneDensity: 'HIGH' as const, type: TileType.OFFICE };
    const before = JSON.stringify(tile);
    const spec = buildingVisualSpec(tile);
    expect(buildingVisualSpec({ ...tile })).toEqual(spec);
    expect(spec.floors).toBeGreaterThanOrEqual(6);
    expect(spec.height).toBeGreaterThan(1);
    expect(spec.archetype).toBe('GLASS_TOWER');
    expect(['L_SHAPE', 'U_SHAPE', 'STEPPED', 'CORNER', 'COURTYARD']).toContain(spec.silhouette);
    expect(JSON.stringify(tile)).toBe(before);
  });
  it('keeps category and level progression visually diverse', () => {
    const base = createEmptyGrid(1, 1)[0][0];
    const categories = [TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL, TileType.SCHOOL, TileType.FIRE_STATION];
    const specs = categories.map((type, index) => buildingVisualSpec({ ...base, type, x: index + 2, y: index + 5, parcelSeed: 900 + index, level: index % 5 + 1 }));
    expect(new Set(specs.map((spec) => spec.silhouette)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(specs.map((spec) => spec.accentIndex)).size).toBeGreaterThanOrEqual(3);
    const low = buildingVisualSpec({ ...base, type: TileType.RESIDENTIAL, level: 1, zoneDensity: 'LOW', parcelSeed: 44 });
    const landmark = buildingVisualSpec({ ...base, type: TileType.RESIDENTIAL, level: 5, zoneDensity: 'HIGH', parcelSeed: 44 });
    expect(landmark.floors).toBeGreaterThan(low.floors);
    expect(landmark.height).toBeGreaterThan(low.height);
    expect(landmark.archetype).not.toBe(low.archetype);
  });
  it('aligns foundations, roads and vehicles with saved elevation', () => {
    expect(terrainHeight(4)).toBeCloseTo(0.6);
    expect(terrainHeight(NaN)).toBe(0);
    expect(roadHeight({ elevation: 4, roadStructure: 'BRIDGE' })).toBeCloseTo(0.82);
    expect(roadHeight({ elevation: 4, roadStructure: 'TUNNEL' })).toBeCloseTo(0.52);
    expect(roadVisual('HIGHWAY').width).toBeGreaterThan(roadVisual('LOCAL').width);
    expect(roadVisual('HIGHWAY').width).toBeLessThanOrEqual(1);
  });
  it('keeps tutorial destination and settlement around the same target', () => {
    const frame = focusFrame([20, 1, 0], [0, 0, 0], true);
    expect(frame.target).toEqual([10, 0.5, 0]);
    expect(frame.distance).toBeGreaterThan(30);
    expect(focusFrame([200, 0, 0], [0, 0, 0], true).distance).toBe(90);
    expect(focusFrame([2, 1, 3], [0, 0, 0], false).target).toEqual([2, 1, 3]);
  });
  it('normalizes the city clock and preserves readable dawn/dusk transitions', () => {
    expect(getNightFactor(12)).toBe(0);
    expect(getNightFactor(0)).toBe(1);
    expect(getNightFactor(24)).toBe(getNightFactor(0));
    expect(getNightFactor(6)).toBeLessThan(1);
    expect(getNightFactor(18)).toBeCloseTo(getNightFactor(6));
  });
});
