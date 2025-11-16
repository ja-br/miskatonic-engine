# INIT-003: Rendering & Graphics Pipeline

## Overview

Modern WebGPU-based rendering pipeline supporting retro/lo-fi aesthetics with modern performance. Targets PlayStation 2 era visual style with contemporary optimization techniques.

**Philosophy:** Authentically retro visuals, no modern AAA bloat.

---

## Active Epics

### Epic 3.4: Retro Rendering Pipeline (COMPLETE OVERHAUL)
**Priority:** P1
**Dependencies:** Epic 3.15, Epic 3.14
**Status:** 📋 Planned
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
- [ ] Simple additive bloom (low-res 1/4 buffer → bilinear upsample)
- [ ] Basic tone mapping (**gamma correction only**, no Reinhard/ACES/Filmic)
- [ ] Single-LUT color grading (256x16 texture lookup, subtle grading)
- [ ] Ordered dither patterns for color/alpha blending (Bayer 4x4 or 8x8 matrix)
- [ ] Noise/grain overlay for film aesthetic
- [ ] **Optional CRT shader** (scanlines, phosphor glow, curvature)
- [ ] Render pass execution (3 passes: bloom extract, blur, composite)

#### Lighting (Retro - Vertex Only)
- [ ] **Vertex lighting system** (Lambert diffuse computed per-vertex, NOT per-pixel)
- [ ] Vertex-painted ambient colors (baked per-vertex ambient term)
- [ ] Simple lightmaps (baked ambient occlusion/GI, 128x128 max resolution)
- [ ] Distance fog (linear or exponential falloff)
- [ ] Contrast fog (depth-based desaturation for atmospheric depth)
- [ ] Unlit emissive materials for neon signs/UI (skip lighting entirely)
- [ ] Specular highlights via cube map lookup (simple reflection, not SSR)

#### LOD System (Retro)
- [ ] Dithered crossfade LOD transitions (alpha-to-coverage or stipple patterns)
- [ ] Distance-based switching (2-3 LOD levels max)
- [ ] No smooth mesh morphing, no temporal blending

#### Shader Variants (Required)
- [ ] **vertex-color.wgsl** - Per-vertex color shading only (no textures)
- [ ] **unlit.wgsl** - Unlit/emissive materials (bypass lighting)
- [ ] **simple-lambert.wgsl** - Basic Lambert diffuse (vertex lighting)
- [ ] **emissive.wgsl** - Self-illuminated materials (glowing objects)
- [ ] **specular-cubemap.wgsl** - Cube map specular reflections
- [ ] **bloom-extract.wgsl** - Post-process: extract bright pixels
- [ ] **bloom-blur.wgsl** - Post-process: Gaussian blur
- [ ] **composite.wgsl** - Post-process: final composite with dither/LUT/grain
- [ ] **crt-effect.wgsl** - Optional CRT shader (scanlines, curvature)

#### Textures & Materials
- [ ] 256px maximum texture resolution constraint (enforced)
- [ ] Point filtering (nearest-neighbor) or bilinear only
- [ ] Texture dithering for smooth gradients (avoid color banding)
- [ ] Separate shader variants per material type (vertex-color, unlit, lambert, emissive)

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
- [ ] **REMOVE** shadow system files (shadows/ directory - all 7 files)
- [ ] **REMOVE** PBR/modern lighting features from existing shaders
- [ ] **REMOVE** any AA/TAA/temporal effect code
- [ ] **REMOVE** deprecated Camera.ts and legacy exports
- [ ] **UPDATE** index.ts to remove deleted exports

**Phase 2 Tasks (Retro Foundation):**
- [ ] Implement 9 new retro shaders (vertex-color, unlit, lambert, emissive, etc.)
- [ ] Create vertex lighting system (replace per-pixel lighting)
- [ ] Add vertex color attributes to vertex layouts
- [ ] Implement texture size constraint enforcement (256px max)

**Phase 3 Tasks (Post-Processing):**
- [ ] Implement 3-pass bloom pipeline (extract, blur, composite)
- [ ] Add gamma-only tonemapping
- [ ] Add ordered dithering (Bayer patterns)
- [ ] Add color LUT support
- [ ] Optional CRT shader

