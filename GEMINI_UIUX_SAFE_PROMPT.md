# Prompt Gemini — Safe UI/UX Redesign Skyline Simulator

Kamu adalah senior product designer, game UI/UX designer, frontend engineer, dan accessibility specialist. Kerjakan perbaikan UI/UX Skyline Simulator langsung di repository ini berdasarkan audit screenshot dan source code.

PENTING: jangan merusak gameplay. Prompt ini khusus untuk UI/UX, layout, visual hierarchy, accessibility, localization, dan responsive behavior. Jangan melakukan rewrite engine atau mengubah balance hanya demi menyelesaikan masalah tampilan.

## Kondisi repository

Repository sudah memiliki banyak perubahan pengguna. Sebelum mengedit:

1. Baca README.md.
2. Baca CURRENT_STATUS_2026-09-05.md dan dokumen audit yang ada.
3. Periksa git diff dan git status.
4. Jangan menimpa perubahan pengguna yang tidak berkaitan.
5. Jangan menghapus file atau melakukan reset/checkout.
6. Setelah memahami struktur, buat daftar file yang benar-benar akan disentuh.

Stack:

- React
- TypeScript
- Vite
- Three.js
- Tailwind CSS
- Vitest

Target bahasa UI: Bahasa Indonesia.

## Baseline yang wajib dipertahankan

Jalankan sebelum dan sesudah perubahan:

    npm run lint
    npm test -- --run
    npm run build
    npm run smoke
    npm run balance
    npm run benchmark

Jangan:

- menghapus atau melemahkan test;
- mengubah deterministic simulation;
- mengubah seed atau replay behavior;
- mengubah BUILD_COSTS;
- mengubah aturan pertumbuhan, pajak, disaster, transit, atau service;
- mengubah save version atau migration tanpa kebutuhan yang benar-benar jelas;
- mengganti callback/props publik component tanpa alasan dan regression test;
- menambah dependency baru hanya untuk styling;
- melakukan rewrite App.tsx atau engine.ts;
- mengubah gameplay hanya supaya screenshot terlihat bagus.

Jika sebuah perbaikan UI memerlukan perubahan kecil pada state UI, batasi perubahan pada state presentasi dan jelaskan alasannya.

## Bukti visual dari screenshot terbaru

Screenshot menunjukkan beberapa masalah struktural yang harus diperbaiki:

1. Tool rail dan build drawer mengambil area kiri sangat besar. Drawer terbuka otomatis pada kategori Zonasi dan menghabiskan ruang layar walaupun hanya menampilkan tiga kartu.
2. Drawer membentang sampai bawah viewport sehingga area kosongnya terlihat seperti panel hitam besar.
3. Kartu panduan/next-action berada di atas header drawer. Judul langkah dan tombol close terlihat bertabrakan dengan search/drawer.
4. Bottom simulation toolbar tertutup atau terpotong oleh drawer karena layout memakai fixed overlay dan z-index, bukan pembagian ruang yang benar.
5. Map kehilangan fokus karena terlalu banyak panel gelap, blur, border, dan floating controls.
6. Settlement terlalu kecil dibanding area kosong map. Pemain baru tidak langsung tahu pusat kota dan lokasi yang harus dibangun.
7. HUD atas, tutorial, camera toolbar, sidebar, dan bottom bar memakai gaya card yang sama sehingga tidak ada primary/secondary hierarchy.
8. Banyak teks terlalu kecil dan memakai uppercase/monospace. Bahasa Indonesia yang panjang menjadi berat dibaca.
9. Warna cyan, gold, amber, purple, emerald, dan merah dipakai bersamaan tanpa semantic hierarchy yang stabil.
10. Sidebar rail memperlihatkan kategori aktif Zonasi, sedangkan panduan sedang meminta aksi lain. State visual dan next action tidak terasa sinkron.

## Akar masalah yang perlu diperbaiki

Periksa file berikut:

- src/index.css
- src/components/Sidebar.tsx
- src/components/ui/GameHUD.tsx
- src/components/ui/StarterTutorial.tsx
- src/components/ui/CameraToolbar.tsx
- src/components/ui/BottomToolbar.tsx
- src/components/ui/CityInformationPanel.tsx
- src/components/ui/BuildingInspector.tsx
- src/components/MissionsModal.tsx
- src/components/TechTreeModal.tsx
- src/components/PoliciesModal.tsx
- src/components/DistrictsModal.tsx
- src/components/TreasuryModal.tsx
- src/components/SaveLoadModal.tsx
- src/components/ui/SettingsModal.tsx
- src/localization.ts

Masalah struktural utama saat ini:

- selectedCategory pada Sidebar dibuka dengan default Zonasi;
- tool drawer adalah child fixed rail yang menutupi area map dan toolbar lain;
- next-action/tutorial dan drawer berada pada layer yang saling menimpa;
- bottom toolbar tidak memiliki safe area terhadap drawer;
- banyak ukuran, warna, radius, dan shadow ditulis langsung di component;
- modal tidak semuanya memiliki dialog semantics dan focus behavior yang sama;
- konten data-driven seperti missions, achievements, tech, policies, dan scenarios masih dapat bocor bahasa Inggris.

