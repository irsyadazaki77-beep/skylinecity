# Skyline Simulator — Roadmap Eksekusi City-Builder

Dokumen ini memetakan kondisi project saat ini ke target pengalaman city-builder modern yang mendekati filosofi Cities: Skylines 2, tanpa menyalin aset, kode, atau identitas visual milik pihak lain. Roadmap dibuat dari audit source, test suite, production build, dan verifikasi runtime pada 24 Agustus 2026.

## 1. Ringkasan kondisi saat ini

Project sudah memiliki fondasi simulasi yang jauh lebih lengkap daripada prototype biasa:

- React 19 + TypeScript + Vite + React Three Fiber + Three.js.
- Grid deterministik 60×60 dengan starter town, river valley, highway connection, resources, elevation, dan region unlock 3×3.
- Engine tick berfase: input/commands, utilities, population, economy, traffic, services, incidents, disasters, dan history.
- Road hierarchy local/arterial/highway, bridge, tunnel, lane telemetry, turn-aware routing, signal control, queue pressure, road works, dan kondisi jalan.
- Citizen simulation dengan household, demographics, migration, jobs, education, rent, affordability, commute, modal split, dan trips.
- Zoning density, parcel ownership/subdivision, building evolution level 1–5, mixed-use, office, land value, suitability, pollution, noise, crime, health, dan happiness.
- Utilities, city services, service fleet, incidents, disasters, hydrology, flood barrier, reservoir, climate, parking, transit, logistics, warehouses, cargo terminal, dan trade contracts.
- District policy, policies, tech tree, missions, scenarios, achievements, causal diagnostics, save migration, autosave, undo/redo, stable/experimental feature gate.
- World renderer dengan procedural buildings, roads, terrain, vegetation, day/night, overlays, traffic vehicles, service vehicles, freight, transit fleet, dan camera orbit.
- 49 file test dengan 178 test yang lulus; TypeScript lint dan production build lulus pada 2.324 modul.

Kesimpulan: pekerjaan utama berikutnya harus memperkuat kualitas pengalaman, keterbacaan, sebab-akibat, konsistensi telemetry, dan performa. Menambah sistem baru tanpa memperbaiki lapisan tersebut akan membuat game makin lebar tetapi tidak otomatis terasa lebih dalam.

## 2. Prinsip target pengalaman

### A. Pemain selalu tahu apa yang terjadi

Setiap masalah kota perlu memiliki rantai yang dapat dilihat:

`indikator masalah → penyebab → lokasi → tindakan → dampak setelah beberapa tick`.

Contoh: kekurangan listrik menurunkan coverage bangunan tertentu, bangunan mendapat warning, City Information menjelaskan demand/capacity, pemain diarahkan ke lokasi yang relevan, lalu indikator pulih setelah jaringan diperbaiki.

### B. Infrastruktur harus terasa sebagai jaringan

Jalan, listrik, air, layanan darurat, transit, dan freight harus berbagi konsep konektivitas, kapasitas, bottleneck, maintenance, dan response time. Render dan inspector harus membaca sumber telemetry yang sama dengan simulation engine.

### C. Kota berkembang dari bentuk yang masuk akal

Zoning harus mengikuti frontage jalan, parcel, density, land value, dan akses. Bangunan harus berevolusi dari rumah/toko kecil menjadi blok yang lebih padat; visual boleh diprocedural, tetapi jangan mengubah data ekonomi per parcel secara diam-diam.

### D. Visual harus membantu gameplay

Pencahayaan, warna terrain, marka jalan, warning badge, overlay, dan kamera harus membuat masalah kota mudah dibaca. Visual yang indah tetapi menyembunyikan state simulasi adalah regresi gameplay.

### E. Deterministik dan dapat disimpan

Seed, command queue, migration, history, dan event journal tetap menjadi kontrak. Fitur baru wajib punya default backward-compatible dan tidak boleh menghasilkan NaN atau state setengah terisi pada save lama.

## 3. Pemetaan arsitektur dan titik perubahan

