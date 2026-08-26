/**
 * Deterministic Seeded Pseudo-Random Number Generator (Mulberry32).
 * Guarantees identical simulation outcomes across executions for a given city seed.
 */
export class SeededRandom {
  private s: number;

  constructor(seed: number = 1337) {
    this.s = seed >>> 0;
  }

  /**
   * Generates a deterministic pseudo-random float in the range [0, 1)
   */
  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates a deterministic integer between min and max (inclusive)
   */
  public nextInt(min: number, max: number): number {
    const floorMin = Math.ceil(min);
    const floorMax = Math.floor(max);
    return Math.floor(this.next() * (floorMax - floorMin + 1)) + floorMin;
  }

  /**
   * Generates a deterministic float between min and max
   */
  public nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Returns true with a given probability (0.0 to 1.0)
   */
  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  /**
   * Picks a random item from an array deterministically
   */
  public pick<T>(array: readonly T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Shuffles an array in place using Fisher-Yates deterministically
   */
  public shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * Creates a sub-stream PRNG deterministically derived from current state
   */
  public fork(tag = 0): SeededRandom {
    const subSeed = (this.s ^ (tag * 0x9e3779b9) ^ (this.nextInt(0, 0x7fffffff))) >>> 0;
    return new SeededRandom(subSeed);
  }

  public getSeed(): number {
    return this.s;
  }

  public setSeed(seed: number): void {
    this.s = seed >>> 0;
  }
}
