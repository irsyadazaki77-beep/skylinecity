import { TileData, TileType } from '../types';
import { SeededRandom } from './prng';
import { 
  Citizen, 
  WorkplaceJob, 
  WorkplaceFacility, 
  EducationLevel, 
  AgeStage,
  WorkforceMetrics 
} from './types';
import { COMMERCIAL_CAPACITIES, INDUSTRIAL_CAPACITIES } from '../depthSimulation';
import { getOfficeCapacity } from '../zoning';

export interface JobTemplate {
  title: string;
  education: EducationLevel;
  baseSalary: number;
}

const COMMERCIAL_JOB_TIERS: Record<number, JobTemplate[]> = {
  1: [
    { title: 'Store Clerk', education: EducationLevel.UNEDUCATED, baseSalary: 18 },
    { title: 'Retail Assistant', education: EducationLevel.UNEDUCATED, baseSalary: 20 },
  ],
  2: [
    { title: 'Sales Associate', education: EducationLevel.HIGH_SCHOOL, baseSalary: 26 },
    { title: 'Customer Support', education: EducationLevel.HIGH_SCHOOL, baseSalary: 28 },
  ],
  3: [
    { title: 'Branch Supervisor', education: EducationLevel.HIGH_SCHOOL, baseSalary: 38 },
    { title: 'Account Manager', education: EducationLevel.HIGH_SCHOOL, baseSalary: 42 },
  ],
  4: [
    { title: 'Financial Analyst', education: EducationLevel.UNIVERSITY, baseSalary: 58 },
    { title: 'Software Developer', education: EducationLevel.UNIVERSITY, baseSalary: 64 },
  ],
  5: [
    { title: 'Senior Executive', education: EducationLevel.UNIVERSITY, baseSalary: 88 },
    { title: 'Principal Architect', education: EducationLevel.UNIVERSITY, baseSalary: 96 },
  ],
};

const INDUSTRIAL_JOB_TIERS: Record<number, JobTemplate[]> = {
  1: [
    { title: 'General Laborer', education: EducationLevel.UNEDUCATED, baseSalary: 19 },
    { title: 'Warehouse Hand', education: EducationLevel.UNEDUCATED, baseSalary: 21 },
  ],
  2: [
    { title: 'Machine Operator', education: EducationLevel.HIGH_SCHOOL, baseSalary: 28 },
    { title: 'Logistics Driver', education: EducationLevel.HIGH_SCHOOL, baseSalary: 30 },
  ],
  3: [
    { title: 'Plant Technician', education: EducationLevel.HIGH_SCHOOL, baseSalary: 40 },
    { title: 'Quality Inspector', education: EducationLevel.HIGH_SCHOOL, baseSalary: 44 },
  ],
  4: [
    { title: 'Automation Engineer', education: EducationLevel.UNIVERSITY, baseSalary: 60 },
    { title: 'Process Specialist', education: EducationLevel.UNIVERSITY, baseSalary: 66 },
  ],
  5: [
    { title: 'R&D Director', education: EducationLevel.UNIVERSITY, baseSalary: 92 },
    { title: 'Robotics Lead', education: EducationLevel.UNIVERSITY, baseSalary: 100 },
  ],
};

const OFFICE_JOB_TIERS: Record<number, JobTemplate[]> = {
  1: [
    { title: 'Office Assistant', education: EducationLevel.HIGH_SCHOOL, baseSalary: 28 },
    { title: 'Junior Coordinator', education: EducationLevel.HIGH_SCHOOL, baseSalary: 32 },
  ],
  2: [
    { title: 'Business Analyst', education: EducationLevel.HIGH_SCHOOL, baseSalary: 42 },
    { title: 'Account Specialist', education: EducationLevel.HIGH_SCHOOL, baseSalary: 46 },
  ],
  3: [
    { title: 'Product Manager', education: EducationLevel.UNIVERSITY, baseSalary: 60 },
    { title: 'Systems Analyst', education: EducationLevel.UNIVERSITY, baseSalary: 66 },
  ],
  4: [
    { title: 'Software Engineer', education: EducationLevel.UNIVERSITY, baseSalary: 78 },
    { title: 'Research Specialist', education: EducationLevel.UNIVERSITY, baseSalary: 84 },
  ],
  5: [
    { title: 'Technology Director', education: EducationLevel.UNIVERSITY, baseSalary: 108 },
    { title: 'Principal Consultant', education: EducationLevel.UNIVERSITY, baseSalary: 116 },
  ],
};

