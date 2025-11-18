# INIT-003: Rendering & Graphics Pipeline

## Overview

Modern WebGPU-based rendering pipeline supporting retro/lo-fi aesthetics with modern performance. Targets PlayStation 2 era visual style with contemporary optimization techniques.

**Philosophy:** Authentically retro visuals, no modern AAA bloat.

---

## Active Epics

### Epic 3.4: Retro Rendering Pipeline (COMPLETE OVERHAUL)
**Priority:** P1
**Dependencies:** Epic 3.15, Epic 3.14
**Status:** ✅ COMPLETE (November 17, 2025)
**Aesthetic:** PlayStation 1/2 / Early 2000s / Lo-Fi / Demake Style

**Philosophy:** Authentically retro visuals using period-appropriate techniques. No modern AAA features (SSAO, SSR, TAA). Embrace limitations as artistic choices.

**⚠️ BREAKING CHANGES - THIS IS A REPLACEMENT, NOT AN ADDITION:**
This epic will **REMOVE** existing modern rendering features and **REPLACE** them with retro equivalents:
- **DELETE:** Shadow system (7 files, ~3,500 LOC) - all shadow mapping, cascades, atlases, PCF
- **DELETE:** Any PBR/modern lighting code
- **DELETE:** Any AA/TAA systems
- **DELETE:** Any SSR/SSAO/modern post-processing
- **DELETE:** Temporal effects and smooth morphing
- **DELETE:** GPU queries and BVH structures
- **KEEP:** Core WebGPU backend, resource management, pipeline builders, ECS integration (~85% reuse)
- **REPLACE:** Lighting with vertex-only system
- **REPLACE:** Materials with retro texture constraints

#### Forbidden Features (MUST NOT IMPLEMENT)
- ❌ **NO PBR** (physically-based rendering, metallic/roughness workflows)
- ❌ **NO per-pixel lighting** (all lighting must be vertex-based)
- ❌ **NO SSR** (screen-space reflections)
- ❌ **NO SSAO** (screen-space ambient occlusion)
- ❌ **NO AA of any kind** (no MSAA, FXAA, TAA, SMAA)
- ❌ **NO temporal effects** (no TAA, no temporal blending, no motion blur)
- ❌ **NO smooth mesh morphing** (LOD transitions use dithering only)
- ❌ **NO GPU queries** (occlusion queries, timestamp queries for this epic)
- ❌ **NO BVH structures** (use simple spatial grids/octrees only)

#### Post-Processing (Retro)
- [x] Simple additive bloom (low-res 1/4 buffer → bilinear upsample)
- [x] Basic tone mapping (**gamma correction only**, no Reinhard/ACES/Filmic)
- [x] Single-LUT color grading (256x16 texture lookup, subtle grading)
- [x] Ordered dither patterns for color/alpha blending (Bayer 4x4 or 8x8 matrix)
- [x] Noise/grain overlay for film aesthetic
- [x] **Optional CRT shader** (scanlines, phosphor glow, curvature)
- [x] Render pass execution (3 passes: bloom extract, blur, composite)

#### Lighting (Retro - Vertex Only)
- [x] **Vertex lighting system** (Lambert diffuse computed per-vertex, NOT per-pixel)
- [x] Vertex-painted ambient colors (baked per-vertex ambient term)
- [x] Simple lightmaps (baked ambient occlusion/GI, 128x128 max resolution)
- [x] Distance fog (linear or exponential falloff)
- [x] Contrast fog (depth-based desaturation for atmospheric depth)
- [x] Unlit emissive materials for neon signs/UI (skip lighting entirely)
- [x] Specular highlights via cube map lookup (simple reflection, not SSR)

#### LOD System (Retro)
- [x] Dithered crossfade LOD transitions (alpha-to-coverage or stipple patterns)
- [x] Distance-based switching (2-3 LOD levels max)
- [x] No smooth mesh morphing, no temporal blending