| Lapisan | File utama | Tanggung jawab | Aturan perubahan |
| --- | --- | --- | --- |
| State/schema | `src/types.ts`, `src/saveSystem.ts` | `CityState`, tile metadata, migration | Tambah field opsional, default saat hydrate, update schema bila perlu |
| World/input | `src/App.tsx`, `src/components/world/TerrainGrid.tsx` | tool, click/drag, preview, undo/redo | Semua mutasi lewat functional state update dan record edit |
| Simulation | `src/engine.ts` | urutan tick dan agregasi telemetry | Tahap harus deterministic; hindari side effect di engine |
| Subsystems | `src/traffic.ts`, `src/services.ts`, `src/transit.ts`, `src/logistics.ts`, `src/depthSimulation.ts` | domain model masing-masing | Pure function bila memungkinkan; test edge case dan legacy state |
| Renderer | `src/components/world/*` | terrain, road, building, vehicle, environment | Jangan membuat render-only state menjadi sumber kebenaran simulasi |
| UI | `src/components/ui/*`, `src/components/Sidebar.tsx` | HUD, panels, tools, diagnostics | Metric harus diberi unit, threshold, dan lokasi tindakan |
| Release | `src/releaseReadiness.ts`, `src/components/ReleaseBoundary.tsx` | quality gate dan fallback | Build/lint/test wajib tetap hijau |

## 4. Rencana implementasi bertahap

### Fase 0 — Baseline dan guardrail

Status: sebagian selesai.

1. Jalankan `npm run lint`, `npm test`, dan `npm run build` sebelum perubahan.
2. Jalankan game di local Vite dan inspeksi DOM/screenshot pada start screen, new city, pause, normal speed, dan noon.
3. Catat FPS, p95 frame time, simulation tick time, memory, serta console errors.
4. Pertahankan test deterministic untuk day/night, starter city, traffic, save migration, transit, services, dan disaster.
5. Tambahkan test setiap kali bug ditemukan, bukan hanya mengandalkan screenshot.

Acceptance: build production berhasil, semua test lulus, dan tidak ada console error baru.

### Fase 1 — Presentation foundation dan readability

Status: dikerjakan pada iterasi ini.

1. Stabilkan day/night lighting dengan daylight curve yang halus.
2. Pastikan background dan fog dikendalikan scene secara eksplisit agar tidak menjadi putih ketika matahari berada di puncak.
3. Batasi intensitas directional/ambient light agar standard material tidak clipping.
4. Naikkan kontras terrain natural: grass, forest, fertile, ore, oil, developed ground.
5. Kurangi dominasi red wireframe pada region terkunci; warna merah disimpan untuk warning aktif, bukan state normal.
6. Jaga jalan, curbs, zebra crossing, dan lampu tetap terbaca pada siang maupun malam.

Acceptance: pukul 06:00 tidak gelap total, pukul 12:00 tidak overexposed, pukul 00:00 tetap night-readable, dan screenshot tidak memerlukan overlay untuk memahami bentuk kota.

### Fase 2 — Tool ergonomics setara city-builder modern

Prioritas berikutnya:

1. Tambahkan mode jalan dengan snapping ke endpoint, sudut 90°/45°, dan preview panjang, cost, elevation, serta slope.
2. Tambahkan upgrade jalan yang memelihara frontage, parcel, utilities, dan road control.
3. Tambahkan drag zone yang mengikuti sisi jalan, mengecualikan air/obstacle, serta menampilkan jumlah parcel valid dan invalid.
4. Tambahkan tombol cancel, repeat-last-tool, recent tools, dan hotkey yang konsisten.
5. Buat inspector menjadi action-oriented: tombol repair/upgrade/route-to/location focus langsung terlihat dari tile yang dipilih.
6. Beri preview khusus bridge/tunnel dengan clearance dan koneksi endpoint, bukan hanya valid/invalid merah-hijau.
7. Tambahkan camera home, focus selected, rotate, pitch, zoom level, dan mini navigation hints.

