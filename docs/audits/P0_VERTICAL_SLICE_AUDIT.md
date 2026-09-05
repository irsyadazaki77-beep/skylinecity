# Skyline Simulator — Audit dan Roadmap Vertical Slice

> Historical: hasil dan angka di dokumen ini digantikan oleh `CURRENT_STATUS_2026-09-05.md`.

Tanggal baseline: 4 September 2026 (Asia/Jakarta)

## Product thesis

Skyline Simulator adalah city-builder tropis tentang hubungan sebab-akibat: pemain membentuk jaringan jalan, utilitas, hunian, dan pekerjaan; kota tumbuh; tekanan lalu lintas, layanan, ekonomi, dan iklim muncul; pemain membaca penyebabnya, memilih trade-off, lalu melihat perubahan nyata pada kota. Kedalaman sistem dipakai untuk memperkaya keputusan, bukan untuk menambah dashboard atau meniru identitas game lain.

Core loop north star:

`Bangun → kota berkembang → masalah muncul → baca penyebab → pilih trade-off → lihat perubahan di peta → buka peluang baru`

## Baseline terukur

| Gate | Hasil awal |
| --- | --- |
| `npm run lint` | Lulus, 19,677 detik wall time |
| `npm test -- --run` | Lulus, 59 file / 216 test, 9,760 detik wall time |
| `npm run build` | Lulus, Vite build 13,61 detik / 15,203 detik wall time |
| `npm run smoke` | Lulus; build command, tick, finite state, save round-trip, replay, dan viewport contracts |
| `npm run balance` | Lulus tanpa bankruptcy; `SMALL_TOWN` berakhir pada 16 warga di hari 91 |

Ukuran arsitektur awal:

- `src/App.tsx`: 1.952 baris, 89.028 byte.
- Entry JavaScript: 386,29 kB (119,48 kB gzip).
- Chunk Three.js: 1.119,52 kB (310,85 kB gzip).
- CSS: 95,48 kB (16,26 kB gzip).

## Gap analysis

### Core loop dan onboarding

- Starter settlement sudah terhubung ke highway, sedangkan langkah pertama meminta pemain membuat koneksi baru. Pathfinder tidak menghasilkan jalur build yang benar pada kondisi ini, sehingga highlight terlalu luas dan tindakan tidak kausal.
- Langkah utilitas bergantung pada `powerCapacity`/`waterCapacity` hasil simulation tick, tetapi langkah menjalankan waktu berada sesudahnya. Ini dapat mendorong pemain membangun fasilitas duplikat tanpa menyelesaikan langkah.
- Jalur minimum tutorial hanya menambah satu lot residential. Trace deterministik menunjukkan konfigurasi itu berhenti sekitar 20 warga; target milestone 25 belum dijamin.
- Langkah “masalah” dapat selesai hanya karena hari bertambah, bukan karena pemain benar-benar melihat diagnostic yang menjelaskan masalah, sebab, solusi, biaya, dan dampak.
- Spesialisasi saat ini diturunkan otomatis dari telemetry. Belum ada keputusan eksplisit pemain pada menit ke-20; dua policy milestone awal merupakan kandidat aman untuk pilihan arah awal tanpa memperluas schema save.

### Keterbacaan dan UX

- HUD, City Pulse, dan City Information sudah membentuk tiga lapisan informasi, tetapi beberapa string lama masih bercampur Inggris/Indonesia di luar localization catalog.
- `City2DCanvas` sudah memiliki build/select/bulldoze serta helper overlay, tetapi `App` belum meneruskan overlay aktif dan unlocked regions kepadanya.
- Tutorial dan camera toolbar sudah memiliki kontrak cancel/reset focus, tetapi `App` belum meneruskan state/callback tersebut.
- Test responsive saat ini memvalidasi angka viewport, bukan layout hasil render. Ini guardrail ringan, belum visual/browser regression test.

### Simulasi dan balance

