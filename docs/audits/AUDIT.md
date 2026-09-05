# Skyline Simulator — Deep Audit

> Historical: audit ini bertanggal 2026-08-22. Untuk status command dan quality gate terbaru, lihat `CURRENT_STATUS_2026-09-05.md`.

Tanggal audit: 2026-08-22

## Kondisi arsitektur

Game memakai React + TypeScript + React Three Fiber/Three.js dengan grid deterministik 60×60. `engine.ts` menjalankan tick kota; citizen simulation menyimpan household, jobs, schools, migration, trips, dan modal split; `traffic.ts` menyimpan road graph; service/utility/depth systems menghitung jaringan dan kondisi kota; UI dan renderer membaca `CityState` yang sama.

## Upgrade yang sudah diverifikasi

- Starter city memakai pocket land yang dicari deterministik, bukan koordinat buta di sungai.
- Road hierarchy: `LOCAL`, `ARTERIAL`, `HIGHWAY`. Kelas jalan memengaruhi biaya, maintenance, capacity, speed, traffic, noise/pollution, land-use suitability, inspector, overlay, dan save migration.
- Road recovery projects: tool Road Works memperbaiki satu ruas rusak dengan biaya proporsional, memulihkan road condition/capacity, menurunkan disaster impact, memunculkan notifikasi, dan memiliki Road Condition overlay sehingga pemain dapat memilih kapan memprioritaskan anggaran pemulihan.
- Multi-lane/intersection traffic: profil 1/2/3 lajur, simpang mengenali road priority, delay unsignalized/signalized/smart lights, grade-aware weighted routing, road condition, bridge topology, tunnel topology, dan rendering marka/struktur.
- Turn-aware traffic: route solver menyimpan konteks incoming/current/outgoing, mengklasifikasikan straight/left/right/U-turn, menerapkan fase sinyal deterministik dan turn-lane friction, sementara congestion menghitung weighted movement pressure di simpang.
- Lane assignment dan spillback: setiap trip kendaraan memilih lane target berdasarkan gerakan berikutnya, perpindahan lane diberi pressure, distribusi load per lane memunculkan spillback saat satu lane jenuh, telemetry tampil di Inspector, dan route solver mempertimbangkan lane utilization tick sebelumnya.
- Queue discharge dan assignment feedback: setiap ruas menghitung queue pressure dari peak lane load versus discharge ratio simpang (signal/stop/roundabout), backlog antrean tumbuh dan terkuras lintas tick, route solver memberi penalty pada antrean tick sebelumnya, assignment demand menyebar ke koridor paralel, dan average queue pressure tampil di City Information.
- Intersection operations: setiap simpang dapat diatur sebagai `AUTO`, `SIGNAL`, `STOP`, atau `ROUNDABOUT`; pemain dapat memblokir gerakan straight/left/right/U-turn, routing menghindari gerakan terlarang, roundabout memakai friction berbeda, kontrol tampil di Inspector/road mesh, dan seluruh konfigurasi disimpan.
- Dynamic signal timing: lampu signal memakai fase berbasis waktu kota, dapat memilih mode `ADAPTIVE`, `FIXED_NS`, atau `FIXED_EW`, memiliki offset per simpang, dan mode adaptif memberi green time lebih panjang secara deterministik kepada sumbu dengan tekanan kendaraan lebih besar; fase ini ikut memengaruhi delay dan congestion.
- Public transit: depot/station powered + road-connected, capacity, coverage, ridership, modal split, traffic relief, overlay, dan kendaraan instanced.
- Transit line planner: stop berurutan untuk bus/tram, fleet/headway estimate, average wait, transfer-stop detection, validasi power + road connection + satu komponen jaringan jalan, route-aware citizen trips, serta line manager untuk pause/aktifkan dan menghapus jadwal.
- Transit fleet agents: tiap line valid menghasilkan vehicle agents dengan loop stop nyata, headway, kapasitas, okupansi, dwell time, platform capacity, dan armada instanced yang hidup terlepas dari kebetulan modal split warga.
- Transit scheduling: setiap line memiliki service window, peak window, dan peak headway yang dapat diedit di Transit Line Manager; clock kota mengubah fleet size, capacity, wait, ridership, fare, dan operating cost secara deterministik.
- Transit economy: ridership menghasilkan fare revenue, sementara bus/tram fleet, frekuensi, dan platform capacity menambah operating cost harian yang masuk ke treasury serta City Information.
- Parking/curb system: Parking Lot buildable dengan supply finite 24 spaces/lot, matching demand residential/commercial/industrial, coverage/pressure metrics, modern 3D lot + solar canopy, dan circling traffic penalty pada tujuan tanpa parking catchment.
- Road-facing frontage: residential, commercial, mixed-use, dan clean-tech industrial lots menghitung tetangga jalan terdekat dan memutar façade/driveway ke frontage tersebut; variasi hash tetap dipertahankan di dalam orientasi yang benar.
- City services: road reach, facility capacity, overlapping assignment, congestion-sensitive response quality, dan coverage berbobot populasi.
- Early-game viability: micro-town municipal baseline sampai 25 warga mencegah service cliff pada starter city; commercial/industrial job growth berjalan eksplisit agar demand membentuk taxable activity sebelum pemain memperluas zoning.
- Freight/logistics: highway access, industrial output, freight demand/capacity/reliability, commercial stock, multi-commodity ledger FOOD/GOODS/MATERIALS/FUEL berbasis resource, dan feedback ke growth serta revenue.
- Production recipes: industri kini memerlukan input komoditas nyata (MATERIALS/FUEL dan variasinya), gateway import hanya memberi dukungan terbatas, production efficiency turun saat input shortage, dan load input terlihat di Economy.
- Cargo Terminal: fasilitas buildable dengan biaya/maintenance, utilitas + road access, throughput finite, gateway import alternatif, dan export freight runs untuk surplus industri.
- Freight agents: delivery/import trips dengan path jalan nyata, cargo load yang memengaruhi congestion, active freight runs di CityState, serta truck instancing di scene 3D.
- Warehouse inventory: fasilitas warehouse buildable dengan capacity berbasis level, inventory buffer persisten antar-tick, warehouse-to-commercial distribution leg, utility demand, inspector, commodity stock metrics, dan metrics ekonomi.
- Incident dispatch: lifecycle deterministik untuk FIRE/MEDICAL/CRIME/TRAFFIC, response berdasarkan service capacity + road access, multi-unit dispatch, agency capacity sharing berbasis prioritas, response progress, queued-unit load, happiness penalty, notifications, incident overlay, nearest-facility dispatch path, dan service-vehicle instancing per unit.
- Incident chains: severe fire dapat menyebar ke tile built di sebelahnya saat kapasitas pemadam habis, dengan parent incident dan batas spawn per tick agar emergent tetapi tetap bounded/deterministic.
- Service fleet agents: unit pemadam, ambulans, polisi, dan traffic response memiliki role, path dispatch, status dispatch/on-scene/returning, condition/fuel, kapasitas fleet operasional per fasilitas, active/available metrics, dan operating cost.
- Depot maintenance: kondisi depot layanan disimpan lintas tick/save, aus lebih cepat saat unit aktif, memengaruhi unit fleet yang operasional dan available, menambah maintenance cost terukur, serta dirangkum di Fleet Condition; pemain dapat memesan overhaul dua tick dari Inspector dengan biaya langsung dan pemulihan condition.
- Land-use suitability: kualitas residential/commercial/industrial dihitung dari land value, clean air, layanan, kelas jalan, dan resource; memengaruhi growth, evolution, dan migration priority.
- Terraforming/elevation: Raise/Lower/Level/Smooth aktif melalui sidebar, memakai brush dan biaya per tile; terrain block, road grade, bridge/tunnel, serta state save/load konsisten.
- Urban form: blok 2×2 parcel matang yang berdampingan digabung sebagai render footprint, sementara populasi/jobs tetap dihitung per tile agar ekonomi tidak kehilangan granularitas.
- Persistent parcel gameplay: zoning baru dipecah deterministically menjadi lot 2×2/2×1/1×2/1×1 dengan `parcelId`, seed, ownership CITY/PRIVATE, status ZONED/DEVELOPING/ACTIVE/ABANDONED, kapasitas berbasis luas lot, dan batas footprint visual yang tidak boleh menyeberangi kepemilikan.
- Spatial districts: District Planner dapat membuat kawasan bernama dengan radius dan policy lokal GREEN/TRANSIT_ORIENTED/MIXED_USE/INDUSTRIAL_LOGISTICS/COMMUNITY_SERVICES; efeknya masuk ke environment, demand, service coverage, transit propensity, mixed-use footprint, save state, dan Districts overlay.
- Modern residential visual kit: enam variasi deterministik per level hunian, facade netral kontemporer, kaca/balkon/kanopi/solar panel/rooftop treatment, serta lot grass-paving-driveway-shrub agar rumah tidak tampil sebagai klon atau voxel biru.
- Modern commercial frontage kit: cafe/retail strip/showroom/corner shop untuk low-rise dan beberapa massing office/plaza untuk mid/high-rise, dengan glazing, planter, roof cap, solar detail, dan variation hash yang stabil.
- Mixed-use urban form: pola 2×2 commercial-frontage + residential-back parcels dirender sebagai satu blok kontemporer dengan podium retail, upper residences, balconies, green roof, dan solar detail; nilai simulasi tetap per parcel.
- World readability: terrain kosong memakai palet natural berbasis resource dan locked region memakai fog-plane ringan, bukan balok hitam yang memutus ilusi dunia.
- Natural disasters: EARTHQUAKE/FLOOD/WILDFIRE/STORM deterministik dengan severity/radius/duration, flood propagation berbasis lowland/water adjacency, road-condition damage dan response-quality recovery rate, dampak environment/land value/abandonment, recovery load, happiness, overlay, notification, dan save persistence.
- Surface hydrology: setiap tick water depth menyebar dari sumber air melalui koridor rendah, steep barriers menghalangi aliran, downhill flow vector dicatat, taman dan green/forest land menyerap lebih banyak limpasan daripada parking/road surface, flood threshold memengaruhi disaster impact/severity, dan metrik flooded/average/peak/flowing tampil sebagai overlay serta Environment telemetry.
- Flood infrastructure: `FLOOD_BARRIER` memblokir propagation pada koridor yang dipilih tetapi membiarkan aliran memutar, sementara `WATER_RESERVOIR` menyerap limpasan downstream ke storage persisten; keduanya buildable, punya visual 3D, maintenance, validation lokasi, Inspector, Environment telemetry, dan save persistence.
- Save format naik ke Version 12; metadata parcel ownership/subdivision, mixed-use floor program, reservoir storage, flood barriers, service depot condition, maintenance cost, road class/structure, road condition, intersection control, turn restrictions, disaster impact, transit fleet, density/rent fields, company telemetry, dan state bencana tersimpan; save lama dimigrasikan dengan default aman.
- Zoning density Low/Medium/High, Office demand/utilization, rent/affordability, household preference, company telemetry, climate/seasons, service upgrades, dan passenger stops kini terhubung ke engine, UI, serta save migration Version 12.
- Trade contract settlement memisahkan import/export capacity per komoditas; kontrak import mendukung supply chain, export contract menghasilkan revenue treasury, dan diagnostic layer menjelaskan vacancy/input shortage/rent pressure/climate risk.