const SERVICE_JOB_TEMPLATES: Partial<Record<TileType, JobTemplate[]>> = {
  [TileType.CLINIC]: [
    { title: 'Medical Nurse', education: EducationLevel.HIGH_SCHOOL, baseSalary: 42 },
    { title: 'Physician / Doctor', education: EducationLevel.UNIVERSITY, baseSalary: 72 },
  ],
  [TileType.SCHOOL]: [
    { title: 'School Administrator', education: EducationLevel.HIGH_SCHOOL, baseSalary: 36 },
    { title: 'Teacher / Instructor', education: EducationLevel.UNIVERSITY, baseSalary: 58 },
  ],
  [TileType.POLICE_STATION]: [
    { title: 'Patrol Officer', education: EducationLevel.HIGH_SCHOOL, baseSalary: 42 },
    { title: 'Detective / Inspector', education: EducationLevel.UNIVERSITY, baseSalary: 64 },
  ],
  [TileType.FIRE_STATION]: [
    { title: 'Firefighter', education: EducationLevel.HIGH_SCHOOL, baseSalary: 40 },
    { title: 'Emergency Captain', education: EducationLevel.HIGH_SCHOOL, baseSalary: 50 },
  ],
  [TileType.POWER_PLANT]: [
    { title: 'Grid Operator', education: EducationLevel.HIGH_SCHOOL, baseSalary: 38 },
    { title: 'Power Systems Engineer', education: EducationLevel.UNIVERSITY, baseSalary: 65 },
  ],
  [TileType.WATER_PUMP]: [
    { title: 'Pump Technician', education: EducationLevel.HIGH_SCHOOL, baseSalary: 35 },
  ],
  [TileType.WASTE_MANAGEMENT]: [
    { title: 'Sanitation Specialist', education: EducationLevel.UNEDUCATED, baseSalary: 28 },
    { title: 'Recycling Facility Manager', education: EducationLevel.HIGH_SCHOOL, baseSalary: 40 },
  ],
};

/**
 * Synchronizes workplace facilities and job openings with current city tiles.
 */
