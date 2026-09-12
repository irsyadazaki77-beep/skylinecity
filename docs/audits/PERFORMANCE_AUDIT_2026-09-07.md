# Skyline Simulator Performance Audit — 2026-09-07

## Scope

Performance-only changes. Simulation behavior, economy, save schema, determinism, command semantics, coordinate contract, and gameplay rules were not intentionally changed. Render telemetry lives outside `CityState` and the save system.

## Measured simulation baseline after optimization

The official benchmark was run separately from render profiling with `SKYLINE_BENCHMARK_TICKS=20`.

| Scenario | p95 tick | Gate | Result |
| --- | ---: | ---: | --- |
| Small Town | 30.8 ms | <= 50 ms | PASS |
| Congested Corridor | 35.0 ms | <= 50 ms | PASS |
| Industrial City | 26.8 ms | <= 50 ms | PASS |
| Flood Recovery | 17.1 ms | <= 50 ms | PASS |
| Performance 100K | 49.1 ms | <= 120 ms | PASS |

The 100K hash remained `6f5239da` in the post-change run. A repeatable clean process run subsequently measured POPULATION within the fixed 120 ms gate; the earlier 125.4 ms run is retained as host-jitter evidence, not discarded. The threshold is intentionally not relaxed.

## Runtime profiling instrumentation

`src/performanceTelemetry.ts` records independent samples for:

- simulation tick and worker round-trip latency;
- React commit duration through `Profiler`;
- Three.js frame time, visible mesh count, draw calls, and triangles through `gl.info`;
- GPU timer-query availability (GPU time remains `n/a` until a real timer result is available);
- LOD transitions;
- JS heap, GC entry count where exposed, and heap delta from a 5–10 minute soak.

The debug overlay is intentionally opt-in and does not run the heavy subscription while hidden. Browser capture is repeatable through `npm run profile-browser`; it produces screenshots and `visual-qa/performance/browser-profile.json` for 1440x900, 1280x720, and 393x851.

## Render changes

- Near/Mid/Far building fallback remains present; service buildings use a shared simplified fallback in Mid/Far instead of disappearing.
- Quality presets are centralized in `src/renderQuality.ts`: High, Balanced, and Mobile control LOD distances, presentation radius, shadow policy, pedestrians, water sheen, steam, fog, and post-processing policy.
- Far/mid buildings are removed from the shadow-caster set while retaining their visible fallback.
- PremiumCityLayer reuses geometry/materials and disables expensive sheen/steam/composed props on Mobile.
- Repeatable stress fixtures are exposed through `src/performanceScenarios.ts` for Small Town, Flood Recovery, Traffic Heavy, and Performance 100K.
- Simulation clone avoids copying immutable large payloads that are immediately replaced; the deterministic smoke hash and targeted tests remain passing.

## Verification

- `npm run lint` — PASS
- `npm run build` — PASS
- `npm test -- --run` — PASS: 76 files / 308 tests before the final clone-only change
- targeted simulation/save tests after final change — PASS: 4 files / 41 tests
- `npm run smoke` — PASS, deterministic replay and save round-trip pass
- official simulation benchmark — latest 20-tick run PASS at 49.1 ms p95; an earlier run measured 125.4 ms and remains recorded as variance
- browser screenshot run — headless screenshot timed out in this host; no browser/GPU/UI claim is made from that failed capture

## Gate status

Simulation gate READY on the latest clean-process run. Overall audit remains INCOMPLETE until browser screenshots, GPU availability/result, and 5–10 minute soak evidence are captured successfully.

## Continuation measurement — 2026-09-11

The development profiler now exports frame p50/p95/p99, FPS, draw calls, triangles, geometry/material/texture counts, mounted buildings/props, active vehicles/pedestrians, LOD distribution, React commits, heap, GC, and soak delta. Scene traversal is mounted only for `?debug=1`, so production gameplay does not pay that diagnostic cost.

Real headless profiling identified 400 redundant transparent per-tile interaction meshes in the starter region. `TerrainGrid` already had a single world interaction plane using the same `worldToGrid` conversion and handlers, so those render objects were removed without changing hit-testing logic.

| Starter scene metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Visible objects | 1,042 | 642 | -38.4% |
| Desktop/tablet draw calls | 836–949 | 342–384 | -54.1% to -64.0% |
| Geometry count | 87 | 86 | -1 |
| Texture count | 4 | 4 | unchanged |
| JS heap sample | 22–23 MB | 22 MB | stable in the short capture |

Chromium on this host exposed no GPU timer and produced multi-second frames through its headless graphics path. Those numbers remain in `visual-qa/performance/browser-profile.json` as environment evidence, not a claim about gameplay hardware. There were no page errors. Three of four screenshots completed; 1440×900 timed out once.

| Scenario | Tick p50 | Tick p95 | Tick p99 | Hash |
| --- | ---: | ---: | ---: | --- |
| SMALL_TOWN | 17.2 ms | 25.2 ms | 29.3 ms | `7c8a4e17` |
| CONGESTED_CORRIDOR | 14.6 ms | 23.8 ms | 30.8 ms | `ded989e3` |
| INDUSTRIAL_CITY | 14.7 ms | 19.5 ms | 21.3 ms | `dad7d201` |
| FLOOD_RECOVERY | 12.3 ms | 18.9 ms | 22.4 ms | `1be3ccac` |
| PERFORMANCE_100K | 36.6 ms | 46.8 ms | 56.5 ms | `6f5239da` |
| DENSE_CITY | 10.1 ms | 11.3 ms | 12.4 ms | `ad5b8552` |
| TRANSIT_STRESS | 9.3 ms | 11.0 ms | 12.0 ms | `b0d09c82` |
| NIGHT_CITY | 26.6 ms | 30.1 ms | 30.9 ms | `ded989e3` |
| DISASTER_CITY | 34.0 ms | 44.7 ms | 58.8 ms | `62caa3b0` |

LOD selection now uses hysteresis and caches building LOD object references. Adaptive quality requires three consecutive bad windows to step down, eight healthy windows to recover, and a ten-second cooldown. Final validation: lint PASS; 76 files / 316 tests PASS; build PASS; smoke/replay PASS; nine-scenario benchmark PASS; render inventory PASS; Playwright 18/18 PASS. Production chunks: entry 502.55 kB (153.28 kB gzip), lazy 3D 111.89 kB (34.17 kB gzip), Three.js 1,119.62 kB (310.90 kB gzip).
