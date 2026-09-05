# Skyline Simulator — Living City Audit

> Historical: audit desain 4 September 2026. Status quality gate terbaru ada di `CURRENT_STATUS_2026-09-05.md`.

Tanggal: 4 September 2026

## Arah desain

Kedalaman berikutnya tidak datang dari lebih banyak panel, melainkan dari memperlihatkan konsekuensi sistem yang sudah ada melalui warga tertentu. Citizen Stories dipilih sebagai fase pertama karena menghubungkan citizen simulation, traffic, transit, flood, diagnostics, mission, dan kamera tanpa menambah aturan ekonomi baru atau membebani onboarding.

## Baseline sebelum Fase 1

| Gate | Hasil |
| --- | --- |
| `npm run lint` | Lulus, 7,506 detik |
| `npm test -- --run` | 60 file / 219 test lulus, 6,42 detik runner |
| `npm run build` | Lulus, 2.336 modul, 6,51 detik Vite |
| `npm run smoke` | Lulus; finite state, save round-trip, deterministic replay, viewport contracts |
| `npm run balance` | Lulus; seluruh fixture tanpa bankruptcy |

## Gap analysis

- Household dan citizen sudah mengambil keputusan nyata, tetapi hasilnya hanya terlihat sebagai agregat population, employment, commute, dan modal split.
- Migration mempunyai alasan keluar, tetapi tidak ada jejak household tertentu yang dapat difokuskan pemain.
- Transit, flood, dan service telemetry sudah spasial, tetapi belum diterjemahkan menjadi pengalaman warga yang menunjukkan mengapa investasi pemain penting.
- Notification dan City Pulse berisi kejadian kota serta diagnostic, tetapi belum memiliki cerita mikro yang menghubungkan keduanya.
- `HistoryRecord` adalah seri statistik; bukan ledger kejadian. Memaksakan story ke struktur itu akan mencampur dua tanggung jawab.
- Menambahkan nama/personality acak sekarang akan menghasilkan flavor text tanpa causal value dan menambah biaya save/performance.

## Fase 1 — Citizen Stories minimal

### Desain data

`CitizenStoryState` adalah domain state terpisah:

- `active`: kondisi warga yang masih berlangsung, dibatasi delapan.
- `history`: story dan outcome terbaru, dibatasi 24.
- `lastEmittedByKey`: cooldown per subjek/kondisi agar feed tidak spam.

Setiap `CitizenStory` menyimpan type, status, day, citizen/household, sebab, dampak, pilihan, estimated cost, projected outcome, lokasi, dan optional diagnostic link. Lima trigger awal adalah keluarga baru, pekerjaan baru, commute panjang, penggunaan transit, dan rumah terdampak banjir.

### Perubahan engine

- `advanceCitizenStories` membaca serialized citizen state, active trips, grid flood depth, migration, dan diagnostics.
- Kandidat diurutkan deterministik; maksimal satu story baru diterbitkan per tick.
- Commute dan flood mempunyai lifecycle `ACTIVE → RESOLVED` berdasarkan telemetry berikutnya.
- Story hanya mulai diturunkan setelah 25 warga atau milestone Town.
- Story menghasilkan event journal `CITIZEN_STORY`/`CITIZEN_STORY_RESOLVED` tanpa mengubah simulation rules.
- Save version naik 13 → 14 dengan migration aditif ke ledger kosong.

### Perubahan UI dan visual

- City Pulse menampilkan maksimal satu story terbaru di atas diagnostics, bukan menambah widget HUD.
- Kartu story menyediakan sebab, dampak, pilihan, biaya, perkiraan hasil, dan tombol fokus lokasi.
- City Information menyimpan daftar enam story terbaru untuk detail.
- Story baru masuk Notification Center dan dapat memfokuskan kamera ke rumah, pekerjaan, atau origin perjalanan.
- Misi `Kota Punya Cerita` memakai tiga tipe story berbeda dari state nyata; bukan counter teks acak.
- Visual dunia tidak mendapat marker permanen baru pada fase minimal. Feedback visual memakai focus camera dan status map yang sudah ada agar scene tidak penuh ikon.

### Test

