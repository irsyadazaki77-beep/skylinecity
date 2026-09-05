# Skyline Simulator

Skyline Simulator adalah city-builder 3D berbasis React, TypeScript, Three.js, dan React Three Fiber. Game dimulai dalam keadaan pause agar pemain dapat memahami fondasi kota sebelum simulasi berjalan.

Status gate terbaru dan batasan audit ada di [docs/audits/CURRENT_STATUS_2026-09-05.md](docs/audits/CURRENT_STATUS_2026-09-05.md). Dokumen audit bertanggal sebelumnya tersimpan di `docs/audits/` dan rencana kerja tersimpan di `docs/plans/`.
Flow browser nyata untuk vertical slice ada di [docs/plans/BROWSER_SMOKE_FLOW.md](docs/plans/BROWSER_SMOKE_FLOW.md); suite E2E browser nyata Playwright dijalankan dengan `npx playwright test`.

## Menjalankan proyek

```bash
npm install
npm run dev
```

Perintah lain yang tersedia:

```bash
npm run build         # production build
npm run lint          # ESLint static analysis + TypeScript type check
npm test              # Vitest regression suite
npm run benchmark     # official deterministic performance/integrity suite
npm run balance       # deterministic economy/progression health trace
npm run smoke         # release smoke: build command, simulate, save preview, replay
npx playwright test   # Playwright real browser E2E test suite (desktop & mobile)
npm run release-check # full release validation (lint + tests + build + smoke + balance + benchmark + E2E)
```

`npm run benchmark` menjalankan `SMALL_TOWN`, `CONGESTED_CORRIDOR`,
`INDUSTRIAL_CITY`, `FLOOD_RECOVERY`, dan `PERFORMANCE_100K`. Laporan menampilkan
percentile tick/fase, target budget, populasi, entitas aktif, dan hash state. Gate ini
gagal bila state menjadi non-finite atau replay seed yang sama menghasilkan hash
berbeda; pelampauan budget hanya advisory karena runtime scheduler akan menurunkan
quality/cadence secara otomatis.
Gunakan `SKYLINE_BENCHMARK_TICKS=30 npm run benchmark` untuk sampel lebih panjang.

## Sistem utama

