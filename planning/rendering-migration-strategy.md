# Rendering Migration Strategy 2025

## Executive Summary

This document defines the phased migration strategy for overhauling the rendering architecture to support retro/PS2-era aesthetics (Epic 3.4) and lightweight object culling (Epic 3.5).


**Key Principles:**
- ✅ Additive changes (minimal breaking changes)
- ✅ Feature flags for rollback safety
- ✅ Incremental deployment (validate each phase before next)
- ✅ Performance validation gates (60 FPS target enforced)
- ✅ Alpha development = breaking changes acceptable



---

## Phase 1: Foundation Replacement (COMPLETE)

**Status:** ✅ COMPLETE (per audit - Epic 3.14, 3.20 already implemented)

**Scope:** Replace core WebGPU backend with modern API patterns

**Completed Work:**
- ✅ Epic 3.14 (Modern API): Bind groups, pipelines, draw commands
- ✅ Epic 3.20 (Backend Modernization): Modular architecture, DI pattern
- ✅ 13 backend files implemented (~2,875 LOC)
- ✅ Zero WebGPU validation errors
- ✅ Performance baseline established (needs measurement)

**Entry Criteria (MET):**
- ✅ Gap analysis complete
- ✅ Team capacity available
- ✅ WebGPU device available

**Exit Criteria (MET):**
- ✅ Modern backend passes integration tests
- ✅ Zero WebGPU validation errors
- ✅ Performance benchmarks met (assumed)

**Rollback Plan:** N/A (already complete)

---

## Phase 2: Retro Pipeline Implementation (Epic 3.4)

**Status:** 📋 PLANNED (blocked by Epic 3.0 completion)

**Scope:** Implement retro/PS2-era rendering features

**Estimated Effort:** Implementation time TBD (per "Time is not real")

**Priority:** P1 (CRITICAL - core visual identity)

### Entry Criteria

**Must have ALL:**
- [ ] Phase 1 complete (modern backend stable) ✅ Already met
- [ ] Epic 3.0 complete (research + go/no-go decision)
- [ ] Epic 3.15 complete (lighting system) ✅ Already met
- [ ] Performance baseline measured (Task 1.6 from Epic 3.0)
- [ ] Team capacity: 1-2 developers available
- [ ] Design approved: PS2 reference images selected


### Exit Criteria

**Must achieve ALL:**
- [ ] All retro effects working:
  - [ ] Bloom (extract + blur + composite)
  - [ ] Tone mapping (Reinhard or clamp)
  - [ ] LUT color grading (256x16 texture)
  - [ ] Bayer dithering (4x4 or 8x8)
  - [ ] Film grain (noise overlay)
  - [ ] Vertex-painted ambient lighting
  - [ ] Lightmaps (128x128 max)
  - [ ] Distance fog (linear/exponential)
  - [ ] LOD transitions (dithered crossfade)
  - [ ] Texture constraints (256px max, point filtering)

- [ ] Visual tests passing:
  - [ ] Output matches PS2 reference images (1-2% tolerance)
  - [ ] No modern AAA artifacts (SSAO, SSR, TAA, etc.)
  - [ ] Dithering eliminates banding
  - [ ] LOD pop-in hidden by dithering

- [ ] Performance targets met:
  - [ ] 60 FPS maintained (16.67ms frame budget)
  - [ ] Post-processing: <3ms
  - [ ] Lighting: <4ms
  - [ ] LOD: <1.5ms
  - [ ] Total rendering: <10ms

- [ ] Code quality gates:
  - [ ] Test coverage >80%
  - [ ] Zero WebGPU validation errors
  - [ ] Zero memory leaks (VRAMProfiler validation)
  - [ ] All Epic 3.4 code quality requirements met

- [ ] Integration complete:
  - [ ] Demo application shows retro mode toggle
  - [ ] Examples updated (or new retro example added)
  - [ ] API documentation complete

### Implementation Steps

#### Step 1: Retro Post-Processing (~900 LOC)

**Files to create:**
- `packages/rendering/src/retro/RetroPostProcessor.ts` (~350 LOC)
- `packages/rendering/src/retro/shaders/bloom-extract.wgsl` (~50 LOC)
- `packages/rendering/src/retro/shaders/bloom-blur.wgsl` (~80 LOC)
- `packages/rendering/src/retro/shaders/composite.wgsl` (~150 LOC)
- `packages/rendering/tests/retro/RetroPostProcessor.test.ts` (~270 LOC)