**Phase 4 Tasks (Integration):**
- [ ] LOD system with dithered crossfade
- [ ] Cube map specular system
- [ ] Fog system (distance + contrast)
- [ ] Demo integration showing retro mode
- [ ] Performance validation (60 FPS target)
- [ ] Update all examples to use new retro API

**Acceptance Criteria:**
- **Vertex lighting only** - No per-pixel lighting calculations
- **All forbidden features absent** - No PBR, SSR, SSAO, AA, temporal effects
- **Retro aesthetic matches PS1/PS2-era references** - Visual comparison tests pass
- **All shader variants implemented** - vertex-color, unlit, lambert, emissive, cubemap
- **60 FPS maintained** - Performance budget met (16.67ms frame time)
- **Dithering eliminates banding** - Smooth gradients use ordered dither
- **Tonemapping is gamma only** - No complex tone curves (Reinhard/ACES forbidden)
- **Bloom is additive** - Simple additive blend, no halos or complex filtering
- **Texture limit enforced** - 256px maximum resolution constraint active

---

### Epic 3.5: Lightweight Object Culling
**Priority:** P1
**Dependencies:** Epic 3.1-3.3
**Status:** 📋 Planned
**Philosophy:** Retro aesthetics with modern lightweight performance
**Scope:** Object culling for mesh geometry (Note: Light culling already exists separately)

#### Phase 1: Spatial Structure (Choose One)
- [ ] **Option A: Uniform 3D Grid** - Best for evenly distributed objects
  - Integer bit-packing for cell keys (8 bits per axis, 256³ cells max)
  - Efficient update algorithm with Set-based O(1) lookups
  - Sphere and AABB query support
- [ ] **Option B: Loose Octree** - Best for clustered/hierarchical scenes
  - Adaptive subdivision based on object density
  - Loose bounds (objects can belong to multiple cells)
  - Efficient spatial queries for frustum culling

#### Phase 2: ObjectCuller
- [ ] Two-phase frustum culling (coarse spatial query + fine frustum test)
- [ ] Proper frustum AABB calculation (Cramer's rule for plane intersections)
- [ ] Squared distance sorting (no Math.sqrt() overhead)
- [ ] Configurable sort order (near-to-far, far-to-near, none)
- [ ] Stats fast path (zero overhead when disabled)

#### Phase 3: OccluderVolume (OPTIONAL)
- [ ] Manual box occluders for large buildings/terrain (artist-placed)
- [ ] Conservative AABB containment test (object fully inside = occluded)
- [ ] Multi-occluder support (hidden by ANY occluder)
- [ ] **Note:** Optional feature - evaluate performance benefit vs manual setup cost

#### Phase 4: SoftwareOcclusionTest (OPTIONAL)
- [ ] Lightweight CPU depth buffer (64x64 low-resolution for large occluders)
- [ ] Conservative rasterization for huge objects only (buildings, terrain)
- [ ] Depth-based occlusion testing (object behind occluder = hidden)
- [ ] **Note:** Optional feature - high CPU cost, only use for massive objects

#### Phase 5: Integration & Public API
- [ ] Comprehensive end-to-end testing
- [ ] Performance benchmarks validation
- [ ] Public API export via culling/index.ts

#### Not Implemented (Retro-Inappropriate)
- ❌ GPU-based occlusion queries (too modern)
- ❌ Complex BVH structures (overkill for retro scenes)
- ❌ Visibility buffer optimization (modern deferred technique)

**Target Metrics:**
- Performance: All budgets met (<2ms culling, <1ms occluders, <10ms software occlusion)
- Code Quality: Resolve all code-critic issues

**Acceptance Criteria:**
- **Frustum culling eliminates off-screen mesh objects** (not lights - separate system)
- **Spatial structure reduces culling** from O(n) to O(log n) average case
- **Occluder volumes hide geometry** behind large objects (if implemented)
- **Software occlusion test works** for huge objects only (if implemented)
- **Performance: 1000-2000 objects @ 60 FPS** with <2ms culling budget
- **No false negatives** - All visible objects are rendered
- **No false positives** - No visible pop-in or objects disappearing incorrectly
- **No GPU queries, no complex BVH** - Lightweight CPU-based culling only

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