Acceptance: pemain baru dapat membangun road → zone → utility → simulate tanpa harus menebak tile yang valid.

### Fase 3 — Simulation feedback dan city information

1. Buat panel “City Pulse” yang merangkum lima perubahan terbesar sejak tick sebelumnya.
2. Pasangkan setiap causal diagnostic dengan `location`, nilai saat ini, threshold, dan tindakan yang tersedia.
3. Tambahkan before/after delta untuk population, jobs, income, traffic, happiness, utility, dan service response.
4. Bedakan demand, capacity, utilization, coverage, reliability, dan quality; jangan menampilkan semuanya sebagai persentase tanpa unit.
5. Tambahkan sparkline history untuk cash flow, population, congestion, happiness, rent pressure, and market health.
6. Tambahkan filter inspector berdasarkan building type, district, warning severity, dan network component.
7. Pastikan notification tidak hanya memberi berita, tetapi juga mengarahkan kamera dan membuka overlay yang tepat.

Acceptance: setiap warning kritis memiliki jawaban atas “apa masalahnya, mengapa terjadi, di mana, dan apa yang bisa saya lakukan?”.

### Fase 4 — Urban form, zoning, dan development loop

1. Tautkan zoning ke road frontage dan parcel frontage rotation secara konsisten.
2. Gunakan low/medium/high density sebagai pilihan kapasitas, rent, household type, parking pressure, dan visual massing yang berbeda.
3. Buat building evolution memiliki progress yang dapat dijelaskan: demand, land value, services, education, affordability, utilities, pollution, dan disaster impact.
4. Tambahkan redevelopment/abandonment loop yang gradual, bukan instant flip.
5. Beri setiap lot facade variant, setback, driveway, sidewalk, tree/shrub, signage, dan night window emissive yang konsisten.
6. Perkuat mixed-use menjadi vertical program yang transparan: retail floors, office floors, residential floors, jobs, households, dan floor area.
7. Tambahkan district identity melalui policy effects, color, signage, street props, dan land-value response.

Acceptance: kota kecil, koridor komersial, kawasan kantor, dan industrial campus dapat dibedakan secara visual dan ekonomi.

### Fase 5 — Road traffic dan mobility depth

1. Pertahankan route-aware trips sebagai sumber demand kendaraan, bukan traffic random.
2. Tambahkan junction queue visualization, lane utilization, spillback, turning pressure, dan pedestrian crossing dalam inspector/overlay.
3. Tautkan road condition, wet weather, grade, lane profile, signal timing, turn bans, parking pressure, dan freight access ke travel time.
4. Tambahkan road hierarchy visual yang jelas untuk local/arterial/highway.
5. Tingkatkan public transit dengan stop catchment, line color, direction, headway, dwell, occupancy, transfers, platform capacity, and fare/operating balance.
6. Tambahkan pedestrian/bicycle priority pada koridor pendek melalui policy dan visual sidewalk/crossing, dengan telemetry tetap deterministic.
7. Sediakan scenario benchmark untuk congested corridor dan transit relief.

Acceptance: membangun arterial, signal, transit line, parking, atau cargo access menghasilkan perubahan lalu lintas yang terlihat dan dapat dijelaskan.

### Fase 6 — Services, economy, dan municipal governance

1. Pertahankan finite capacity untuk fire, police, clinic, school, waste, fleet, bay queue, maintenance, dan response quality.
2. Tambahkan service district heatmap dan response-time bands berbasis road path.
3. Tautkan biaya operasi, maintenance backlog, depot condition, debt, capital budget, dan operating budget ke keputusan pemain.
4. Buat supply chain dari resource → production input → warehouse/terminal → freight → commercial/consumer stock → revenue.
5. Tampilkan shortage dan reliability dengan commodity/unit yang jelas.
6. Kembangkan policy/tech tree menjadi trade-off nyata, bukan hanya bonus positif.
7. Tambahkan consequence preview sebelum mengaktifkan pajak/policy besar.

