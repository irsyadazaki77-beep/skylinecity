# Skyline Simulator — baseline visual, 6 September 2026

Status: FASE 0 belum lolos performance gate. FASE 1–8 belum diimplementasikan. Tidak ada klaim visual acceptance atau pekerjaan selesai.

## Perubahan file dalam pekerjaan ini

- `visual-qa/capture.mjs`: capture build produksi pada tiga viewport, console warning/error, dan 120 interval requestAnimationFrame.
- `visual-qa/baseline-*.log`: hasil perintah baseline dan pengulangan benchmark tanpa capture browser.
- `visual-qa/baseline-browser.json`: hasil browser baseline.
- `visual-qa/before-1440x900.png`, `before-1280x720.png`, `before-393x851.png`: screenshot kota baru pada waktu awal 06:00, zoom 125%, pengaturan default.
- `visual-qa/REPORT.md`: laporan ini.

Source gameplay maupun source renderer tidak diubah. Workspace sudah memiliki banyak perubahan lokal, termasuk file utama render, sebelum pekerjaan ini dimulai; perubahan tersebut dipertahankan.

## Verifikasi

| Perintah | Hasil |
| --- | --- |
| npm run lint | Lulus, tidak ada diagnostic |
| npm test -- --run | 69 file, 285 test lulus |
| npm run build | Lulus, 17,19 detik |
| npm run smoke | PASS, 7 pemeriksaan termasuk save round-trip dan deterministic replay |
| npm run balance | Selesai; semua lima skenario tanpa bankruptcy; stress fixture happiness 0 sudah ditandai sebagai expected oleh runner |
| npm run benchmark | Gagal; pengukuran pertama terkontaminasi capture browser bersamaan |
| npm run benchmark, setelah browser selesai | Gagal hanya PERFORMANCE_100K, exit 1 |

### Benchmark ulang tanpa capture browser

Angka berikut adalah waktu tick simulasi, bukan waktu render atau FPS. Default CLI: 20 measured ticks per skenario, satu warm-up, dan replay deterministik.

| Skenario | p50 ms | p95 ms | Budget p95 ms | Gate |
| --- | ---: | ---: | ---: | --- |
| SMALL_TOWN | 29,3 | 45,9 | 50 | Lulus |
| CONGESTED_CORRIDOR | 18,2 | 27,6 | 50 | Lulus |
| INDUSTRIAL_CITY | 23,4 | 33,7 | 50 | Lulus |
| FLOOD_RECOVERY | 16,3 | 27,1 | 50 | Lulus |
| PERFORMANCE_100K | 107,0 | 129,6 | 120 | Gagal budget dan regresi |

Penyebab gate yang terverifikasi: stress p95 melewati budget 120 ms; p50 melewati pembanding committed baseline (61,5 × 1,35 + 8 = 91,025 ms). Penyebab utama kelambatan di source belum diprofilkan dan tidak boleh disimpulkan dari angka ini. Tidak ada kegagalan integrity gate yang dilaporkan; hash replay sama pada kedua eksekusi benchmark.

### Bundle produksi

| Chunk | Ukuran | Gzip |
| --- | ---: | ---: |
| City3DCanvas | 94,11 kB | 24,41 kB |
| Three.js | 1.119,54 kB | 310,86 kB |
| Main index JS | 452,90 kB | 137,15 kB |
| CSS | 102,57 kB | 17,14 kB |
| Simulation worker | 152,64 kB | tidak dilaporkan |

Build log tidak mencatat warning. Tidak ada test dihapus, lint dinonaktifkan, warning disembunyikan, atau dependency ditambahkan.

## Visual QA baseline

Ketiga screenshot telah dibuka dan diperiksa. Semua menampilkan kota, tanpa blank render. Ini QA initial view, bukan pengujian lengkap fitur interaksi.

| Viewport | Temuan |
| --- | --- |
| 1440×900 | Settlement terlihat di bagian tengah; sungai dan highway mengambil area besar. Shoreline bertangga, shallow water berupa petak, tanah memperlihatkan pola persegi dan bayangan keras. |
| 1280×720 | Settlement tetap terlihat, namun kecil dibanding konteks jalan dan air. Kekakuan coastline dan pola petak tetap jelas. |
| 393×851 | Render tersedia; panel tutorial menutupi bagian besar komposisi kota. Tidak ada UI dipindahkan/dihapus. |

