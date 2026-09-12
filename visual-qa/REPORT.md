# Skyline Simulator — visual upgrade verification, 10 September 2026

## Total UI/UX shell redesign — 10 September 2026

Redesign ini mengubah hierarchy dan struktur layout, bukan hanya warna. HUD disatukan menjadi satu top lane tenang; build categories menjadi rail ringkas di desktop dan horizontal expandable dock di mobile/844 landscape; subtools tetap berada dalam satu contextual drawer/bottom sheet. Camera toolbar sekarang hanya menampilkan 2D/3D, zoom, dan satu overflow secara persisten, sedangkan rotation, focus, reset, clean view, dan presets berada di disclosure sekunder.

Advisor desktop dipangkas menjadi objective aktif + Location/Later/primary action. Alasan, biaya, dampak, recovery, dan petunjuk dipindahkan ke tombol `Detail`. Inspector dan City Information menempati right contextual lane pada desktop serta bottom sheet dengan drag-handle visual pada mobile. Performance/debug tetap tertiary. Tokens layout, surface, spacing, status, radius, shadow, motion, serta responsive lanes dipusatkan di `src/styles/city-builder-shell.css`.

QA terbaru memperbarui empat capture utama dan gameplay captures. 393×851 menggunakan compact top HUD, camera group kecil, collapsed advisor, horizontal build dock, dan speed dock terpisah. 844×390 menggunakan dock landscape serta advisor di kanan bawah. Tidak ada horizontal overflow atau page error; pesan GPU 1440×900 tetap hanya warning screenshot `ReadPixels`.

| Gate redesign ballot | Hasil |
| --- | --- |
| `npm run lint` | PASS |
| `npm test -- --run` | PASS — 76 file, 311 test |
| `npm run build` | PASS |
| `npm run smoke` | PASS — save/load + deterministic replay hash `5be7d3c6` |
| Gameplay capture | PASS — new city, tutorial, contextual road drawer, 2D/3D, mobile sheet; tanpa page error |

### Final refinement audit — 11 September 2026

Ditambahkan `visual-qa/verify-ui-redesign.mjs` untuk memeriksa perilaku yang tidak cukup dibuktikan oleh screenshot statis. Verifier membuka camera overflow, menguji Detail/Ringkas advisor, membuka build drawer pada viewport kecil, mengukur bounding box terhadap viewport, memeriksa document overflow, dan memastikan reduced-motion media rule tersedia.

- 1440×900, 1280×720, 844×390, 393×851: seluruhnya `cameraContained: true`, `detailDisclosure: true`, `horizontalOverflow: false`, `reducedMotionRule: true`, tanpa console/page error.
- Lint/typecheck PASS; 76 file / 311 test PASS; build PASS; smoke PASS dengan replay hash `5be7d3c6`.
- Benchmark terisolasi PASS: PERFORMANCE_100K p50 36,4 ms, p95 49,7 ms, budget 120 ms. Run paralel sebelumnya sengaja tidak dipakai karena terkontaminasi build dan unit test bersamaan.
- Seluruh 18 workflow Playwright mencetak `ok` pada desktop/mobile. Seperti run sebelumnya, proses runner tidak menutup setelah web-server teardown sehingga dihentikan manual setelah test ke-18 selesai; tidak ada test failure.

## Frontage-aware streetscape pass — 10 September 2026

Layer `PremiumCityLayer` kini menurunkan seluruh detail parcel dari adjacency jalan aktual. Access path dan curb menghadap road frontage terdekat; street tree, lamp, bin/signage, parked car, industrial storage yard, dan waterfront promenade ditempatkan deterministik dari koordinat serta `parcelSeed`. Semua keluarga prop memakai `InstancedMesh`, shared geometry/material, bounding sphere, dan budget desktop/mobile yang berbeda. Tidak ada data `TileData` atau state simulasi yang ditulis oleh layer ini.

Capture `after-1440x900.png`, `after-1280x720.png`, `after-844x390.png`, dan `after-393x851.png` diperbarui dari aplikasi aktual. Capture menunjukkan frontage paths, pohon jalan, lampu, serta parked vehicle muncul pada sisi jalan yang sesuai; mobile tetap mempertahankan city view dominan. Tidak ada page error. Warning 1440×900 terbatas pada `GPU stall due to ReadPixels` dari screenshot headless.

