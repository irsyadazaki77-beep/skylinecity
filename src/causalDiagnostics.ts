import { CausalDiagnostic, CityState, TileData, TileType } from './types';
import { RESIDENTIAL_CAPACITIES } from './depthSimulation';
import { getResidentialCapacity } from './zoning';

function findDefaultLocation(state: CityState): { x: number; y: number } {
  // Cari bangunan apapun, jalan, atau default tengah grid
  for (let y = 0; y < state.grid.length; y++) {
    for (let x = 0; x < state.grid[y].length; x++) {
      if (state.grid[y][x].type !== TileType.EMPTY && !state.grid[y][x].water) {
        return { x, y };
      }
    }
  }
  return { x: Math.floor((state.grid[0]?.length ?? 1) / 2), y: Math.floor((state.grid.length ?? 1) / 2) };
}

export function calculateCausalDiagnostics(state: CityState): CausalDiagnostic[] {
  const diagnostics: CausalDiagnostic[] = [];
  const day = state.day;
  const defaultLoc = findDefaultLocation(state);

  const add = (diagnostic: Omit<CausalDiagnostic, 'id' | 'day'>) => {
    diagnostics.push({
      ...diagnostic,
      id: `${diagnostic.category.toLowerCase()}-${diagnostics.length + 1}-${day}`,
      day,
      location: diagnostic.location ?? defaultLoc,
      estimatedCost: diagnostic.estimatedCost ?? 0,
      cause: diagnostic.cause ?? diagnostic.explanation,
      projectedImpact: diagnostic.projectedImpact ?? 'Meningkatkan stabilitas dan efisiensi kota',
    });
  };

  const flatGrid = state.grid.flat();

  // 1. Stalled growth: R/C/I/O unpowered or unwatered
  const stalledTile = flatGrid.find(
    (tile) =>
      [TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.INDUSTRIAL, TileType.OFFICE].includes(tile.type) &&
      (!tile.powered || !tile.watered),
  );
  if (stalledTile) {
    if (!stalledTile.watered) {
      add({
        category: 'BUILDING',
        severity: 'WARNING',
        title: 'Bangunan belum dapat tumbuh',
        cause: 'Pasokan air belum menjangkau petak ini',
        explanation: 'Bangunan tidak tumbuh karena belum terhubung air.',
        recommendation: 'Bangun pompa air atau hubungkan jaringan pipa ke petak ini.',
        value: 1,
        threshold: 0,
        location: { x: stalledTile.x, y: stalledTile.y },
        estimatedCost: 100,
        projectedImpact: 'Mengaktifkan utilitas air agar bangunan dapat berkembang',
      });
    } else {
      add({
        category: 'BUILDING',
        severity: 'WARNING',
        title: 'Bangunan belum dapat tumbuh',
        cause: 'Pasokan listrik belum menjangkau petak ini',
        explanation: 'Bangunan tidak tumbuh karena belum terhubung listrik.',
        recommendation: 'Bangun pembangkit listrik atau hubungkan jaringan listrik ke petak ini.',
        value: 1,
        threshold: 0,
        location: { x: stalledTile.x, y: stalledTile.y },
        estimatedCost: 150,
        projectedImpact: 'Mengalirkan daya listrik agar aktivitas bangunan berjalan',
      });
    }
  }

  // 2. Population loss / Emigration
  const lastPop = state.history?.[state.history.length - 1]?.population ?? state.population;
  const isLosingPop = (state.history?.length ?? 0) > 0 && lastPop > state.population;
  const emigrationCount = state.demographics?.migration.emigrants ?? 0;
  if (isLosingPop || state.primaryEmigrationReason === 'COMMUTE_TOO_LONG' || emigrationCount > 5) {
    const resTile = flatGrid.find((tile) => tile.type === TileType.RESIDENTIAL) ?? defaultLoc;
    add({
      category: 'POPULATION',
      severity: 'WARNING',
      title: 'Warga meninggalkan kota',
      cause: 'Waktu perjalanan kerja terlalu lama dan beban sewa menekan warga',
      explanation: 'Warga pergi karena sewa tinggi dan commute terlalu lama.',
      recommendation: 'Perbaiki koridor jalan, tambah jalur transit, dan seimbangkan pasokan perumahan.',
      value: emigrationCount || 1,
      threshold: 0,
      location: { x: resTile.x, y: resTile.y },
      estimatedCost: 200,
      projectedImpact: 'Menstabilkan populasi dan kepuasan warga',
    });
  }

  // 3. Unemployment
  if (state.unemploymentRate > 12) {
    const resTile = flatGrid.find((tile) => tile.type === TileType.RESIDENTIAL) ?? defaultLoc;
    add({
      category: 'POPULATION',
      severity: 'WARNING',
      title: 'Pengangguran meningkat',
      cause: 'Kapasitas pekerjaan aktif di sektor komersial, industri, atau kantor lebih rendah dari angkatan kerja',
      explanation: 'Jumlah warga yang mencari kerja lebih besar daripada kapasitas pekerjaan aktif.',
      recommendation: 'Periksa tingkatan pekerjaan dan tambahkan sektor yang sesuai dengan pendidikan warga.',
      value: state.unemploymentRate,
      threshold: 12,
      location: { x: resTile.x, y: resTile.y },
      estimatedCost: 100,
      projectedImpact: 'Menciptakan lapangan kerja baru dan menurunkan angka pengangguran',
    });
  }

  // A small city can be healthy yet stop growing simply because every
  // residential lot is full. Surface the missing player action explicitly so
  // the path to the 25-resident Town milestone is understandable.
  const residentialTiles = flatGrid.filter((tile) => tile.type === TileType.RESIDENTIAL);
  const residentialCapacity = residentialTiles.reduce((sum, tile) => {
    const level = Math.min(5, Math.max(1, tile.level));
    return sum + getResidentialCapacity(tile, RESIDENTIAL_CAPACITIES[level]);
  }, 0);
  if (state.population < 25 && (state.residentialDemand ?? 0) > 10 && residentialTiles.length > 0 && residentialCapacity <= state.population + 1) {
    const target = flatGrid.find((tile) => tile.type === TileType.EMPTY && !tile.water && [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => state.grid[tile.y + dy]?.[tile.x + dx]?.type === TileType.ROAD))
      ?? residentialTiles[0]
      ?? defaultLoc;
    add({
      category: 'POPULATION',
      severity: 'INFO',
      title: 'Kapasitas hunian mencapai batas',
      cause: 'Demand perumahan masih positif, tetapi semua lot hunian yang aktif hampir penuh',
      explanation: 'Populasi berhenti sebelum milestone Kota Kecil karena tidak ada kapasitas rumah kosong.',
      recommendation: 'Tambah zona hunian di sisi jalan yang menerima listrik dan air; lanjutkan simulasi setelah membangunnya.',
      value: residentialCapacity,
      threshold: 25,
      location: { x: target.x, y: target.y },
      estimatedCost: 60,
      projectedImpact: 'Membuka kapasitas untuk melewati milestone Kota Kecil 25 warga',
    });
  }

  // 4. Commute time
  if ((state.averageCommuteTime ?? 0) > 25) {
    const roadTile = flatGrid.find((tile) => tile.type === TileType.ROAD) ?? defaultLoc;
    add({
      category: 'TRAFFIC',
      severity: 'WARNING',
      title: 'Waktu commute tinggi',
      cause: 'Jarak perjalanan tempat tinggal dan tempat kerja terlalu jauh atau kapasitas jalan terbatas',
      explanation: 'Perjalanan kerja terlalu lama; periksa tekanan antrean, kapasitas jalan, dan cakupan transit.',
      recommendation: 'Cari koridor dengan tekanan antrean tertinggi lalu tambahkan jalan arteri atau transit.',
      value: state.averageCommuteTime ?? 0,
      threshold: 25,
      location: { x: roadTile.x, y: roadTile.y },
      estimatedCost: 250,
      projectedImpact: 'Mengurangi waktu perjalanan warga menuju tempat kerja',
    });
  }

  // 5. Congestion / Koridor metropolitan jenuh
  if ((state.congestionIndex ?? 0) > 50) {
    const worstRoad = flatGrid
      .filter((tile) => tile.type === TileType.ROAD)
      .sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0))[0];
    const loc = worstRoad ? { x: worstRoad.x, y: worstRoad.y } : defaultLoc;
    add({
      category: 'TRAFFIC',
      severity: 'CRITICAL',
      title: 'Koridor metropolitan jenuh',
      cause: 'Volume kendaraan melebihi kapasitas koridor jalan utama',
      explanation: 'Kemacetan sudah memengaruhi perjalanan, angkutan barang, dan waktu respons layanan.',
      recommendation: 'Aktifkan lapisan lalu lintas dan tangani simpang dengan beban lajur tertinggi.',
      value: state.congestionIndex ?? 0,
      threshold: 50,
      location: loc,
      estimatedCost: 300,
      projectedImpact: 'Mengurangi kemacetan dan memperlancar arus kendaraan',
    });
  }

  // 6. Market health
  if ((state.marketHealth ?? 100) < 45) {
    const commTile = flatGrid.find((tile) => tile.type === TileType.COMMERCIAL) ?? defaultLoc;
    add({
      category: 'ECONOMY',
      severity: 'WARNING',
      title: 'Kesehatan pasar melemah',
      cause: 'Pasokan komoditas barang dagang dan keandalan logistik terhambat',
      explanation: 'Supply barang dan reliability logistik tidak cukup untuk memenuhi permintaan kota.',
      recommendation: 'Periksa stok komoditas dan pastikan gudang serta akses kargo terhubung.',
      value: state.marketHealth ?? 0,
      threshold: 45,
      location: { x: commTile.x, y: commTile.y },
      estimatedCost: 150,
      projectedImpact: 'Menyehatkan sirkulasi barang dan pendapatan usaha komersial',
    });
  }

  // 7. Office vacancy
  if ((state.officeUtilization ?? 1) < 0.72 && (state.officeDemand ?? 0) > 0) {
    const offTile = flatGrid.find((tile) => tile.type === TileType.OFFICE) ?? defaultLoc;
    add({
      category: 'ECONOMY',
      severity: 'WARNING',
      title: 'Kantor kurang terisi',
      cause: 'Tingkat pendidikan warga atau akses transit belum memenuhi syarat perkantoran',
      explanation: 'Permintaan pekerjaan berpengetahuan belum seimbang dengan pasokan kantor. Naikkan pendidikan, akses transit, atau buka kawasan perkantoran dekat pusat aktivitas.',
      recommendation: 'Prioritaskan pendidikan dan transit sebelum menambah pasokan perkantoran.',
      value: Math.round((state.officeUtilization ?? 0) * 100),
      threshold: 72,
      location: { x: offTile.x, y: offTile.y },
      estimatedCost: 200,
      projectedImpact: 'Meningkatkan okupansi kantor dan produktivitas sektor jasa',
    });
  }

  // 8. Production shortage
  if ((state.productionEfficiency ?? 1) < 0.8) {
    const indTile = flatGrid.find((tile) => tile.type === TileType.INDUSTRIAL) ?? defaultLoc;
    add({
      category: 'ECONOMY',
      severity: 'WARNING',
      title: 'Input industri kurang',
      cause: 'Rantai pasok material mentah dan bahan bakar ke pabrik mengalami kelangkaan',
      explanation: 'Rantai produksi kehilangan MATERIALS/FUEL atau akses angkutan barang. Tambahkan jalan tol, gudang, terminal kargo, atau kontrak impor yang sesuai.',
      recommendation: 'Cari komoditas dengan kekurangan terbesar dan tambahkan kapasitas input.',
      value: Math.round((state.productionEfficiency ?? 0) * 100),
      threshold: 80,
      location: { x: indTile.x, y: indTile.y },
      estimatedCost: 250,
      projectedImpact: 'Memulihkan kapasitas produksi pabrik manufaktur',
    });
  }

  // 9. Import contracts
  if ((state.tradeImportCapacity ?? 0) > 0 && (state.freightReliability ?? 100) < 65) {
    const cargoTile = flatGrid.find((tile) => tile.type === TileType.INDUSTRIAL || tile.type === TileType.COMMERCIAL) ?? defaultLoc;
    add({
      category: 'ECONOMY',
      severity: 'WARNING',
      title: 'Kontrak import belum efektif',
      cause: 'Akses jalan menuju pergudangan dan terminal kargo menghambat distribusi import',
      explanation: 'Kapasitas kontrak tersedia, tetapi jaringan jalan, gudang, atau distribusi lokal masih menahan keandalan angkutan barang.',
      recommendation: 'Perbaiki akses jalan antara terminal, gudang, dan kawasan komersial.',
      value: state.freightReliability ?? 0,
      threshold: 65,
      location: { x: cargoTile.x, y: cargoTile.y },
      estimatedCost: 180,
      projectedImpact: 'Meningkatkan keandalan pengiriman komoditas import',
    });
  }

  // 10. Wildfire risk
  if ((state.climateFireRisk ?? 1) > 1.35) {
    const parkTile = flatGrid.find((tile) => tile.type === TileType.PARK || tile.type === TileType.RESIDENTIAL) ?? defaultLoc;
    add({
      category: 'ENVIRONMENT',
      severity: 'WARNING',
      title: 'Risiko kebakaran iklim meningkat',
      cause: 'Kondisi cuaca kering dan gelombang panas meningkatkan potensi kebakaran',
      explanation: 'Cuaca panas/kering menaikkan risiko wildfire. Periksa coverage pemadam, water reserve, dan kepadatan bangunan.',
      recommendation: 'Siapkan water reserve dan tambah coverage pemadam di tepi kota.',
      value: state.climateFireRisk ?? 1,
      threshold: 1.35,
      location: { x: parkTile.x, y: parkTile.y },
      estimatedCost: 200,
      projectedImpact: 'Melindungi kawasan pemukiman dari bahaya kebakaran lahan',
    });
  }

  // 11. Operating budget deficit
  if ((state.income ?? 0) < (state.expenses ?? 0)) {
    add({
      category: 'ECONOMY',
      severity: 'CRITICAL',
      title: 'Anggaran operasional negatif',
      cause: 'Biaya pemeliharaan fasilitas kota melebihi pemasukan pajak harian',
      explanation: 'Pengeluaran harian melebihi pendapatan. Tunda ekspansi atau ubah pajak dan prioritas layanan.',
      recommendation: 'Hentikan ekspansi, cek biaya perawatan terbesar, lalu stabilkan anggaran operasional.',
      value: state.income - state.expenses,
      threshold: 0,
      location: defaultLoc,
      estimatedCost: 0,
      projectedImpact: 'Menghindarkan kas kota dari ancaman kebangkrutan',
    });
  }

  // 12. Service response quality weakened
  if ((state.serviceResponseQuality ?? 100) < 60) {
    // Cari tile dengan response time tertinggi atau service facility
    const delayedTile = flatGrid.find(
      (tile) => tile.serviceResponseTimes && Object.values(tile.serviceResponseTimes).some((t) => t > 15),
    );
    const serviceTile = delayedTile ?? flatGrid.find((tile) =>
      [TileType.FIRE_STATION, TileType.POLICE_STATION, TileType.CLINIC].includes(tile.type),
    ) ?? defaultLoc;
    add({
      category: 'SERVICES',
      severity: 'CRITICAL',
      title: 'Respons layanan melemah',
      cause: 'Keterlambatan armada darurat akibat kemacetan atau antrean depot',
      explanation: 'Kemacetan, kapasitas fasilitas, atau kondisi depo membuat layanan darurat terlambat.',
      recommendation: 'Buka lapisan respons dan prioritaskan fasilitas dengan antrean atau kondisi depo terburuk.',
      value: state.serviceResponseQuality ?? 0,
      threshold: 60,
      location: { x: serviceTile.x, y: serviceTile.y },
      estimatedCost: 400,
      projectedImpact: 'Mempercepat waktu tanggap darurat dan keselamatan warga',
    });
  }

  // 13. Transit lines without residential catchment
  if (state.transitLines && state.transitLines.length > 0) {
    const emptyLine = state.transitLines.find((line) => {
      if (!line.active) return false;
      const hasCatchment = line.stops.some(([sx, sy]) => {
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const tx = sx + dx;
            const ty = sy + dy;
            if (tx >= 0 && tx < (state.grid[0]?.length ?? 0) && ty >= 0 && ty < state.grid.length) {
              if (state.grid[ty][tx].type === TileType.RESIDENTIAL) return true;
            }
          }
        }
        return false;
      });
      return !hasCatchment;
    });

    if (emptyLine) {
      add({
        category: 'TRAFFIC',
        severity: 'WARNING',
        title: `Jalur ${emptyLine.name} sepi penumpang`,
        cause: 'Rute transit tidak memiliki halte di dekat permukiman warga',
        explanation: 'Jalur transit ini sepi karena pemberhentian tidak menjangkau area hunian.',
        recommendation: 'Pindahkan atau tambahkan pemberhentian transit di area dengan kepadatan permukiman.',
        value: emptyLine.stops.length,
        threshold: 1,
        location: { x: emptyLine.stops[0][0], y: emptyLine.stops[0][1] },
        estimatedCost: 80,
        projectedImpact: 'Menaikkan jumlah penumpang angkutan umum dan mengurai kepadatan lalu lintas',
      });
    }
  }

  // 14. Pollution
  if ((state.pollutionAverage ?? 0) > 35) {
    const pollTile = flatGrid.find((tile) => (tile.pollution ?? 0) > 30) ?? defaultLoc;
    add({
      category: 'ENVIRONMENT',
      severity: 'WARNING',
      title: 'Polusi kota tinggi',
      cause: 'Emisi dari zona industri berat dan kepadatan kendaraan bermotor',
      explanation: 'Industri, lalu lintas, dan tata guna lahan menurunkan kesehatan serta daya tarik kota.',
      recommendation: 'Pisahkan industri dari hunian dan tambahkan penyangga hijau atau transit.',
      value: state.pollutionAverage ?? 0,
      threshold: 35,
      location: { x: pollTile.x, y: pollTile.y },
      estimatedCost: 200,
      projectedImpact: 'Meningkatkan indeks kesehatan lingkungan dan kenyamanan hunian',
    });
  }

  // 15. Abandoned building
  const abandoned = flatGrid.find((tile) => tile.abandoned && [TileType.RESIDENTIAL, TileType.COMMERCIAL, TileType.INDUSTRIAL].includes(tile.type));
  if (abandoned) {
    add({
      category: 'BUILDING',
      severity: 'WARNING',
      title: 'Bangunan terbengkalai',
      cause: 'Kekurangan utilitas pokok, keterisolasian jalan, atau dampak bencana',
      explanation: 'Periksa listrik, air, akses jalan, permintaan, dampak bencana, dan kualitas lingkungan di lokasi ini.',
      recommendation: 'Fokus pada petak ini untuk melihat penyebab bangunan terbengkalai secara langsung.',
      value: 1,
      location: { x: abandoned.x, y: abandoned.y },
      estimatedCost: 50,
      projectedImpact: 'Mengembalikan fungsi petak agar kembali produktif',
    });
  }

  // 16. Housing rent pressure
  const housingPressure = flatGrid.find((tile) => tile.type === TileType.RESIDENTIAL && (tile.rentPressure ?? 0) >= 2.2);
  if (housingPressure) {
    add({
      category: 'BUILDING',
      severity: 'WARNING',
      title: 'Tekanan sewa perumahan',
      cause: 'Ketimpangan penawaran hunian terhadap tingginya minat warga tinggal',
      explanation: 'Sewa melebihi kemampuan rumah tangga di persil ini. Tambahkan kepadatan lebih tinggi, transit, cakupan layanan, atau pasokan hunian.',
      recommendation: 'Fokus pada persil ini dan pertimbangkan kepadatan sedang/tinggi dengan transit.',
      value: housingPressure.rentPressure ?? 0,
      threshold: 2.2,
      location: { x: housingPressure.x, y: housingPressure.y },
      estimatedCost: 150,
      projectedImpact: 'Meringankan beban biaya sewa hunian dan mencegah penggusuran warga',
    });
  }

  return diagnostics.slice(0, 12);
}