Acceptance: kota dapat gagal secara ekonomi atau layanan karena keputusan pemain, tetapi selalu punya recovery path yang terbaca.

### Fase 7 — Climate, disasters, scenarios, dan replayability

1. Pertahankan climate seed dan event lifecycle deterministic.
2. Tautkan hujan → hydrology → flood depth/flow → road/building impact → recovery.
3. Tambahkan disaster preparation: evacuation priority, emergency budget, barrier/reservoir planning, and rebuild priority.
4. Buat scenario objectives menilai trajectory, bukan hanya angka sesaat.
5. Tambahkan milestone unlock yang membuka pilihan baru tetapi tidak memaksa satu gaya kota.
6. Tambahkan seeded challenge/campaign dengan benchmark reproducible.

Acceptance: disaster terasa sebagai sistem kota, bukan event overlay; scenario dapat diulang dan dibandingkan.

### Fase 8 — Performance, save safety, dan release quality

1. Ukur tick cost per phase; targetkan p95 tick normal di bawah 50 ms pada starter town dan degradasi graceful pada city benchmark.
2. Cache road graph, region telemetry, overlay data, and building footprints berdasarkan topology signature.
3. Hindari clone besar untuk data yang tidak berubah; gunakan structural sharing ketika aman.
4. Pastikan vehicle instancing, environment props, shadows, DPR, adaptive quality, dan reduced motion memiliki fallback.
5. Uji save/load pada setiap schema migration, interrupted autosave, malformed import, dan experimental feature mismatch.
6. Tambahkan release smoke script untuk start screen, new city, simulate, save, load, and settings.
7. Periksa keyboard, focus ring, contrast, responsive layout, reduced motion, dan WebGL fallback.

Acceptance: tidak ada regression pada 100K benchmark, save lama tetap dapat dibuka, dan release build dapat dijalankan tanpa dev-only dependency.

## 5. Urutan eksekusi setelah iterasi lighting

Urutan yang paling bernilai untuk iterasi lanjutan:

1. **Road visibility + camera tools** — karena jalan adalah pusat semua aksi pemain.
2. **City Pulse + diagnostic action links** — karena simulation depth sudah ada tetapi belum seluruhnya terasa di layar utama.
3. **Road/zone preview yang lebih informatif** — mengurangi trial-and-error saat membangun.
4. **Building evolution feedback + urban form polish** — membuat pertumbuhan kota terasa, bukan hanya angka.
5. **Traffic/transit overlays dan junction inspector** — memperkuat loop keputusan.
6. **Performance per phase + targeted caching** — menjaga skala kota tanpa mengorbankan simulation fidelity.

## 6. Perubahan yang sudah dieksekusi pada iterasi ini

Iterasi lanjutan 26 Agustus 2026 menutup beberapa gap UX yang tersisa:

- Command pipeline sekarang mencakup mutasi jalan, zoning, bangunan, terraform, road works, layanan, transit, pajak, distrik, region, teknologi, misi, scenario, dan trade contract dengan ID deterministik serta guard idempotensi.
- City Pulse menampilkan hingga lima diagnostic terbesar dengan nilai, threshold, rekomendasi, dan tombol fokus/lokasi; placement preview menampilkan forecast kapasitas, household, jobs, traffic, pajak, maintenance, dan polusi, termasuk preview satu tile.
- Kamera memiliki toolbar 2D/3D, zoom, rotasi, reset, fokus terpilih, serta shortcut Q/E/F/Home; lapisan HUD tidak lagi menutup tombol kamera.
- Settings menambahkan kontras tinggi, bantuan penglihatan warna, dan reduced-motion handling; feedback audio sintetis ringan memakai master volume tanpa asset eksternal.
- Localization catalog kini dipakai oleh sidebar, forecast, City Pulse, dan navigasi utama City Information.
- Benchmark `PERFORMANCE_100K` kini menjaga population/grid population 100.000 dan citizen agent sampled yang nyata dengan `populationScale`, sehingga laporan tidak lagi menyamakan populasi agregat dengan 100.000 entity.

