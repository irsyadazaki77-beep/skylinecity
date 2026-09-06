import { TileData, TileType } from './types';

export type ConstructionStage =
  | 'EMPTY_LOT'
  | 'SITE_PREPARATION'
  | 'PREPARATION'
  | 'FOUNDATION'
  | 'FRAME'
  | 'STRUCTURE'
  | 'FACADE'
  | 'FINISHING'
  | 'OCCUPIED'
  | 'RENOVATING'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'DAMAGED';

/** Maps persisted simulation fields to a deterministic renderer state. */
export function getConstructionStage(tile: TileData): ConstructionStage {
  if (tile.type === TileType.EMPTY) return 'EMPTY_LOT';
  if (![TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.OFFICE, TileType.INDUSTRIAL].includes(tile.type)) return 'COMPLETED';
  if ((tile.disasterImpact ?? 0) >= 40) return 'DAMAGED';
  if (tile.abandoned) return 'ABANDONED';

  const occupied = tile.type === TileType.RESIDENTIAL ? tile.population > 0 : tile.jobs > 0;
  const progress = Math.max(0, Math.min(100, tile.upgradeProgress ?? 0));

  // Upgrades of existing occupied buildings show as active renovation
  if (occupied && progress > 0 && progress < 100) {
    return 'RENOVATING';
  }

  // New construction lifecycle progression
  if (progress >= 88) return 'FINISHING';
  if (progress >= 70) return 'FACADE';
  if (progress >= 45) return 'STRUCTURE';
  if (progress >= 30) return 'FRAME';
  if (progress > 0) return 'FOUNDATION';

  if (!occupied && (tile.parcelStatus === 'ZONED' || tile.parcelOwnership !== 'PRIVATE')) {
    return 'SITE_PREPARATION';
  }

  return occupied ? 'OCCUPIED' : 'COMPLETED';
}

/** Human-readable label for construction and upgrade stages. */
export function getConstructionStageLabel(stage: ConstructionStage, lang: 'id' | 'en' = 'id'): string {
  const labels: Record<ConstructionStage, { id: string; en: string }> = {
    EMPTY_LOT: { id: 'Tanah Kosong', en: 'Empty Lot' },
    SITE_PREPARATION: { id: 'Persiapan Lahan', en: 'Site Preparation' },
    PREPARATION: { id: 'Persiapan Lahan', en: 'Site Preparation' },
    FOUNDATION: { id: 'Pondasi Beton', en: 'Foundation' },
    FRAME: { id: 'Rangka Struktur', en: 'Structural Framing' },
    STRUCTURE: { id: 'Konstruksi Bangunan', en: 'Structure Building' },
    FACADE: { id: 'Pemasangan Fasad', en: 'Facade Cladding' },
    FINISHING: { id: 'Penyelesaian Interior', en: 'Finishing Works' },
    OCCUPIED: { id: 'Dihuni / Beroperasi', en: 'Occupied' },
    RENOVATING: { id: 'Renovasi Peningkatan', en: 'Renovating / Upgrading' },
    COMPLETED: { id: 'Selesai Dibangun', en: 'Completed' },
    ABANDONED: { id: 'Terbengkalai', en: 'Abandoned' },
    DAMAGED: { id: 'Rusak Terdampak', en: 'Damaged' },
  };
  return labels[stage]?.[lang] ?? stage;
}
