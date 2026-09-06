# Skyline City — Autonomous Engineering & Performance Status

> **Auto-generated**: 2026-09-06T09:26:41.655Z  
> **Commit**: `310516e` (main)  
> **Smoke Day/Hash**: Day 2 · Hash `5be7d3c6` · ✅ PASS

## 1. Simulation Performance Gate (Target: Normal <= 50ms, 100K <= 120ms)

| Scenario | Pop (Rep) | Entities | p50 | p95 | p99 | Budget | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SMALL_TOWN** | 24 | 19 | 15.6ms | 21.5ms | 24.3ms | <= 50ms | ✅ PASSED |
| **CONGESTED_CORRIDOR** | 640 | 4 | 10.8ms | 15.7ms | 24.9ms | <= 50ms | ✅ PASSED |
| **INDUSTRIAL_CITY** | 160 | 49 | 12.9ms | 17.7ms | 20.4ms | <= 50ms | ✅ PASSED |
| **FLOOD_RECOVERY** | 640 | 39 | 12.7ms | 15.4ms | 17.6ms | <= 50ms | ✅ PASSED |
| **PERFORMANCE_100K** | 100,000 | 13 | 37.9ms | 46.6ms | 47.1ms | <= 120ms | ✅ PASSED |

**Gate Result**: ✅ ALL BUDGETS & REGRESSION GATES PASSED

## 2. Three.js Render Benchmark (Prioritas 5)

| Scenario | Pop | Buildings | Triangles | Draw Calls | Peds | Vehs | Estimated FPS | p95 Frame |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1K City (Small Town)** | 0 | 6 | 3,888 | 6 | 26 | 0 | 60 fps | 1.32ms |
| **10K City (Industrial City)** | 0 | 22 | 4,272 | 22 | 26 | 0 | 60 fps | 1.56ms |
| **50K City (Congested Corridor)** | 0 | 21 | 4,248 | 21 | 26 | 0 | 60 fps | 1.55ms |
| **100K City (Metropolis 100K)** | 100,000 | 1640 | 43,104 | 83 | 26 | 0 | 60 fps | 2.79ms |

## 3. Subsystem Audit Summary

- **Pedestrian System**: Representative agent sampling from live trips; sidewalk offsets (±0.28); crosswalk state machine.
- **Construction Lifecycle**: Deterministic stages (SITE_PREP → FOUNDATION → FRAME → STRUCTURE → FACADE → FINISHING → OCCUPIED).
- **Building Renderer 3.0**: Fully modularized kits (Residential, Commercial, Office, Industrial, Service, Construction, Shared Materials).
- **Traffic Motion**: Physics acceleration/deceleration, red light queueing, transit dwells (1.8s), freight delivery dwells (2.0s).
- **Causal UX**: WHAT → WHY → WHERE → ACTION → TRADEOFF structure with camera focus action.
- **Citizen Profile & Business Identity**: Deterministic seed identity, workplace, commute, revenue, expenses, and freight reliability.
- **Tropical Aesthetic & Audio**: Adaptive music crossfade (CALM, GROWTH, BUSY_CITY, CRISIS, DISASTER, METROPOLIS), sirens, weather haze/fog.