- `DayNightSky` sekarang memakai daylight curve 04:00–20:00, ambient/hemisphere yang dikontrol secara halus, dan direct-light intensity yang tidak clipping.
- Scene background dan fog di-update secara eksplisit dari sky profile agar tidak fallback menjadi putih ketika midday.
- Terrain palette diperjelas untuk default ground, forest, fertile, ore, dan oil.
- Region lock overlay normal memakai warna slate-blue yang lebih tenang; warna amber dipakai saat mode expansion aktif.
- Road palette dan emissive baseline dinaikkan agar road hierarchy tetap terbaca pada material standard.
- City Pulse kini muncul setelah kota mulai berjalan dan merangkum delta tick terakhir untuk warga, kas, kebahagiaan, dan kemacetan.
- Causal diagnostics tampil sebagai kartu tindakan: warning memiliki penjelasan, nilai/threshold, tombol detail, atau tombol fokus ke lokasi.
- Drag jalan diagonal sekarang mencapai endpoint yang dipilih dengan satu tikungan ortogonal deterministik; preview tidak lagi menghilangkan koordinat akhir.
- Preview jalan/zona sekarang memisahkan tile valid, tile terhalang, biaya, kapasitas, dan alasan invalid. Tool zonasi tidak lagi tampak hijau ketika brush berisi tile yang tidak dapat dibangun.
- Performance overlay kini memisahkan frame p95 dari simulation p95 agar regresi render dan regresi tick dapat dilacak secara terpisah.
- `Building Growth Advisor` kini memakai kontrak evaluasi murni yang sama dengan aturan evolusi level: occupancy, demand sektoral, frontage, utility, service coverage, land value, suitability, pollution, crime, education, dan unlock level.
- `Traffic / Junction Advisor` kini tampil ketika road dipilih dan menjelaskan corridor vs intersection, jumlah approach, kelas jalan terhubung, traffic, queue, lane load, lane-change pressure, kondisi, serta rekomendasi tindakan.
- Evaluator urban growth dan traffic memiliki regression tests terpisah untuk status READY, INACTIVE, MAX_LEVEL, junction mixed-class, maintenance, dan lane-change pressure.
- Service engine kini menulis estimasi response time per kategori (`fire`, `police`, `health`, `school`, `waste`) ke tile; Info Views menyediakan heatmap Service Response dengan legend ≤5, 5–10, 10–20, dan >20 menit/tanpa layanan.
- Transit Line Manager kini menampilkan catchment population, transfer stops, fleet/load, wait time, line balance, serta rekomendasi headway/armada/stop berdasarkan telemetry line aktif.
- City Information menampilkan demand history dan city trend charts untuk demand sektoral, happiness, congestion, dan service response quality; history engine menyimpan 60 sampel tick.
- Inspector diberi batas tinggi viewport dan scroll internal agar Growth/Traffic Advisor tidak menutupi header, tombol tutup, atau kontrol HUD pada layar kecil.
- Engine sekarang memiliki profiler fase non-deterministik yang tidak masuk ke `CityState`/save-state; Performance Overlay menampilkan p95 fase terpanas (`CLONE`, `ENVIRONMENT`, `SERVICES_FINAL`, dan seterusnya).
- `depthSimulation` memakai stencil radius lingkungan yang dipra-hitung dan park influence map; `hydrology` mengumpulkan daftar tile/reservoir/barrier dalam satu scan; `disasters` menghindari `grid.flat()` berulang, memakai squared-distance untuk seleksi air, dan queue index FIFO agar flood propagation tidak memakai `shift()` O(n).
- Lookup tile-ke-road terdekat kini memiliki cache `WeakMap` per `RoadGraph`; cache hilang bersama graph sehingga tidak mencemari save-state dan tetap aman ketika topology berubah.
- Regression test profiler memastikan semua phase timing finite dan tidak mencemari state gameplay. Benchmark warm `SMALL_TOWN` turun dari sekitar 144 ms pada audit awal menjadi sekitar 32–54 ms per tick pada sample terbaru (batch/browser dapat lebih tinggi); hasil tetap bervariasi menurut warm-up/runtime, sehingga target p95 <50 ms belum dianggap tercapai.
- Info Views memiliki batas tinggi dan scroll internal. Tombol penutup tetap berada di viewport meskipun seluruh daftar overlay dan legend dibuka.
- City Information kini memiliki `Dispatch Bands by Agency` untuk Fire, Medical, Police, dan Traffic: active calls, critical calls, required/dispatched/queued units, ETA band, bay queue, fleet readiness, route length, dan rekomendasi tindakan.
- Transit Line Manager kini memiliki `Transit Route Map` schematic yang memakai path road vehicle agent setelah line beroperasi, fallback ke stop chain sebelum tick pertama, status line, serta tombol fokus setiap stop ke map.
- Geometry route transit dan dispatch insight dipisahkan menjadi fungsi read-only dengan regression tests untuk vehicle-path precedence, fallback stop geometry, projection degenerate bounds, queue pressure, ETA band, dan clear-agency state.
- Info Views kini memiliki world overlay `TRANSIT_ROUTES` untuk line/stop aktif serta fallback stop chain, dan `DISPATCH` untuk incident path, severity, agency color, serta posisi kendaraan layanan berdasarkan progress rute.
- World overlay geometry (`sampleGridPath`, incident color, service vehicle color) memiliki regression tests untuk interpolasi outbound/return dan pemetaan agency yang deterministik.
- Ditemukan dan diperbaiki regression layer UI: saat Starter Tutorial terbuka, panel Info Views sekarang berada di atas tutorial sehingga semua tombol overlay tetap dapat diakses; klik Transit Routes dan Emergency Dispatch diverifikasi di Edge dengan console error `0`.
- Transit route geometry sekarang membawa status jam layanan (`operating`) dari waktu kota; jalur tetap terlihat di luar jam layanan dengan opacity/status yang lebih redup dan legend yang menjelaskan perbedaannya.
- Runtime audit scenario deterministik (`?debug=1&audit=transit-dispatch`) sekarang menyiapkan corridor bus, depot terpisah, passenger stops, fire station, incident aktif, lalu memaksa seluruh lifecycle melewati simulation tick normal; scenario ini juga diverifikasi melalui save round-trip.
- Transit engine sekarang menghitung depot/station terpisah sebagai fleet capacity provider, sementara passenger coverage tetap dibatasi oleh stop line. Metrik `Active Lines` dan coverage mengikuti jam layanan aktual, bukan hanya line yang terjadwal.
- City Information menampilkan rasio `road path live` dan status `ROAD PATH LIVE · telemetry kendaraan` ketika route map sudah memakai path kendaraan aktual.
- Incident Dispatch kini memiliki lifecycle per-insiden yang read-only: `QUEUED → DISPATCHING → ON SCENE`, response progress, jumlah unit en route/on scene, ETA, panjang route, dan unit `RETURNING` yang masih terlihat satu leg setelah insiden selesai.
- `serviceDispatchLifecycle.ts` memisahkan derivasi telemetry dari `CityState`; regression tests mengunci queued dispatch, partial dispatch, on-scene transition, dan return-leg visibility tanpa mengubah save determinism.
- `transitReliefBenchmark.ts` menambahkan benchmark corridor beban tinggi dengan warga/household nyata, perbandingan baseline versus bus line, transit ridership, modal split, car-trip reduction, congestion reduction, dan deterministic seed.
- Transit vehicle agent kini membawa route progress, stop aktif/berikutnya, dan ETA yang deterministik dari waktu kota; route map menampilkan marker kendaraan dan Line Manager menampilkan telemetry schedule serta occupancy per vehicle.
- `findTransitLineAccess` sekarang memakai BFS pada graph line-sharing-stop, sehingga perjalanan regional mendukung lebih dari satu transfer dan memilih rantai line terpendek; regression test multi-transfer ditambahkan.
- Runtime audit scenario kini memakai dua bus line dengan satu transfer stop bersama, sehingga active line, vehicle fleet, transfer opportunity, route path, modal split, dan emergency dispatch diuji dalam satu fixture.
- `runTransitCapacityStressBenchmark` menambahkan horizon stress dua tick dengan corridor padat dan stop pattern rapat untuk memverifikasi utilisasi kapasitas kendaraan tinggi sebelum demographic churn mengubah fixture.
- Audit performance terbaru: `PERFORMANCE_100K` menghabiskan sekitar `915 ms / 20 tick` (~45,8 ms/tick) pada fixture world/grid, tetapi `citizenState` belum berisi 100k entity sehingga `state.population` kembali `0`; benchmark ini belum cukup untuk mengklaim performa simulasi warga 100k dan harus dilengkapi sampled/aggregate citizen workload.
- Balance harness deterministik (`npm run balance`) merekam trajectory treasury, debt, happiness, population, demand, dan bankruptcy advisory per benchmark scenario.
- Core-loop advisor di HUD memilih satu tindakan berikutnya dari live state dan dapat mengaktifkan tool, menjalankan simulasi, membuka objectives, atau memfokuskan diagnostic.
- Starter town civic baseline kini ditulis ke tile coverage flags agar land value, satisfaction, dan building evolution memakai sinyal yang sama sampai 25 warga.
- Reconciliation parcel kini dipisah menjadi full topology pass sebelum urban-form mutation dan lightweight status/ownership refresh sesudahnya; struktur lot tidak dibangun ulang dua kali dalam tick yang sama.