- Generator dunia deterministik dengan river valley, highway outside connection, resource tiles, elevation, dan region unlock 3x3.
- Simulasi utilitas berbasis jaringan jalan untuk listrik dan air.
- Hierarki jalan dengan Local Road, Arterial, dan Highway. Kelas jalan memengaruhi biaya, upkeep, kapasitas, kecepatan perjalanan, weighted routing, noise/polusi, traffic overlay, dan bisa di-upgrade langsung lewat drag tool.
- Road network lanjutan: profil 1/2/3 lajur, simpang otomatis bersinyal pada jalan prioritas, smart-light delay, penalti grade/elevasi, bridge highway di atas air, dan tunnel highway dengan struktur tersimpan.
- Citizen simulation dengan household, migration, rent, satisfaction, education, job matching, commute, modal split, dan traffic trips.
- Citizen Stories membentuk feed deterministik dari household/trip nyata—kedatangan keluarga, pekerjaan, commute panjang, penggunaan transit, dan dampak banjir—lengkap dengan sebab, dampak, pilihan, biaya, lokasi, serta outcome ketika kondisi pulih. Feed baru muncul setelah milestone Town agar onboarding tetap sederhana.
- RCI demand, building evolution level 1–5, city services, land value, pollution, noise, crime, waste, economy, milestones, missions, achievements, policies, events, tech tree, serta save migration.
- Early-game balance menyediakan municipal baseline sampai 25 warga agar starter town tidak runtuh sebelum layanan pertama dibangun; pertumbuhan pekerjaan komersial/industri dipisahkan dari migrasi warga sehingga taxable activity benar-benar terbentuk.
- Core-loop advisor menampilkan satu langkah berikutnya yang actionable (build/connect/grow/diagnose/progress) dan langsung mengaktifkan tool atau panel yang relevan.
- Starter missions mencakup utilitas, kesehatan lingkungan, cashflow positif, transit, dan resilience; grant memberi recovery path yang terukur.
- Public transit yang benar-benar dapat dibangun setelah unlock: Bus Depot dan Tram Station memiliki biaya/upkeep, syarat road + power, jangkauan jaringan, kapasitas, coverage berbobot populasi, ridership, modal split warga, traffic relief, overlay, dan armada bus/tram instanced di scene 3D.
- Transit line planner untuk membuat line bus/tram dengan stop berurutan, fleet/headway estimate, average wait, transfer-stop detection, route-aware citizen trips, serta pause/aktifkan dan penghapusan line dari City Information.
- City services memakai kapasitas operasional dan assignment berbasis kedekatan jalan; klinik, sekolah, pemadam, dan polisi tidak lagi memberi coverage tak terbatas hanya karena berada dalam radius.
- Ekonomi antarsektor melacak consumer demand, retail supply, goods demand/supply, utilization komersial/industri, dan market health; metrik tersedia di City Information.
- Freight/logistics menghitung demand, capacity, reliability, highway access industri, dan connected industries; delivery/import runs berbasis path jalan ikut menambah congestion dan ditampilkan sebagai truck instanced. Resource industry menghasilkan commodity FOOD/GOODS/MATERIALS/FUEL dengan stock ledger per kategori.
- Warehouse buildable menyediakan inventory buffer berbasis level, menerima local/import freight, mengirim distribution leg ke komersial, dan menampilkan capacity/buffer di City Information.
- Service response capacity ikut turun saat ruas jalan yang dijangkau fasilitas mengalami kemacetan.
- Transit line trips memakai catchment stop nyata: perjalanan direct memakai satu line, perjalanan antarkoridor membutuhkan shared stop dan membawa waktu transfer.
- Incident dispatch membuat FIRE, MEDICAL, CRIME, dan TRAFFIC calls deterministik; service capacity dan akses jalan memengaruhi response time, happiness, overlay, notification, dan service vehicles.
- Incident dispatch memakai multi-unit queue: severity menentukan kebutuhan unit, kapasitas layanan menentukan unit yang benar-benar berangkat, unit antrean dan response progress masuk ke City Information, dan setiap unit tampil sebagai kendaraan respons.
- Kapasitas dispatch kini benar-benar dibagi antar incident se-agensi: panggilan severity tinggi mendapat unit lebih dahulu, sementara panggilan lain tetap berada di queue dan memengaruhi response load sampai resource tersedia.
- Emergency service fleet memakai unit persistent: fire engine, ambulance, police car, dan traffic unit memiliki rute jalan, status dispatch/on-scene/returning, condition/fuel, kapasitas fleet per fasilitas, dan biaya operasi yang terlihat di City Information.
- Fire incident chain: kebakaran severity tinggi dapat menyebar ke bangunan built yang berdampingan ketika kapasitas pemadam habis, tetapi tetap dibatasi dua spawn per tick dan deterministik untuk menjaga performa.
- Natural disaster response membuat EARTHQUAKE, FLOOD, WILDFIRE, dan STORM deterministik; flood merambat melalui koridor dataran rendah dari sumber air, bencana merusak road condition, memengaruhi kapasitas/kecepatan routing, kesehatan, nilai lahan, abandonment, happiness, overlay, dan laju pemulihan yang dipengaruhi kualitas layanan.
- Surface hydrology menghitung kedalaman air dan arah aliran downhill setiap tick; steep barrier menghalangi propagation, park/forest/fertile land menyerap limpasan, flood depth memberi disaster impact/severity, dan overlay Hydrology serta Environment telemetry memperlihatkan flooded tiles, average/peak depth, dan flowing tiles.
- Flood Barrier dan Reservoir dapat dibangun di tepi koridor air; barrier memutus jalur flow, reservoir menahan storage limpasan, biaya/maintenance masuk treasury, dan metriknya terlihat di Inspector serta Environment.
- Terraforming aktif dengan Raise, Lower, Level, dan Smooth brush; elevasi divisualisasikan sebagai terrain blocks dan disimpan lintas save.
- Urban form menggabungkan parcel matang 2×2 yang bersebelahan menjadi footprint bangunan koheren saat dirender, tanpa mengorbankan simulasi per-lot.
- Residential visual variety memakai enam archetype deterministik per level: detached villa, split-level, townhouse row, courtyard house, glass cube, dan compact modern home; setiap lot mendapat driveway, paving, shrubs, facade palette, balkon/kanopi/solar panel sesuai tier.
- Commercial frontage juga bervariasi secara deterministik: cafe, retail strip, showroom, corner shop, compact office, plaza, dan tower massing modern agar blok kota tidak tersusun dari satu siluet berulang.
- Blok mixed-use 2×2 menggabungkan frontage commercial dan residential upper massing secara visual, dengan podium retail, balkon, green roof, dan solar detail tanpa menggabungkan ekonomi parcel di belakang layar.
- Zoning memakai persistent parcels: lot baru mendapat ID/seed/ownership/status dan subdivision deterministik 2×2, 2×1, 1×2, atau 1×1; kapasitas dan footprint visual mengikuti luas lot, sehingga zoning terasa seperti kepemilikan tanah yang berkembang.
- Mixed-use sekarang menjadi hasil progresi: footprint gabungan hanya aktif setelah teknologi `Mixed-Use Zoning` atau kebijakan insentif dinyalakan.
- Industri memakai siluet clean-tech/logistics campus yang bervariasi, bukan lagi satu workshop/cerobong berulang; kaca bangunan modern juga mendapat pencahayaan malam.
- Kamera awal otomatis membingkai settlement pertama agar kota terbaca sejak frame pertama, sementara pan/zoom tetap bebas.
- Transit bukan kosmetik: ridership menghasilkan fare revenue, sedangkan fleet, frekuensi, mode bus/tram, dan platform menghasilkan biaya operasional harian yang terlihat di City Information.
- Parking Lot dapat dibangun sebagai kapasitas finite: 24 spaces per lot, coverage/pressure terlihat di tab Traffic, dan kekurangan parking menambah circling traffic di tujuan perjalanan.
- Lot modern otomatis menghadap jalan terdekat, sehingga rumah, retail frontage, mixed-use podium, dan clean-tech industrial campus membentuk streetscape yang koheren.
- Routing kendaraan kini turn-aware: gerakan straight/left/right/U-turn dihitung terhadap fase sinyal dan tekanan lajur belok di simpang, sehingga pilihan rute dan kemacetan lebih masuk akal daripada beban seragam per tile.
- Kendaraan kini memiliki lane assignment berbasis gerakan berikutnya; lajur belok, perpindahan lajur, peak lane load, dan spillback memengaruhi congestion serta biaya rute pada tick berikutnya.
- Queue pressure dihitung dari load peak lane dan kemampuan discharge simpang; backlog bertambah saat inflow melampaui discharge dan perlahan terkuras saat ruas sepi, sementara route assignment memakai soft toll untuk menyebarkan kendaraan ke koridor paralel.
- Setiap simpang dapat diatur dari Inspector sebagai Auto, Signal, Stop signs, atau Roundabout; pemain juga dapat melarang gerakan tertentu, dan routing akan mencari jalur lain bila gerakan itu benar-benar diblokir.
- Signal timing dapat diatur per simpang sebagai Adaptive pressure, Fixed N-S, atau Fixed E-W dengan phase offset; fase mengikuti waktu kota dan tekanan kendaraan sehingga delay serta congestion ikut berubah.
- Road Works memberi kontrol pemulihan langsung: ruas yang rusak dapat diperbaiki dengan biaya proporsional, kondisi jalan dan kapasitas pulih pada tick berikutnya, serta disaster impact berkurang.
- Info Views menyediakan Road Condition overlay hijau/amber/merah untuk menemukan ruas yang perlu diperbaiki sebelum kapasitas dan response time jatuh terlalu jauh.
- Industri kini berjalan dengan production recipes: input MATERIALS/FUEL membatasi output secara nyata, kekurangan input menurunkan Production Efficiency, dan Economy menampilkan beban input produksi.
- Zoning hunian memiliki Low/Medium/High density dengan kapasitas, sewa, affordability, household preference, dan abandonment pressure yang berbeda; Office menjadi sektor pekerjaan tersendiri dengan demand, utilization, revenue, dan job tiers terpisah.
- Setiap perusahaan industri/retail/office menyimpan telemetry sektor, efisiensi, profit harian, dan input shortage; industri resource-driven tampil sebagai SPECIALIZED_FOOD/GOODS/MATERIALS/FUEL dan dapat diperiksa per parcel.
- Kontrak import/export persisten kini memecah kapasitas per komoditas, membantu supply chain saat benar-benar dibutuhkan, dan menghasilkan export revenue yang masuk treasury.
- Climate simulation deterministik memakai musim, hujan, storm, heatwave, drought, serta multiplier power/water/traffic/fire-risk; dampaknya mengalir ke hydrology, happiness, traffic, dan diagnostics.
- Service upgrades dapat dibeli pada fasilitas yang kompatibel; kapasitas/range/response naik bersama upkeep, dan passenger Bus Stop/Tram Stop terpisah dari depot/station untuk line planner.
- Causal diagnostics menjelaskan office vacancy, input industri kurang, tekanan sewa, kontrak import yang tidak efektif, dan risiko kebakaran iklim pada City Information.
- Cargo Terminal buildable menambah gateway throughput terbatas untuk import dan export freight surplus, dengan model utilitas, akses jalan, dan visual terminal modern.
- District Planner memungkinkan kawasan bernama dengan radius dan kebijakan lokal Green Quarter, Transit-Oriented, Mixed-Use Core, Logistics Hub, atau Community Services; efeknya terlihat pada overlay, lingkungan, demand, layanan, dan pertumbuhan.
- Transit Line Manager sekarang memiliki service window dan peak headway editor; jam kota mengubah fleet, capacity, wait time, ridership, dan biaya operasi secara deterministik.
- Terrain visual memakai warna natural per resource dan locked region fog-plane agar dunia terasa sebagai lanskap kota yang menyambung, bukan papan permainan blok gelap.
- Transit fleet menggunakan vehicle agent per line dengan loop stop nyata, headway, occupancy, dwell time, dan platform capacity; armada tetap bergerak meski ridership belum tinggi.
- Fleet layanan sekarang memiliki depot condition persisten: dispatch mengauskan depot, maintenance cost tercatat di treasury, dan kondisi rendah mengurangi unit operasional/available.
- Depot layanan dapat menerima overhaul manual dari Inspector; order berlangsung dua tick, biaya dibayar saat dipesan, condition pulih saat selesai, dan jumlah work order aktif terlihat di City Information.
- Scene 3D dengan terrain, procedural buildings, roads, vegetation, day/night cycle, overlays (termasuk Public Transit), traffic vehicles, camera controls, dan render settings.
- Metropolis 3.0 foundation: schema-versioned save envelope dengan migration, deterministic command queue/event journal, active/background region telemetry, staged recovery projects, persistent trade contracts, scenario campaigns, causal diagnostics, dan mod registry berbasis JSON tanpa arbitrary scripting.
- Traffic telemetry tingkat lajur menyimpan load, queue, discharge rate, signal stage yellow/all-red, dan pedestrian crossing untuk inspector serta benchmark scenario deterministik.

