# Skyline Simulator — Product & Technical Audit

> Historical: baseline audit 2026-09-04. Status terbaru ada di `CURRENT_STATUS_2026-09-05.md`.

Tanggal: 4 September 2026 (Asia/Jakarta)

## 1. Product thesis

Skyline Simulator adalah city-builder tropis tentang keterbacaan sebab-akibat. Pemain membentuk jaringan kota, melihat warga dan distrik bereaksi terhadap jaringan tersebut, memahami tekanan yang muncul, memilih trade-off, lalu melihat kota berubah secara spasial, ekonomi, dan sosial. Identitas produk berasal dari iklim tropis, ketahanan kota, cerita warga, dan spesialisasi yang tumbuh dari keputusan nyata—bukan dari meniru aset, UI, istilah, atau struktur proprietary city-builder lain.

North star:

`Bangun → kota berkembang → masalah muncul → pahami penyebab → pilih trade-off → kota berubah → peluang terbuka → identitas terbentuk`

## 2. Ruang audit dan kondisi repository

Audit mencakup README, audit terdahulu, package scripts, model tipe, composition root, engine tick, seluruh folder component/hook, modul simulasi, save/replay, benchmark/balance, dan 61 file test. Source yang diaudit berjumlah sekitar 32.491 baris.

Worktree sudah memiliki banyak perubahan dan file baru sebelum audit ini. Perubahan tersebut diperlakukan sebagai pekerjaan pengguna yang harus dipertahankan. Audit ini hanya menambahkan dokumen; tidak mengubah rule simulasi, save schema, UI, atau renderer.

## 3. Baseline quality gates

| Gate | Hasil | Waktu wall |
| --- | --- | ---: |
| `npm run lint` | PASS | 12,235 s |
| `npm test -- --run` | PASS — 61 file, 224 test | 8,558 s (Vitest 7,22 s) |
| `npm run build` | PASS — 2.337 modul | 10,964 s (Vite 9,75 s) |
| `npm run smoke` | PASS — tick, finite state, save round-trip, replay, viewport contracts | 0,871 s |
| `npm run balance` | PASS — seluruh fixture tanpa bankruptcy | 19,618 s |
| `npm run benchmark` | PASS — deterministic dan finite | 3,285 s |

Bundle produksi:

| Chunk | Raw | Gzip |
| --- | ---: | ---: |
| Entry JS | 399,41 kB | 123,55 kB |
| Three.js | 1.119,52 kB | 310,85 kB |
| City3DCanvas | 72,17 kB | 18,25 kB |
| CityInformationPanel | 51,16 kB | 12,66 kB |
| UI shared | 50,41 kB | 12,48 kB |
| CSS | 98,15 kB | 16,53 kB |

`src/App.tsx`: 1.974 baris / 90.148 byte. Ini masih orchestration hotspot, walau renderer dan panel berat sudah lazy-loaded serta beberapa hook domain telah diekstrak.

## 4. Architecture map

```text
main.tsx
  └─ App.tsx (composition + UI orchestration + player command handlers)
       ├─ Runtime hooks
       │    ├─ useSimulationControls → scheduler → engine.simulateTick
       │    ├─ useSaveLifecycle → saveRepository
       │    ├─ useCameraControls
       │    ├─ usePanelState
       │    ├─ useBuildActions
       │    └─ useTutorialFlow
       ├─ Presentation
       │    ├─ City3DCanvas
       │    │    ├─ TerrainGrid / RoadMesh / BuildingMesh
       │    │    ├─ EnvironmentProps / DayNightSky
       │    │    ├─ TrafficVehicles / NetworkOverlays
       │    │    └─ CameraController
       │    └─ City2DCanvas
       └─ UI
            ├─ GameHUD / Sidebar / BottomToolbar / CameraToolbar
            ├─ StarterTutorial / CityPulse / NotificationCenter
            ├─ BuildingInspector / InfoViewsToolbar
            └─ lazy panels: City Information, Treasury, Tech, Policies,
               Districts, Missions, Save/Load

simulationCommands → engine.simulateTick → CityState
saveSystem ↔ CityState + serialized citizen state
releaseReadiness ← deterministic hash + diagnostic/performance snapshots
```