- Starter tanpa tindakan aman secara fiskal, tetapi berhenti pada 16 warga. Ini baik sebagai idle baseline, bukan bukti bahwa jalur pemain dapat mencapai 25.
- Penambahan dua lot residential dapat melewati 25 dalam trace awal, tetapi memicu tekanan layanan/kebahagiaan. Ini cocok sebagai krisis kecil bila diagnostic dan satu layanan benar-benar mengarahkan pemulihan.
- Balance CLI belum melaporkan waktu menuju 25 warga, diagnostic pertama, tindakan pemulihan, atau pilihan arah kota. Karena itu gate hijau belum membuktikan target 20 menit.

### Arsitektur dan performa

- `App.tsx` tetap menjadi orchestration hotspot meski domain hooks sudah mulai diekstrak. Pemecahan lanjut diperlukan, tetapi bukan sebelum kontrak vertical slice terkunci oleh test.
- Lazy loading modal dan renderer sudah menekan entry chunk, namun Three.js masih menjadi chunk terbesar. Optimasi agresif belum layak dilakukan sebelum browser profiling aktual.
- Scheduler, region simulation, instancing, dan benchmark deterministik sudah tersedia. Jangan mengubah aturan simulasi demi angka bundle atau frame rate.

### Save/replay dan QA

- Save envelope, migration, command queue, dan deterministic replay memiliki test yang baik.
- P0 tidak memerlukan field state baru: pilihan arah awal dapat memakai `activePolicies`, sehingga schema tidak berubah.
- Test onboarding, 2D, camera, localization, dan responsive sudah ada, tetapi sebagian masih berupa contract test; P1 perlu browser-driven visual verification.

## Roadmap prioritas

### P0 — Vertical slice 20 menit (implementasi iterasi ini)

1. Buat starter connection memiliki satu gap jalan yang jelas dan deterministik; highlight hanya jalur yang benar.
2. Nilai utilitas dari infrastruktur dan konektivitas aktual sebelum tick, bukan hanya aggregate hasil tick.
3. Minta kapasitas hunian minimum yang benar-benar cukup untuk 25 warga serta satu tambahan zona pekerjaan.
4. Selesaikan langkah masalah hanya setelah causal diagnostic nyata tersedia.
5. Setelah milestone 25, arahkan pemain memilih salah satu policy milestone awal sebagai spesialisasi awal; gunakan state/save yang sudah ada.
6. Sambungkan overlay 2D, unlocked-region guidance, focus cancel, dan reset camera yang sudah tersedia.
7. Tambahkan deterministic acceptance test untuk urutan road → utilities → zoning → growth → diagnostic → service → milestone → specialization, termasuk treasury buffer dan replay hash.
8. Jalankan kembali seluruh lima gate dan catat before/after.

Acceptance P0:

- Tindakan bermakna pertama memiliki satu lokasi build yang benar.
- Tidak ada circular dependency antara utilitas dan tombol menjalankan waktu.
- Jalur build minimum menyediakan kapasitas untuk 25 warga dan pekerjaan.
- Diagnostic awal memiliki masalah, sebab, solusi, biaya/dampak, dan lokasi.
- Satu layanan dapat dipilih sebagai respons terhadap tekanan awal.
- Milestone 25 membuka pilihan arah kota dengan efek gameplay yang sudah nyata.
- Kesalahan kecil tidak menghabiskan seluruh kas; replay seed yang sama tetap identik.

### P1 — Living city, traffic story, dan UX verification

1. Perjalanan rumah–kerja, jam sibuk, aktivitas komersial, kendaraan layanan, abandonment, cuaca, dan audio memakai event telemetry yang sama.
2. Traffic story menjelaskan origin/destination, komposisi commuter/freight/emergency/transit, bottleneck, before/after, serta rekomendasi bypass/upgrade/transit.
3. Lengkapi localization seluruh UI, bukan hanya catalog inti.
4. Jalankan browser visual QA nyata pada 360×800, 768×1024, 1024×768, dan desktop; tambah screenshot/layout regression yang bermakna.
5. Jadikan mode 2D parity target untuk overlay dasar, diagnostics, build, select, dan bulldoze.
6. Ekstrak controller onboarding, world interaction, dan notification dari `App.tsx` setelah kontrak P0 stabil.