## Kontrol penting

- `Space` / `0`: pause atau lanjutkan simulasi.
- `1`: pause, `2`: normal speed, `3`: fast speed, `4`: ultra speed.
- `T`: technology tree, `P`: policies, `M`: missions, `B`: bulldozer, `Escape`: tutup panel dan batalkan tool.
- Kamera: gunakan toolbar kamera untuk mode 2D/3D, zoom, rotasi, fokus tile terpilih, dan reset; `Q`/`E` memutar kamera, `F` fokus tile terpilih, dan `Home` mengembalikan kamera ke settlement awal.
- Gunakan sidebar untuk memilih Local Road, Arterial, Highway, Tunnel, zoning, utilitas, layanan, transit, terrain, select, dan bulldoze. Drag dari jalan lokal ke kelas lebih tinggi akan meng-upgrade ruas dengan biaya selisih. Bridge dibangun dengan Highway melintasi air; Tunnel memakai tool Tunnel di daratan. Depot bus membutuhkan `bus_network`; Tram Station membutuhkan `tram_system`.
- Kategori `Terrain` menyediakan Raise/Lower/Level/Smooth dan memakai ukuran brush dari toolbar bawah. Setiap perubahan elevasi memiliki biaya per tile yang berubah.
- Gunakan kategori `Logistics → Warehouse` untuk membangun buffer supply chain; warehouse wajib road-connected dan power-connected agar inventory aktif.
- Setelah teknologi transit terbuka, pilih `Transit → Line Planner`, klik depot/station yang sudah powered dan menyentuh jalan secara berurutan, lalu tekan `Enter` untuk menyimpan line. Semua stop dalam satu line harus memakai mode yang sama.

