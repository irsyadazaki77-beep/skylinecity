# Audit dan peningkatan simulator — 12 September 2026

## Kondisi awal

Workspace sudah memuat game React 19, TypeScript, Vite, Three.js, React Three Fiber, dan Drei. Banyak file mempunyai perubahan lokal sebelum pekerjaan ini; perubahan tersebut dipertahankan. Proyek tidak dibuat ulang dan tidak ditambah dependensi atau aset eksternal.

Fondasi yang dipertahankan:

- Grid peta deterministik dengan elevasi, sungai, region unlock, jalan lokal/arteri/tol, jembatan dan terowongan.
- Ekonomi, pajak, RCI, zoning/density, evolusi bangunan, utilitas, kapasitas layanan, household/citizen, pekerjaan dan perpindahan penduduk.
- Routing, lalu lintas, armada layanan, transit, logistik, polusi, nilai tanah, insiden, cuaca dan bencana.
- Milestone, tutorial sebab-akibat, misi, kebijakan, statistik, inspector, save migration dan undo/redo.
- Procedural building kits, kendaraan, warga, vegetation instancing, siang/malam, audio Web Audio, pengaturan grafis dan UI responsif.
- Simulation worker dan identitas revisi untuk menolak hasil tick yang sudah usang.

Baseline: lint/type-check dan build lulus; 76 berkas uji / 316 pengujian lulus. Tes browser lama terutama menguji pembangunan melalui renderer 2D dan perpindahan tampilan 2D/3D, sehingga bukan bukti lengkap interaksi WebGL.

## Temuan dan implementasi

1. **Kontrol kamera.** Mouse kiri bawaan melakukan orbit dan pemilihan petak langsung terjadi pada pointer-down. Sekarang mode pilih memakai drag kiri untuk pan, tombol tengah untuk pan, klik untuk inspeksi, Q/E untuk rotasi, dan dua jari untuk zoom/rotasi. Dalam mode membangun, drag kiri menjadi milik tool.
2. **Posisi kamera.** Zoom/rotasi sebelumnya kembali ke target state lama setelah pan. Perintah sekarang menggunakan target OrbitControls aktual. Keyboard pan mengikuti arah pandang, gerakan diagonal dinormalisasi, dan delta setelah tab kembali dibatasi. Blur/fokus membersihkan tombol yang tertahan. Modal dan input memiliki prioritas atas shortcut kamera.
3. **Reset.** Reset ke nilai React yang sama sebelumnya tidak memicu pembaruan. Revision token sekarang mengirim perintah reset meskipun zoom/rotasi belum berubah. Home memakai perintah yang sama. Rotasi mode foto diperbaiki dari radian menjadi derajat.
4. **Pembangunan 3D.** Jalan dapat di-drag dari titik awal ke akhir, tetap mendukung dua klik. Gesture multitouch membatalkan interaksi tool; sentuhan pembangunan menunggu pelepasan jari agar gesture kedua tidak membangun tanpa sengaja.
5. **Overlay.** Tombol sampah, kesehatan, pemadam, dan kebisingan sebelumnya tidak mempunyai warna petak 3D. Kini membaca coverage/noise simulasi, menggunakan model bersama dengan renderer 2D, serta mempunyai legenda Bahasa Indonesia. Nilai tanah nol tidak lagi diganti angka default 35. Overlay kebahagiaan memakai agregasi kepuasan household yang ditimbang menurut jumlah warga, dengan warna netral bila data belum tersedia. Threshold traffic 3D disamakan dengan 2D (30/70). Overlay dapat dibuka sejak hari pertama.
6. **Rendering overlay.** Petak tematik memakai satu `InstancedMesh` dengan warna per instance. Transform diperbarui saat data berubah, bukan setiap frame. Geometri terrain/air/pantai lama dibersihkan ketika diganti.
7. **Kualitas dan LOD.** Low benar-benar memilih budget mobile, termasuk jarak LOD 9/24, tanpa shadow caster. LOD controller kini membaca preset shadow yang dipilih. Bangunan konstruksi tanpa representasi Mid/Far tetap terlihat saat kamera menjauh.
8. **Diagnostik fatal.** `recordReactCommit` sebelumnya memberi notifikasi sinkron ke state panel performa, memicu rekursi Profiler sampai `Maximum update depth exceeded`. Pencatatan commit kini tidak mempublikasikan pembaruan React. Publikasi metrik dibatasi 4 Hz; penghitungan persentil tidak dilakukan setiap frame.
9. **Pemulihan renderer.** Listener WebGL context loss/restoration dibersihkan saat unmount. UI pemulihan dapat memasang ulang canvas tanpa mengganti state simulasi atau me-reload halaman.
10. **UX.** Shortcut J/Z/C/I untuk jalan/hunian/komersial/industri; bantuan kontrol diperbarui; beberapa istilah kamera diterjemahkan. Kontrak save tidak diubah.