Boundary yang sudah baik:

- Scheduler/performance telemetry berada di luar deterministic `CityState`.
- Command queue dan event journal menjaga mutasi pemain dapat direplay.
- Simulation modules umumnya fungsi deterministik/pure terhadap state input.
- 2D dan 3D membaca state yang sama.
- Save memakai migration aditif dan import validation.

Boundary yang masih lemah:

- `App.tsx` masih menangani terlalu banyak command construction, optimistic mutation, preview, selection, notifications, transit editing, policy/mission/scenario actions, dan prop assembly.
- `CityInformationPanel.tsx` (1.169 baris), `BuildingMesh.tsx` (1.170), `TerrainGrid.tsx` (700), `BuildingInspector.tsx` (652), dan `Sidebar.tsx` (603) adalah hotspot presentasi berikutnya.
- `CityState` menjadi broad shared contract; penambahan domain baru berisiko memperbesar save dan invalidation React.

## 5. Simulation dependency map

Urutan tick aktual:

```text
INPUT
  command queue + signal clocks + climate + trade/recovery
    ↓
DISASTERS
  disaster → hydrology → tile/road impact
    ↓
UTILITIES
  road graph → power/water network allocation
    ↓
ENVIRONMENT
  land value/pollution/noise/health/desirability
    ↓
SERVICES_INITIAL
  capacity/coverage baseline
    ↓
DEMAND
  R/C/O/I demand + district/policy/event modifiers
    ↓
URBAN_FORM
  parcels → building evolution → mixed-use → job growth
    ↓
TRAFFIC_NETWORK
  transit availability + road graph/signal state
    ↓
POPULATION
  household/migration → jobs/school/satisfaction → trips → congestion
    ↓
LOGISTICS
  production recipes → warehouse/import/export → freight trips
    ↓
SERVICES_FINAL
  true-population capacity + response quality
    ↓
INCIDENTS
  incident queue → persistent fleet → depot condition
    ↓
TRANSIT_FINAL
  ridership/headway/wait/fare/cost/vehicle agents
    ↓
ECONOMY
  taxes + upkeep + trade/transit/fleet/recovery → treasury/debt
    ↓
HISTORY
  milestones/achievements → numeric history → regions → diagnostics
  → citizen stories → scenario evaluation → event journal
```

Critical coupling:

- Road graph memengaruhi utilitas, frontage, trips, freight, transit, service response, parking, dan bencana.
- Citizen state memengaruhi population/workforce/trips; hasil trip kembali memengaruhi road congestion dan happiness.
- Logistics memengaruhi building growth, market health, freight congestion, dan ekonomi.
- Disaster/hydrology memengaruhi road condition, service response, happiness, abandonment, dan recovery spending.
- District/policy modifiers masuk ke demand, services, transit, environment, dan economy; karena itu perubahan modifier wajib mendapat deterministic regression test.

## 6. UI dependency map

```text
CityState
  ├─ HUD: population, cashflow, happiness, time, next action
  ├─ City Pulse: delta + causal diagnostic + latest citizen story
  ├─ City Information: technical telemetry/history/transit/dispatch
  ├─ Inspector: selected TileData + road/service/building actions
  ├─ Tutorial: real state predicates + spatial recommendations
  ├─ Info Views: active overlay → 2D/3D renderer
  └─ Notifications: incidents/events/stories → optional camera focus

Player input
  ├─ tool/preview/drag/click
  ├─ command queue
  ├─ optimistic UI state where applicable
  └─ next engine tick commits authoritative state
```

Tiga lapisan UX sudah ada secara struktural. Gap utamanya adalah konsistensi bahasa, touch targets, browser-level layout verification, dan traffic story yang belum menjawab origin/destination/bottleneck dengan bukti perjalanan.