## Catatan performa

Road asphalt memakai instancing GPU, weighted routing memakai cache per pasangan road node, environment props memakai cache berbasis terrain topology, transit/service BFS memakai queue index, kendaraan memakai instancing GPU, dan traffic density dapat diatur dari Settings.

Runtime memakai scheduler non-persisten: ketika p95 tick melewati budget kota
(50 ms untuk kota kecil, 120 ms untuk target 100K), renderer beralih ke quality
reduced dan cadence simulasi diturunkan. Ini menjaga UI responsif tanpa mengubah
aturan simulasi deterministik atau isi save file. Region kosong yang tidak aktif
masuk level `FROZEN`; region dengan warga, pekerjaan, network load, air, atau
emergency tetap diproses sebagai `BACKGROUND`.

## Public beta readiness

- `npm run dev` memakai config loader runner agar konsisten dengan build/test pada workspace desktop.
- Start screen menyediakan New City, Continue autosave, Load/Import, dan Settings.
- Save release memakai IndexedDB sebagai primary store dengan rotating autosave backup, import preview, dan recovery quarantine; localStorage lama tetap dibaca sebagai fallback.
- Settings menyediakan bahasa, UI scale, reduced motion, adaptive quality, kontras tinggi, bantuan penglihatan warna, experimental feature gate, volume feedback audio sintetis, dan diagnostic report lokal.
- Performance overlay dapat dilihat pada development build atau dengan membuka URL memakai `?debug=1`.
- Benchmark `PERFORMANCE_100K` tersedia bersama starter town, congested corridor, industrial city, dan flood recovery.
- Fitur advanced trade/logistics ditandai experimental dan tidak tampil pada mode stable.
