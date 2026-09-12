# Skyline City Upgrade — Gap Report Aktual

Tanggal audit: 2026-09-06  
Status: **belum final / goal masih aktif**

## Terbukti di workspace

- Living city: pedestrian park visits, weather/incident-sensitive density, connected walking paths, dan traffic OD story.
- Traffic presentation: bottleneck evidence, observed before/after comparison, serta visual archetype sedan, scooter, MPV, van, bus, tram, freight, dan emergency.
- Buildings/environment: construction stages dengan crane, district identity facade accents, palm vegetation, climate-sensitive vegetation, dan park civic sculpture.
- Audio/weather/night: procedural Web Audio, weather effects, day/night lighting, dan settings audio tersedia di source serta unit tests audio.
- Disaster loop: forecast, preparation actions, preparedness, avoided damage, recovery cost, dan UI Environment panel.
- Content/progression: registry data-driven, district identity, scenario `waterfront-identity`, landmark objective berbasis jumlah `PARK` aktual.
- Compatibility: smoke membuktikan save round-trip dan deterministic replay; save migration tests lulus.

## Gate terakhir yang terbukti

- Lint/typecheck: PASS.
- Full unit regression: 75 test files / 307 tests PASS.
- Production build: PASS.
- Smoke: PASS, termasuk `saveRoundTripValid` dan `deterministicReplay`.
- Balance: PASS, seluruh official scenarios tanpa bankruptcy.
- Render inventory: PASS, tetapi ini **synthetic budget estimate**, bukan GPU FPS.
- Benchmark hash: stabil untuk seluruh official scenarios.
- Benchmark timing: variatif; beberapa run lulus, beberapa run melewati budget, terutama `PERFORMANCE_100K`.

## Gap yang belum boleh ditutup

1. Performance gate perlu profiling pada host/proses bersih; jangan mengubah threshold atau hash contract untuk meloloskannya.
2. Browser E2E runtime dan screenshot visual belum mendapat hasil terminal: Playwright/Chromium timeout saat startup/interaksi meskipun `--list` menemukan 18 tests dan accessibility tree aplikasi dapat terbaca melalui browser interaktif.
3. GPU FPS, memory leak, dan LOD hitch belum memiliki pengukuran browser nyata.
4. Scenario/campaign sudah bertambah, tetapi belum ada acceptance pass end-to-end untuk seluruh campaign progression.
5. Visual acceptance untuk day/night, flood, bridge/tunnel, dense map, placement, overlay, dan mobile hardware belum lengkap.

## Invariants yang dipertahankan

- Tidak ada perubahan pada TileData contract, koordinat, command semantics, save version contract, atau authoritative simulation hash.
- Presentation-only improvements tidak mengubah routing, economy, population accounting, atau determinism.
- Existing user changes pada `StarterTutorial.tsx`, `index.css`, dan `visual-qa/capture-after.mjs` dipertahankan.

Dokumen ini sengaja tidak menyatakan upgrade selesai sampai gap di atas memiliki bukti aktual.