## 7. Save schema map

```text
SaveEnvelope (save version 14)
  ├─ schemaVersion
  ├─ gameVersion / buildId / featureSet
  ├─ metadata: cityName, timestamp, playtime/day
  └─ state / gameState
       ├─ CityState scalar + bounded histories/events
       ├─ compact grid: tuple per TileData (type, level, pop, jobs,
       │  utilities, environment, road/signal, parcel, hydrology,
       │  mixed-use, density/rent, upgrades, company telemetry...)
       ├─ serialized citizen simulation (arrays + populationScale)
       ├─ transit lines/vehicle agents, incidents/service fleet
       ├─ regions, districts, contracts, recovery, scenario
       └─ citizenStoryState (added v14)

Persistence
  ├─ IndexedDB primary (`skyline-simulator-release`, store `saves`)
  ├─ rotating autosave backups ×3
  ├─ localStorage compatibility fallback
  └─ quarantine for invalid/corrupt records
```

Migration berjalan aditif dari versi lama ke 14. Test saat ini membuktikan envelope, compact round-trip, v13→v14 Citizen Stories, malformed import rejection, non-finite rejection, fallback tanpa IndexedDB, dan legacy v1/v2 hydration. Risiko utama adalah tuple tile positional yang panjang: field baru salah urutan dapat merusak kompatibilitas tanpa type-level protection.

## 8. Performance map

Benchmark CLI (10 measured ticks setelah warm-up):

| Scenario | Pop representatif | p50 | p95 | Budget | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| SMALL_TOWN | 16 | 16,2 ms | 30,5 ms | 50 ms | within |
| CONGESTED_CORRIDOR | 640 | 15,4 ms | 26,7 ms | 50 ms | within |
| INDUSTRIAL_CITY | 160 | 15,0 ms | 20,4 ms | 50 ms | within |
| FLOOD_RECOVERY | 640 | 14,2 ms | 18,7 ms | 50 ms | within |
| PERFORMANCE_100K | 100.000 (20 agents ×5.000) | 40,3 ms | 55,6 ms | 120 ms | within |

Runtime browser lokal, starter city, 3D aktif, sekitar 14 warga:

- 36–37 FPS; frame p95 100 ms.
- Simulation tick sekitar 31,6–42,5 ms.
- Scheduler p95 sempat 131,1 ms lalu memilih quality `reduced`.
- Heap teramati sekitar 137–152 MB saat berjalan.
- Fase yang terlihat paling mahal pada sampel: `ENVIRONMENT` (~8 ms), diikuti `SERVICES_FINAL` dan `CLONE`.

Mekanisme yang sudah ada: instanced road/environment/vehicle meshes, shared materials, route caches/WeakMap lookup, lazy panels/renderer, adaptive DPR/shadows/traffic/vegetation, phase profiler, active/background/frozen regions, bounded histories, sampled 100K population.

Kesimpulan: throughput headless berada dalam budget, tetapi pengalaman browser starter city belum mencapai frame pacing stabil. P1 harus memprofilkan render/React invalidation dan cadence bersama-sama; jangan mengubah rule simulasi untuk memperbaiki FPS.

## 9. Balance map

| Scenario | Pop awal→akhir | Kas minimum→akhir | Operating budget range | Happiness min–max (σ) |
| --- | ---: | ---: | ---: | ---: |
| SMALL_TOWN | 2→16 | 3.339→3.339 | -86…-43 | 47,0–66,8 (3,99) |
| CONGESTED_CORRIDOR | 640→640 | 9.021→71.614 | 617,5…1.023,5 | 25,8–47,0 (5,11) |
| INDUSTRIAL_CITY | 160→160 | 8.063→12.951 | -10…118,5 | 48,1–65,0 (4,01) |
| FLOOD_RECOVERY | 640→640 | 9.134→94.927 | 829…1.362,5 | 26,3–44,8 (4,14) |
| PERFORMANCE_100K | 100.000→100.000 | 152.884→1.475.670 | 142.556…173.104 | 1,6–13,7 (4,55) |

