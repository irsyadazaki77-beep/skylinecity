import { TileData, TileType } from '../types';
import { SeededRandom } from './prng';
import { 
  Citizen, 
  SchoolFacility, 
  EducationLevel, 
  AgeStage 
} from './types';

/**
 * Synchronizes school facilities with the city grid and enrolls eligible children & students.
 */
export function syncSchoolFacilitiesAndEnrollment(
  grid: TileData[][],
  schools: Map<string, SchoolFacility>,
  citizens: Map<string, Citizen>,
  _prng: SeededRandom,
): {
  totalCapacity: number;
  totalEnrolled: number;
  schoolCount: number;
} {
  const height = grid.length;
  const width = grid[0]?.length || 0;
  const activeKeys = new Set<string>();

  let totalCapacity = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = grid[y][x];
      if (tile.type === TileType.SCHOOL && tile.powered && !tile.abandoned) {
        const key = `${x},${y}`;
        activeKeys.add(key);
        const capacity = 60;
        totalCapacity += capacity;

        let facility = schools.get(key);
        if (!facility) {
          facility = {
            tileX: x,
            tileY: y,
            level: tile.level || 1,
            capacity,
            enrolledCitizenIds: [],
          };
          schools.set(key, facility);
        } else {
          facility.capacity = capacity;
          facility.level = tile.level || 1;
        }
      }
    }
  }

  // Remove demolished schools
  for (const [key, facility] of schools.entries()) {
    if (!activeKeys.has(key)) {
      for (const citizenId of facility.enrolledCitizenIds) {
        const citizen = citizens.get(citizenId);
        if (citizen) citizen.school = null;
      }
      schools.delete(key);
    }
  }

  // Clear stale enrollments
  for (const facility of schools.values()) {
    facility.enrolledCitizenIds = facility.enrolledCitizenIds.filter((id) => {
      const c = citizens.get(id);
      return c && (c.stage === AgeStage.CHILD || c.stage === AgeStage.STUDENT);
    });
  }

  // Enroll children and students into nearest school with capacity
  const eligibleCitizens = Array.from(citizens.values()).filter(
    (c) => (c.stage === AgeStage.CHILD || c.stage === AgeStage.STUDENT) && !c.school,
  );

  for (const student of eligibleCitizens) {
    let nearestSchool: SchoolFacility | null = null;
    let minDistance = Infinity;

    for (const facility of schools.values()) {
      if (facility.enrolledCitizenIds.length < facility.capacity) {
        // Distance calculation from student's home residence
        const dist = student.residence
          ? Math.abs(facility.tileX - student.residence.x) + Math.abs(facility.tileY - student.residence.y)
          : 10;
        if (dist < minDistance) {
          minDistance = dist;
          nearestSchool = facility;
        }
      }
    }

    if (nearestSchool) {
      nearestSchool.enrolledCitizenIds.push(student.id);
      student.school = { x: nearestSchool.tileX, y: nearestSchool.tileY };
    }
  }

  // Simulate education progression for enrolled citizens
  let totalEnrolled = 0;
  for (const facility of schools.values()) {
    totalEnrolled += facility.enrolledCitizenIds.length;
    for (const id of facility.enrolledCitizenIds) {
      const citizen = citizens.get(id);
      if (!citizen) continue;

      // School boosts education tier over time
      if (citizen.stage === AgeStage.CHILD && citizen.education === EducationLevel.UNEDUCATED && citizen.age >= 16) {
        citizen.education = EducationLevel.HIGH_SCHOOL;
      } else if (citizen.stage === AgeStage.STUDENT && citizen.education === EducationLevel.HIGH_SCHOOL && citizen.age >= 21) {
        citizen.education = EducationLevel.UNIVERSITY;
      }
    }
  }

  return {
    totalCapacity,
    totalEnrolled,
    schoolCount: schools.size,
  };
}
