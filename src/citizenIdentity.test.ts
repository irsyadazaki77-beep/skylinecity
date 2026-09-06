import { describe, expect, it } from 'vitest';
import { deriveCitizenProfile } from './citizenIdentity';
import { deriveHouseholdProfile } from './householdIdentity';
import { AgeStage, EducationLevel } from './citizenSimulation/types';

describe('citizen and household identity presentation', () => {
  it('generates consistent deterministic citizen profiles from id and simulation data', () => {
    const mockCitizen = {
      id: 'cit-1042',
      householdId: 'hh-501',
      residence: { x: 5, y: 8 },
      age: 29,
      stage: AgeStage.ADULT,
      education: EducationLevel.UNIVERSITY,
      workplace: {
        id: 'job-1',
        workplaceTile: { x: 12, y: 15 },
        workplaceType: 'OFFICE' as const,
        educationRequired: EducationLevel.UNIVERSITY,
        salary: 260,
        jobTitle: 'Insinyur Sistem',
      },
      school: null,
      health: 85,
      happiness: 78,
      commuteTime: 18,
      serviceNeeds: { healthcare: 20, education: 10, leisure: 40, goods: 30 },
    };

    const profile1 = deriveCitizenProfile(mockCitizen);
    const profile2 = deriveCitizenProfile(mockCitizen);

    expect(profile1.name).toBe(profile2.name);
    expect(profile1.occupation).toBe('Insinyur Sistem');
    expect(profile1.income).toBe(260);
    expect(profile1.stageLabel).toBe('Usia Produktif');
    expect(profile1.commuteTimeMinutes).toBe(18);
  });

  it('generates household profiles with authentic concerns and member breakdowns', () => {
    const mockHousehold = {
      id: 'hh-77',
      residence: { x: 4, y: 6 },
      citizenIds: ['cit-1', 'cit-2', 'cit-3'],
      savings: 2400,
      rent: 45,
      satisfaction: 42,
      satisfactionFactors: {
        rentAffordability: 35, // Low affordability!
        employment: 75,
        commute: 60,
        crime: 80,
        pollution: 70,
        schoolAccess: 65,
        healthAccess: 80,
        overall: 42,
      },
      relocationTimer: 0,
    };

    const mockCitizens = [
      { id: 'cit-1', stage: AgeStage.ADULT } as any,
      { id: 'cit-2', stage: AgeStage.ADULT } as any,
      { id: 'cit-3', stage: AgeStage.CHILD } as any,
    ];

    const profile = deriveHouseholdProfile(mockHousehold, mockCitizens);

    expect(profile.familyName).toContain('Keluarga');
    expect(profile.membersCount).toBe(3);
    expect(profile.adultsCount).toBe(2);
    expect(profile.childrenCount).toBe(1);
    expect(profile.primaryConcern).toBe('Beban sewa tempat tinggal terlalu tinggi');
    expect(profile.statusLabel).toBe('Khawatir');
  });
});