export function syncWorkplaceFacilities(
  grid: TileData[][],
  workplaces: Map<string, WorkplaceFacility>,
  citizens: Map<string, Citizen>,
  prng: SeededRandom,
  populationScale = 1,
): void {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const activeKeys = new Set<string>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      const isWorkplaceTile =
        tile.type === TileType.COMMERCIAL ||
        tile.type === TileType.OFFICE ||
        tile.type === TileType.INDUSTRIAL ||
        tile.type === TileType.CLINIC ||
        tile.type === TileType.SCHOOL ||
        tile.type === TileType.POLICE_STATION ||
        tile.type === TileType.FIRE_STATION ||
        tile.type === TileType.POWER_PLANT ||
        tile.type === TileType.WATER_PUMP ||
        tile.type === TileType.WASTE_MANAGEMENT;

      if (!isWorkplaceTile || tile.abandoned || !tile.powered) {
        continue;
      }

      const key = `${x},${y}`;
      activeKeys.add(key);

      let capacity = 0;
      let type: 'COMMERCIAL' | 'OFFICE' | 'INDUSTRIAL' | 'SERVICE' = 'SERVICE';
      let templates: JobTemplate[] = [];

      const level = Math.min(5, Math.max(1, tile.level || 1));

      if (tile.type === TileType.COMMERCIAL) {
        type = 'COMMERCIAL';
        capacity = COMMERCIAL_CAPACITIES[level] || 4;
        templates = COMMERCIAL_JOB_TIERS[level] || COMMERCIAL_JOB_TIERS[1];
      } else if (tile.type === TileType.OFFICE) {
        type = 'OFFICE';
        capacity = getOfficeCapacity(level);
        templates = OFFICE_JOB_TIERS[level] || OFFICE_JOB_TIERS[1];
      } else if (tile.type === TileType.INDUSTRIAL) {
        type = 'INDUSTRIAL';
        capacity = INDUSTRIAL_CAPACITIES[level] || 5;
        templates = INDUSTRIAL_JOB_TIERS[level] || INDUSTRIAL_JOB_TIERS[1];
      } else {
        type = 'SERVICE';
        capacity = 4;
        templates = SERVICE_JOB_TEMPLATES[tile.type] || [
          { title: 'Municipal Worker', education: EducationLevel.HIGH_SCHOOL, baseSalary: 35 },
        ];
      }

      let facility = workplaces.get(key);
      if (!facility || facility.level !== level || facility.type !== type) {
        // Build or upgrade facility positions
        const existingPositions = facility?.positions || [];
        const positions: WorkplaceJob[] = [];

        // Large-city fixtures represent many residents with a sampled citizen
        // population. Keep aggregate capacity truthful while materializing only
        // a small deterministic job sample; otherwise every tick allocates
        // hundreds of thousands of WorkplaceJob objects for a few agents.
        const materializedCapacity = populationScale > 1 ? Math.min(capacity, 8) : capacity;
        for (let i = 0; i < materializedCapacity; i++) {
          if (i < existingPositions.length) {
            positions.push(existingPositions[i]);
          } else {
            const template = templates[i % templates.length];
            const salaryVariation = prng.nextInt(-2, 2);
            positions.push({
              id: `${key}-job-${i}`,
              workplaceTile: { x, y },
              workplaceType: type,
              educationRequired: template.education,
              salary: Math.max(12, template.baseSalary + salaryVariation),
              jobTitle: template.title,
            });
          }
        }

        facility = {
          tileX: x,
          tileY: y,
          type,
          level,
          totalCapacity: capacity,
          positions,
        };
        workplaces.set(key, facility);
      }
    }
  }

  // Remove stale or demolished workplace facilities and lay off workers
  for (const [key, facility] of workplaces.entries()) {
    if (!activeKeys.has(key)) {
      // Dissolve facility and clear jobs for workers
      for (const pos of facility.positions) {
        // Check if any citizen worked here
        for (const citizen of citizens.values()) {
          if (citizen.workplace?.id === pos.id) {
            citizen.workplace = null;
            citizen.commuteTime = 0;
          }
        }
      }
      workplaces.delete(key);
    }
  }
}

/**
 * Matches unemployed citizens to available job vacancies according to education and proximity to residence.
 */