### P2 — Specialization penuh, campaign, landmark, dan scale

1. Implementasikan Green City, Transit City, Industrial Powerhouse, Resilient City, dan Mixed-Use Metro sebagai paket demand, bangunan, misi, ekonomi, visual, milestone, trade-off, dan reward yang berbeda.
2. Tambahkan lima campaign pendek dengan premis, batasan, event, keputusan sulit, dan evaluasi trajectory.
3. Tambahkan landmark bertahap hanya bila masing-masing memengaruhi traffic, jobs, land value, happiness, skyline, dan maintenance.
4. Lanjutkan active/background/frozen regions, LOD, instancing, batching, memoization, dan lazy loading berdasarkan profiler nyata.
5. Tambahkan long-run performance regression dan visual QA; performance overlay tetap debug-only.

## Keputusan yang sengaja ditunda

- Tidak ada rewrite `App.tsx` pada P0.
- Tidak ada schema save baru.
- Tidak ada statistik UI baru yang tidak berasal dari simulasi.
- Tidak ada lima specialization penuh, campaign, atau landmark sebelum vertical slice terbukti.
- Tidak ada klaim browser responsiveness sempurna sampai browser-driven visual QA selesai.

## Hasil implementasi P0

- Starter map kini memiliki tepat satu gap jalan menuju highway; pathfinder mengembalikan tepat satu tile tindakan pertama.
- Langkah utilitas membaca fasilitas yang menyentuh jaringan jalan dan pompa yang menyentuh air, sehingga tidak menunggu simulation tick berikutnya.
- Langkah zoning mensyaratkan dua hunian tambahan dan satu zona pekerjaan tambahan; trace acceptance melewati 25 warga pada hari 9.
- Diagnostic pertama yang actionable muncul pada hari 6 (`Pengangguran meningkat`). Respons menambah pekerjaan dicatat selesai pada hari 7 melalui event deterministik `DIAGNOSTIC_RESOLVED`.
- Klinik dibangun pada hari 7 sebagai layanan pertama. Milestone Town tercapai, lalu `Small Business Relief` dipilih sebagai arah kota awal memakai `activePolicies` yang sudah kompatibel dengan save lama.
- Mode 2D kini menerima overlay aktif dan unlocked regions; overlay power, water, road condition, incident, dan disaster mendapat representasi dasar.
- Tutorial dan camera toolbar kini menerima state focus serta callback cancel/reset; reset mempertahankan mode tampilan pemain.
- Diagnostic office dan industrial hanya muncul jika sektor terkait benar-benar ada. Defisit investasi pembukaan tidak lagi salah diberi label krisis sebelum Town atau sebelum runway kas pendek.

Hasil verifikasi akhir:

| Gate | Hasil |
| --- | --- |
| TypeScript | Lulus |
| Vitest terisolasi | 60 file / 219 test lulus; 8,35 detik runner, 9,549 detik wall time |
| Production build terisolasi | Lulus; 2.336 modul; 8,11 detik Vite, 9,167 detik wall time |
| Release smoke | Lulus; finite state, save round-trip, replay, viewport contracts |
| Balance | Lulus; tidak ada bankruptcy pada seluruh fixture |
| Official benchmark | Semua skenario di bawah budget; p95 25,1 ms `SMALL_TOWN`, 47,5 ms `PERFORMANCE_100K` |

Catatan pengukuran: satu run Vitest yang dijalankan paralel bersama build dan balance memicu timeout 5 detik pada benchmark transit. Run seluruh suite secara terisolasi lulus. Ini menunjukkan test tersebut sensitif terhadap contention dan layak diberi treatment performance-test khusus pada P1.

Ukuran sesudah P0:

- `src/App.tsx`: 1.959 baris, 89.390 byte (+7 baris / +362 byte; tidak dilakukan refactor besar).
- Entry JavaScript: 389,45 kB (120,56 kB gzip).
- Chunk Three.js: tetap 1.119,52 kB (310,85 kB gzip).
- CSS: 96,82 kB (16,40 kB gzip).
