# Visual P0 — 2026-09-05

> Historical: baseline `235 PASS / 1 FAIL` di bawah sudah tidak berlaku. Lihat `CURRENT_STATUS_2026-09-05.md` untuk hasil terbaru.

## Before / audit
Read the requested world renderers, legacy Building3D, App, types, CSS, README and AUDIT. Existing working tree contains extensive prior changes; preserve these.

- P0 camera: effect depends on freshly allocated target array; simulation renders reset user orbit. Tutorial focus discards settlement context. Default azimuth is axial.
- P0 lighting: scene background is fixed midnight even at noon. Asphalt is MeshBasicMaterial, so it cannot receive directional shading. Shadow rig allocates 2048² regardless of quality.
- P0 terrain: zero-elevation land is a thin plane, road tiles omit foundations, locked regions omit terrain. Elevation already maps to 0.15 world units; keep this mapping to preserve alignment.
- P0 roads: existing curbs, crosswalks and bridge piers are useful, but asphalt is thin and disconnected at tile seams. Unbounded per-lamp point lights cost heavily at night.
- P0 buildings: residential/commercial/industrial kits already have several massings and facades. Variant depends on level, changing identity on evolution; density does not affect silhouette. Variant rotation overrides road frontage.
- P0 interaction: selection is not passed into 3D renderer; previews are shallow filled planes. Raycast plane is below terrain; elevated picking can drift.
- P1: EnvironmentProps mounted twice; vehicles use constant world height. Remaining facade utility-state handling, lane trajectories, instanced streetscape, curved shorelines, slopes, adaptive LOD and overlay polish need further work.
- P2: tropical landmarks, photo mode, visual timelapse, advanced materials and milestone effects.

## Baseline verification
Lint PASS. Build PASS (25.92 s; City3D chunk 72.17 kB, gzip 18.25 kB). Smoke PASS, hash 861a443c, save round trip and replay PASS. Tests: 235 PASS / 1 FAIL in policyConsequences.test.ts:25 (unexpected `before` property); pre-existing, outside rendering scope.

## Scope
Implement P0 as one integrated render-only phase, then run all four checks. Do not modify simulation, economic contracts or existing tests to hide baseline failure. P1/P2 remain explicit follow-up work.

## Implemented P0

1. Camera uses scalar target dependencies, 45-degree default azimuth, interruptible smooth framing, reduced-motion snap, pan bounds and terrain clearance. Tutorial focus includes settlement midpoint and increases distance. Keyboard focus/rotation and existing touch OrbitControls remain available.
2. Day/night background and fog now interpolate with the simulation clock. Stronger readable sun/ambient/hemisphere rig; shadows use 512 or 1024 resolution, with existing reduced-quality shadow disable preserved.
3. Terrain foundations extend to -0.55 world units, including road foundations. Locked land/water now forms a continuous muted landscape via a single instanced draw instead of blank dark regions. Elevation scale remains 0.15. Water uses low metalness for readability without an environment map.
4. Asphalt now receives lighting and shadows, with 0.12 thickness and widths bounded to its parcel. Local road center lines, continuous highway markings across wide highway strips, bridge edge rails, and exclusion of highway zebra crossings improve infrastructure readability. Unbounded per-streetlight point lights are disabled; emissive bulbs remain.
5. Building seed includes parcel seed and coordinates, independent of level, with density/seed height variation and road-facing orientation retained. Existing procedural facade and massing kits are reused. Roof metalness reduced to avoid black surfaces without environment lighting.
6. Persistent selection and build cursor gain open-center dual outlines; invalid placement has a slash, not just a color difference. Overlays are translucent and do not write depth. Terrain picking uses the actual elevated surface and click position. Right-click does not issue placement.
7. Removed duplicate EnvironmentProps mount. Vehicle rendering samples road/bridge elevation at segment endpoints, interpolates height and renders even when simulation is paused; routing and simulation agents are untouched.