Interpretasi:

- Idle starter town stabil tetapi terus defisit dan berhenti pada 16 warga. Ini bukan kegagalan karena jalur aksi P0 terpisah mencapai 25 warga, tetapi balance CLI belum mengukur jalur pemain tersebut.
- Vertical-slice test membuktikan first diagnostic ≤ hari 10, resolution ≤ hari 15, 25 warga ≤ hari 15, kas minimum >4.500, layanan pertama, milestone, specialization policy, dan replay deterministik.
- Stress fixtures mempertahankan populasi secara sintetis; cocok untuk regression throughput, bukan bukti kualitas livability atau campaign balance.
- `PERFORMANCE_100K` sengaja tanpa civic services; happiness 1,6 bukan target produk dan tidak boleh dipakai sebagai balance acceptance.

## 10. Diagnostic coverage

`calculateCausalDiagnostics` memiliki 16 rule branches dan membatasi output pada 12 kartu. Lima test diagnostic mencakup rule-specific assertions untuk stalled growth, population loss, congestion, delayed services, transit catchment, office vacancy, industrial input, dan rent pressure; satu test lintas-rule memvalidasi field sebab/solusi/biaya/dampak/lokasi.

Gap coverage langsung: climate fire risk, pollution, abandonment, negative budget, market health, long commute, dan unemployment belum semuanya memiliki isolated title/threshold/location regression masing-masing. Traffic diagnostic masih memakai busiest-road aggregate dan estimasi queue, bukan OD evidence dari trip cohort.

## 11. Feature gap analysis

| Area | Status | Gap paling bernilai |
| --- | --- | --- |
| 20-minute vertical slice | Implemented + deterministic test | Browser playthrough/timing manusia belum otomatis |
| Living city | Citizen Stories minimal implemented | routine/day-night/shop/school/pedestrian belum menjadi story/visual event lengkap |
| Traffic/transit | Sistem dalam; insight/route map ada | belum ada OD traffic story + before/after intervention ledger |
| Economy/policy | Telemetry kuat | policy belum menyimpan beneficiary/loser/short/long-term contract eksplisit |
| Disaster resilience | Impact/recovery kuat | belum ada state machine forecast→evaluation dan preparation actions |
| District identity | Policy districts ada | identity evidence/confidence/visual cue belum diturunkan dari data |
| Specialization | Auto-derived + early policy choice | tujuh specialization package belum unik secara mission/building/problem/evaluation |
| Campaign/challenge | Scenario foundation ada | content campaign lengkap, setup modifiers, trajectory scoring belum ada |
| Landmark | Cargo/recovery foundation | staged landmark projects dan skyline impact belum lengkap |
| City history | Numeric history + event journal | curated deterministic city chronicle belum ada |
| UX/accessibility | 3 layers + 2D + localization catalog | touch targets, browser visual regression, localization seluruh copy |
| Visual/audio | Tropical procedural direction + synthetic cues | audio ambience lifecycle/mute QA dan state-driven district identity |
| Architecture | domain modules + hooks | App/large components masih terlalu besar |
| Performance | headless budgets pass | browser starter frame pacing gagal mencapai stabil 60 FPS |

Responsive audit:

- 360×800, 768×1024, 1024×768, dan 1440×900 tidak menghasilkan horizontal document overflow.
- Pada sampel tablet/desktop, 32 dari 38 control terlihat berada di bawah 44×44; pada mobile beberapa tombol HUD berukuran tinggi 24–38 px.
- Mode 2D dapat diaktifkan, HUD/build/speed/reset/info controls tetap tersedia, dan test unit membuktikan build/overlay helpers. Ini belum setara end-to-end browser interaction test.

## 12. Prioritization

### P0 — wajib sebelum ekspansi konten

Status: secara fungsional sudah diimplementasikan dan gate deterministik lulus.

