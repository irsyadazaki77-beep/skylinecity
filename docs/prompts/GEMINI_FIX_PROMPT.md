# Prompt untuk Gemini — Audit dan Perbaikan Skyline Simulator

Kamu adalah senior game engineer, product designer, dan QA engineer. Kerjakan perbaikan langsung pada repository Skyline Simulator ini. Jangan mengubah game menjadi proyek baru dan jangan melakukan rewrite besar-besaran sebelum memahami arsitektur yang ada.

## Konteks proyek

- Stack: React, TypeScript, Vite, Three.js, Vitest.
- Game: city-builder/simulation dengan grid 60x60, mode 3D dan 2D, tutorial onboarding, save/load, deterministic simulation, disaster/service systems, dan city information panels.
- Bahasa UI yang dituju: Bahasa Indonesia.
- Pertahankan deterministic simulation, kontrak save/migration, seed/replay behavior, dan API publik yang sudah digunakan oleh test.
- Perubahan harus bersifat incremental, mudah direview, dan tidak boleh menghapus fitur yang sudah bekerja hanya demi menyederhanakan implementasi.

## Baseline yang sudah diverifikasi

Jalankan ulang semua command ini setelah perubahan:

    npm run lint
    npm test -- --run
    npm run build
    npm run smoke
    npm run balance
    npm run benchmark

Baseline saat audit:

- lint: PASS
- test: 64 test files, 243 tests PASS
- build: PASS
- smoke: PASS
- balance scenarios: PASS
- benchmark: PASS pada run terbaru
- Tidak ada console error/warning runtime yang terlihat pada browser smoke desktop.

Artinya, fokus utama adalah memperbaiki correctness dan UX tanpa merusak regression suite yang sudah ada.

## Temuan prioritas P0/P1

### 1. Onboarding dan core-loop advisor tidak konsisten

Starter city sudah memiliki power plant dan water pump yang terhubung secara fisik. Tutorial menganggap utility network starter sudah selesai, tetapi core-loop advice masih dapat menampilkan “Sediakan listrik” dan meminta pemain memilih power plant. Pada browser, setelah membangun satu road, tutorial melompat dari langkah 1 ke langkah 3 dan status berikutnya meminta power plant walaupun bangunan itu sudah ada.

Area yang perlu diperiksa:

- src/starterCity.ts
- src/engine.ts
- src/tutorialFlow.ts
- src/coreLoopAdvisor.ts
- src/components/ui/StarterTutorial.tsx

Perbaiki dengan satu sumber kebenaran untuk status utility starter. Advisor, tutorial, initial derived metrics, dan UI harus menghasilkan rekomendasi yang sama. Jangan membuat pemain membangun utility duplikat atau mengeluarkan uang untuk memenuhi langkah yang sebenarnya sudah selesai. Buat transisi tutorial yang jelas: jika langkah utility memang otomatis selesai, tampilkan state selesai/penjelasan singkat sebelum lanjut, atau desain ulang urutan langkah agar tidak terasa melompat.

Tambahkan regression test untuk:

- starter utility network dianggap aktif oleh seluruh sistem yang relevan;
- rekomendasi awal tidak meminta power plant/water pump duplikat;
- tutorial tidak melewati langkah secara membingungkan setelah road pertama dibuat.

### 2. serviceResponseQuality memberi sinyal yang menyesatkan

Di src/services.ts, ketika tidak ada fasilitas layanan, serviceResponseQuality dapat tetap menjadi 100. Probe simulation menunjukkan kota dengan populasi 40 dan fire/police/healthcare capacity 0 tetap mendapat serviceResponseQuality 100 dan tidak mendapat konsekuensi layanan yang sesuai. Nilai ini kemudian digunakan dalam disaster simulation dan ditampilkan di CityInformationPanel sebagai kapasitas/respons layanan.

Perjelas semantik metrik ini:

- kota tanpa emergency facilities tidak boleh tampak memiliki emergency response aktif;
- hitung hanya fasilitas yang memang relevan terhadap emergency response;
- bedakan emergency response quality dari waste, education, healthcare coverage, dan kapasitas umum;
- pastikan kota mikro yang sengaja diberi grace period tetap memakai aturan yang eksplisit dan terdokumentasi, bukan default 100 yang diam-diam menutupi kekurangan layanan.

Jangan asal mengganti 100 menjadi 0 tanpa memahami balance. Periksa pemakaian metrik pada engine, disaster system, diagnostics, dan panel UI. Tambahkan test untuk kota tanpa layanan, satu layanan, layanan tidak terhubung jalan, dan layanan lengkap.

