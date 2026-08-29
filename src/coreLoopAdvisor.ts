import { GAME_CONFIG } from './config';
import { ActiveTool, CityState, TileType } from './types';

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

  if (speed === 0 && state.day <= 1) {
    return {
      id: 'start-simulation',
      phase: 'GROW',
      title: 'Jalankan simulasi',
      description: 'Kota sedang pause. Jalankan satu tick untuk melihat jaringan dan demand bekerja.',
      actionLabel: 'Mulai waktu (1×)',
      action: { kind: 'SPEED', speed: 1 },
      tone: 'cyan',
    };
  }

  if (tileCount(state, TileType.ROAD) < 8) {
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

  if (state.powerCapacity <= 0) {
    return {
      id: 'connect-power',
      phase: 'CONNECT',
      title: 'Sediakan listrik',
      description: 'Bangunan yang tidak mendapat daya tidak akan berkembang.',
      actionLabel: 'Pilih power plant',
      action: { kind: 'TOOL', tool: TileType.POWER_PLANT },
      tone: 'cyan',
    };
  }

  if (state.waterCapacity <= 0) {
    return {
      id: 'connect-water',
      phase: 'CONNECT',
      title: 'Sediakan air bersih',
      description: 'Pompa air harus terhubung ke jaringan jalan agar coverage aktif.',
      actionLabel: 'Pilih water pump',
      action: { kind: 'TOOL', tool: TileType.WATER_PUMP },
      tone: 'cyan',
    };
  }

  if (tileCount(state, TileType.RESIDENTIAL) < 4) {
    return {
      id: 'zone-residential',
      phase: 'BUILD',
      title: 'Buat rumah untuk warga',
      description: 'Mulai dengan beberapa lot Low Residential di sisi jalan yang sudah tersambung.',
      actionLabel: 'Pilih residential',
      action: { kind: 'TOOL', tool: TileType.RESIDENTIAL },
      tone: 'emerald',
    };
  }

  if (tileCount(state, TileType.COMMERCIAL) + tileCount(state, TileType.INDUSTRIAL) < 2) {
    return {
      id: 'zone-jobs',
      phase: 'BUILD',
      title: 'Buat lapangan kerja',
      description: 'Tambahkan commercial atau industrial agar warga punya pekerjaan dan kota punya pemasukan.',
      actionLabel: 'Pilih commercial',
      action: { kind: 'TOOL', tool: TileType.COMMERCIAL },
      tone: 'amber',
    };
  }

  if (state.population < 25) {
    return {
      id: 'grow-town',
      phase: 'GROW',
      title: 'Tumbuhkan kota ke 25 warga',
      description: 'Biarkan beberapa hari berjalan, lalu gunakan inspector jika ada bangunan yang mandek.',
      actionLabel: speed === 0 ? 'Mulai waktu (1×)' : 'Buka City Info',
      action: speed === 0 ? { kind: 'SPEED', speed: 1 } : { kind: 'CITY_INFO' },
      tone: 'emerald',
    };
  }

  if (state.money < GAME_CONFIG.LOW_TREASURY_THRESHOLD || (state.operatingBudget ?? state.income - state.expenses) < 0) {
    return {
      id: 'stabilize-budget',
      phase: 'DIAGNOSE',
      title: 'Stabilkan anggaran kota',
      description: 'Cash flow sedang tertekan. Periksa biaya upkeep, pajak, dan utilization sebelum ekspansi.',
      actionLabel: 'Buka treasury',
      action: { kind: 'TREASURY' },
      tone: 'rose',
    };
  }

  return {
    id: 'next-milestone',
    phase: 'PROGRESS',
    title: 'Siapkan milestone berikutnya',
    description: 'Periksa objective dan pilih investasi yang paling memperkuat spesialisasi kota.',
    actionLabel: 'Buka objectives',
    action: { kind: 'OBJECTIVES' },
    tone: 'cyan',
  };
}