- Pertahankan vertical-slice contract dan tambah browser playthrough test yang benar-benar melakukan road→utility→zone→simulate→diagnose→resolve→specialize.
- Masukkan trace aksi P0 ke `npm run balance`, agar gate tidak hanya mengukur idle starter town.
- Tutup isolated coverage diagnostic awal.
- Jangan menambah schema baru atau rewrite `App.tsx` di tahap ini.

### P1 — pengalaman yang harus dikerjakan berikutnya

- Traffic Story berbasis OD trip nyata, bottleneck contribution, cohort separation, dan before/after intervention.
- Living-city routine yang terlihat: work/school/shop/service/emergency/day-night; visual hanya dari state nyata.
- Browser performance profiling dan targeted invalidation/render optimization.
- Touch target minimum, keyboard path, responsive modal/toolbar verification, dan localization completeness.
- Disaster preparation slice untuk flood saja setelah traffic story stabil.
- Ekstraksi orchestration `App.tsx` hanya di sekitar area yang disentuh dan telah memiliki tests.

### P2 — differentiation dan replayability

- District identity evidence/confidence + bounded modifiers.
- Policy consequence contracts per cohort/district.
- Specialization packages lengkap.
- Campaign/challenge trajectory scoring.
- Landmark projects dan city history.
- Region/world scale polish setelah browser performance stabil.

## 13. Roadmap implementasi berurutan

Setiap fase di bawah wajib melewati lint, full tests, build, smoke, balance, benchmark, dan targeted browser verification bila menyentuh UI/render.

### Fase 1 — Audit dan gap analysis

- Tujuan: baseline terukur dan batas arsitektur.
- Data/engine/UI/visual/audio: tidak berubah.
- Test: seluruh gate baseline.
- Risiko: dokumentasi lama mengklaim lebih dari yang dibuktikan runtime.
- Persetujuan: tidak diperlukan.
- Status: selesai dalam dokumen ini.

### Fase 2 — Vertical slice 20 menit

- Tujuan: aksi pertama <60 detik, warga ≤5 menit, masalah ≤10, solusi ≤15, specialization ≤20.
- Data: gunakan state/command/policy yang ada; hindari schema baru.
- Engine: pertahankan causal sequence dan replay.
- UI: tutorial selalu menunjukkan satu next action dan focus location.
- Visual/audio: highlight lokasi + build/success/warning cues yang sudah ada.
- Test: P0 action trace, treasury floor, diagnostic/resolution, milestone, replay, browser flow.
- Risiko: waktu “menit” masih diproksikan oleh hari/tick.
- Persetujuan: definisi mapping waktu nyata ↔ hari simulasi untuk acceptance manusia.
- Status: implemented; browser automation masih gap.

### Fase 3 — Living city

- Tujuan: keputusan agregat terasa sebagai kehidupan warga.
- Data: bounded citizen event/story ledger; tidak menyimpan flavor random.
- Engine: derive work/school/shop/transit/flood/service lifecycle dari telemetry nyata.
- UI: latest story di City Pulse, detail di City Information, focus location.
- Visual: agents/occupancy/window/activity hanya saat state mendukung.
- Audio: ambience/event mix mengikuti density, rain, traffic, emergency.
- Test: deterministic triggers/outcomes, bounds, save migration, day/night behavior.
- Risiko: agent sampling dapat disalahartikan sebagai satu warga literal.
- Persetujuan: naming tone warga, individual vs household narration, reward vs informational.
- Status: Citizen Stories minimal selesai; routine breadth ditunda.

### Fase 4 — Traffic dan transit

