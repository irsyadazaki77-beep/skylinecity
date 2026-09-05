# Skyline Simulator — Status Terkini (5 September 2026)

Dokumen ini adalah source of truth untuk audit terbaru. Audit bertanggal sebelumnya tetap disimpan sebagai catatan historis; angka lama di dalamnya tidak boleh dipakai sebagai status rilis.

## Ringkasan hasil

P0 policy contract sudah hardened sebagai observed-only, P1 vertical slice sudah dijalankan di browser nyata, 2D sekarang benar-benar playable untuk build/select/bulldoze/overlay, dan lokalisasi jalur utama sudah diperbaiki. Tidak ada test yang dihapus, skema save tidak diubah tanpa migrasi, dan simulasi deterministik tetap dipakai.

## Quality gates aktual

| Perintah | Hasil aktual |
| --- | --- |
| `npm run lint` | PASS — TypeScript check tanpa error |
| `npm test -- --run` | PASS — 64 file, 243 test, 84.37 detik; konfigurasi Vitest repo memakai satu worker |
| `npm run build` | PASS — 2.345 modul, 39.41 detik; `City3DCanvas` 77.01 kB / gzip 19.70 kB |
| `npm run smoke` | PASS — day 2, state finite, save round-trip, deterministic replay, hash `861a443c` |
| `npm run balance` | PASS — lima fixture finite, debt $0, bankruptcy 0 hari |
| `npm run benchmark` | PASS sebagai integrity gate; budget advisory terlampaui pada semua fixture: Small Town p50/p95 45.4/79.0 ms, Congested 42.7/81.5 ms, Industrial 55.4/85.2 ms, Flood 48.7/73.7 ms, Performance 100K 177.0/230.8 ms |

Catatan command: `npm test -- --run --maxWorkers=1 --minWorkers=1` tidak dipakai karena Vitest versi ini menolak opsi `--minWorkers`. Command wajib `npm test -- --run` tetap lulus memakai konfigurasi `vite.config.ts` yang sudah mengunci worker untuk menghindari contention benchmark.

## Audit P0 — policy consequences

`PolicyConsequence` sekarang hanya membawa kontrak kebijakan dan `observedValue` dari `CityState` saat ini. `expectedDirection` adalah arahan kualitatif, bukan angka counterfactual. Tidak ada `before`, `after`, `projectedValue`, atau `projectedChange` yang dipresentasikan sebagai fakta. Save migration v16 membuang field legacy `before/after`, dan test memeriksa observed live metric serta hasil migrasi.

## P1 — tutorial, kamera, dan browser flow

- Tutorial primer memiliki denominator stabil `1 dari 5`: jalan, utilitas, zonasi, waktu, dan diagnosis. Milestone lanjutan tetap dipisah sebagai advanced/contextual guidance melalui City Pulse dan diagnostics.
- Core-loop advisor memprioritaskan koneksi highway yang benar. `Tunjukkan lokasi` membingkai settlement dan target jalan dalam satu frame; kamera mendukung focus, cancel/`Escape`, smooth framing, serta reset.
- Sebelum fix, tombol 2D hanya mengubah pitch kamera sementara scene 3D tetap terpasang. Sesudah fix, browser benar-benar melihat region `Peta kota mode 2D` dengan 3.600 tile button; transisi balik ke 3D juga diverifikasi.
- Flow browser nyata menyelesaikan New City, tutorial, guidance, road drag, residential/commercial zoning, run simulation, diagnostics, City Pulse, inspector open/close, camera reset, 3D↔2D↔3D, save/load, dan label Indonesia. Detail langkah dan bukti DOM ada di [BROWSER_SMOKE_FLOW.md](BROWSER_SMOKE_FLOW.md).

## Starter balance checkpoints

Fixture `SMALL_TOWN` diuji pada Hari 1/5/10/15/30/90 dengan simulation tick yang sama seperti gameplay: Hari 1 = 0 warga, $8.000, happiness 50; Hari 5 = 8 warga, $7.702, 60; Hari 10 = 16 warga, $7.428, 57,7; Hari 15 = 16 warga, $7.262, 67,1; Hari 30 = 16 warga, $6.752, 58,1; Hari 90 = 16 warga, $4.684, 60. Acceptance test memastikan semua checkpoint finite, kas positif, happiness >40, populasi minimal 15 mulai Hari 10, dan kas Hari 90 >$3.000.

Official `npm run balance` menjalankan 90 tick dari state Hari 1 sehingga output akhirnya Hari 91: Small Town pop 16/min treasury $3.339/min happiness 47,0; Congested 640/$8.000/25,8; Industrial 160/$8.000/48,1; Flood 640/$8.000/26,3; Performance 100K 100.000/$8.000/1,6. Stress fixture 100K memang tanpa civic services sehingga happiness rendah adalah expected.

## Localization and 2D parity

Katalog `id/en` kini mencakup menu utama, save/load, Info Views, City Pulse, alert toast, overview metrics, disaster preparation actions, serta label inspector yang sebelumnya bocor seperti City Info, Traffic, Maintenance, dan English disaster actions. 2D mempertahankan tool build/select/bulldoze, valid road drag, status utility/traffic, overlay, legend, focus, locked region, dan accessible tile coordinates. Static project-impact card kini diberi label ilustrasi eksplisit agar tidak dibaca sebagai metrik hasil eksperimen.

## Performance and residual risks

- Scheduler fallback/adaptive quality tetap aktif karena benchmark CLI melampaui budget tick 50 ms (kota kecil) dan 120 ms (100K). Ini adalah advisory performa, bukan integrity failure; tidak ada angka frame browser yang dikarang.
- Belum ada CI browser E2E otomatis; browser flow saat ini adalah manual real-browser smoke dengan verifikasi DOM/accessibility.
- Native `window.confirm` untuk varian menu `Quit & New City` tidak dapat dikendalikan aman oleh bridge browser saat audit; jalur Start Screen `Kota Baru` lulus. Ini tidak mengubah engine atau save data.
- Worktree sudah berisi banyak perubahan pengguna sebelum audit ini. Perubahan audit yang disentuh langsung terutama `src/App.tsx`, `src/components/world/City2DCanvas.tsx`, komponen UI terkait, `src/localization.ts`, `src/starterCity.test.ts`, `src/localization.test.ts`, serta dokumen status/flow.