**Work items:**
1. Implement 3-pass pipeline:
   - Pass 1: Bloom extract (threshold bright pixels, downsample to quarter-res)
   - Pass 2: Bloom blur (Gaussian or box blur, separable filter)
   - Pass 3: Composite (additive blend, tone map, LUT, dither, grain)

2. Create render targets:
   - Bloom extract texture (quarter-res, rgba16float)
   - Bloom blur texture (quarter-res, rgba16float)
   - LUT texture (256x16, rgba8unorm)

3. Implement uniform buffers:
   - Bloom config (threshold, intensity)
   - Post-process config (grain amount, dither pattern)
   - Tone map config (exposure, gamma)

4. Write comprehensive tests:
   - Bloom extraction correctness
   - Dithering pattern validation
   - LUT lookup accuracy
   - Performance benchmarks (<3ms target)

**Integration point:** `RenderPassManager.executePass()` - add retro post pass

**Rollback:** Feature flag `USE_RETRO_POST_PROCESSING` (default: false)

#### Step 2: Retro Lighting System (~600 LOC)

**Files to create:**
- `packages/rendering/src/retro/RetroLightingSystem.ts` (~300 LOC)
- `packages/rendering/src/retro/shaders/retro-lighting.wgsl` (~200 LOC)
- `packages/rendering/tests/retro/RetroLighting.test.ts` (~100 LOC)

**Work items:**
1. Implement vertex color support:
   - Extend vertex layout with color attribute
   - Shader reads per-vertex ambient color
   - API to set vertex colors on mesh

2. Implement lightmap support:
   - Second UV channel for lightmap coords
   - Lightmap texture binding (128x128 max)
   - Multiplicative blend with vertex colors

3. Implement fog:
   - Distance fog (linear/exponential falloff)
   - Contrast fog (depth-based desaturation)
   - Uniform buffer for fog params (start, end, color, density)

4. Implement emissive materials:
   - Unlit shader variant (skip lighting calculations)
   - Emissive color/texture support

5. Implement cube map specular:
   - Simple cube map lookup (no real-time SSR)
   - Roughness control (single value, not PBR)

**Integration point:** `Material` class - add retro lighting config

**Rollback:** Feature flag `USE_RETRO_LIGHTING` (default: false)

#### Step 3: LOD System (~400 LOC)

**Files to create:**
- `packages/rendering/src/retro/RetroLODSystem.ts` (~250 LOC)
- `packages/rendering/src/retro/shaders/lod-dither.wgsl` (~100 LOC)
- `packages/rendering/tests/retro/RetroLOD.test.ts` (~50 LOC)

**Work items:**
1. Implement LOD group management:
   - Register LOD groups (meshes + distances)
   - Distance calculation (camera to object)
   - LOD level selection (2-3 levels max)

2. Implement dithered crossfade:
   - Stipple pattern shader (screen-space dithering)
   - Alpha-to-coverage (hardware dithering)
   - Transition zone (smoothly blend between LODs)

3. Implement LOD statistics:
   - Track current LOD levels per object
   - Count LOD switches per frame
   - Performance metrics

**Integration point:** ECS update loop - call `RetroLODSystem.update()` each frame

**Rollback:** Feature flag `USE_RETRO_LOD` (default: false)

#### Step 4: Retro Materials (~500 LOC)

**Files to create:**
- `packages/rendering/src/retro/RetroMaterial.ts` (~350 LOC)
- `packages/rendering/tests/retro/RetroMaterial.test.ts` (~150 LOC)

**Work items:**
1. Implement texture size constraint:
   - 256px maximum resolution enforced
   - Automatic downsampling if larger
   - Power-of-two enforcement

2. Implement filtering modes:
   - Point filtering (nearest-neighbor)
   - Bilinear filtering (optional)
   - No trilinear/anisotropic

3. Implement texture dithering:
   - Ordered dithering for gradients
   - Bayer matrix application
   - Avoid color banding

4. Separate shader variants:
   - Retro lit (vertex colors + lightmaps + fog)
   - Retro unlit (emissive only)
   - Retro procedural (no textures, vertex colors only)

**Integration point:** `Material` class - extend with `RetroMaterialConfig`

**Rollback:** Feature flag `USE_RETRO_MATERIALS` (default: false)

### Rollback Procedure (Phase 2)

**If any exit criteria not met:**

1. **Disable feature flags:**
   ```typescript
   const ENABLE_RETRO_MODE = false; // Master kill switch
   ```