- Tujuan: pemain dapat menjelaskan siapa pergi dari mana ke mana dan mengapa satu koridor gagal.
- Data: read-only `TrafficStory` snapshot berisi origin zone/district, destination, purpose/mode, route, bottleneck share, affected trips, confidence, baseline/intervention delta.
- Engine: derive dari `activeTrips`, freight, service/transit agents, lane/queue telemetry; bounded history, tanpa mengubah routing rules pada slice pertama.
- UI: satu traffic story utama di City Pulse/City Information; focus origin, bottleneck, destination; before/after setelah action.
- Visual: route/cohort overlay memakai geometry yang ada.
- Audio: tidak ada audio baru pada slice pertama; traffic intensity tetap state-driven.
- Test: OD aggregation, 78%-style bridge explanation, cohort separation, deterministic tie-break, before/after delta.
- Risiko: active-trip sampling harus menampilkan confidence dan represented-trip scale.
- Persetujuan: durasi baseline/intervention window dan apakah story disimpan atau dihitung ulang.

### Fase 5 — Economy dan policy

- Tujuan: setiap policy adalah kontrak trade-off yang dapat diaudit.
- Data: cost, benefit, beneficiary, disadvantaged, shortTerm, longTerm, evaluation metrics.
- Engine: bounded modifiers per cohort/district; no hidden bonuses.
- UI: preview sebelum apply dan evaluation setelah beberapa hari.
- Visual/audio: hanya cue bila district/building telemetry berubah; confirmation cue dapat dimute.
- Test: winners/losers, fiscal impact, long-run bounds, replay/save migration.
- Risiko: modifier stacking dan runaway compounding.
- Persetujuan: cohort vocabulary dan maksimal magnitude policy.

### Fase 6 — Disaster resilience

- Tujuan: flood pertama menjadi forecast→prepare→impact→respond→recover→evaluate.
- Data: disaster phase, forecast confidence/window, preparation orders, evaluation snapshot.
- Engine: satu deterministic flood scenario; action preparation mengubah exposure/capacity, bukan RNG outcome diam-diam.
- UI: risk map, countdown, prioritized actions, post-event comparison.
- Visual/audio: risk bands, barrier/shelter/service staging, rain/siren/recovery cues.
- Test: prepared vs unprepared same seed, closure/reroute, recovery, save mid-phase.
- Risiko: forecast terlalu akurat menghilangkan ketegangan; terlalu kabur terasa random.
- Persetujuan: warning duration, forecast confidence, failure severity.

### Fase 7 — District identity

- Tujuan: kawasan memiliki karakter yang terbaca dan memengaruhi permainan.
- Data: evidence scores, dominant/secondary identity, confidence, bounded modifiers.
- Engine: derive density/income/mix/transit/pollution/value/services/pedestrian ratios.
- UI: explanation “mengapa distrik ini menjadi X” dan levers untuk mengarahkannya.
- Visual/audio: palette/props/activity mix dari identity state; tidak ada aset tiruan.
- Test: classification, hysteresis, modifier bounds, save/replay, visual state mapping.
- Risiko: identity flip-flop dan self-reinforcing runaway.
- Persetujuan: otomatis murni atau player-directed melalui policy.

### Fase 8 — Specialization

- Tujuan: tujuh arah kota benar-benar berbeda dalam problem dan reward.
- Data: specialization contract: unlock, unique content, trade-off, evaluation.
- Engine: bounded modifiers dan mission hooks; satu specialization per iterasi.
- UI: choice, evidence, locked consequences, progress evaluation.
- Visual/audio: cue unik berbasis state/building, bukan skin semata.
- Test: unlock, trade-off, counter-pressure, replay/save, no dominant strategy.
- Risiko: content explosion.
- Persetujuan: specialization pertama dan apakah respec diperbolehkan.

### Fase 9 — Campaign

- Tujuan: skenario mengajarkan sistem melalui constraint dan recovery path.
- Data: seed, start state, modifiers, objectives, events, scoring trajectory.
- Engine: evaluasi multi-dimensional; tidak hanya snapshot populasi.
- UI: briefing, objective chain, consequence, evaluation.
- Visual/audio: scenario-specific state cues; reuse procedural system.
- Test: start/end, no softlock, objective ordering, replay, save/resume.
- Risiko: campaign content menutupi balance sandbox.
- Persetujuan: campaign pertama dan target difficulty/time.

### Fase 10 — Performance polish