### 3. Label congestion terbalik

CityInformationPanel menampilkan label “Tingkat Kemacetan”, tetapi nilai yang dipakai adalah 100 dikurangi congestionIndex. Akibatnya congestionIndex 0 dapat terlihat sebagai “Tingkat Kemacetan 100%”.

Pilih satu kontrak yang jelas:

- jika labelnya “Tingkat Kemacetan”, tampilkan congestionIndex; atau
- jika ingin menampilkan nilai inverse, ubah label menjadi “Kelancaran Lalu Lintas”.

Audit semua pemakaian congestionIndex agar warna, tooltip, summary, traffic tab, dan diagnostics memakai arah yang sama. Tambahkan test dengan nilai 0, 50, dan 100.

### 4. Mode 2D belum parity dengan mode 3D

Di src/components/world/City2DCanvas.tsx, tile water diperiksa sebelum road. Bridge road yang berada di atas water dapat dirender sebagai water, padahal mode 3D merender struktur BRIDGE. Beberapa class tile juga belum memiliki style yang sesuai di src/index.css, antara lain office, arterial, emergency, park, parking, barrier, dan reservoir. Akibatnya beberapa tile dapat jatuh ke tampilan default dan legend tidak selalu sesuai visual.

Perbaiki:

- buat prioritas klasifikasi yang benar untuk bridge/highway/road sebelum water ketika tile adalah road structure;
- lengkapi style class untuk semua tipe yang benar-benar dipakai;
- pastikan warna, label, legend, status inspector, dan bentuk visual konsisten dengan 3D;
- verifikasi road biasa, highway, bridge, office, emergency, park, parking, barrier, reservoir, power plant, water pump, dan empty tile.

Jangan hanya memperbaiki screenshot; buat unit/contract test untuk klasifikasi tile dan smoke check untuk mode 2D.

### 5. Coordinate display tidak konsisten

Button grid memakai koordinat 1-based pada aria-label seperti Petak 36,28, tetapi BuildingInspector dapat menampilkan koordinat internal 0-based seperti Inspector (35, 27). Pilih satu representasi user-facing, gunakan 1-based di seluruh UI, dan simpan konversi hanya di boundary internal. Tambahkan test untuk selection, inspector, hover, bulldoze confirmation, dan keyboard navigation.

### 6. Mobile controls terlalu kecil dan bertumpuk

Audit browser mobile menunjukkan:

- grid 2D berisi 3600 button dengan ukuran sekitar 24x24 px;
- banyak kontrol utama berukuran di bawah target touch 44x44 px;
- camera toolbar dapat bertumpuk dengan HUD/legend;
- tutorial card dapat menutupi area map dan toolbar;
- 2D grid menjadi area scroll yang besar dan sulit dinavigasi.

Periksa:

- src/components/world/City2DCanvas.tsx
- src/components/ui/CameraToolbar.tsx
- src/components/ui/BottomToolbar.tsx
- src/components/ui/StarterTutorial.tsx
- src/index.css

Target responsive minimum:

- 360x800
- 390x844
- 768x1024
- 1024x768
- 1440x900

Perbaiki layout berdasarkan breakpoint dan safe area, bukan dengan menumpuk fixed position secara kebetulan. Semua kontrol primer harus nyaman disentuh, keyboard-focusable, dan memiliki aria-label yang bermakna. Untuk grid 2D, pertimbangkan hit area yang lebih besar, zoom/pan yang jelas, atau virtualisasi hanya jika memang diperlukan dan tidak merusak selection/hover. Pastikan tidak ada body overflow horizontal.

### 7. Localization Bahasa Indonesia belum menyeluruh

Masih ada string bahasa Inggris yang terlihat pada jalur normal, terutama:

- SettingsModal: Game Settings, Gameplay, Graphics, Audio, Controls, Gameplay Rules, Difficulty, Easy/Normal/Hard, Apply & Close, dan banyak label lain;
- BuildingInspector: Inspector, Growth Advisor, Occupancy, Demand, Capacity, Density, Low Density, Bulldoze, Intersection Control, Auto, Signal, Stop signs, Roundabout;
- CityInformationPanel: Consumer Demand, Goods Demand, Office Demand, Freight Demand, Traffic & Commute Flow, Congestion Index, Avg Commute Time, Parking Demand, Public Transit Network, dan banyak label tab/services/traffic;
- beberapa istilah statis seperti Desirability, Preparedness, Scenario, Monitoring, Balanced, Completed, dan tiles.