- Trigger commute panjang dari `Trip` nyata.
- Kesetaraan output untuk input/seed yang sama.
- Outcome hanya saat commute benar-benar turun.
- Feature gate milestone agar onboarding tidak berubah.
- Batas active/history untuk guardrail performa.
- Mission completion dari tiga story type berbeda.
- Save/load persistence dan migration version 13.
- Full deterministic replay, benchmark, smoke, balance, lint, test, dan build tetap menjadi gate akhir.

### Hasil verifikasi setelah implementasi

| Gate | Hasil |
| --- | --- |
| `npm run lint` | Lulus, 11,879 detik |
| `npm test -- --run` | 61 file / 224 test lulus, 8,75 detik runner |
| `npm run build` | Lulus, 2.337 modul, 6,68 detik Vite |
| `npm run smoke` | Lulus; deterministic hash `861a443c` |
| `npm run balance` | Lulus; seluruh fixture tanpa bankruptcy |
| `npm run benchmark` | Lulus; seluruh p95 di bawah budget |

Bundle produksi utama berubah dari 389,45 kB menjadi 399,41 kB (gzip 120,56 → 123,55 kB). CSS berubah dari 96,82 menjadi 98,15 kB (gzip 16,40 → 16,53 kB). Chunk Three.js tetap 1.119,52 kB (gzip 310,85 kB). Benchmark p95 adalah 27,4 ms untuk Small Town dan 50,8 ms untuk PERF100K, masing-masing di bawah budget 50 ms dan 120 ms.

`App.tsx` sekarang 1.974 baris / 90.148 byte. Logic story berada di modul domain 214 baris, sehingga penambahan fitur tidak memindahkan derivasi atau lifecycle story ke komponen aplikasi.

### Risiko

- Citizen ID masih bersifat teknis; pemberian nama manusia perlu generator seed-based terpisah dan keputusan tone/lokalisasi.
- `FOUND_WORK` mengenali pekerjaan yang sedang dimiliki, bukan transition diff yang sempurna. Agar benar-benar “hari pertama kerja”, citizen employment history perlu field domain baru.
- Story flood dan commute punya outcome kuat; story kedatangan, pekerjaan, dan transit masih bersifat observed event.
- Story frequency dan cooldown tujuh hari perlu playtest supaya tidak terlalu sepi atau terlalu sering.
- Benchmark besar memakai sampled population; story mewakili agent/cohort, bukan selalu satu individu literal.

### Keputusan yang perlu disetujui sebelum ekspansi Fase 1

1. Apakah warga akan memakai nama Indonesia deterministik, label netral seperti `Warga 24`, atau campuran regional?
2. Apakah story harus selalu menyebut household, atau boleh mengikuti citizen individual untuk commute/pekerjaan?
3. Apakah story outcome memberi reward kecil, atau tetap informasional agar tidak berubah menjadi quest farming?
4. Apakah cooldown tujuh hari dan history 24 item cocok dengan pacing target?

## Fase berikutnya — belum diimplementasikan

### Fase 2: Neighborhood Identity minimal

Turunkan identity dari district tile set dan telemetry nyata. Data harus menyimpan evidence scores, dominant/secondary identity, confidence, serta gameplay modifiers yang bounded. Implementasi menunggu keputusan apakah identity otomatis murni atau dapat diarahkan pemain melalui district policy.

### Fase 3: Disaster Preparation minimal

Tambahkan state machine forecast → preparation → impact → response → recovery → evaluation. Irisan pertama sebaiknya flood saja agar effectiveness dapat dibandingkan dengan seed dan storm yang sama. Implementasi menunggu definisi durasi warning dan biaya kegagalan yang dianggap adil.

### Fase 4: Policy consequences

Ubah policy menjadi kontrak benefit/cost/beneficiary/disadvantaged/short-term/long-term. Implementasi menunggu telemetry cohort/district dari Fase 2 agar pihak yang untung dan rugi bukan sekadar copy UI.

### Fase 5: City History

Bangun event ledger terpisah dari numeric `HistoryRecord`, memakai event journal yang sudah ada serta snapshot delta sebelum/sesudah. Citizen Story tidak akan dipaksa menjadi seluruh city history.

### Fase 6: Campaign dan challenge seed

Evaluasi multi-dimensional untuk mobility, green, industry, resilience, mixed-use, dan balance. Implementasi menunggu identity dan disaster preparation karena keduanya menjadi bukti gaya kota serta kualitas keputusan, bukan population score.
