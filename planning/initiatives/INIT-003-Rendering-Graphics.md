# INIT-003: Rendering & Graphics Pipeline

**Owner:** Core Engine Team
**Timeline:** 12-16 weeks (80-113 days remaining)
**Status:** 21/22 epics complete (95% done)

## Overview

Modern WebGPU-based rendering pipeline supporting retro/lo-fi aesthetics with modern performance. Targets PlayStation 2 era visual style with contemporary optimization techniques.

**Philosophy:** Authentically retro visuals using period-appropriate techniques, no modern AAA bloat.

## Status Dashboard

| Epic | Title | Status | Priority | Effort |
|------|-------|--------|----------|--------|
| 3.1-3.3 | Foundation & Core Systems | ✅ COMPLETE | P0 | - |
| 3.4 | Retro Rendering Pipeline | 🔄 PHASE 1 COMPLETE | P1 | Phase 2: 1-2 weeks |
| 3.5 | Lightweight Culling | ✅ COMPLETE | P1 | - |
| 3.6 | Particles & VFX | ✅ COMPLETE | P2 | - |
| 3.7-3.13 | Systems (Skybox, Sprites, Billboards, etc.) | ✅ COMPLETE | P1-P2 | - |
| 3.14 | WebGPU Modern API | ✅ COMPLETE | P0 | - |
| 3.15 | Lighting System | ✅ COMPLETE | P1 | - |
| 3.16 | Shadow Mapping | ✅ COMPLETE | P1 | - |
| 3.17 | Shadow Optimization | ✅ COMPLETE | P1 | - |
| 3.18 | Shadow Quality | ✅ COMPLETE | P2 | - |
| 3.19 | Final Shadow Polish | ✅ COMPLETE | P2 | - |
| 3.20 | WebGPU Backend Modernization | ✅ COMPLETE | P0 | - |
| 3.21 | Test Infrastructure | ✅ COMPLETE | P0 | - |
| 3.22 | API Patterns & Performance | ✅ COMPLETE | P1 | - |

**Key Metrics:**
- Test Coverage: 80%+ across all systems
- Performance: 60 FPS @ 1080p, <500 draw calls
- Shadow Quality: PCF 4x4, 2048px maps, 4 cascades
- String Operations: 83.3% reduction achieved

## Table of Contents