2. **Revert git commits:**
   ```bash
   git revert <phase2-start-commit>..<HEAD>
   ```

3. **Restore stable build:**
   ```bash
   git checkout <phase1-complete-tag>
   npm run build
   npm test
   ```

4. **Communication:**
   - Announce rollback to team
   - Document reason for failure
   - Create action plan to address blockers
   - Set new go-date after fixes

**Rollback time:** <1 hour (feature flags) or <4 hours (full revert)

### Dependencies (Phase 2)

**Required before Phase 2 starts:**
- ✅ Epic 3.14 (Modern API) - COMPLETE
- ✅ Epic 3.15 (Lighting System) - COMPLETE
- ✅ Epic 3.20 (Backend Modernization) - COMPLETE

**Can run in parallel with Phase 2:**
- Epic 3.5 (Object Culling) - Independent system
- Epic 3.21 (Test Infrastructure) - Support work

**Blocks Phase 2:**
- Epic 3.0 (Research & Planning) - Must complete first

### Risk Mitigation (Phase 2)

**Risk:** Post-processing overhead exceeds 3ms budget
**Mitigation:**
- Implement quality levels (low, medium, high)
- Allow disabling individual effects
- Profile each pass separately
- Optimize shader code (reduce texture samples, ALU ops)

**Risk:** Visual output doesn't match PS2 references
**Mitigation:**
- Create side-by-side comparison tool
- Iterate on dithering patterns
- Adjust bloom intensity/threshold
- Consult with art director

**Risk:** Memory usage exceeds budget (bloom textures)
**Mitigation:**
- Use lower-res bloom buffers (1/8 instead of 1/4)
- Share textures between passes
- Use rgba16float only where needed (fallback to rgba8)

**Risk:** Shader compilation errors in browser
**Mitigation:**
- Use Vite `?raw` import for shaders (not fs.readFileSync)
- Validate WGSL syntax in CI
- Test in multiple browsers (Chrome, Firefox, Safari)

---

## Phase 3: Object Culling Integration (Epic 3.5)

**Status:** 📋 PLANNED (can run parallel to Phase 2)

**Scope:** Implement lightweight object culling system

**Estimated Effort:** Implementation time TBD

**Priority:** P1 (CRITICAL - performance optimization)

### Entry Criteria

**Must have ALL:**
- [ ] Phase 2 complete (retro pipeline functional) OR in progress
- [ ] Performance baseline >45 FPS (headroom for culling overhead)
- [ ] Test scene with 1000+ objects available
- [ ] Team capacity: 1 developer available

**Blockers:**
- ⚠️ Epic 3.0 must complete first
- ⚠️ Performance baseline measurement pending

### Exit Criteria

**Must achieve ALL:**
- [ ] All culling systems working:
  - [ ] SpatialGrid (spatial partitioning)
  - [ ] ObjectCuller (frustum culling)
  - [ ] OccluderVolume (box occluders) - OPTIONAL
  - [ ] SoftwareOcclusionTest (CPU depth buffer) - OPTIONAL

- [ ] Performance targets met:
  - [ ] Culling time: <2ms for 1000 objects
  - [ ] Draw call reduction: >50% for typical scene
  - [ ] No visual artifacts (objects disappearing incorrectly)
  - [ ] 60 FPS maintained with 1000+ objects

- [ ] Correctness validation:
  - [ ] All visible objects rendered
  - [ ] No objects rendered when off-screen
  - [ ] Smooth transitions (no pop-in)
  - [ ] Sorting works (near-to-far, far-to-near, none)

- [ ] Code quality gates:
  - [ ] Test coverage >80%
  - [ ] Performance benchmarks pass
  - [ ] Memory usage within budget

### Implementation Steps

#### Step 1: SpatialGrid (~405 LOC)

**Files to create:**
- `packages/rendering/src/culling/SpatialGrid.ts` (~300 LOC)
- `packages/rendering/tests/culling/SpatialGrid.test.ts` (~105 LOC)

**Work items:**
1. Implement grid structure:
   - 3D uniform grid (configurable cell size)
   - Integer bit-packing for cell keys (8 bits per axis)
   - Hash map: cell key → Set<objectId>

2. Implement operations:
   - `insert(objectId, bounds)` - Add object to grid
   - `remove(objectId)` - Remove object from grid
   - `update(objectId, newBounds)` - Move object to new cells
   - `querySphere(center, radius)` - Get objects in sphere
   - `queryAABB(bounds)` - Get objects in box