export function matchCitizensToWorkplaces(
  citizens: Map<string, Citizen>,
  workplaces: Map<string, WorkplaceFacility>,
  prng: SeededRandom,
): WorkforceMetrics {
  // 1. Gather all occupied job IDs
  const occupiedJobIds = new Set<string>();
  let totalSalary = 0;
  let employedCount = 0;

  // Clean up invalid workplaces for citizens whose jobs no longer exist
  const allJobMap = new Map<string, WorkplaceJob>();
  let totalJobSlots = 0;
  for (const facility of workplaces.values()) {
    totalJobSlots += facility.totalCapacity;
    for (const job of facility.positions) {
      allJobMap.set(job.id, job);
    }
  }

  const jobSeekers: Citizen[] = [];
  let employableCount = 0;

  for (const citizen of citizens.values()) {
    if (citizen.stage === AgeStage.CHILD || citizen.stage === AgeStage.SENIOR) {
      if (citizen.workplace) citizen.workplace = null;
      continue;
    }

    employableCount++;

    if (citizen.workplace) {
      const validJob = allJobMap.get(citizen.workplace.id);
      if (validJob) {
        occupiedJobIds.add(validJob.id);
        totalSalary += validJob.salary;
        employedCount++;
      } else {
        // Workplace closed or vanished
        citizen.workplace = null;
        jobSeekers.push(citizen);
      }
    } else {
      jobSeekers.push(citizen);
    }
  }

  // 2. Gather all vacant positions
  const vacantJobs: WorkplaceJob[] = [];
  for (const facility of workplaces.values()) {
    for (const job of facility.positions) {
      if (!occupiedJobIds.has(job.id)) {
        vacantJobs.push(job);
      }
    }
  }

  // Large benchmark/city fixtures can contain many more job slots than
  // sampled citizens. A spatial bucket keeps matching deterministic while
  // avoiding a full scan of every vacancy for every seeker.
  const vacantJobIds = new Set(vacantJobs.map((job) => job.id));
  const jobsByBucket = new Map<string, WorkplaceJob[]>();
  const bucketSize = 4;
  for (const job of vacantJobs) {
    const key = `${Math.floor(job.workplaceTile.x / bucketSize)},${Math.floor(job.workplaceTile.y / bucketSize)}`;
    const bucket = jobsByBucket.get(key) ?? [];
    bucket.push(job);
    jobsByBucket.set(key, bucket);
  }

  const getCandidateJobs = (seeker: Citizen): WorkplaceJob[] => {
    if (vacantJobs.length <= 512) return vacantJobs;
    const originX = Math.floor((seeker.residence?.x ?? 0) / bucketSize);
    const originY = Math.floor((seeker.residence?.y ?? 0) / bucketSize);
    const candidates: WorkplaceJob[] = [];
    const seen = new Set<string>();
    for (let radius = 0; radius <= 8 && candidates.length < 512; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const bucket = jobsByBucket.get(`${originX + dx},${originY + dy}`) ?? [];
          for (const job of bucket) {
            if (vacantJobIds.has(job.id) && !seen.has(job.id)) {
              seen.add(job.id);
              candidates.push(job);
              if (candidates.length >= 512) break;
            }
          }
          if (candidates.length >= 512) break;
        }
        if (candidates.length >= 512) break;
      }
    }
    return candidates.length > 0 ? candidates : vacantJobs.slice(0, 512);
  };

  // Deterministically shuffle seekers to avoid order-based privilege
  prng.shuffle(jobSeekers);

  // 3. Match seekers to jobs
  for (const seeker of jobSeekers) {
    if (vacantJobs.length === 0) break;

    let bestJobIndex = -1;
    let bestScore = -Infinity;

    const candidateJobs = getCandidateJobs(seeker);
    for (let i = 0; i < candidateJobs.length; i++) {
      const job = candidateJobs[i];

      // Qualification evaluation
      let eduScore = 0;
      if (seeker.education === job.educationRequired) {
        eduScore = 50; // Exact match
      } else if (seeker.education > job.educationRequired) {
        eduScore = 35; // Overqualified (acceptable)
      } else {
        // Underqualified
        if (job.educationRequired === EducationLevel.UNIVERSITY) {
          // Cannot work university jobs without university education
          continue;
        } else if (job.educationRequired === EducationLevel.HIGH_SCHOOL && seeker.education === EducationLevel.UNEDUCATED) {
          eduScore = 10; // Can work entry-level high school jobs with lower score
        }
      }

      // Proximity evaluation using citizen's residence
      const dist = seeker.residence
        ? Math.abs(seeker.residence.x - job.workplaceTile.x) + Math.abs(seeker.residence.y - job.workplaceTile.y)
        : 5;

      const score = eduScore + job.salary * 0.5 - dist * 1.2;

      if (score > bestScore) {
        bestScore = score;
        bestJobIndex = i;
      }
    }

    if (bestJobIndex !== -1 && bestScore > 0) {
      const matchedJob = candidateJobs[bestJobIndex];
      const vacantIndex = vacantJobs.indexOf(matchedJob);
      if (vacantIndex < 0) continue;
      vacantJobs.splice(vacantIndex, 1);
      vacantJobIds.delete(matchedJob.id);
      seeker.workplace = matchedJob;
      occupiedJobIds.add(matchedJob.id);
      totalSalary += matchedJob.salary;
      employedCount++;
    }
  }

  const unemployedCount = Math.max(0, employableCount - employedCount);
  const vacantJobCount = Math.max(0, totalJobSlots - employedCount);
  const unemploymentRate = employableCount > 0
    ? Math.round((unemployedCount / employableCount) * 1000) / 10
    : 0;
  const averageSalary = employedCount > 0 ? Math.round(totalSalary / employedCount) : 0;

  return {
    totalJobSlots,
    filledJobs: employedCount,
    vacantJobs: vacantJobCount,
    unemployedCitizens: unemployedCount,
    employable: employableCount,
    employed: employedCount,
    unemployed: unemployedCount,
    totalEmployable: employableCount,
    totalEmployed: employedCount,
    totalUnemployed: unemployedCount,
    unemploymentRate,
    averageSalary,
  };
}
