import { TileData } from './types';
import { MapPreset, REGION_SIZE } from './mapGenerator';
import { createTile } from './types';

export interface WorldRegionChunk {
  key: string;
  rx: number;
  ry: number;
  seed: number;
  tiles: TileData[][];
}

function hash(seed: number, x: number, y: number): number {
  let value = (seed ^ Math.imul(x + 31, 0x45d9f3b) ^ Math.imul(y + 17, 0x119de1f3)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

/** Generates a deterministic chunk outside the original 3×3 starter map. */
export function generateRegionChunk(seed: number, rx: number, ry: number, preset: MapPreset = 'flatlands'): WorldRegionChunk {
  const tiles: TileData[][] = [];
  for (let localY = 0; localY < REGION_SIZE; localY += 1) {
    const row: TileData[] = [];
    for (let localX = 0; localX < REGION_SIZE; localX += 1) {
      const x = rx * REGION_SIZE + localX;
      const y = ry * REGION_SIZE + localY;
      const terrain = hash(seed, x, y);
      const ridge = hash(seed + 97, Math.floor(x / 3), Math.floor(y / 3));
      const elevation = preset === 'highland'
        ? Math.round(4 + ridge * 6)
        : preset === 'river_valley'
          ? Math.round(Math.min(8, 1 + Math.abs(localX - REGION_SIZE / 2) * 0.45 + ridge * 2))
          : Math.round(ridge * 5);
      const water = preset === 'coastal_plains'
        ? localY > REGION_SIZE * 0.72 && terrain < 0.45
        : preset === 'river_valley'
          ? Math.abs(localX - REGION_SIZE / 2 + Math.sin(y * 0.18) * 2) < 1.5
          : terrain < 0.08;
      const resource = water
        ? 'none'
        : elevation >= 5 && terrain > 0.74
          ? 'ore'
          : terrain > 0.82
            ? 'forest'
            : elevation <= 2 && terrain > 0.58
              ? 'fertile'
              : 'none';
      row.push(createTile(x, y, { elevation, water, resource }));
    }
    tiles.push(row);
  }
  return { key: `${rx},${ry}`, rx, ry, seed, tiles };
}

export function regionChunkToWorldCoordinates(chunk: WorldRegionChunk): [number, number] {
  return [chunk.rx * REGION_SIZE, chunk.ry * REGION_SIZE];
}

export function getStreamingRegionKeys(center: { rx: number; ry: number }, radius = 1): string[] {
  const keys: string[] = [];
  for (let ry = center.ry - radius; ry <= center.ry + radius; ry += 1) {
    for (let rx = center.rx - radius; rx <= center.rx + radius; rx += 1) keys.push(`${rx},${ry}`);
  }
  return keys;
}