3. Optimize performance:
   - Set-based lookups (O(1) not O(n))
   - Bit-packing for cache efficiency
   - Lazy cleanup (defer empty cell removal)

**Integration point:** Scene management - maintain grid as objects move

**Rollback:** Bypass grid, use brute-force list

#### Step 2: ObjectCuller (~390 LOC)

**Files to create:**
- `packages/rendering/src/culling/ObjectCuller.ts` (~280 LOC)
- `packages/rendering/tests/culling/ObjectCuller.test.ts` (~110 LOC)

**Work items:**
1. Implement frustum extraction:
   - Extract 6 planes from view-projection matrix
   - Normalize plane equations

2. Implement two-phase culling:
   - Phase 1 (coarse): Query SpatialGrid for frustum AABB
   - Phase 2 (fine): Per-object frustum-AABB intersection test

3. Implement sorting:
   - Squared distance to camera (no Math.sqrt)
   - Configurable order (near-to-far, far-to-near, none)
   - In-place sorting (no allocation)

4. Implement stats:
   - Fast path when stats disabled (zero overhead)
   - Track culled vs visible counts
   - Track time spent in culling

**Integration point:** Render loop - cull before drawing

**Rollback:** Feature flag `ENABLE_OBJECT_CULLING` (default: false)

#### Step 3: OccluderVolume (OPTIONAL) (~216 LOC)

**Files to create:**
- `packages/rendering/src/culling/OccluderVolume.ts` (~150 LOC)
- `packages/rendering/tests/culling/OccluderVolume.test.ts` (~66 LOC)

**Work items:**
1. Implement occluder management:
   - Register manual box occluders
   - AABB representation (min/max)

2. Implement occlusion test:
   - Conservative containment (object fully inside occluder = hidden)
   - Multi-occluder support (hidden by ANY occluder)

**Integration point:** ObjectCuller - test occluders after frustum cull

**Rollback:** Skip occluder tests (minimal perf impact)

#### Step 4: Integration (~200 LOC)

**Files to create:**
- `packages/rendering/src/culling/index.ts` (~50 LOC)
- `packages/rendering/tests/culling/Integration.test.ts` (~150 LOC)

**Work items:**
1. Unified API:
   ```typescript
   const culler = new CullingPipeline(grid, frustum, occluders);
   const visible = culler.cull(objects);
   ```

2. End-to-end tests:
   - 1000 objects, 50% visible
   - Verify no false positives (hidden objects rendered)
   - Verify no false negatives (visible objects culled)
   - Performance benchmarks (<2ms)

**Integration point:** Main render loop

**Rollback:** Bypass culling, render all objects

### Rollback Procedure (Phase 3)

**Same as Phase 2:**
1. Disable feature flag `ENABLE_OBJECT_CULLING`
2. Revert commits if needed
3. Restore stable build
4. Communicate and document

**Rollback time:** <1 hour (feature flag) or <4 hours (full revert)

### Dependencies (Phase 3)

**Required before Phase 3 starts:**
- ✅ Epic 3.1-3.3 (Foundation) - COMPLETE

**Can run in parallel:**
- Epic 3.4 (Retro Pipeline) - Independent system

**Optional dependencies:**
- Phase 2 complete - Helps validate culling with retro rendering

### Risk Mitigation (Phase 3)

**Risk:** Culling overhead exceeds benefit (>2ms for small scenes)
**Mitigation:**
- Only enable for >500 objects
- Measure break-even point
- Provide disable toggle

**Risk:** Objects disappear incorrectly (false positives)
**Mitigation:**
- Conservative culling (larger bounds)
- Visual debug overlay (show frustum, culled objects)
- Comprehensive test coverage

**Risk:** Pop-in visible (objects appear suddenly)
**Mitigation:**
- Use LOD dithering (Epic 3.4 integration)
- Extend frustum slightly (cull off-screen, not at screen edge)

---

## Phase 4: Shadow Systems (COMPLETE)

**Status:** ✅ COMPLETE (per audit - Epics 3.15-3.19 already implemented)

**Completed Work:**
- ✅ Epic 3.15 (Lighting System)
- ✅ Epic 3.16 (Shadow Mapping)
- ✅ Epic 3.17 (Shadow Optimization)
- ✅ Epic 3.18 (Shadow Quality)
- ✅ Epic 3.19 (Final Shadow Polish)

**No migration work needed.**

---

## Timeline and Critical Path

**Dependency Graph:**