## 8. Status implementasi saat ini

Vertical slice yang sudah dapat dimainkan dan diverifikasi:

```text
start paused → pilih tool → preview biaya/validasi → bangun → jalankan simulasi
→ City Pulse membaca delta dan causal diagnostics → fokus lokasi → buka City Info
```

Regression gate terakhir: `49` test files, `178` tests lulus; TypeScript lint dan production build lulus (2.324 modules). Smoke test WebGL pada audit scenario menghasilkan console error `0` (warning hanya deprecation `THREE.Clock`), line aktif `2`, vehicle `4`, depot `1`, kapasitas `80`, transfer stop `1`, `road path live 2/2`, incident dispatch `1` dengan fire band `CRITICAL`, lifecycle `ON SCENE` setelah tiga tick, dan overlay world Transit Routes/Emergency Dispatch terverifikasi pada Hari 2 pukul 12:00. Save round-trip mempertahankan dua line, vehicle route telemetry, incident path, dan service vehicle. Benchmark transit relief, capacity stress, balance harness, dan full test suite juga deterministik. Benchmark report juga menampilkan target tick budget sebagai advisory (`50 ms` kota kecil, `120 ms` benchmark 100K); jika terlampaui, scheduler reduced-quality/cadence fallback tetap menjadi jalur runtime.

Prioritas implementasi berikutnya: menangkap dan mengaudit return-leg incident pada runtime dengan fixture yang mempertahankan insiden cukup lama, memperluas benchmark transit ke kapasitas penuh dan transfer demand nyata, cache topology lanjutan yang mempertahankan data dinamis dengan aman, optimasi POPULATION/logistics, serta benchmark visual/runtime pada city density tinggi. Target p95 <50 ms masih terbuka dan harus diukur ulang setelah setiap cache besar.

## 7. Quality gates setiap iterasi

```text
npm run lint
npm test
npm run build
```

Untuk perubahan visual, tambahkan verifikasi runtime:

```text
start screen → new city → screenshot 06:00
normal speed satu tick → screenshot 12:00
pause → select/overlay → screenshot
console errors = 0
```

Roadmap ini sengaja berlapis: sistem simulasi yang sudah matang dipertahankan, sementara setiap iterasi berikutnya harus meningkatkan apa yang dilihat, dipahami, dan dapat dikendalikan pemain.
