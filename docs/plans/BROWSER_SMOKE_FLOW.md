# Browser-level smoke flow — 5 September 2026

This is the manual browser-level flow for the P1 vertical slice. It was executed against the local Vite server at `http://127.0.0.1:4173/` in the Codex in-app browser, with DOM/accessibility checks after each interaction. `npm run smoke` remains the deterministic engine/save smoke; it does not replace this UI flow.

## Verified flow

| Step | UI action | Visual/DOM verification | Result |
| --- | --- | --- | --- |
| 1 | Start screen → `Kota Baru` | Start modal dismissed; tutorial and HUD visible | PASS |
| 2 | Read tutorial step 1 | Stable `LANGKAH 1 DARI 5`; no state-dependent denominator | PASS |
| 3 | `Tunjukkan lokasi` | Settlement and regional highway are visible in the same 697×729 browser frame | PASS |
| 4 | `Lakukan sekarang` | Road tool activates and guidance names the settlement/highway gap | PASS |
| 5 | Switch to 2D and drag the local road across the gap | Cell `(38,30)` changes from `EMPTY` to `ROAD`; tutorial advances | PASS |
| 6 | Select `Zonasi → Hunian Rendah` and click an unlocked cell | Cell changes to `RESIDENTIAL`; tutorial advances | PASS |
| 7 | Select `Komersial` and click an unlocked cell | Cell changes to `COMMERCIAL` | PASS |
| 8 | Start normal simulation speed | HUD day advances and population/cash change; pause control remains available | PASS |
| 9 | Observe diagnostics | City Pulse and causal alert cards appear from live city state | PASS |
| 10 | Open `Info Kota` from City Pulse | City Information panel opens with localized sections and live metrics | PASS |
| 11 | Select a residential tile, then close inspector | Inspector opens with tile coordinates and closes via `Tutup inspector` | PASS |
| 12 | Focus/reset camera | Focus control is available for a selected tile; `Reset kamera` clears focus, restores zoom 125%, and returns to 3D | PASS |
| 13 | 3D → 2D → 3D | 2D exposes `Peta kota mode 2D` and 3,600 accessible tile buttons; returning to 3D removes that region | PASS |
| 14 | Open save panel, save slot 1, advance, load slot 1 | Slot 1 records the city; after the city reaches a later day, load restores Hari 1 / Populasi 0 / Kas $8,000 | PASS |
| 15 | Inspect Indonesian labels | Menu, save modal, Info Views, City Pulse, diagnostics, overview metrics, disaster actions, and inspector labels are Indonesian | PASS |

## Camera regression evidence

Before the fix, selecting `Tampilan 2D` changed the camera pitch but left the 3D scene mounted. The fix makes the view-mode handler update both `cameraViewMode` and the renderer mode. After the fix, the DOM exposes the real 2D region and tile grid, and the reverse transition restores the 3D branch.

## Notes and residuals

- The flow intentionally pauses the simulation before save/load so an uncontrolled timer cannot change the observed state during the persistence check.
- The in-game `Quit & New City` confirmation uses a native browser confirm dialog, which is not safely controllable through the current in-app browser bridge. The Start Screen `Kota Baru` path was used for the destructive reset and passed; no claim is made for automated confirmation of the menu variant.
- This is a repeatable manual smoke script, not a CI browser test. Browser frame-time p50/p95 was not fabricated; performance numbers in the status report come from the deterministic CLI benchmark.