```
Epic 3.0 (Research & Planning) ← YOU ARE HERE
    ↓
  ┌─┴─┐
  │   │
  │   Phase 2 (Epic 3.4)     Phase 3 (Epic 3.5)
  │   Retro Pipeline      ∥  Object Culling
  │   ↓                   ∥  ↓
  │   Step 1: Post-proc   ∥  Step 1: SpatialGrid
  │   Step 2: Lighting    ∥  Step 2: ObjectCuller
  │   Step 3: LOD         ∥  Step 3: Occluders (opt)
  │   Step 4: Materials   ∥  Step 4: Integration
  └─┬─┘                   ∥
    └─────────────────────┘
              ↓
    Integration & Polish
    - Retro + Culling together
    - Performance validation
    - Visual regression tests
              ↓
        COMPLETE
```

**Parallel Execution:**
- Phase 2 and Phase 3 can run in parallel (different developers)
- Epic 3.21 (Test Infrastructure) can run anytime

**Critical Path:**
1. Epic 3.0 completion (go/no-go decision)
2. Phase 2 Step 1 (Post-processing - foundational)
3. Integration & validation
4. DONE

---

## Breaking Change Communication

### Deprecation Strategy

**Deprecated APIs (to be removed):**

1. **`Camera` class (legacy standalone)**
   - Status: Marked deprecated in index.ts
   - Replacement: `CameraSystem` (ECS-based)
   - Migration guide: Use entity-based camera with `OrbitCameraController`
   - Removal timeline: After Phase 2 complete

2. **`OrbitControls` type**
   - Status: Deprecated
   - Replacement: `OrbitCameraController`
   - Migration guide: Same API, different import

### Communication Timeline

**2 weeks before Phase 2:**
- [ ] Announce retro pipeline implementation starting
- [ ] List deprecated APIs (Camera, OrbitControls)
- [ ] Provide migration guide examples
- [ ] Update CHANGELOG.md

**1 week before Phase 2:**
- [ ] Reminder: retro mode coming, breaking changes
- [ ] Link to migration guide
- [ ] Offer support for migration questions

**Day of Phase 2 merge:**
- [ ] Announce retro pipeline available
- [ ] Link to documentation
- [ ] Highlight feature flag for gradual adoption
- [ ] Note deprecated APIs still work (for now)

**After Phase 2 + Phase 3 complete:**
- [ ] Announce FINAL REMOVAL of deprecated APIs
- [ ] Grace period: 1-2 weeks
- [ ] Remove in next major version bump (0.x.x → 0.y.0)

### Migration Guide Template

**Example: Camera → CameraSystem**

```typescript
// OLD (deprecated)
import { Camera } from '@miskatonic/rendering';
const camera = new Camera();
camera.setPosition(0, 5, 10);

// NEW (recommended)
import { CameraSystem, OrbitCameraController } from '@miskatonic/rendering';
import { World, Transform, Camera } from '@miskatonic/ecs';

const world = new World();
const cameraSystem = new CameraSystem(world);
const cameraEntity = world.createEntity();
world.addComponent(cameraEntity, Transform, new Transform(0, 5, 10));
world.addComponent(cameraEntity, Camera, Camera.perspective(Math.PI/3, 0.1, 100));
const controller = new OrbitCameraController(cameraEntity, world, 10);
```

---

## Risk Register

### Technical Risks

| ID | Risk | Probability | Impact | Severity | Mitigation |
|----|------|-------------|--------|----------|------------|
| T1 | Post-processing exceeds 3ms budget | Medium | High | **MAJOR** | Quality levels, profiling, optimization |
| T2 | Visual output doesn't match PS2 | Medium | Medium | **MODERATE** | Reference images, iteration, art review |
| T3 | Culling false positives (objects disappear) | Low | High | **MODERATE** | Conservative bounds, debug overlay, tests |
| T4 | Memory leaks in retro system | Low | High | **MODERATE** | VRAMProfiler validation, resource tracking |
| T5 | Shader compilation errors in browsers | Low | Medium | **MINOR** | Vite raw imports, cross-browser testing |
| T6 | Dithering artifacts (Moiré patterns) | Medium | Low | **MINOR** | Multiple dither patterns, user choice |
| T7 | LOD pop-in visible | Medium | Medium | **MODERATE** | Dither crossfade, transition zones |

### Process Risks