## Arsitektur

`CityState` tetap menjadi sumber data simulasi. Kamera, diagnostik, matriks instance, serta epoch pemulihan merupakan state presentasi. Tidak ada perubahan hash simulasi, versi save, harga, atau aturan ekonomi. Model overlay dipisahkan dari komponen Three.js agar dapat diuji sebagai fungsi murni. Proyeksi kamera untuk pengujian hanya tersedia pada mode `?debug=1`, bersifat baca-saja; pengujian pembangunan tetap mengirim event mouse melalui UI nyata.

## File utama

- `src/App.tsx`, `src/hooks/useCameraControls.ts`
- `src/components/world/CameraController.tsx`, `TerrainGrid.tsx`, `City3DCanvas.tsx`
- `src/components/world/TileOverlayInstances.tsx`, `RendererRecovery.tsx`, `City2DCanvas.tsx`
- `src/overlayModel.ts`, `src/renderQuality.ts`, `src/performanceTelemetry.ts`
- `src/components/ui/CameraToolbar.tsx`, `InfoViewsToolbar.tsx`, `SettingsModal.tsx`
- Pengujian regresi model overlay, kualitas, telemetry; `visual-qa/verify-upgrade.mjs`; opsi Chromium software pada `playwright.config.ts`.

## Bukti pengujian

- Lint/TypeScript: lulus setelah perubahan.
- Vitest: 79 berkas / 323 pengujian lulus, termasuk vertical slice pertumbuhan, utilitas, ekonomi, migrasi save, routing dan determinisme.
- Production build: lulus.
- Release smoke: seluruh tujuh pemeriksaan lulus, termasuk save round-trip dan deterministic replay.
- Balance: semua lima fixture lolos tanpa bangkrut; fixture stress tanpa civic service tetap memiliki kebahagiaan rendah, bukan contoh kota seimbang.
- Benchmark tanpa browser software aktif: sembilan skenario lulus budget dan baseline hash. P95 kota kecil 23,2 ms; 100K 53,5 ms; disaster 44,4 ms. Pengukuran sebelumnya ketika browser software aktif menghasilkan p95 149,7 ms untuk 100K; hasil buruk tersebut tidak dibuang atau ambang dilonggarkan.
- Suite browser awal: 18 assertions/workflows desktop dan mobile lulus. Proses browser hardware tersendat pada shutdown setelah semua tes; pengujian software digunakan untuk isolasi driver.
- Bukti WebGL lanjutan dan screenshot tersedia di `visual-qa/upgrade/report.json`. Jalankan server produksi port 3006 lalu `node visual-qa/verify-upgrade.mjs` untuk mengulang.

## Batas klaim dan pekerjaan berikutnya

Target 60 FPS pada GPU desktop menengah belum terbukti. SwiftShader pada host ini bukan perangkat pembanding GPU dan menghasilkan p95 frame yang tinggi. Profil singkat bukan bukti tidak ada memory leak; perlu soak 10–30 menit dan perangkat Android/iOS fisik. Tampilan High, gesture perangkat nyata, cuaca, seluruh campaign serta seluruh kombinasi overlay belum mendapat acceptance menyeluruh. Sebagian label lama masih campuran Bahasa Indonesia/Inggris. Penyatuan semua overlay khusus 2D/3D masih perlu dilanjutkan.

Prioritas selanjutnya: batching detail bangunan pada kota padat, raycast terrain sesuai elevasi pada seluruh sudut, profiling GPU nyata, serta acceptance visual High siang/malam. Dokumen ini tidak menyatakan keseluruhan brief premium telah selesai.