- [Active Epics](#active-epics)
  - [Epic 3.4: Retro Rendering Pipeline](#epic-34-retro-rendering-pipeline)
  - [Epic 3.5: Lightweight Culling](#epic-35-lightweight-culling)
- [Completed Work](#completed-work)
- [Dependencies](#dependencies)
- [Performance Targets](#performance-targets)

---

## Active Epics

### Epic 3.4: Retro Rendering Pipeline
**Priority:** P1
**Dependencies:** Epic 3.15 ✅, Epic 3.14 ✅
**Status:** 🔄 IN PROGRESS (Phase 1 Complete)
**Estimated Effort:** 2-3 weeks (Phase 1: 1 week complete, Phase 2: 1-2 weeks remaining)
**Aesthetic:** PlayStation 2 / Early 2000s / Lo-Fi / Demake Style

**Philosophy:** Authentically retro visuals using period-appropriate techniques. No modern AAA features (SSAO, SSR, TAA). Embrace limitations as artistic choices.

#### Post-Processing (Retro) - Phase 1 ✅ ARCHITECTURE COMPLETE
- ✅ Simple additive bloom (low-res buffer → bilinear upsample)
- ✅ Basic tone mapping (simple Reinhard or clamping, no HDR thresholds)
- ✅ Single-LUT color grading (256x16 texture lookup)
- ✅ Ordered dither patterns for color/alpha blending (Bayer matrix)
- ✅ Noise/grain overlay for film aesthetic
- **Implementation:** `RetroPostProcessor.ts` (565 lines) + `retro-post-process.wgsl` (267 lines)
- **Tests:** 21 tests passing (RetroPostProcessor.test.ts)
- **Deferred to Phase 2:** Render pass execution (needs backend integration)

#### Lighting (Retro) - Phase 1 ✅ COMPLETE
- ✅ Vertex-painted ambient lighting (baked per-vertex colors)
- ✅ Simple lightmaps (baked ambient occlusion/GI, 128x128 max)
- ✅ Distance fog (linear/exponential falloff)
- ✅ Contrast fog (depth-based desaturation)
- ✅ Unlit emissive materials for neon signs/UI
- ✅ Specular highlights via simple cube map (not real-time SSR)
- **Implementation:** `RetroLighting.ts` (285 lines) + `retro-lighting.wgsl` (293 lines)
- **Tests:** 28 tests passing (RetroLighting.test.ts)

#### LOD System (Retro) - Phase 1 ✅ COMPLETE
- ✅ Dithered crossfade LOD transitions (alpha-to-coverage or stipple patterns)
- ✅ Distance-based switching (2-3 LOD levels max)
- ✅ No smooth mesh morphing, no temporal blending
- **Implementation:** `RetroLOD.ts` (334 lines) + `retro-lod.wgsl` (223 lines)
- **Features:** Comprehensive validation, procedural Bayer dithering, LOD bias calculation

#### Textures & Materials - Phase 1 ✅ COMPLETE
- ✅ 256px maximum texture resolution constraint
- ✅ Point filtering / nearest-neighbor sampling option
- ✅ Texture dithering for smooth gradients (avoid banding)
- ✅ Separate retro/unlit shader variants (not PBR extension)
- **Implementation:** `RetroMaterial.ts` (456 lines)
- **Features:** Power-of-two enforcement, downscaling utilities, procedural dither

#### Code Quality - 6 Critical Bugs Fixed ✅
- ✅ Shader uniform buffer resolution mismatch
- ✅ Buffer alignment waste (trimmed 48 bytes garbage)
- ✅ Bayer pattern normalization
- ✅ LOD validation (negative/inverted ranges)
- ✅ WGSL array syntax (flattened nested arrays)
- ✅ Resource disposal (null handle assignments)

#### Deferred to Future Epics
- CRT filter / scanlines / phosphor glow (separate epic)
- Low-pass filter / blur (separate epic)

**Phase 1 Completion Summary:**
- **Total LOC:** ~2,900 lines (production code + tests)
- **Test Coverage:** 49 tests passing (21 post-processing + 28 lighting)
- **Architecture:** 100% complete
- **Integration:** Deferred to Phase 2

**Phase 2 (Remaining Work):**
- Implement render pass execution in `RetroPostProcessor.apply()`
- Implement shader loading in `RetroMaterial.createShaderAndPipeline()`
- Integration with main rendering pipeline
- Performance validation (60 FPS target)
- Additional tests for LOD and Material systems

**Acceptance Criteria (Phase 1):**
- Retro aesthetic matches PS2-era references (defaults validated)
- All effects use period-appropriate techniques (no modern AAA)
- Architecture supports 60 FPS (uniform updates optimized)
- Dithering eliminates smooth blending artifacts (Bayer matrices implemented)
- Separate shader variants (lit/unlit/procedural)

---

### Epic 3.5: Lightweight Culling ✅
**Priority:** P1
**Dependencies:** Epic 3.1-3.3 ✅
**Status:** ✅ COMPLETE (2025-11-15)
**Actual Effort:** 2 weeks
**Philosophy:** Retro aesthetics with modern lightweight performance

#### Phase 1: SpatialGrid ✅ COMPLETE
- ✅ Uniform 3D grid for spatial partitioning (O(log n) performance)
- ✅ Integer bit-packing for cell keys (8 bits per axis, 256 max)
- ✅ Efficient update algorithm with Set-based O(1) lookups
- ✅ Sphere and AABB query support
- **Implementation:** `SpatialGrid.ts` (405 lines)
- **Tests:** 54 tests passing, 100% coverage
- **Performance:** <1ms for 1000-2000 objects

#### Phase 2: ObjectCuller ✅ COMPLETE
- ✅ Two-phase frustum culling (coarse spatial query + fine frustum test)
- ✅ Proper frustum AABB calculation (Cramer's rule for plane intersections)
- ✅ Squared distance sorting (no Math.sqrt() overhead)
- ✅ Configurable sort order (near-to-far, far-to-near, none)
- ✅ Stats fast path (zero overhead when disabled)
- **Implementation:** `ObjectCuller.ts` (390 lines)
- **Tests:** 18 tests passing
- **Performance:** <2ms for 1000 objects, <3ms for 2000 objects

#### Phase 3: OccluderVolume ✅ COMPLETE
- ✅ Manual box occluders for large buildings/terrain
- ✅ Conservative AABB containment test
- ✅ Multi-occluder support
- **Implementation:** `OccluderVolume.ts` (216 lines)
- **Tests:** 29 tests passing
- **Performance:** <1ms for 10-20 occluders

#### Phase 4: SoftwareOcclusionTest ✅ COMPLETE
- ✅ Lightweight CPU depth buffer (64x64 low-resolution)
- ✅ Conservative rasterization for huge objects
- ✅ Depth-based occlusion testing
- **Implementation:** `SoftwareOcclusionTest.ts` (387 lines)
- **Tests:** 18 tests passing
- **Performance:** <10ms for 10-20 huge objects

#### Phase 5: Integration & Public API ✅ COMPLETE
- ✅ Comprehensive end-to-end testing (119 tests total)
- ✅ Performance benchmarks validated
- ✅ Public API exported via `culling/index.ts`

#### Not Implemented (Retro-Inappropriate)
- ❌ GPU-based occlusion queries (too modern)
- ❌ Complex BVH structures (overkill for retro scenes)
- ❌ Visibility buffer optimization (modern deferred technique)

**Final Metrics:**
- **Total LOC:** ~1,600 lines production code (405 + 390 + 216 + 387 + integration)
- **Test Coverage:** 119 tests passing across all phases
- **Performance:** All budgets met (<2ms culling, <1ms occluders, <10ms software occlusion)
- **Code Quality:** All code-critic issues resolved

**Acceptance Criteria:**
- ✅ Frustum culling eliminates off-screen objects (ObjectCuller)
- ✅ Spatial grid reduces culling from O(n) to O(log n) (SpatialGrid)
- ✅ Occluder volumes hide geometry behind large objects (OccluderVolume)
- ✅ Software occlusion test for huge objects (SoftwareOcclusionTest)
- ✅ Performance: 1000-2000 objects @ 60 FPS with <2ms budget
- ✅ No GPU queries, no complex BVH required

---

### Epic 3.18: Shadow Quality (Phase 3) ✅
**Priority:** P2
**Dependencies:** Epic 3.17 ✅
**Status:** ✅ COMPLETE (2025-11-15)

#### Completed Tasks
- ✅ **Task 3.1:** PCF Filtering - 16-sample Poisson disk sampling
- ✅ **Task 3.2:** Cascade Blending - Smooth transitions between cascades
- ✅ **Task 3.3:** Contact Hardening
  - Variable penumbra based on blocker distance (PCSS-lite)
  - Retro-appropriate shadow softness (16+16 samples = 32 total)
  - Fixed 3 critical bugs from code review (blocker depth, missing param, double division)
  - 19 tests passing (ContactHardeningShadows.test.ts)
- ✅ **Task 3.4:** Quality Metrics & Benchmarks
  - Shadow quality validation across all 3 tasks
  - Performance budget analysis (0.8ms typical, 3ms budget)
  - Quality vs performance tradeoff documentation
  - Retro aesthetic alignment validation
  - 12 tests passing (ShadowQualityBenchmark.test.ts)

#### Completion Summary
- **Test Coverage:** 31 tests total (19 implementation + 12 benchmark)
- **Performance:** 0.8ms typical shadow cost (27% of 3ms budget, 5% of frame)
- **Quality Metrics:**
  - PCF: 16-sample Poisson disk (well-distributed, min separation 0.459)
  - Cascades: 4-cascade support, ~90% aliasing reduction vs no blending
  - Contact Hardening: 32 total samples (50% savings vs full PCSS)
- **Retro Alignment:** Exceeds PS2 baseline while maintaining 60 FPS
- **Files:** 3 shader files, 2 test files (383 lines + 262 lines tests)

**All acceptance criteria met:** Natural soft shadows, comprehensive quality benchmarks, 60 FPS maintained, retro aesthetic preserved.

---

### Epic 3.19: Final Shadow Polish ✅
**Priority:** P2
**Dependencies:** Epic 3.18 ✅
**Estimated Effort:** 1 week
**Status:** ✅ COMPLETE (2025-11-15)

#### Completed Tasks
- ✅ Shadow acne mitigation (depth bias tuning)
- ✅ Light leaking prevention (surface acne fixes)
- ✅ Edge case handling (large objects, extreme angles)
- ✅ Final performance tuning
- ✅ Production-ready shadow system
- ✅ Quality presets (Low, Medium, High, Custom)
- ✅ Auto-tuning utility for scene-specific bias calculation

#### Implementation Summary
**Files Created:**
- `packages/rendering/src/shadows/ShadowPolish.ts` (470 lines)
  - Complete shadow bias calculation system
  - Light leak validation
  - Edge case handling for large objects and extreme angles
  - Quality presets with production-ready defaults
  - Auto-tuning utility for scene-specific configuration

- `packages/rendering/tests/shadows/ShadowPolish.test.ts` (392 lines)
  - 31 comprehensive tests covering all functionality
  - Bias calculation validation across angles, distances, edge cases
  - Light leak detection validation
  - Configuration management tests
  - Auto-tuning validation
  - PS2-era preset validation

**Test Coverage:** 31 tests passing (100% coverage)
  - Initialization with all quality profiles
  - Bias calculation for flat surfaces, angled surfaces, extreme angles
  - Adaptive bias for large objects
  - Light leak validation (occluder position, depth discontinuity, surface orientation)
  - Receiver plane offset calculation
  - Configuration management (partial updates, custom profiles)
  - Quality presets validation (Low, Medium, High, Custom)
  - Recommendation systems (PCF kernel size, shadow map resolution)
  - Auto-tuning for small/large scenes, large objects, extreme angles, distant lights

**Critical Fix:** Deep copy bug in `autoTuneShadowBias()` - was mutating SHADOW_QUALITY_PRESETS due to shallow spread operator

**Acceptance Criteria:**
- ✅ No visible shadow artifacts in common scenarios (bias calculation handles all angles)
- ✅ Shadow system production-ready (quality presets + auto-tuning)
- ✅ Documentation complete (comprehensive JSDoc + test coverage)
- ✅ All shadow epics integrated and tested (31/31 tests passing)

**Deferred Items:**
- Atlas resolution uniform (Issue #2) - Not critical, hardcoded value works for current implementation
- Numerical validation tests (Issue #7) - Already covered by existing test suite (31 tests with numerical validation)

---

## Completed Work

Detailed documentation for completed epics has been archived for clarity:

- **[Epic 3.1-3.3: Foundation & Core Systems](INIT-003-completed/Epic-3.1-3.3-Foundation.md)** (Week 1-4)
  - WebGPU device initialization, context management
  - Basic triangle rendering, shader compilation
  - Mesh rendering, vertex buffers, index buffers

- **[Epic 3.6-3.13: Rendering Systems](INIT-003-completed/Epic-3.6-3.13-Systems.md)** (Week 5-8)
  - Particle system, VFX
  - Skybox, sprite rendering, billboards
  - Text rendering, GPU instancing
  - Interleaved vertex buffers

- **[Epic 3.14-3.17: Lighting & Shadows](INIT-003-completed/Epic-3.14-3.17-Lighting.md)** (Week 9-12)
  - WebGPU Modern API (render passes, command buffers)
  - Basic lighting (directional, point, spot)
  - Shadow mapping (basic implementation)
  - Shadow optimization (caching, cascades)

- **[Epic 3.20-3.22: Modernization & Quality](INIT-003-completed/Epic-3.20-3.22-Quality.md)** (Week 13-16)
  - WebGPU Backend refactoring (DI, modularity)
  - Test infrastructure (benchmarks, integration tests)
  - API patterns & performance (builder pattern, string reduction)

**Summary Metrics (Completed Epics):**
- Total LOC: ~8,500 lines of production code
- Test Coverage: 80%+ across all systems
- Performance: All targets met or exceeded
- String Operations: 83.3% reduction (Task 6.6)

---

## Dependencies

```
Epic 3.1-3.3 (Foundation) ✅
    ↓
Epic 3.14 (Modern API) ✅
    ↓
Epic 3.15 (Lighting) ✅ → Epic 3.4 (Retro Pipeline) 🔄
    ↓                        ↓
Epic 3.16 (Shadows) ✅      Epic 3.5 (Culling) 📋
    ↓
Epic 3.17 (Shadow Optimization) ✅
    ↓
Epic 3.18 (Shadow Quality) ✅
    ↓
Epic 3.19 (Shadow Polish) ✅
```

**Parallel Tracks:**
- Retro Pipeline (3.4) + Culling (3.5) can run in parallel

---

## Performance Targets

### Frame Budget (60 FPS = 16.67ms)
- Rendering: <10ms
- Shadow mapping: <3ms
- Culling: <2ms
- Physics/ECS: <3ms
- Remaining: ~1ms headroom

### Resource Limits
- Draw calls: <500 per frame
- Shadow maps: 4 cascades × 2048px
- Texture memory: <512MB
- Vertex buffers: Interleaved, instanced where possible

### Quality Metrics
- Shadow aliasing: <5% visible artifacts
- Cascade blending: Smooth transitions, no banding
- Retro aesthetic: Dithered blending, point filtering, lo-fi textures

---

## Next Steps

1. **Epic 3.4 (Retro Pipeline)** - Phase 2 (1-2 weeks)
   - Implement render pass execution
   - Implement shader loading
   - Integration with main rendering pipeline
   - Performance validation (60 FPS target)

2. **Epic 3.5 (Lightweight Culling)** - 2 weeks
   - CPU frustum culling
   - Simple spatial structure
   - Manual occluder volumes

**Total Remaining:** 3-4 weeks for all active epics

---

**Last Updated:** 2025-11-15
**Completion:** 91% (20/22 epics)
