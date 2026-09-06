# Skyline City — Autonomous Engineering & Performance Status

> **Auto-generated**: 2026-09-06T09:28:22.784Z  
> **Commit**: `cdc1d70` (main)  
> **Smoke Day/Hash**: Day 2 · Hash `5be7d3c6` · ✅ PASS

## 1. Simulation Performance Gate (Target: Normal <= 50ms, 100K <= 120ms)

| Scenario | Pop (Rep) | Entities | p50 | p95 | p99 | Budget | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SMALL_TOWN** | 24 | 19 | 13.5ms | 23.3ms | 24.1ms | <= 50ms | ✅ PASSED |
| **CONGESTED_CORRIDOR** | 640 | 4 | 10.4ms | 13.7ms | 23.6ms | <= 50ms | ✅ PASSED |
| **INDUSTRIAL_CITY** | 160 | 49 | 12.5ms | 16.3ms | 19.5ms | <= 50ms | ✅ PASSED |
| **FLOOD_RECOVERY** | 640 | 39 | 11.4ms | 14.9ms | 15.0ms | <= 50ms | ✅ PASSED |
| **PERFORMANCE_100K** | 100,000 | 13 | 35.9ms | 46.3ms | 47.0ms | <= 120ms | ✅ PASSED |

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