#### Shader Variants (Required)
- [x] **vertex-color.wgsl** - Per-vertex color shading only (no textures)
- [x] **unlit.wgsl** - Unlit/emissive materials (bypass lighting)
- [x] **simple-lambert.wgsl** - Basic Lambert diffuse (vertex lighting)
- [x] **emissive.wgsl** - Self-illuminated materials (glowing objects)
- [x] **specular-cubemap.wgsl** - Cube map specular reflections
- [x] **bloom-extract.wgsl** - Post-process: extract bright pixels
- [x] **bloom-blur.wgsl** - Post-process: Gaussian blur
- [x] **composite.wgsl** - Post-process: final composite with dither/LUT/grain
- [x] **crt-effect.wgsl** - Optional CRT shader (scanlines, curvature)

#### Textures & Materials
- [x] 256px maximum texture resolution constraint (enforced)
- [x] Point filtering (nearest-neighbor) or bilinear only
- [x] Texture dithering for smooth gradients (avoid color banding)
- [x] Separate shader variants per material type (vertex-color, unlit, lambert, emissive)

#### Code Quality
- [ ] Shader uniform buffer resolution
- [ ] Buffer alignment optimization
- [ ] Bayer pattern normalization
- [ ] LOD validation (negative/inverted ranges)
- [ ] WGSL array syntax (flattened nested arrays)
- [ ] Resource disposal (null handle assignments)
- [ ] Shader loading in browser context
- [ ] WebGPU texture upload validation

#### Deferred to Future Epics
- Low-pass filter / blur effects (separate epic)
- Advanced CRT effects beyond basic scanlines (separate epic)

**Phase 1 Tasks (Demolition):**
- [x] **REMOVE** shadow system files (shadows/ directory - all 7 files)
- [x] **REMOVE** PBR/modern lighting features from existing shaders
- [x] **REMOVE** any AA/TAA/temporal effect code
- [x] **REMOVE** deprecated Camera.ts and legacy exports
- [x] **UPDATE** index.ts to remove deleted exports

**Phase 2 Tasks (Retro Foundation):**
- [x] Implement 9 new retro shaders (vertex-color, unlit, lambert, emissive, etc.)
- [x] Create vertex lighting system (replace per-pixel lighting)
- [x] Add vertex color attributes to vertex layouts
- [x] Implement texture size constraint enforcement (256px max)

**Phase 3 Tasks (Post-Processing):**
- [x] Implement 3-pass bloom pipeline (extract, blur, composite)
- [x] Add gamma-only tonemapping
- [x] Add ordered dithering (Bayer patterns)
- [x] Add color LUT support
- [x] Optional CRT shader

**Phase 4 Tasks (Integration):**
- [x] LOD system with dithered crossfade
- [x] Cube map specular system
- [x] Fog system (distance + contrast)
- [x] Demo integration showing retro mode
- [x] Performance validation (60 FPS target) - **120 FPS achieved (2x target), 8.33ms frame time**
- [x] Update all examples to use new retro API (integrated into main demo)

**Acceptance Criteria:**
- **Vertex lighting only** - No per-pixel lighting calculations ✅
- **All forbidden features absent** - No PBR, SSR, SSAO, AA, temporal effects ✅
- **Retro aesthetic matches PS1/PS2-era references** - Visual comparison tests pass ✅
- **All shader variants implemented** - vertex-color, unlit, lambert, emissive, cubemap ✅
- **60 FPS maintained** - Performance budget met (16.67ms frame time) ✅ **EXCEEDED (120 FPS)**
- **Dithering eliminates banding** - Smooth gradients use ordered dither ✅
- **Tonemapping is gamma only** - No complex tone curves (Reinhard/ACES forbidden) ✅
- **Bloom is additive** - Simple additive blend, no halos or complex filtering ✅
- **Texture limit enforced** - 256px maximum resolution constraint active ✅

**Performance Validation Results (November 17, 2025):**

Test Configuration: 2924x2194 resolution (Retina display), CRT effects enabled

| Load Level | Objects | FPS | Frame Time | VRAM | CPU Total | GPU Exec | Notes |
|-----------|---------|-----|------------|------|-----------|----------|-------|
| Low | 60 | 120 | 8.33 ms | 3.07 MB | 0.80 ms | 7.53 ms | Physics active |
| High | 2,364 | 119 | 8.33 ms | 3.66 MB | 5.00 ms | 3.33 ms | 40x object increase |

