import { GAME_CONFIG } from './config';
import { ActiveTool, CityState, TileType } from './types';
import { hasActivePower, hasActiveWater, hasLocalHighwayConnection } from './tutorialFlow';

export type CoreLoopAction =
  | { kind: 'SPEED'; speed: 1 | 2 }
  | { kind: 'TOOL'; tool: ActiveTool }
  | { kind: 'CITY_INFO' }
  | { kind: 'TREASURY' }
  | { kind: 'FOCUS_DIAGNOSTIC'; location: { x: number; y: number } }
  | { kind: 'OBJECTIVES' };

export interface CoreLoopAdvice {
  id: string;
  phase: 'BUILD' | 'CONNECT' | 'GROW' | 'DIAGNOSE' | 'PROGRESS';
  title: string;
  description: string;
  actionLabel: string;
  action: CoreLoopAction;
  tone: 'cyan' | 'emerald' | 'amber' | 'rose';
}

function tileCount(state: CityState, type: TileType): number {
  return state.grid.flat().filter((tile) => tile.type === type).length;
}

/** Returns one actionable next step for the first-time city-builder loop. */
export function getCoreLoopAdvice(state: CityState, speed: number): CoreLoopAdvice {
  const critical = (state.causalDiagnostics ?? []).find((item) => item.severity === 'CRITICAL');
  if (critical) {
    return {
      id: `diagnostic-${critical.id}`,
      phase: 'DIAGNOSE',
      title: critical.title,
      description: critical.explanation,
      actionLabel: critical.location ? 'Fokus masalah' : 'Buka analisis',
      action: critical.location ? { kind: 'FOCUS_DIAGNOSTIC', location: critical.location } : { kind: 'CITY_INFO' },
      tone: 'rose',
    };
  }

  // Only the authored starter map has a regional highway target. Generic
  // sandbox/test maps retain the normal build/speed ordering.
  const hasRegionalHighway = state.grid.flat().some((tile) => tile.type === TileType.ROAD && tile.roadClass === 'HIGHWAY');
  if (!hasRegionalHighway && speed === 0 && state.day <= 1) {
    return {
      id: 'start-simulation', phase: 'GROW', title: 'Jalankan simulasi',
      description: 'Kota sedang jeda. Jalankan satu siklus untuk melihat jaringan dan permintaan bekerja.',
      actionLabel: 'Mulai waktu (1×)', action: { kind: 'SPEED', speed: 1 }, tone: 'cyan',
    };
  }
  if (hasRegionalHighway && !hasLocalHighwayConnection(state.grid)) {
    return {
      id: 'connect-road',
      phase: 'BUILD',
      title: 'Bangun koneksi jalan',
      description: 'Jalan adalah backbone untuk bangunan, utilitas, warga, dan layanan darurat.',
      actionLabel: 'Pilih jalan',
      action: { kind: 'TOOL', tool: TileType.ROAD },
      tone: 'amber',
    };
  }

  const powerActive = hasActivePower(state);
  const waterActive = hasActiveWater(state);
  const hasPowerPlant = state.grid.flat().some((tile) => tile.type === TileType.POWER_PLANT);
  const hasWaterPump = state.grid.flat().some((tile) => tile.type === TileType.WATER_PUMP);

  if (!powerActive) {
    if (hasPowerPlant) {
      return {
        id: 'connect-power',
        phase: 'CONNECT',
        title: 'Sambungkan listrik ke jalan',
        description: 'Pembangkit listrik sudah ada namun belum terhubung ke jalan. Hubungkan jalan ke sisi pembangkit listrik.',
        actionLabel: 'Pilih jalan',
        action: { kind: 'TOOL', tool: TileType.ROAD },
        tone: 'cyan',
      };
    }
    return {
      id: 'connect-power',
      phase: 'CONNECT',
      title: 'Sediakan listrik',
      description: 'Bangunan yang tidak mendapat daya tidak akan berkembang.',
      actionLabel: 'Pilih pembangkit listrik',
      action: { kind: 'TOOL', tool: TileType.POWER_PLANT },
      tone: 'cyan',
    };
  }

  if (!waterActive) {
    if (hasWaterPump) {
      return {
        id: 'connect-water',
        phase: 'CONNECT',
        title: 'Sambungkan pompa air',
        description: 'Pompa air harus menyentuh tepi air dan terhubung ke jalan agar air bersih mengalir.',
        actionLabel: 'Pilih jalan',
        action: { kind: 'TOOL', tool: TileType.ROAD },
        tone: 'cyan',
      };
    }
    return {
      id: 'connect-water',
      phase: 'CONNECT',
      title: 'Sediakan air bersih',
      description: 'Pompa air harus terhubung ke jaringan jalan agar cakupan aktif.',
      actionLabel: 'Pilih pompa air',
      action: { kind: 'TOOL', tool: TileType.WATER_PUMP },
      tone: 'cyan',
    };
  }

  if (tileCount(state, TileType.RESIDENTIAL) < 4) {
    return {
      id: 'zone-residential',
      phase: 'BUILD',
      title: 'Buat rumah untuk warga',
      description: 'Mulai dengan beberapa zona hunian rendah di sisi jalan yang sudah tersambung.',
      actionLabel: 'Pilih hunian',
      action: { kind: 'TOOL', tool: TileType.RESIDENTIAL },
      tone: 'emerald',
    };
  }

  if (tileCount(state, TileType.COMMERCIAL) + tileCount(state, TileType.INDUSTRIAL) < 2) {
    return {
      id: 'zone-jobs',
      phase: 'BUILD',
      title: 'Buat lapangan kerja',
      description: 'Tambahkan zona komersial atau industri agar warga punya pekerjaan dan kota punya pemasukan.',
      actionLabel: 'Pilih komersial',
      action: { kind: 'TOOL', tool: TileType.COMMERCIAL },
      tone: 'amber',
    };
  }

  if (speed === 0 && state.day <= 1) {
    return {
      id: 'start-simulation',
      phase: 'GROW',
      title: 'Jalankan simulasi',
      description: 'Kota sedang jeda. Jalankan satu siklus untuk melihat jaringan dan permintaan bekerja.',
      actionLabel: 'Mulai waktu (1×)',
      action: { kind: 'SPEED', speed: 1 },
      tone: 'cyan',
    };
  }

  if (state.population < 25) {
    return {
      id: 'grow-town',
      phase: 'GROW',
      title: 'Tumbuhkan kota ke 25 warga',
      description: 'Biarkan beberapa hari berjalan, lalu gunakan inspector jika ada bangunan yang mandek.',
      actionLabel: speed === 0 ? 'Mulai waktu (1×)' : 'Buka Info Kota',
      action: speed === 0 ? { kind: 'SPEED', speed: 1 } : { kind: 'CITY_INFO' },
      tone: 'emerald',
    };
  }

  if (state.money < GAME_CONFIG.LOW_TREASURY_THRESHOLD || (state.operatingBudget ?? state.income - state.expenses) < 0) {
    return {
      id: 'stabilize-budget',
      phase: 'DIAGNOSE',
      title: 'Stabilkan anggaran kota',
      description: 'Arus kas sedang tertekan. Periksa biaya perawatan, pajak, dan pemanfaatan sebelum ekspansi.',
      actionLabel: 'Buka kas kota',
      action: { kind: 'TREASURY' },
      tone: 'rose',
    };
  }

  return {
    id: 'next-milestone',
    phase: 'PROGRESS',
    title: 'Siapkan milestone berikutnya',
    description: 'Periksa tujuan dan pilih investasi yang paling memperkuat spesialisasi kota.',
    actionLabel: 'Buka tujuan',
    action: { kind: 'OBJECTIVES' },
    tone: 'cyan',
  };
}