Buat atau perluas localization catalog yang sudah ada. Jangan menambahkan ternary bahasa secara acak di setiap component. Pertahankan istilah teknis yang memang lebih mudah dipahami jika diberi padanan konsisten, tetapi jangan biarkan campuran Inggris-Indonesia muncul pada satu layar tanpa alasan. Uji Settings, inspector, city information, tutorial, 2D legend, diagnostics, dan menu.

## Temuan P2 / maintainability dan release confidence

1. StarterTutorial.tsx memiliki blok advanced guidance yang tidak terjangkau setelah return baseSteps. Hapus dead code dengan aman atau refactor menjadi flow yang benar-benar dipakai. Jangan menghapus milestone guidance yang masih digunakan di tempat lain.
2. App.tsx dan beberapa UI besar sudah menjadi hotspot maintainability. Jangan rewrite sekarang. Jika menyentuh area tersebut, ekstrak helper/pure functions yang kecil dan tambahkan test pada boundary yang dipindahkan.
3. Saat ini smoke test bukan browser E2E penuh. Jika repository sudah memiliki infrastruktur browser test, tambahkan regression flow untuk fresh city, tutorial utility, mode 2D/3D, inspector coordinate, settings localization, dan mobile layout. Jika belum, buat contract test yang realistis dan dokumentasikan gap-nya; jangan mengklaim visual E2E jika belum ada.
4. Three.js chunk cukup besar. Jangan melakukan optimasi bundle spekulatif sebelum mengukur. Prioritaskan lazy-loading atau render optimization hanya jika tidak mengganggu determinism dan setelah profiling.
5. Pertahankan save version dan migrations yang ada. Jika menyentuh schema/version naming, tambahkan migration test dan backward-compatibility test.

## Cara kerja yang wajib

1. Mulai dengan membaca README, CURRENT_STATUS_2026-09-05.md, BROWSER_SMOKE_FLOW.md, dan file sumber yang relevan.
2. Buat audit singkat berdasarkan kode dan test yang benar-benar ada. Bedakan bug terkonfirmasi, risiko yang perlu profiling, dan preferensi desain.
3. Implementasikan perbaikan dalam fase kecil. Prioritas urutan:
   - utility/tutorial/advisor consistency;
   - service response semantics dan congestion semantics;
   - 2D parity dan coordinate contract;
   - mobile layout/touch target;
   - localization;
   - cleanup dead code dan maintainability ringan.
4. Untuk setiap fase, tambahkan atau perbarui test sebelum menyimpulkan selesai.
5. Jangan menonaktifkan, menghapus, atau melemahkan test hanya supaya command menjadi hijau.
6. Jangan mengubah balance secara luas tanpa menjelaskan alasan, dampak pada scenario, dan hasil balance runner.
7. Jangan mengganti deterministic RNG dengan Math.random, Date.now, atau sumber nondeterministic lain di simulation.
8. Jangan mengarang angka performa. Ukur dengan benchmark yang tersedia.

## Definition of Done

Perubahan dianggap selesai jika:

- semua quality gate di atas PASS;
- fresh city tidak memberi saran utility yang kontradiktif dengan starter state;
- service response menunjukkan keadaan layanan yang benar dan tidak memperkuat disaster response secara diam-diam;
- congestion summary memakai arah metrik yang benar;
- 2D bridge dan seluruh tile class utama terlihat sesuai dengan 3D;
- koordinat user-facing konsisten 1-based;
- jalur mobile 360x800 dan 390x844 tidak memiliki overlap kritis, horizontal overflow, atau kontrol primer yang sulit disentuh;
- layar Settings, inspector, city information, tutorial, dan legend tidak memiliki localization leak Inggris yang tidak disengaja;
- save/load, deterministic replay, balance, smoke, dan benchmark tetap lulus.

## Format laporan akhir

Laporkan:

1. akar masalah setiap bug;
2. file yang diubah dan alasan singkat;
3. test yang ditambahkan/diubah;
4. hasil semua quality gate;
5. temuan yang sengaja belum diubah beserta alasannya;
6. langkah manual singkat untuk memverifikasi fresh city, mobile, 2D/3D, inspector, Settings, dan save/load.

Mulai dengan inspeksi repository. Jangan meminta saya mengulang konteks yang sudah tertulis di prompt ini.

## Addendum audit ulang — temuan tambahan yang wajib diperiksa

### 9. Reset dan scope progress tutorial

Progress onboarding disimpan pada key localStorage global skyline_onboarding_v3. Handler resetCity membuat state kota baru, tetapi tidak mereset progress tutorial. StarterTutorial juga menyimpan baseline grid dalam useRef, sehingga baseline dapat stale setelah reset kota atau load kota lain.