## Design direction yang harus digunakan

Gunakan arah visual:

“Calm premium city-builder interface: map-first, civic, readable, restrained.”

Prinsip:

- map adalah hero;
- UI mendukung keputusan pemain, bukan memamerkan data;
- satu accent utama teal/cyan;
- amber hanya untuk uang, warning, atau tindakan yang membutuhkan perhatian;
- merah hanya untuk error/danger;
- hijau hanya untuk success/healthy;
- jangan memakai gold dan purple sebagai aksen dekoratif utama secara bersamaan;
- kurangi backdrop blur berat;
- kurangi border putih transparan;
- jangan membuat semua elemen menjadi pill;
- hindari panel gelap besar tanpa informasi yang padat;
- gunakan satu sistem radius, spacing, shadow, dan typography.

## Implementasi wajib, urut berdasarkan fase

### Fase 1 — Perbaiki layout shell

Buat pembagian ruang yang jelas:

- map tetap menjadi area utama;
- tool rail compact sekitar 64–72px;
- build drawer tertutup secara default;
- drawer hanya terbuka setelah pemain memilih kategori;
- drawer tidak boleh menutupi next-action card, bottom toolbar, atau camera toolbar;
- jika drawer overlay map, gunakan backdrop dan sediakan close yang jelas;
- jika drawer memakai layout side-by-side, area map harus benar-benar menghitung lebar drawer;
- drawer tidak boleh membentang sebagai bidang kosong sampai bawah jika kontennya hanya sedikit;
- gunakan max-height dan overflow internal;
- bottom toolbar harus tetap sepenuhnya terlihat dan dapat diklik;
- next action/tutorial harus memiliki ruang yang konsisten dan tidak boleh menimpa drawer;
- camera toolbar harus punya safe position terhadap HUD dan tutorial.

Pada desktop:

- map harus tetap mendominasi layar;
- drawer terbuka tidak boleh mengambil lebih dari area yang wajar;
- drawer sekitar 280–340px sudah cukup;
- tool cards tidak boleh melebar menjadi panel kosong;
- bottom bar harus berada di area map yang aman.

Pada mobile:

- tool rail menjadi compact drawer/sheet;
- build drawer boleh menjadi sheet dengan lebar maksimal sekitar 88–92vw;
- gunakan backdrop ketika drawer terbuka;
- tutorial harus ditempatkan pada area yang tidak bertabrakan dengan bottom controls;
- camera controls harus memiliki mode compact;
- tidak boleh ada horizontal overflow;
- jangan hanya mengecilkan desktop sampai semua teks sulit dibaca.

### Fase 2 — Sederhanakan visual hierarchy

Tetapkan hierarki:

Primary:

- map;
- next action;
- selected tool;
- pause/speed;
- critical alert.

Secondary:

- city metrics;
- camera;
- undo/redo;
- optional overlays.

Tertiary:

- advanced statistics;
- favorites;
- debug/performance;
- detailed telemetry.

Jangan memberi weight visual yang sama pada semua panel.

HUD:

- kiri: nama kota dan milestone;
- tengah: maksimal tiga metrik utama;
- kanan: waktu, notifikasi, dan menu;
- jangan menambah card baru jika informasi sudah ada di HUD.

Next action:

- satu card saja;
- satu judul singkat;
- satu alasan singkat;
- satu CTA utama;
- optional secondary action “Tunjukkan lokasi”;
- target map harus memiliki highlight yang terlihat;
- state card harus jelas: available, active, completed, blocked.

Bottom toolbar:

- pause dan speed sebagai kelompok utama;
- undo/redo sebagai kelompok sekunder;
- jangan mencampur brush size, region expansion, dan semua telemetry ke dalam satu bar;
- context tools boleh muncul hanya saat relevan.

### Fase 3 — Typography dan spacing

Gunakan aturan:

- body text minimal 12–13px;
- label minimal 10–11px;
- title panel 16–20px;
- jangan memakai uppercase untuk kalimat panjang;
- monospace hanya untuk angka, koordinat, shortcut, dan telemetry;
- line-height minimal 1.35 untuk paragraf;
- jangan memakai tracking lebar pada teks panjang Bahasa Indonesia;
- jangan memotong label penting dengan truncate tanpa tooltip;
- semua card harus memiliki padding yang konsisten;
- semua button primer harus memiliki touch target minimal 44x44px;
- icon button harus punya aria-label dan tooltip.

### Fase 4 — Redesign tool drawer

Tool card harus mudah dipindai:

- icon;
- nama tool;
- biaya;
- satu deskripsi singkat;
- status active/locked;
- satu favorite action yang tidak mengganggu target klik utama.

Jangan menampilkan tiga paragraf atau metadata berlebihan pada setiap card.

Kategori harus punya:

- active state kuat;
- selected state berbeda dari hover;
- disabled state yang jelas;
- lock reason yang pendek;
- focus-visible yang jelas.

Ketika next action meminta road, pastikan:

- kategori Roads aktif;
- tool yang sesuai aktif;
- tutorial CTA dan sidebar menunjuk aksi yang sama;
- camera/map highlight menunjuk area yang sama.

### Fase 5 — Modal dan accessibility

Semua modal harus konsisten:

- role="dialog";
- aria-modal="true";
- aria-labelledby;
- focus trap;
- focus kembali ke tombol pembuka;
- Escape menutup modal;
- tombol close minimal 44x44px;
- body modal dapat discroll;
- header modal tetap terlihat;
- tidak keluar viewport pada mobile.

Terapkan juga pada missions, tech tree, policies, districts, treasury, city information, inspector, milestone banner, settings, dan save/load.

Jangan menjadikan modal sebagai halaman telemetry tanpa hierarchy. Gunakan summary dahulu, detail setelahnya.

### Fase 6 — Localization

Semua teks yang terlihat pada bahasa Indonesia harus konsisten:

- Settings;
- tool drawer;
- tutorial;
- HUD;
- Missions;
- Achievements;
- Tech Tree;
- Policies;
- Districts;
- Treasury;
- City Information;
- Building Inspector;
- tooltips;
- empty/loading/error states;
- keyboard shortcut descriptions.

Pindahkan string data-driven ke localization/content catalog jika diperlukan. Jangan melakukan ternary bahasa acak di setiap component.

### Fase 7 — Perbaiki state visual yang menyesatkan

Perbaiki UI-only issues berikut tanpa mengubah aturan simulation:

- selected category tidak boleh otomatis membuka Zonasi jika belum dipilih pemain;
- New City dan Repeat Guide harus menampilkan state tutorial yang benar;
- nomor langkah harus sesuai dengan isi card;
- HUD, tutorial, sidebar, CTA, dan map highlight harus konsisten;
- shortcut tooltip harus sesuai mapping aktual;
- label congestion dan service harus sesuai arti metric;
- inspector dan tile coordinate harus konsisten untuk user;
- opsi Settings yang belum bekerja jangan ditampilkan seolah-olah aktif.

Jika perbaikan memerlukan perubahan logic non-visual, lakukan seminimal mungkin dan tambahkan regression test.

## Hal yang dilarang

Jangan:

- mengubah engine.ts kecuali benar-benar dibutuhkan untuk kontrak UI;
- mengubah CityState;
- mengubah simulation tick;
- mengubah biaya bangunan;
- mengubah population growth;
- mengubah disaster balance;
- menghapus mode 2D atau 3D;
- menghapus missions atau tutorial;
- menghapus save migration;
- menghapus tests;
- mengganti seluruh CSS dengan framework baru;
- membuat satu component raksasa baru;
- membuat semua panel fixed;
- menutupi bug layout dengan z-index yang semakin tinggi;
- memakai !important secara berlebihan;
- menambahkan animasi terus-menerus yang mengganggu;
- mengklaim visual E2E jika hanya menjalankan unit test.

## Acceptance criteria visual

Verifikasi minimal pada:

- 360x800;
- 390x844;
- 768x1024;
- 1024x768;
- 1280x720;
- 1440x900.

Pada semua viewport:

- tidak ada body horizontal overflow;
- bottom toolbar tidak terpotong atau berada di belakang drawer;
- tutorial tidak menimpa header/sidebar/camera controls;
- camera toolbar tidak menutupi HUD;
- drawer dapat dibuka dan ditutup dengan jelas;
- drawer tidak terbuka tanpa alasan pada initial state;
- control utama minimal 44x44px;
- teks utama terbaca;
- modal tidak keluar viewport;
- focus keyboard terlihat;
- Escape bekerja pada modal dan drawer;
- map tetap terlihat dan playable;
- active tool dan next action konsisten.

Pada fresh city:

- pemain melihat settlement dengan jelas;
- next action pertama jelas;
- tool yang disarankan sama dengan tool aktif;
- tidak ada panel besar kosong;
- UI tidak menutupi target pembangunan.

## Test dan verifikasi

Tambahkan regression test tanpa dependency baru jika memungkinkan untuk:

- default drawer closed;
- next-action/tool/category consistency;
- tutorial step label;
- modal Escape/focus behavior jika test environment mendukung;
- localization key coverage;
- keyboard shortcut label;
- responsive class/contract;
- touch target contract;
- coordinate display.

Jalankan seluruh quality gate:

    npm run lint
    npm test -- --run
    npm run build
    npm run smoke
    npm run balance
    npm run benchmark

Lakukan pemeriksaan browser/manual untuk screenshot target. Bedakan dengan jelas hasil automated test dan hasil manual visual review.

## Format laporan

Laporkan:

1. masalah akar yang ditemukan;
2. layout yang diubah;
3. design tokens yang dibuat;
4. component yang diubah;
5. perubahan accessibility;
6. perubahan localization;
7. test yang ditambahkan;
8. hasil semua quality gate;
9. bagian gameplay yang sengaja tidak disentuh;
10. issue UI yang masih tersisa.

Kerjakan bertahap. Setelah setiap fase, pastikan aplikasi masih build dan test. Prioritaskan struktur layout dan hierarchy sebelum dekorasi.