- Tujuan: stabilitas browser starter dan graceful scale tanpa mengubah hasil simulasi.
- Data: telemetry non-persisten saja.
- Engine/runtime: profile-guided caching, structural sharing, region cadence; verify identical hash.
- UI/render: memoization, batching, LOD/instancing, lazy advanced panels, debug-only overlay.
- Visual/audio: quality fallback menjaga readability dan audio mute.
- Test: state hash before/after optimization, p95 regression, four viewports, long-run memory.
- Risiko: cache invalidation dan stale visualization.
- Persetujuan: device performance tiers dan target FPS minimum.

## 14. Before/after status

### UX

- Sebelum pekerjaan P0/Living City yang sudah ada di worktree: starter connection/tutorial/2D focus contracts memiliki gap dan warga hanya terlihat sebagai agregat.
- Sekarang: deterministic P0 action path, always-visible next action, focus/reset, 2D overlays, City Pulse, dan Citizen Stories minimal tersedia.
- Belum tercapai: browser-proven 20-minute flow, touch target 44×44, complete localization, OD traffic explanation.

### Balance

- Sebelum P0: idle starter berhenti 16 warga dan tidak membuktikan milestone 25.
- Sekarang: action-path test melewati 25 ≤ hari 15, diagnostic ≤10, resolution ≤15, dan treasury floor >4.500.
- Belum tercapai: `npm run balance` belum memasukkan action path; idle starter tetap defisit -86…-43/hari.

### Performance

- Headless benchmark kini memiliki sampled/aggregate 100K fixture yang nyata dan semua p95 berada dalam budget.
- Entry bundle bertambah menjadi 399,41 kB (123,55 gzip) setelah Citizen Stories; Three chunk tetap 1.119,52 kB.
- Browser starter masih menunjukkan frame p95 100 ms dan adaptive reduction; inilah target optimasi berbasis profiler berikutnya.

## 15. Risiko utama

1. Broad `CityState` dan compact positional tile tuple membuat evolusi schema rawan.
2. App/UI hotspot dapat memicu React invalidation luas dan memperburuk frame pacing.
3. Headless benchmark dapat memberi rasa aman palsu terhadap browser/render performance.
4. Synthetic stress fixtures bukan bukti fun, readability, atau recovery fairness.
5. Diagnostics berisiko oversimplify bila tidak memakai cohort/OD evidence dan confidence.
6. Specialization/district modifier dapat membentuk positive feedback runaway.
7. Menambah story/history tanpa bounds akan membengkakkan save dan render.
8. Banyak perubahan worktree belum dipisahkan per fase/commit, sehingga bisect/regression lebih sulit.

## 16. Fitur yang sengaja ditunda

- Tujuh specialization penuh sekaligus.
- Seluruh campaign/challenge content.
- Landmark portfolio.
- Multi-disaster preparation sebelum flood slice terbukti.
- Nama/personality warga dan reward story sebelum tone disetujui.
- Rewrite besar `App.tsx` atau `CityState`.
- Schema save baru hanya untuk dashboard/derived metrics.
- Asset/audio pack eksternal sebelum state-driven cue contract stabil.
- Klaim 100K real-time rendered citizens; fixture memakai 20 agents × populationScale 5.000.

## 17. Keputusan berikutnya yang membutuhkan persetujuan produk

Urutan rekomendasi implementasi berikutnya adalah Traffic Story read-only, karena ini memperkuat core loop tanpa mengubah routing, save schema, atau balance. Empat keputusan produk sebelum memperluas Living City tetap terbuka:

1. Nama Indonesia deterministik, label netral, atau campuran regional.
2. Narasi citizen individual vs household.
3. Story informasional vs reward kecil.
4. Cooldown/history story final.

Untuk Traffic Story, dua keputusan dapat ditunda sambil membuat evaluator murni dan tests: panjang comparison window serta persistence snapshot. Default aman adalah evaluator read-only per tick dan before/after ring buffer kecil hanya setelah UX-nya terbukti.