Baseline RAF headless p50/p95: 366,6/799,9 ms (1440×900), 283,3/716,6 ms (1280×720), 66,7/100 ms (393×851). Angka ini tidak representatif untuk FPS GPU desktop atau perangkat mobile: memakai browser headless, capture ReadPixels, dan pengukuran awal tumpang tindih benchmark. Jangan gunakan sebagai dasar klaim regresi renderer ≤10%.

Console mencatat empat pesan driver `GPU stall due to ReadPixels` pada 1440×900. Tidak ada pageerror tercatat. Viewport lain tidak mencatat warning/error. Mobile adalah ukuran viewport browser desktop, bukan pengujian hardware ponsel.

## Temuan source untuk fase berikutnya

- `City3DCanvas.tsx`: initialFocus sudah mengikuti centroid settlement saat mount. Jangan mengulang implementasi yang sudah ada tanpa evaluasi. BuildingLodController menonaktifkan BuildingDetail pada jarak jauh tetapi tidak mengaktifkan BuildingFar. Bangunan layanan juga terkena penyembunyian meskipun tidak memiliki far mesh. Ini temuan inspeksi source, belum diuji dengan zoom jauh.
- `BuildingMesh.tsx`: modern kits sudah ada untuk empat kategori dan level 1–5. Banyak geometry JSX masih dibuat per komponen. BuildingNearDetail sudah diberi nama tetapi controller belum memanfaatkannya untuk tier ketiga.
- `TerrainGrid.tsx`: mesh gabungan sudah ada, namun tiap tile masih berupa quad datar dengan vertical cliff pada setiap penurunan elevasi; penggabungan draw call saja belum menghilangkan bentuk voxel. Water color konstan per quad dan shoreline berupa strip lurus per sisi.
- `LandscapeContext.tsx`: daerah terkunci masih memakai box instancing per tile. Signature seluruh grid dihitung saat render.
- `EnvironmentProps.tsx`: broadleaf, pine, shrub serta rounded/flat/angular rock sudah tersedia; penempatan seeded dan instancing harus dipertahankan.
- `DayNightSky.tsx`: satu directional light sudah ada. Ambient dan hemisphere sama-sama tinggi; perlu evaluasi material/shadow saat fase lighting, bukan sekadar menaikkan intensitas.
- `RoadMesh.tsx`: chunk cache dan topology adjacency sudah ada; perubahan perlu dibatasi pada geometry/material.
- `visualModel.ts`: terrainHeight adalah render mapping 0,15; stable buildingVariant menghasilkan delapan nilai. Kontrak koordinat dan elevasi tidak diubah.

## Cakupan yang belum diverifikasi

- Day/night, locked day/night: belum diuji visual; hanya initial 06:00.
- Water/flood: air awal terlihat; FLOOD_RECOVERY lulus benchmark simulasi, tetapi visual flood belum diuji.
- Bridge/tunnel: belum diuji visual dan interaksi.
- Hover, placement, zoning/network overlay, drag brush: belum diuji UI.
- Dense/stress map: hasil simulasi tersedia, screenshot renderer belum tersedia.
- Before/after dengan kondisi identik: belum tersedia karena renderer belum diubah.
- Performa GPU, LOD transition hitch, memory leak dan visual acceptance keseluruhan: belum dinilai.

Seluruh reducer, command queue, economy, population, happiness, disaster, zoning, save/load, determinism, TileData, koordinat, hit-testing, hover, selection, placement, tutorial, road recommendation, kontrol kamera dan fitur render tetap seperti saat pekerjaan dimulai.

## Keputusan gate

Tidak melanjutkan FASE 1 karena pengguna melarang melanjutkan fase sebelum fase sebelumnya aman. Stress baseline tetap gagal setelah pengukuran diulang tanpa capture browser. Meloloskan gate dengan perubahan simulation logic atau melonggarkan threshold tidak termasuk scope yang diizinkan. Dibutuhkan baseline stress yang lolos, atau arahan eksplisit untuk menerima kegagalan stress yang sudah ada sebagai pengecualian sebelum melanjutkan render.