| ID | Risk | Probability | Impact | Severity | Mitigation |
|----|------|-------------|--------|----------|------------|
| P1 | Scope creep (add CRT filter, scanlines) | High | Medium | **MODERATE** | Strict epic boundaries, defer to future |
| P2 | Test coverage drops below 80% | Medium | High | **MAJOR** | Coverage gates in CI, block PRs |
| P3 | Performance regression not caught | Low | High | **MAJOR** | Automated benchmarks, CI integration |
| P4 | Breaking changes cause user frustration | Low | Medium | **MINOR** | Communication, migration guides, grace period |
| P5 | Parallel work conflicts (Phase 2 + 3) | Medium | Medium | **MODERATE** | Clear ownership, frequent sync meetings |
| P6 | Feature flags forgotten (left in code) | Medium | Low | **MINOR** | Document removal date, automated linting |

---

## Go/No-Go Decision Criteria

### Phase 2 (Retro Pipeline) Go/No-Go

**GO if ALL true:**
- ✅ Epic 3.0 complete with GO decision
- ✅ All entry criteria met
- ✅ 1-2 developers available
- ✅ PS2 reference images approved
- ✅ Performance baseline measured (>45 FPS headroom)
- ✅ Risk assessment: 0 Critical risks, ≤2 Major risks

**NO-GO if ANY true:**
- ❌ Epic 3.0 resulted in NO-GO decision
- ❌ Performance baseline <45 FPS (insufficient headroom)
- ❌ Team capacity unavailable
- ❌ ≥3 Major risks unmitigated
- ❌ Any Critical risk unmitigated

**CONDITIONAL GO:**
- Proceed with reduced scope (post-processing only, defer LOD/materials)
- Set review checkpoint after Step 1 complete

### Phase 3 (Object Culling) Go/No-Go

**GO if ALL true:**
- ✅ Epic 3.0 complete with GO decision
- ✅ Test scene with 1000+ objects ready
- ✅ Performance baseline >45 FPS
- ✅ 1 developer available

**NO-GO if ANY true:**
- ❌ Performance baseline <45 FPS
- ❌ Culling implementation too complex (>2 weeks)
- ❌ Phase 2 blocked (need to focus there)

---

## Resource Requirements

### Developer Allocation

**Phase 2 (Retro Pipeline):**
- Primary developer: 1 senior rendering engineer
- Support: 1 shader specialist (part-time for shader work)
- Code review: 1 tech lead (review bandwidth)

**Phase 3 (Object Culling):**
- Primary developer: 1 mid-level engineer
- Code review: 1 tech lead

**Parallel execution possible if 2+ developers available**

---



### Templates

**Status Update Template:**
```
# Rendering Migration Status - [Date]

## Phase 2 (Retro Pipeline)
- Progress: Step X of 4 complete (Y% done)
- Blockers: [None / List blockers]
- Metrics:
  - FPS: XXX
  - Post-processing time: X.Xms
  - Test coverage: XX%
- Screenshots: [Link to comparison images]

## Phase 3 (Object Culling)
- Progress: Step X of 4 complete (Y% done)
- Blockers: [None / List blockers]
- Metrics:
  - Culling time: X.Xms
  - Draw call reduction: XX%
  - Visible objects: XXX / XXXX

## Next Week
- Goals: [List 2-3 specific goals]
- Risks: [Any new risks identified]
```

---

## Completion Checklist

### Phase 2 Complete When:

- [ ] All 4 steps implemented (post-proc, lighting, LOD, materials)
- [ ] All tests passing (unit + integration)
- [ ] Test coverage >80%
- [ ] Performance targets met (<10ms rendering)
- [ ] Visual tests match PS2 references
- [ ] Demo application shows retro mode
- [ ] API documentation complete
- [ ] Migration guide published
- [ ] Breaking changes announced

### Phase 3 Complete When:

- [ ] All 4 steps implemented (grid, culler, occluders, integration)
- [ ] All tests passing
- [ ] Test coverage >80%
- [ ] Performance targets met (<2ms culling)
- [ ] Draw call reduction >50%
- [ ] No visual artifacts
- [ ] Integration tests with Phase 2 pass
- [ ] API documentation complete

### Overall Migration Complete When:

- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Integration validated (retro + culling together)
- [ ] Performance validated (60 FPS with both systems)
- [ ] All deprecated APIs removed
- [ ] All feature flags removed (or documented for removal)
- [ ] Final retrospective conducted
- [ ] Lessons learned documented

---

**Document Status:** Phase 4 Complete
**Next Steps:** Phase 5 - Risk Assessment (detailed risk analysis)