Perbaiki lifecycle tutorial:

- Kota Baru harus memulai onboarding dari langkah yang benar;
- Continue/Load harus memiliki perilaku yang eksplisit: lanjutkan progress kota tersebut atau sembunyikan tutorial jika onboarding sudah selesai;
- baseline harus terkait dengan sesi/kota yang tepat, bukan state lama;
- jangan menghapus progress global tanpa migration atau keputusan UX yang jelas.

Tambahkan test untuk New City, Continue, Load, Repeat Guide, dan pergantian seed/kota.

### 10. Jangan tampilkan Settings yang tidak bekerja

musicVolume disediakan di Settings, tetapi audio system saat ini hanya memakai volume untuk procedural UI sound dan tidak memiliki music channel. vsync juga disimpan dari Settings tetapi tidak dipakai oleh renderer/scheduler. Jangan membiarkan opsi terlihat aktif jika tidak punya efek.

Pilih salah satu:

- implementasikan audio channel music dan V-Sync/frame-cap yang benar; atau
- sembunyikan/ubah label menjadi experimental dengan penjelasan yang jujur.

Jika diimplementasikan, tambahkan test bahwa setiap opsi benar-benar memengaruhi perilaku yang dimaksud.

### 11. Perbaiki shortcut keyboard dan tooltip

Mapping aktual di App.tsx adalah:

- Space atau 0: toggle pause/resume;
- 1: pause;
- 2: normal;
- 3: fast;
- 4: ultra.

Tooltip pada BottomToolbar masih menampilkan mapping yang membingungkan seperti Pause (Space / 1) dan Normal Speed (Space / 2). Satukan definisi shortcut agar README, tooltip, Settings, dan handler tidak saling bertentangan. Tambahkan test atau contract table untuk mapping keyboard.

### 12. Growth pacing dan player direction

Balance checkpoint starter menunjukkan kota kecil dapat berhenti di sekitar 16 populasi sampai Hari 90, sementara Town milestone dan mission pertama yang bermakna membutuhkan 25 populasi. Pastikan pemain memiliki jalur yang terlihat dan masuk akal untuk melewati plateau tersebut.

Audit:

- apakah demand/residential growth benar-benar memberi feedback;
- apakah player tahu perlu menambah zona, pekerjaan, layanan, atau menjalankan waktu;
- apakah advisor/tutor menjelaskan penyebab population stagnation;
- apakah mission/milestone terlalu jauh dibanding cash dan action yang tersedia.

Jangan menaikkan growth multiplier secara membabi buta. Perbaiki feedback dan actionability terlebih dahulu, lalu validasi dengan balance runner.

### 13. Test viewport saat ini bukan visual/layout test

src/browserSmoke.test.ts dan src/releaseSmoke.ts hanya memeriksa angka viewport positif. Itu tidak membuktikan tidak ada overlap, horizontal overflow, kontrol kecil, atau modal yang keluar layar.

Perbaiki release confidence:

- jika tool browser test tersedia, tambahkan browser E2E minimal untuk 360x800 dan desktop;
- jika belum tersedia, buat contract/helper test untuk breakpoint, touch target, overflow, modal bounds, dan visibility;
- dokumentasikan dengan jujur mana yang automated dan mana yang manual.

Jangan menyebut viewportsSmokeTested sebagai layout verification bila hanya melakukan width > 0.

### 14. Localization harus mencakup data-driven content

Selain Settings dan Inspector, MissionsModal, TechTreeModal, PoliciesModal, DistrictsModal, milestone names, tech node names/descriptions, mission titles/descriptions, achievement titles/descriptions, dan scenario labels masih memiliki banyak teks Inggris langsung di source.

Gunakan catalog terpusat atau content registry yang mendukung bahasa. Audit seluruh modal dan state kosong/loading/error. Tidak boleh ada label Inggris yang lolos pada bahasa Indonesia hanya karena teks berasal dari data constants.

### 15. Single next-action contract

Saat ini HUD dapat menyarankan jalan, tutorial menampilkan langkah berbeda, dan sidebar dapat masih menyorot kategori zonasi. Semua surface berikut harus menunjuk aksi yang sama:

- HUD next action;
- tutorial card;
- selected category/tool;
- camera focus/highlight;
- CTA button;
- diagnostic explanation.

Buat satu model next-action yang dapat dikonsumsi semua UI tersebut, atau dokumentasikan dengan jelas jika ada alasan surface tertentu berbeda.