| Pemeriksaan akhir | Hasil |
| --- | --- |
| `npm run lint` | PASS |
| `npm test -- --run` | PASS — 76 file, 311 test |
| `npm run build` | PASS — City3DCanvas 108,64 kB (33,16 kB gzip) |
| `npm run smoke` | PASS — replay hash `5be7d3c6` |
| `npm run benchmark` | PASS — 100K p50 46,2 ms, p95 58,8 ms, budget 120 ms |
| `npm run render-benchmark` | PASS — 100K inventory 1.640 building, 85 draw calls, synthetic p95 2,82 ms |

### Acceptance closure audit

- Camera toolbar sekarang memiliki preset `Overview` dan `Skyline`, di samping focus selected, orbit, zoom, rotasi, reset, dan clean-city view.
- Tombol `R` mengaktifkan kembali tool pembangunan terakhir; `Escape` tetap menjadi cancel yang konsisten. Shortcut baru juga didokumentasikan pada Settings.
- Capture empat viewport diulang setelah perubahan kontrol kamera. Tidak ada page error atau overlap kritis pada 1440×900, 1280×720, 844×390, dan 393×851.
- Regression gate terakhir: lint PASS, 76/76 test file dan 311/311 test PASS, build PASS, smoke PASS dengan replay hash `5be7d3c6`, benchmark 100K PASS (p50 69,3 ms, p95 89,6 ms; budget 120 ms).
- Seluruh 18 workflow Playwright lulus pada desktop dan mobile. Runner kembali tidak menutup proses web-server setelah test ke-18, sehingga dihentikan manual setelah seluruh hasil `ok` tercetak; tidak ada test failure.

## Hasil upgrade terbaru

Audit dilanjutkan di atas worktree visual-upgrade yang sudah berisi perubahan lokal besar. Kontrak simulation, reducer, command queue, TileData, koordinat, save/migration, seed, dan deterministic replay tidak diubah.

- Render building sekarang memakai spesifikasi deterministik per parcel dengan 14 archetype: detached house, villa, townhouse row, courtyard/apartment block, corner shop, retail strip, mixed-use block, office mid-rise, glass/civic tower, warehouse, factory, dan industrial campus.
- Archetype menentukan massing, podium/tower/wing, jumlah balkon, canopy, fire escape, crown, shopfront, side facade, rooftop equipment, dan industrial yard. NEAR/MID/FAR tetap berbagi satu visual spec sehingga silhouette tidak berubah acak saat LOD berganti.
- Facade windows memakai InstancedMesh dan shared geometry/material; jendela samping ditambahkan tanpa geometry baru per frame.
- Bug z-fighting jalan yang terlihat sebagai garis hitam/moire pada highway diperbaiki dengan offset render skin 0,01 world unit. Elevasi simulation dan hit-testing tidak berubah.
- Script capture kini secara eksplisit memilih 3D. Pada desktop tutorial diminimalkan agar komposisi kota dapat dinilai; pada mobile state awal bottom sheet tetap collapsed.

### Verifikasi setelah perubahan

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run lint` | PASS |
| `npm test -- --run` | PASS — 76 file, 311 test |
| `npm run build` | PASS — City3DCanvas 105,84 kB (32,16 kB gzip) |
| `npm run smoke` | PASS — 7/7, replay hash `5be7d3c6` |
| `npm run benchmark` | PASS — stress 100K p50 34,8 ms, p95 46,6 ms (budget 120 ms) |
| `npm run render-benchmark` | PASS inventory — 100K: 1.640 building, 43.104 triangles, 85 draw calls, synthetic p95 2,82 ms |
| Playwright desktop/mobile | 18/18 test cases melaporkan `ok`; proses runner tidak keluar setelah teardown web server dan dihentikan manual |

Capture terbaru: `after-1440x900.png`, `after-1280x720.png`, `after-844x390.png`, dan `after-393x851.png`. Tidak ada page error. Chromium software WebGL hanya mencatat warning `GPU stall due to ReadPixels` pada capture 1440×900; ini berasal dari screenshot readback, bukan exception aplikasi. Pemeriksaan visual memastikan artefak z-fighting highway hilang dan mobile 393×851 mempertahankan area kota dominan dengan tutorial collapsed setinggi 66 px.

## Baseline awal (6 September 2026)

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
