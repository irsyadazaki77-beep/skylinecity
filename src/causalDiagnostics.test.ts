import { describe, expect, it } from 'vitest';
import { createEmptyGrid, createInitialCityState } from './engine';
import { calculateCausalDiagnostics } from './causalDiagnostics';
import { TileType } from './types';

describe('causal diagnostics', () => {
  it('explains office vacancy, production shortage, and rent pressure', () => {
    const state = createInitialCityState(createEmptyGrid(4, 4), 99);
    state.officeDemand = 30;
    state.officeUtilization = 0.4;
    state.productionEfficiency = 0.5;
    state.freightReliability = 55;
    state.tradeImportCapacity = 20;
    state.grid[1][1] = { ...state.grid[1][1], type: TileType.RESIDENTIAL, rentPressure: 2.5 };
    state.grid[1][2] = { ...state.grid[1][2], type: TileType.OFFICE };
    state.grid[2][1] = { ...state.grid[2][1], type: TileType.INDUSTRIAL };

    const diagnostics = calculateCausalDiagnostics(state);
    const titles = diagnostics.map((diagnostic) => diagnostic.title);

    expect(titles).toContain('Kantor kurang terisi');
    expect(titles).toContain('Input industri kurang');
    expect(titles).toContain('Tekanan sewa perumahan');
  });

  it('locates stalled growth, population loss, traffic, and delayed services', () => {
    const state = createInitialCityState(createEmptyGrid(4, 4), 99);
    state.grid[1][1] = { ...state.grid[1][1], type: TileType.RESIDENTIAL, powered: false, watered: true, traffic: 0 };
    state.grid[2][1] = { ...state.grid[2][1], type: TileType.ROAD, traffic: 90 };
    state.grid[1][2] = { ...state.grid[1][2], type: TileType.COMMERCIAL, powered: true, watered: true, serviceResponseTimes: { fire: 24 } };
    state.history = [{ day: 1, population: 30, money: state.money, income: 0, expenses: 0, happiness: 50 }];
    state.population = 15;
    state.congestionIndex = 60;
    state.serviceResponseQuality = 50;

    const diagnostics = calculateCausalDiagnostics(state);
    expect(diagnostics.find((item) => item.title === 'Bangunan belum dapat tumbuh')?.location).toEqual({ x: 1, y: 1 });
    expect(diagnostics.find((item) => item.title === 'Warga meninggalkan kota')).toBeTruthy();
    expect(diagnostics.find((item) => item.title === 'Koridor metropolitan jenuh')?.location).toEqual({ x: 1, y: 2 });
    expect(diagnostics.find((item) => item.title === 'Respons layanan melemah')?.location).toEqual({ x: 2, y: 1 });
  });

  it('answers the four causal questions: what happened, why, solution, and cost/impact', () => {
    const state = createInitialCityState(createEmptyGrid(4, 4), 99);
    state.grid[1][1] = { ...state.grid[1][1], type: TileType.RESIDENTIAL, powered: true, watered: false }; // missing water
    state.primaryEmigrationReason = 'COMMUTE_TOO_LONG';
    state.population = 20;

    const diagnostics = calculateCausalDiagnostics(state);

    const waterDiag = diagnostics.find((d) => d.title === 'Bangunan belum dapat tumbuh');
    expect(waterDiag).toBeTruthy();
    expect(waterDiag?.cause).toContain('air');
    expect(waterDiag?.explanation).toBe('Bangunan tidak tumbuh karena belum terhubung air.');
    expect(waterDiag?.recommendation).toBeTruthy();
    expect(waterDiag?.estimatedCost).toBeGreaterThan(0);
    expect(waterDiag?.projectedImpact).toBeTruthy();

    const emigDiag = diagnostics.find((d) => d.title === 'Warga meninggalkan kota');
    expect(emigDiag).toBeTruthy();
    expect(emigDiag?.explanation).toBe('Warga pergi karena sewa tinggi dan commute terlalu lama.');
    expect(emigDiag?.cause).toContain('perjalanan');
    expect(emigDiag?.recommendation).toBeTruthy();
    expect(emigDiag?.estimatedCost).toBeDefined();
    expect(emigDiag?.projectedImpact).toBeTruthy();
  });

  it('diagnoses transit lines that have no residential catchment', () => {
    const state = createInitialCityState(createEmptyGrid(10, 10), 99);
    state.transitLines = [
      {
        id: 'line-remote',
        name: 'Express 1',
        mode: 'BUS',
        stops: [[1, 1], [8, 8]],
        frequency: 8,
        active: true,
      },
    ];

    const diagnostics = calculateCausalDiagnostics(state);
    const transitDiag = diagnostics.find((d) => d.title.includes('sepi penumpang'));
    expect(transitDiag).toBeTruthy();
    expect(transitDiag?.explanation).toBe('Jalur transit ini sepi karena pemberhentian tidak menjangkau area hunian.');
    expect(transitDiag?.recommendation).toContain('pemberhentian transit');
    expect(transitDiag?.estimatedCost).toBe(80);
    expect(transitDiag?.projectedImpact).toContain('jumlah penumpang');
  });

  it('explains a positive-demand city that is stalled by full housing capacity', () => {
    const state = createInitialCityState(createEmptyGrid(5, 5), 99);
    state.population = 4;
    state.residentialDemand = 40;
    state.grid[2][1] = { ...state.grid[2][1], type: TileType.ROAD };
    state.grid[2][2] = { ...state.grid[2][2], type: TileType.RESIDENTIAL, level: 1, population: 4, powered: true, watered: true };

    const diagnostic = calculateCausalDiagnostics(state).find((item) => item.title === 'Kapasitas hunian mencapai batas');
    expect(diagnostic?.recommendation).toContain('Tambah zona hunian');
    expect(diagnostic?.location).toBeDefined();
  });

  it('guarantees that every generated diagnostic has complete causal fields and a valid focus location', () => {
    const state = createInitialCityState(createEmptyGrid(8, 8), 42);
    // Introduce multiple issues: stalled building, commute, congestion, market, unemployment
    state.grid[2][2] = { ...state.grid[2][2], type: TileType.RESIDENTIAL, powered: false, watered: false };
    state.grid[3][3] = { ...state.grid[3][3], type: TileType.COMMERCIAL, productivity: 0.2 };
    state.grid[4][4] = { ...state.grid[4][4], type: TileType.ROAD, traffic: 95 };
    state.congestionIndex = 75;
    state.unemploymentRate = 22;
    state.averageCommuteTime = 40;
    state.marketHealth = 30;
    state.income = 100;
    state.expenses = 300;
    state.serviceResponseQuality = 45;

    const diagnostics = calculateCausalDiagnostics(state);
    expect(diagnostics.length).toBeGreaterThan(0);

    for (const diag of diagnostics) {
      expect(diag.title).toBeTruthy();
      expect(diag.cause).toBeTruthy();
      expect(diag.explanation).toBeTruthy();
      expect(diag.recommendation).toBeTruthy();
      expect(typeof diag.estimatedCost).toBe('number');
      expect(diag.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(diag.projectedImpact).toBeTruthy();
      expect(diag.location).toBeDefined();
      expect(typeof diag.location?.x).toBe('number');
      expect(typeof diag.location?.y).toBe('number');
      expect(Number.isFinite(diag.location?.x)).toBe(true);
      expect(Number.isFinite(diag.location?.y)).toBe(true);
    }
  });
});
