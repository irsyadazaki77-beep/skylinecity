# UI and visual polish — 9 September 2026

## Scope and audit

Reviewed the React/Vite application shell, HUD, build rail/drawers, tutorial,
start screen, modal styling and settings, 2D fallback, R3F renderer, day/night
lighting, climate effects, shared building materials, quality configuration,
and telemetry. The working tree already contained extensive local changes;
those were preserved. No simulation rules, save schema, dependencies, or
gameplay data were changed in this pass.

Findings addressed:

- Clear weather replaced the existing daylight distance fog with null.
- Storm lighting used a rapid repeating flash; now uses one gentle swell per
  18 seconds and retains the reduced-motion suppression.
- Materials had no environment map supplying reflections. A shared procedural
  PMREM map now supplies restrained PBR highlights with day/night intensity.
- Visible-object telemetry traversed the scene and queried extensions every
  frame. Object counts now sample at 2 Hz; extension support is cached while
  frame timing and draw calls still update each frame.
- Building shadow traversal ran even when LOD and quality had not changed.
- Unsupported GC observation produced console warnings in browsers.
- Repeated panel styles lacked consistent surface treatment and interaction
  feedback. Added a separate token-based presentation stylesheet.
- Start-screen scenery had zero-height silhouettes; overflow rules also
  prevented scrolling on short screens.
- Autosave continuation could remain busy after a rejected promise, with no
  local error or progress message. Added recovery and accessible feedback.
- Graphics options lacked a quick way to choose a coordinated setup. Added
  three presets using existing saved settings, retaining individual controls.
- Settings tabs lacked arrow/Home/End navigation and roving tab stops.
- Mobile tutorial actions were clipped by the fixed sheet height. Content now
  scrolls independently of actions; camera and rail have separate horizontal
  lanes. Short landscape screens also keep tutorial actions and rail reachable.
- The 2D legend opened behind HUD controls. It now starts collapsed, uses a
  separate area, and exposes expanded state and its controlled panel.
- Pedestrian presentation sampling could loop forever when activity buildings
  were attached to disconnected road fragments. Sampling attempts are now
  strictly bounded and covered by a regression test.
- Passive City Pulse and alert cards could cover mobile camera controls after
  a long simulation run. They now use a safe lane and alerts cannot capture
  pointer input.
- Synthetic landmark fallbacks could place buildings that were not represented
  in simulation data. They were removed; premium context now derives from real
  zone tiles only.

## Files changed in this pass

| File | Change |
| --- | --- |
| `src/index.css` | Valid import ordering, stylesheet integration, muted text token, start-screen overflow |
| `src/styles/polish.css` | Shared glass surfaces, colors, interaction states, touch treatment, responsive layout, legend and preset styling |
| `src/components/ui/StartScreen.tsx` | Busy/error feedback and promise recovery |
| `src/components/ui/SettingsModal.tsx` | Quality presets and keyboard tab navigation |
| `src/components/ui/StarterTutorial.tsx` | Separate scrollable content and action area |
| `src/components/world/City2DCanvas.tsx` | Progressive legend disclosure and accessible relationships |
| `src/components/world/CityEnvironment.tsx` | Procedural shared environment map, lifecycle cleanup, day/night reflection intensity |
| `src/components/world/City3DCanvas.tsx` | Environment integration, telemetry sampling, conditional shadow traversal |
| `src/components/world/WeatherEffects.tsx` | Preserve clear-weather fog; gentle storm lighting |
| `src/performanceTelemetry.ts` | Check GC observer support before subscribing |
| `src/pedestrianModel.ts` / `.test.ts` | Bound disconnected activity-route sampling and prevent renderer stalls |
| `src/components/world/PremiumCityLayer.tsx` | Remove synthetic landmarks and retain data-derived urban detail |
| `visual-qa/polish-review.mjs` | Repeatable production UI capture and interaction checks |
| `visual-qa/verify-renderer.mjs` | Isolated production WebGL initialization, telemetry and screenshot check |

## Rendering budget

Reflection map faces are 128 px for balanced rendering and 64 px for reduced
rendering, generated at mount or quality-tier change and explicitly disposed.
There are no external HDR/texture downloads, per-frame reflection captures,
new particle systems, or full-screen post-processing passes. Existing traffic,
pedestrians, building lights, vegetation and weather budgets remain available.
Mobile glass panels avoid backdrop blur on primary controls. Existing quality
adaptation and the 2D fallback are preserved. No FPS improvement is claimed
without a successful hardware profiling run.

## Validation and limits

- Production build and ESLint/TypeScript validation pass.
- Unit suite: 76 files / 309 tests passed on final logic.
- Visual captures: `visual-qa/polish/` at 1440×900, 393×851 and 844×390.
  These exercise the real production UI in 2D with low graphics settings.
  `results.json` records exceptions and viewport overflow checks.
- Browser interaction capture also checks tutorial CTA visibility, opening
  settings, applying Balanced, and moving from Graphics to Audio by keyboard.
- Production WebGL initializes without console/page errors and a 1280×720 3D
  screenshot completes under the low/software quality verification profile.
  `results-3d.json` records a visible canvas with no viewport overflow.
- All 18 real Playwright workflows passed across desktop and mobile. Seventeen
  passed in the complete matrix run; its one mobile collision was fixed and
  that same scenario passed on its focused rerun.
- The dev server hit a dependency-optimizer access error during the earlier
  audit, so final screenshots use the successfully built production bundle.

The automated and software-rendered release checks are green. Real mobile
hardware performance, browser/GPU combinations, long soak sessions, and a
measured whole-app contrast audit remain device-level release checks; no finite
local suite can prove every device combination. Existing beta status and save
compatibility are retained. User data migration or reset is not required.