## Verification evidence

```text
npm test -- --run  -> 20 test files, 97 tests passed
npm run lint       -> TypeScript check passed
npm run build      -> Vite production build passed
365-day stress run -> no crash, no NaN/Infinity, day 366/time 12:00; starter pocket stabilizes at 8 residents/9 jobs without expansion, production metrics remain finite (efficiency 100%, input load MATERIALS 1), parking metrics remain finite (demand 4 / supply 0 / pressure 2), hydrology remains finite (66 flooded tiles, average depth 0.02, peak 0.71, 50 flowing tiles), service fleet remains finite (0 active / 0 available without service facilities), commodity stocks remain finite (FOOD 100%, GOODS 100%, MATERIALS 50%, FUEL 100%), making the fixed-capacity fiscal limit explicit
district stress run -> one Green Core district persisted through 120 ticks to day 121; 25 tiles, happiness 60, demand remained finite, invalid values 0
browser smoke      -> no runtime error; canvas 1920x1080, Roads/Terrain/Info Views reachable, refreshed scene visible, camera frames the starter settlement, Hydrology overlay activates, Environment shows flood/depth/flow metrics, Services shows Service Fleet metrics; only dependency warning THREE.Clock
```

## Remaining parity gaps

Game belum boleh diklaim identik dengan Cities: Skylines 2. Pekerjaan besar yang masih tersisa:

1. Transit sudah punya vehicle agents, passenger stops, headway, dwell, platform capacity, transfer routing, fare/operating economics, clock kota, dan schedule editor berbasis jam; yang tersisa adalah depot maintenance khusus transit dan timetable multi-day/weekday.
2. Road network sudah punya multi-lane profile, per-trip lane assignment, lane-change pressure, spillback-aware congestion, queue backlog yang tumbuh/terkuras lintas tick, turn-aware route solver, persistent turn restrictions, signal/stop/roundabout controls, fase signal berbasis waktu dengan mode adaptive/fixed dan offset, assignment demand ke koridor paralel, serta roundabout-aware routing, tetapi belum ada vehicle lane trajectories individual, per-lane queue discharge event yang benar-benar time-sliced, yellow/all-red/pedestrian phase, dan network assignment skala metropolitan.
3. Warehouse inventory, local/import/distribution agents, production recipes, dan Cargo Terminal sudah ada, termasuk multi-commodity stock ledger; belum ada persistent export contracts, commodity-specific warehouse compartments, dan production chains lintas beberapa fasilitas.
4. Incident dispatch dan service fleets sudah punya multi-unit queue, progress, agency capacity sharing berbasis prioritas, bounded fire spread, incident chains, role-specific agents, depot capacity, return lifecycle, depot condition, maintenance cost, dan maintenance work orders dua tick yang dapat dijadwalkan pemain; belum ada ambulance/police pursuit lintas beberapa incident atau station bay queues.
5. Urban form sudah punya persistent multi-tile ownership, procedural lot subdivision 2×2/2×1/1×2/1×1, render footprint berbasis batas parcel, mixed-use block komersial-residensial yang gated oleh tech/policy, parking gameplay dasar, dan spatial districts dengan local policy; belum ada mixed-use floor programs yang memengaruhi ekonomi secara langsung dan asset variety setara game komersial.
6. Terrain/bridge/tunnel/disaster sudah terintegrasi dengan surface-water flow, depth thresholds, Road Works, flood barriers, dan reservoir storage; belum ada culvert routing penuh, deformable terrain, tunnel portals kompleks, dan recovery projects multi-tahap.

Urutan prioritas berikutnya: time-sliced per-lane queue events + yellow/all-red/pedestrian signal phases → multi-agency pursuit + station bay queues → culvert routing/deformable terrain → mixed-use floor programs → long-run performance and visual QA. Fiscal tuning setelah zoning expansion tetap diperlukan agar biaya jaringan, district policy, fleet, intersection control, parcel capacity, flood infrastructure, dan pertumbuhan penduduk menghasilkan kurva treasury yang sehat.