## Files changed in this task

- src/App.tsx — only selectedTile prop added to City3DCanvas; existing unrelated edits preserved.
- src/components/world/City3DCanvas.tsx — framing, quality, context landscape, selected tile, district prop and vehicle grid wiring.
- src/components/world/CameraController.tsx
- src/components/world/DayNightSky.tsx
- src/components/world/TerrainGrid.tsx
- src/components/world/RoadMesh.tsx
- src/components/world/BuildingMesh.tsx
- src/components/world/TrafficVehicles.tsx
- src/components/world/visualModel.ts — new pure render mappings.
- src/components/world/visualModel.test.ts — four behavioral tests.
- src/components/world/TileMarker.tsx — new open-center selection/preview marker.
- src/components/world/LandscapeContext.tsx — new instanced locked landscape.
- VISUAL_P0_AUDIT.md

## Before / after observed in browser

Before correction during QA, locked regions appeared dark and the regional highway was covered in repeated zebra crossings. After correction the land and river continue through locked regions, asphalt has readable lane dashes, the starter settlement has visible facades/roofs, and light separates horizontal and vertical surfaces. Night is darker/bluer but terrain and roads remain legible.

Screenshots were inspected inline, not exported as comparison files. Inspected 360×800, 1024×768 and 1440×900 scenes; requested 768×1024 capture was clipped by the browser surface, so full tablet-portrait validation remains incomplete. At 360×800 the scene is visible with tutorial minimized, but camera toolbar overflow and top UI overlap remain. 3D→2D→3D controls verified through the browser. No warning/error entries captured by browser console inspection. Night lock tested then restored to Dynamic Loop. No ten-scenario screenshot suite or complete playthrough is claimed.

## Verification and performance

Checks were run before implementation, after the integrated P0 phase and after QA corrections. Final lint PASS; production build PASS (77.01 kB City3D chunk / 19.70 kB gzip versus baseline 72.17 / 18.25); smoke PASS with identical hash 861a443c and save/replay checks. New visual tests pass. Full suite retains the baseline policyConsequences failure. One concurrent build/test/WebGL run also hit the existing 5-second verticalSlice timeout; a test-only rerun was used to check this separately.

Performance improvements are architectural, not measured FPS: vegetation submitted once instead of twice; one additional instanced landscape draw; 512²/1024² shadows instead of fixed 2048² (1/16 or 1/4 shadow texels); no unbounded streetlight point lights. No per-frame full-grid scan or random simulation writes added. Vehicle height samples are O(rendered vehicles). Terrain and existing facade components still contribute per-tile draw calls. The ~60 FPS desktop target and large-city GPU performance remain unverified; build duration is not an FPS benchmark.

Final test details: the default-worker rerun also timed out in transitReliefBenchmark and verticalSlice (237 pass / 3 fail including baseline contract). Running `npm test -- --run --maxWorkers=2` with unchanged tests and unchanged 5-second timeout yielded **239 pass / 1 baseline contract failure**, 63 passing files / 1 failing file, 16.91 seconds. Both timeout-affected suites passed with bounded worker concurrency. Therefore all-checks-green acceptance remains unmet because of the pre-existing policy contract failure; timing sensitivity of the default worker configuration is also recorded.

## Remaining work

- P0 polish: full tablet/mobile UI framing, terrain-aware mouse tests at steep grades, measured GPU frame-time and reduced-quality comparison, powered/unpowered window differentiation.
- P1: smooth terrain slope transitions, curved shoreline and foam, animated water, visible flood volume, instanced facade/streetscape LOD, traffic signals and condition wear, individual lane turn trajectories, vegetation variety and tropical palms, material/overlay accessibility validation, complete service-building variants and policy-driven details.
- P2: tropical landmarks, photo mode, timelapse, milestone effects.
- Simulation contract failure in policyConsequences remains outside this visual-only change. No existing test was weakened and no economy/save/replay implementation changed.