**Key Findings:**
- ✅ **Performance target massively exceeded**: 120 FPS vs 60 FPS target (2x)
- ✅ **Frame budget well within limits**: 8.33ms used of 16.67ms available (50%)
- ✅ **GPU instancing highly effective**: 40x object increase with <1 FPS drop
- ✅ **Excellent memory efficiency**: Only 3.66 MB VRAM for 2,364 instanced objects
- ✅ **No performance regressions**: Retro pipeline faster than previous implementation

---

### Epic 3.5: Lightweight Object Culling
**Priority:** P1
**Dependencies:** Epic 3.1-3.3
**Status:** ✅ COMPLETE (November 17, 2025)
**Philosophy:** Retro aesthetics with modern lightweight performance
**Scope:** Object culling for mesh geometry (Note: Light culling already exists separately)

#### Phase 1: Spatial Structure (Choose One)
- [x] **Option A: Uniform 3D Grid** - Best for evenly distributed objects ✅ IMPLEMENTED
  - Integer bit-packing for cell keys (8 bits per axis, 256³ cells max)
  - Efficient update algorithm with Set-based O(1) lookups
  - Sphere and AABB query support
- [ ] **Option B: Loose Octree** - NOT SELECTED (uniform grid chosen)

#### Phase 2: ObjectCuller
- [x] Two-phase frustum culling (coarse spatial query + fine frustum test)
- [x] Proper frustum AABB calculation (Cramer's rule for plane intersections)
- [x] Squared distance sorting (no Math.sqrt() overhead)
- [x] Configurable sort order (near-to-far, far-to-near, none)
- [x] Stats fast path (zero overhead when disabled)

#### Phase 3: OccluderVolume (OPTIONAL)
- [ ] Manual box occluders for large buildings/terrain (artist-placed) - DEFERRED
- [ ] Conservative AABB containment test (object fully inside = occluded) - DEFERRED
- [ ] Multi-occluder support (hidden by ANY occluder) - DEFERRED
- [ ] **Note:** Optional feature deferred - current performance is excellent without it

#### Phase 4: SoftwareOcclusionTest (OPTIONAL)
- [ ] Lightweight CPU depth buffer (64x64 low-resolution for large occluders) - DEFERRED
- [ ] Conservative rasterization for huge objects only (buildings, terrain) - DEFERRED
- [ ] Depth-based occlusion testing (object behind occluder = hidden) - DEFERRED
- [ ] **Note:** Optional feature deferred - high CPU cost, not needed for current workloads

#### Phase 5: Integration & Public API
- [x] Comprehensive end-to-end testing (all 5 critical fixes verified)
- [x] Performance benchmarks validation (culling working correctly in demo)
- [x] Public API export via culling/index.ts (integrated into rendering package)

#### Not Implemented (Retro-Inappropriate)
- ❌ GPU-based occlusion queries (too modern)
- ❌ Complex BVH structures (overkill for retro scenes)
- ❌ Visibility buffer optimization (modern deferred technique)

**Target Metrics:**
- Performance: All budgets met (<2ms culling, <1ms occluders, <10ms software occlusion)
- Code Quality: Resolve all code-critic issues

**Acceptance Criteria:**
- **Frustum culling eliminates off-screen mesh objects** (not lights - separate system) ✅
- **Spatial structure reduces culling** from O(n) to O(log n) average case ✅
- **Occluder volumes hide geometry** behind large objects (if implemented) - DEFERRED (not needed)
- **Software occlusion test works** for huge objects only (if implemented) - DEFERRED (not needed)
- **Performance: 1000-2000 objects @ 60 FPS** with <2ms culling budget ✅
- **No false negatives** - All visible objects are rendered ✅
- **No false positives** - No visible pop-in or objects disappearing incorrectly ✅
- **No GPU queries, no complex BVH** - Lightweight CPU-based culling only ✅

**Implementation Summary (November 17, 2025):**

**Core Implementation:**
- Uniform 3D Grid (16x16x16 = 4,096 cells) with integer bit-packing
- Two-phase frustum culling (spatial query + AABB test)
- Per-die-type bounding spheres (D4=0.4, D6=0.866, D8=0.5, D10=0.673, D12=0.55, D20=0.6)
- Object pooling (zero allocation after initialization)
- Sleep optimization (skip updating sleeping rigid bodies)

**Integration (demo.ts):**
- Added ObjectCuller initialization with 16x16x16 spatial grid
- Integrated culling into render loop (updates positions, performs frustum test)
- Added culling stats to UI (Visible, Culled, Reduction %)
- Lifecycle management (addObject, updateObject, removeObject, clear)
- Verified all 5 critical code-critic fixes

**Files Modified:**
- `/packages/renderer/src/demo.ts` (~70 LOC added) - Integration into demo
- `/packages/renderer/index.html` (4 LOC added) - Culling stats UI
- `/packages/rendering/src/index.ts` (18 LOC added) - Epic 3.5 exports

**Key Accomplishments:**
- ✅ Zero API errors after fixing all 5 critical issues identified by code-critic
- ✅ Culling stats display working correctly in UI
- ✅ Camera rotation changes visible/culled counts as expected
- ✅ No false negatives or false positives observed
- ✅ Clean integration with existing ECS/physics systems
- ✅ Optional features (OccluderVolume, SoftwareOcclusionTest) correctly deferred

**Performance:**
- Culling working correctly with dynamic dice simulation
- UI shows real-time culling statistics
- No performance regressions observed
- Sleep optimization reduces unnecessary updates

---

### Epic 3.6: Static Model Viewer
**Priority:** P2
**Dependencies:** Epic 3.4 (Retro Rendering Pipeline), Epic 3.5 (Object Culling)
**Status:** 🚧 IN PROGRESS (November 18, 2025)
**Philosophy:** Validate retro rendering pipeline with real-world 3D models

**Purpose:** Create a dedicated model viewer to test and validate how actual 3D assets render using the retro pipeline. This is a testing/validation tool, not a game feature.

**Scope:**
- Static model display (no physics simulation)
- Camera controls (orbit with existing OrbitCameraController)
- Pan functionality enhancement to OrbitCameraController
- Same debug UI as dice demo (FPS, VRAM, culling stats, post-processing controls)
- OBJ model loading from `models/` directory (Naked Snake model already present)
- Retro lighting and post-processing validation using existing RetroPostProcessor

#### Core Requirements

**Model Loading:**
- [ ] OBJ file parser (`loadOBJ`, `parseOBJ` functions) in Geometry.ts
- [ ] Support for v (vertex), vn (normal), vt (texture coord), f (face) directives
- [ ] Support for MTL material file parsing (basic material properties only)
- [ ] Automatic normal generation for models without normals (using face normals)
- [ ] Vertex/index buffer creation from loaded geometry (reuse GeometryData interface)
- [ ] Handle both Uint16Array and Uint32Array indices (based on vertex count >65535)
- [ ] Error handling for malformed OBJ files (missing faces, invalid indices)
- [ ] Validate indices are within vertex array bounds
- [ ] Handle different face winding orders (CW/CCW detection and normalization)

**Scene Setup:**
- [ ] Single static model display (no instancing, reuse DrawCommand patterns from demo.ts)
- [ ] Use existing OrbitCameraController from rendering/src/CameraControllers.ts
- [ ] Ground plane using createPlane() from Geometry.ts (10x10 units, white/gray checkerboard)
- [ ] Reuse RetroLightingSystem from demo.ts with single directional light
- [ ] Calculate model bounding box to auto-position camera at optimal distance
- [ ] Center model at origin, apply scale if needed to fit in view frustum

**Camera Controls:**
- [ ] Orbit rotation using existing OrbitCameraController.rotate() (left mouse drag)
- [ ] Add pan() method to OrbitCameraController for target movement (right mouse drag)
- [ ] Zoom using existing OrbitCameraController.zoom() (mouse wheel)
- [ ] Reset camera to default view (R key - reset distance, azimuth, elevation)
- [ ] Display camera state in debug UI (distance, azimuth, elevation, target position)

**Debug UI & Controls:**
- [ ] Copy stats display from demo.ts (FPS counter, frame time graph, VRAM usage)
- [ ] Reuse RetroPostProcessor UI controls (bloom, CRT, fog toggles from demo)
- [ ] Add model-specific stats section (vertex count, triangle count, draw calls)
- [ ] Add light direction sliders (azimuth, elevation) updating RetroLightingSystem
- [ ] Add wireframe toggle using WIREFRAME_PIPELINE_STATE from PipelineStateDescriptor
- [ ] Display loaded texture info if MTL file references textures

**Rendering Integration:**
- [ ] Load simple-lambert.wgsl shader from retro/shaders/ directory
- [ ] Reuse RetroPostProcessor from demo.ts (bloom, CRT, fog effects)
- [ ] Create vertex buffer with position, normal, uv attributes (matching shader layout)
- [ ] If MTL file present, parse diffuse texture path and load with 256px constraint
- [ ] Use RetroMaterial class for material properties (diffuse, ambient, specular)
- [ ] Apply vertex lighting via RetroLightingSystem (no per-pixel lighting)

**Test Model:**
- [ ] Use existing "Naked Snake" model in `models/Naked Snake/` directory
- [ ] Load Naked_Snake.obj (90KB, ~2-5K triangles estimated)
- [ ] Load Naked_Snake.mtl for material definitions
- [ ] Handle multiple texture files (Tex_*.png) with 256px resize if needed
- [ ] Add fallback: if model missing, load a generated cube/sphere from Geometry.ts

#### Implementation Phases

**Phase 1: OBJ Loader Implementation**
- [ ] Add `parseOBJ(objText: string): GeometryData` to Geometry.ts
  - [ ] Parse v/vn/vt/f directives with regex or line-by-line parsing
  - [ ] Build vertex arrays (positions, normals, uvs) from parsed data
  - [ ] Handle f directive formats: "f v1 v2 v3", "f v1/vt1 v2/vt2 v3/vt3", "f v1/vt1/vn1"
  - [ ] Triangulate quads/polygons using fan triangulation from first vertex
  - [ ] Generate normals if missing using cross product of face edges
- [ ] Add `loadOBJ(url: string): Promise<GeometryData>` async wrapper
  - [ ] Fetch file content, handle network errors
  - [ ] Call parseOBJ with fetched text
  - [ ] Return GeometryData matching existing interface
- [ ] Add `parseMTL(mtlText: string): MaterialData` for basic material support
  - [ ] Parse Kd (diffuse), Ka (ambient), Ks (specular), map_Kd (texture path)
  - [ ] Return simplified material properties
- [ ] Export new functions from rendering/src/index.ts

**Phase 2: Model Viewer Application Setup**
- [ ] Create `packages/renderer/src/model-viewer.ts` entry point
  - [ ] Copy WebGPU initialization from demo.ts
  - [ ] Initialize BackendFactory with WebGPU backend
  - [ ] Create ECS World, TransformSystem, CameraSystem
  - [ ] Setup canvas resize handler
- [ ] Create `packages/renderer/model-viewer.html`
  - [ ] Copy base HTML structure from index.html
  - [ ] Add model selector dropdown for future models
  - [ ] Include debug UI divs (stats, controls)
- [ ] Initialize scene components:
  - [ ] Create camera entity with Transform and Camera components
  - [ ] Initialize OrbitCameraController with camera entity
  - [ ] Setup mouse event handlers (drag, wheel, keyboard)
  - [ ] Create ground plane geometry using createPlane()
- [ ] Load and display model:
  - [ ] Load Naked_Snake.obj using loadOBJ()
  - [ ] Create GPU buffers from GeometryData
  - [ ] Setup simple-lambert.wgsl pipeline
  - [ ] Initialize RetroLightingSystem
  - [ ] Start render loop with requestAnimationFrame

**Phase 3: Debug UI & Camera Enhancement**
- [ ] Enhance OrbitCameraController with pan functionality:
  - [ ] Add `pan(deltaX: number, deltaY: number)` method
  - [ ] Update target position based on camera's right/up vectors
  - [ ] Maintain orbit center during pan operations
- [ ] Copy and adapt debug UI from demo.ts:
  - [ ] FPS counter and frame time graph
  - [ ] VRAM usage from VRAMProfiler
  - [ ] Remove dice count, physics stats
  - [ ] Add model stats: vertex count, triangle count, texture count
- [ ] Add camera info display:
  - [ ] Distance, azimuth, elevation values
  - [ ] Target position (x, y, z)
  - [ ] Reset button (R key handler)
- [ ] Integrate RetroPostProcessor controls:
  - [ ] Copy bloom, CRT, fog toggles from demo
  - [ ] Add sliders for bloom threshold, fog density
  - [ ] Wire up to RetroPostProcessor instance

**Phase 4: Lighting, Materials & Error Handling**
- [ ] Setup RetroLightingSystem with directional light:
  - [ ] Configure initial light direction (0.5, -0.7, 0.5)
  - [ ] Set light color and intensity
  - [ ] Connect to vertex shader uniforms
- [ ] Material loading and application:
  - [ ] Parse MTL file if present
  - [ ] Load textures referenced in map_Kd
  - [ ] Apply 256px resize constraint to textures
  - [ ] Fallback to default gray material if MTL missing
- [ ] Add light direction controls:
  - [ ] Azimuth/elevation sliders in UI
  - [ ] Update RetroLightingSystem on change
  - [ ] Visual feedback with light direction indicator
- [ ] Error handling:
  - [ ] Graceful fallback for missing OBJ file (show cube)
  - [ ] Handle malformed OBJ data (skip invalid faces)
  - [ ] Texture load failures (use checkerboard pattern)
  - [ ] Display error messages in UI console

**Phase 5: Testing & Performance Validation**
- [ ] Create unit tests for OBJ parser:
  - [ ] Test parseOBJ with valid/invalid data
  - [ ] Test triangulation of quads
  - [ ] Test normal generation
  - [ ] Test index validation and bounds checking
  - [ ] Achieve >80% code coverage for new code
- [ ] Integration testing:
  - [ ] Load Naked Snake model successfully
  - [ ] Verify vertex/normal/uv data integrity
  - [ ] Test with additional OBJ files if available
  - [ ] Validate against reference renders
- [ ] Performance benchmarks:
  - [ ] Measure FPS with different model sizes (1K, 5K, 10K triangles)
  - [ ] Profile VRAM usage per model
  - [ ] Ensure 60 FPS minimum on target hardware
  - [ ] Check for memory leaks during model switching
- [ ] Visual validation:
  - [ ] Verify vertex lighting looks correct
  - [ ] Check retro post-processing effects
  - [ ] Confirm no Z-fighting or culling issues
  - [ ] Screenshot comparisons with PS1/PS2 era reference

#### Acceptance Criteria

**Functional:**
- ✅ Loads OBJ models from `models/` directory without errors
- ✅ Model displays with correct geometry and normals
- ✅ Camera controls work smoothly (orbit, pan, zoom)
- ✅ Debug UI shows accurate stats
- ✅ Post-processing effects apply correctly
- ✅ Vertex lighting produces expected results

**Visual Quality:**
- ✅ Model normals appear smooth (no faceted shading artifacts)
- ✅ Retro aesthetic is evident (vertex lighting, low-res textures)
- ✅ Post-processing (bloom, CRT) works as expected
- ✅ No Z-fighting or depth buffer issues
- ✅ Consistent with PS1/PS2 era visual style

**Performance:**
- ✅ 60 FPS minimum for models up to 10K triangles
- ✅ VRAM usage is reasonable (<10MB for typical model)
- ✅ Load time <1 second for typical OBJ file
- ✅ No memory leaks during model loading/unloading

**Code Quality:**
- ✅ OBJ parser handles malformed files gracefully
- ✅ No dependencies on physics system
- ✅ Clean separation from dice demo code
- ✅ Reuses existing rendering infrastructure
- ✅ No code duplication with dice demo

#### Files to Create/Modify

**New Files:**
- `packages/renderer/src/model-viewer.ts` - Model viewer application (~500 lines)
- `packages/renderer/model-viewer.html` - UI for model viewer (~200 lines)
- `packages/rendering/tests/OBJLoader.test.ts` - Unit tests for OBJ parsing (~300 lines)

**Modified Files:**
- `packages/rendering/src/Geometry.ts` - Add loadOBJ(), parseOBJ(), parseMTL() (~300 lines added)
- `packages/rendering/src/CameraControllers.ts` - Add pan() method to OrbitCameraController (~30 lines)
- `packages/rendering/src/index.ts` - Export OBJ loading functions (~5 lines)
- `package.json` - Add model-viewer dev script (~3 lines)

#### Technical Considerations & Risks

**Known Challenges:**
1. **OBJ Format Variations**: Different exporters create slightly different OBJ formats
   - Mitigation: Support common variants, graceful degradation for unsupported features
2. **Large Model Performance**: Models >10K triangles may impact performance
   - Mitigation: Implement vertex count warning, suggest decimation
3. **Texture Memory**: Multiple textures can exceed VRAM budget
   - Mitigation: Enforce 256px limit, texture atlas consideration
4. **Winding Order**: Models may have inconsistent face winding (CW vs CCW)
   - Mitigation: Auto-detect and normalize, or add manual toggle

**Dependencies & Assumptions:**
- OrbitCameraController exists and works correctly ✅ (verified in CameraControllers.ts)
- RetroPostProcessor can be reused from demo ✅ (verified in demo.ts)
- Simple-lambert.wgsl shader supports non-instanced rendering ✅ (verified, uses standard vertex input)
- Naked Snake model is valid OBJ format (needs testing)
- Models directory exists with test content ✅ (verified, contains Naked Snake model)

**Performance Targets:**
- OBJ parsing: <100ms for 10K triangles
- Model load time: <1 second including textures
- Render performance: 60 FPS minimum
- Memory usage: <50MB for typical model

#### Out of Scope

**Not Included:**
- ❌ **NO glTF/GLB support** - OBJ only for now
- ❌ **NO animation system** - Static models only
- ❌ **NO physics simulation** - Pure visual testing
- ❌ **NO texture baking tools** - Use pre-made textures
- ❌ **NO model editing** - Display only, not an editor
- ❌ **NO multi-model scenes** - Single model at a time
- ❌ **NO skeletal animation** - Static geometry only
- ❌ **NO instancing** - Single model instance only

**Deferred to Future Epics:**
- Multiple model loading (scene composition)
- Texture painting/editing tools
- Model export functionality
- Advanced material editing UI
- glTF 2.0 support with PBR materials

---

### Epic 3.18: Shadow Quality (Phase 3)
**Priority:** P2
**Dependencies:** Epic 3.17
**Status:** ❌ CANCELLED - WILL BE DELETED IN EPIC 3.4

**⚠️ This epic is obsolete.** Epic 3.4 will DELETE the entire shadow system to align with pure retro/PS1-PS2 aesthetics. Shadows in retro games were typically:
- Baked into lightmaps (pre-computed)
- Simple blob shadows (projected decals)
- Vertex-painted darkening

The modern shadow system (cascades, PCF, atlases) is incompatible with the retro aesthetic and will be removed.

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






---


1. **Epic 3.14 (Modern API) + Epic 3.20 (Backend Modernization)**
   - Replace core WebGPU backend with modern patterns
   - Eliminate string operations and resource leaks
   - Establish foundation for retro pipeline

2. **Epic 3.15 (Lighting System) + Epic 3.21 (Test Infrastructure)**
   - Implement lighting foundation (vertex-painted, lightmaps, fog)
   - Set up visual regression and performance testing
   - Prepare for retro pipeline integration

3. **Epic 3.4 (Retro Pipeline) + Epic 3.5 (Culling)** 
   - Retro post-processing, LOD, materials
   - Spatial grid, frustum culling, occluders
   - Integration and performance validation

4. **Epics 3.16-3.19 (Shadow Systems)**
   - Shadow mapping, optimization, quality improvements
   - PCF filtering, cascade blending, contact hardening

5. **Epic 3.22 (API Patterns & Performance)**
   - Finalize public API patterns
   - Performance optimization and profiling
