import { describe, expect, it } from 'vitest';
import { BEAUTIFICATION_CATALOG, calculateBeautificationBonuses } from './beautification';

describe('beautification system', () => {
  it('provides all 5 core beautification tools with localized descriptions', () => {
    expect(BEAUTIFICATION_CATALOG.PLAZA).toBeDefined();
    expect(BEAUTIFICATION_CATALOG.URBAN_TREE).toBeDefined();
    expect(BEAUTIFICATION_CATALOG.PEDESTRIAN_PATH).toBeDefined();
    expect(BEAUTIFICATION_CATALOG.FOUNTAIN).toBeDefined();
    expect(BEAUTIFICATION_CATALOG.PARK_SCULPTURE).toBeDefined();

    expect(BEAUTIFICATION_CATALOG.PLAZA.name.id).toBe('Plaza Tropis');
    expect(BEAUTIFICATION_CATALOG.PLAZA.name.en).toBe('Tropical Plaza');
  });

  it('calculates falloff effects gracefully based on radius', () => {
    const fountain = BEAUTIFICATION_CATALOG.FOUNTAIN;
    const directImpact = calculateBeautificationBonuses(fountain, 0);
    expect(directImpact.landValueImpact).toBeGreaterThan(0);
    expect(directImpact.happinessImpact).toBeGreaterThan(0);

    const midImpact = calculateBeautificationBonuses(fountain, 2);
    expect(midImpact.landValueImpact).toBeLessThan(directImpact.landValueImpact);

    const outsideImpact = calculateBeautificationBonuses(fountain, 10);
    expect(outsideImpact.landValueImpact).toBe(0);
    expect(outsideImpact.happinessImpact).toBe(0);
  });
});
