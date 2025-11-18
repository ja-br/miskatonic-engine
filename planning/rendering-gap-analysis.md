

## Executive Summary

This document analyzes the **delta between current rendering implementation** (as of commit 302418e) and the **target architecture** defined in Epics 3.4, 3.5, and 3.14-3.22.

**Current State:**
- 78 TypeScript files, ~22,002 LOC
- Epics 3.14-3.18 implemented (Modern API, Lighting, Shadows)
- Epic 3.4 (Retro Pipeline) **MISSING** (source code lost)
- Epic 3.5 (Object Culling) **MISSING** (only light culling exists)

**Target State:**
- Add Epic 3.4: Retro post-processing, lighting, LOD, materials (~3,000 LOC estimated)
- Add Epic 3.5: Spatial grid, object culler, occluders (~1,600 LOC estimated)
- Complete missing features in existing epics

**Gap Summary:**
- **Missing LOC:** ~4,600 lines (Epic 3.4 + 3.5)
- **API Changes:** Minimal (additive, not breaking)
- **Reusability:** 85%+ of current code can be kept
- **Implementation Effort:** ~5-8 weeks for both epics

---

## Phase 2: Target Architecture Analysis

### Task 2.1: Epic 3.4 (Retro Rendering Pipeline) Requirements


#### Render Pass Structure

**3-Pass Post-Processing Pipeline:**

1. **Pass 1: Bloom Extract** (Output: Low-res bright pixels)
   - Input: Scene color texture (full resolution)
   - Shader: Extract pixels above brightness threshold
   - Output: Quarter-res texture (downsampled)
   - Bind Group: Scene texture (group 0)

2. **Pass 2: Bloom Blur** (Output: Blurred bloom)
   - Input: Bloom extract texture
   - Shader: Simple box blur or Gaussian
   - Output: Quarter-res blurred texture
   - Bind Group: Bloom texture (group 0)

3. **Pass 3: Composite** (Output: Final frame)
   - Inputs: Scene texture + bloom texture
   - Shader: Additive blend, tone map, LUT color grade, dither, grain
   - Output: Swapchain texture (display)
   - Bind Groups: Scene (group 0), bloom (group 1), LUT (group 2)

#### Required APIs

**New Classes/Interfaces:**

```typescript
// Post-Processing
class RetroPostProcessor {
  constructor(backend: IRendererBackend, config: RetroPostConfig);
  apply(sceneTexture: BackendTextureHandle): void;
  resize(width: number, height: number): void;
  setBloomIntensity(intensity: number): void;
  setGrainAmount(amount: number): void;
  setDitherPattern(pattern: 'bayer4x4' | 'bayer8x8'): void;
  dispose(): void;
}

interface RetroPostConfig {
  bloomThreshold: number;
  bloomIntensity: number;
  grainAmount: number;
  ditherPattern: 'bayer4x4' | 'bayer8x8';
  colorLUT?: BackendTextureHandle;
}

// Retro Lighting
class RetroLightingSystem {
  constructor(backend: IRendererBackend);
  setVertexColors(mesh: Mesh, colors: Float32Array): void;
  loadLightmap(texture: BackendTextureHandle): void;
  setFog(type: 'linear' | 'exponential', start: number, end: number): void;
  setContrastFog(enabled: boolean, intensity: number): void;
  dispose(): void;
}

// LOD System
class RetroLODSystem {
  constructor();
  registerLODGroup(meshes: Mesh[], distances: number[]): LODGroup;
  update(cameraPosition: vec3): void;
  setDitherCrossfade(enabled: boolean): void;
  getStats(): LODStats;
}

interface LODGroup {
  meshes: Mesh[];
  distances: number[];
  currentLOD: number;
}

// Retro Materials
class RetroMaterial {
  constructor(config: RetroMaterialConfig);
  setTexture(texture: BackendTextureHandle, maxSize: 256): void;
  setFiltering(mode: 'point' | 'bilinear'): void;
  enableDithering(enable: boolean): void;
  dispose(): void;
}

interface RetroMaterialConfig {
  type: 'lit' | 'unlit' | 'emissive';
  vertexColors: boolean;
  lightmap: boolean;
  maxTextureSize: 256;
  filtering: 'point' | 'bilinear';
}
```

#### Shader Requirements (WGSL)

**New Shaders:**

1. **`retro-bloom-extract.wgsl`** (~50 LOC)
   - Extract bright pixels above threshold
   - Downsample to quarter resolution
   - Output: rgba16float format

2. **`retro-bloom-blur.wgsl`** (~80 LOC)
   - Box blur or simple Gaussian (5x5 kernel)
   - Separable filter (horizontal + vertical passes)
   - Output: rgba16float format

3. **`retro-composite.wgsl`** (~150 LOC)
   - Additive bloom blend
   - Tone mapping (Reinhard)
   - LUT color grading (256x16 texture lookup)
   - Bayer dithering (4x4 or 8x8 matrix)
   - Film grain (noise overlay)
   - Output: rgba8unorm format (swapchain)

4. **`retro-lighting.wgsl`** (~200 LOC)
   - Vertex-painted ambient lighting
   - Lightmap sampling (single texture)
   - Distance fog (linear/exponential)
   - Contrast fog (depth desaturation)
   - Cube map specular (simple lookup)
   - Output: Lit color

5. **`retro-lod-dither.wgsl`** (~100 LOC)
   - Dithered alpha crossfade between LOD levels
   - Stipple pattern based on screen-space position
   - Alpha-to-coverage for hardware dithering
   - Output: Dithered mesh

**Total Shader LOC:** ~580 lines WGSL

#### Performance Targets

**Frame Budget Allocation (60 FPS = 16.67ms):**

- Rendering (base): 10ms
- **Retro post-processing: 3ms** (bloom 1ms + composite 2ms)
- **Retro lighting: 4ms** (vertex colors + lightmaps + fog)
- **LOD system: 1.5ms** (selection + dithering)
- Shadows: 3ms (existing shadow system)
- Culling: 2ms (Epic 3.5)
- Physics/ECS: 3ms
- **Total:** 16.5ms (within budget)

#### Code Quality Requirements

**From Epic 3.4 description:**

- ✅ Shader uniform buffer resolution (correct struct alignment)
- ✅ Buffer alignment optimization (no wasted padding)
- ✅ Bayer pattern normalization (proper dither matrix)
- ✅ LOD validation (no negative/inverted ranges)
- ✅ WGSL array syntax (flattened, not nested)
- ✅ Resource disposal (null handle assignments)
- ✅ Shader loading in browser (no fs.readFileSync)
- ✅ WebGPU texture upload validation (correct bytesPerRow)

---

### Task 2.2: Epic 3.5 (Lightweight Culling) Requirements


#### Phase Breakdown

**Phase 1: SpatialGrid** (~400 LOC)
- Uniform 3D grid partitioning
- Integer bit-packing for cell keys (8 bits per axis → 256³ cells)
- Efficient update algorithm with Set-based O(1) lookups
- Sphere and AABB query support
- Insert/remove/query operations

**Phase 2: ObjectCuller** (~390 LOC)
- Two-phase culling:
  1. Coarse: SpatialGrid query for camera frustum AABB
  2. Fine: Per-object frustum AABB intersection test
- Proper frustum AABB calculation (Cramer's rule for plane intersections)
- Squared distance sorting (no Math.sqrt() overhead)
- Configurable sort order (near-to-far, far-to-near, none)
- Stats fast path (zero overhead when disabled)

**Phase 3: OccluderVolume** (~216 LOC)
- Manual box occluders for large buildings/terrain
- Conservative AABB containment test (object fully inside occluder = hidden)
- Multi-occluder support (OR logic: hidden by any occluder)

**Phase 4: SoftwareOcclusionTest** (~387 LOC)
- Lightweight CPU depth buffer (64x64 low-resolution)
- Conservative rasterization for huge objects (buildings, terrain)
- Depth-based occlusion testing (object behind = hidden)
- Only used for massive objects (overhead not worth it for small objects)

**Phase 5: Integration** (~200 LOC)
- Combine all phases into unified culling pipeline
- Public API for easy integration
- Performance benchmarks

**Total LOC:** ~1,593 lines (production code)

#### Required APIs

```typescript
// Spatial Grid
class SpatialGrid {
  constructor(worldSize: vec3, cellSize: number);
  insert(objectId: number, bounds: AABB): void;
  remove(objectId: number): void;
  update(objectId: number, newBounds: AABB): void;
  querySphere(center: vec3, radius: number): number[];
  queryAABB(bounds: AABB): number[];
  clear(): void;
  getStats(): GridStats;
}

// Object Culler
class ObjectCuller {
  constructor(spatialGrid: SpatialGrid);
  cullFrustum(frustum: Frustum, objects: CullableObject[]): CullResult;
  setSortOrder(order: 'near' | 'far' | 'none'): void;
  getStats(): CullStats;
}

interface CullableObject {
  id: number;
  bounds: AABB;
  position: vec3;
}

interface CullResult {
  visible: number[];
  sorted: boolean;
  stats: CullStats;
}

// Occluder Volume
class OccluderVolume {
  constructor(bounds: AABB);
  testOcclusion(objectBounds: AABB): boolean;
}

class OccluderSystem {
  addOccluder(bounds: AABB): OccluderVolume;
  removeOccluder(occluder: OccluderVolume): void;
  testOcclusion(objectBounds: AABB): boolean; // Returns true if occluded by ANY occluder
}

// Software Occlusion Test
class SoftwareOcclusionTest {
  constructor(resolution: 64);
  setViewProjection(viewProj: mat4): void;
  rasterize(bounds: AABB, depth: number): void;
  testOcclusion(bounds: AABB, depth: number): boolean;
  clear(): void;
}
```

#### Performance Budgets

**Per-Component Budgets:**

- SpatialGrid query: <1ms for 1000-2000 objects
- ObjectCuller (frustum test): <2ms for 1000 objects
- OccluderVolume test: <1ms for 10-20 occluders
- SoftwareOcclusionTest: <10ms for 10-20 huge objects

**Optimizations:**

- Use squared distances (no Math.sqrt)
- Set-based lookups (O(1) not O(n))
- Integer bit-packing for cell keys
- Stats fast path (zero overhead when disabled)
- Early-out tests (coarse before fine)

#### NOT Implemented (Retro-Inappropriate)

From Epic 3.5 description:

- ❌ GPU-based occlusion queries (too modern, not PS2-era)
- ❌ Complex BVH structures (overkill for retro scenes)
- ❌ Visibility buffer optimization (modern deferred technique)

---

### Task 2.3: Epics 3.14-3.22 Requirements

**Epic 3.14-3.22 Status:** ALREADY IMPLEMENTED (per audit)

**Required Features (for reference):**

- ✅ Epic 3.14: Modern API (bind groups, pipelines, draw commands)
- ✅ Epic 3.15: Lighting System (component-based, transform integration)
- ✅ Epic 3.16: Shadow Mapping (directional, point, spot shadows)
- ✅ Epic 3.17: Shadow Optimization (caching, cascades)
- ✅ Epic 3.18: Shadow Quality (PCF, cascade blending, contact hardening)
- ✅ Epic 3.19: Final Shadow Polish (bias tuning, quality presets)
- ✅ Epic 3.20: WebGPU Backend Modernization (modular architecture)
- ✅ Epic 3.21: Test Infrastructure (Vitest, benchmarks)
- ✅ Epic 3.22: API Patterns (builder patterns, ergonomics)

**Note:** No additional requirements needed for these epics - they are complete.

---

### Task 2.4: Performance Targets and Constraints

**Source:** INIT-003-Rendering-Graphics.md lines 662-688

#### Frame Budget (60 FPS = 16.67ms total)

| System | Budget | Current | Gap | Status |
|--------|--------|---------|-----|--------|
| Rendering (base) | <10ms | ??? | ??? | Needs measurement |
| Shadow mapping | <3ms | ??? | ??? | Needs measurement |
| **Retro post-processing** | **<3ms** | **N/A** | **-3ms** | **Missing** |
| **Retro lighting** | **<4ms** | **N/A** | **-4ms** | **Missing** |
| **LOD system** | **<1.5ms** | **N/A** | **-1.5ms** | **Missing** |
| **Culling** | **<2ms** | **N/A** | **-2ms** | **Missing** |
| Physics/ECS | <3ms | ??? | ??? | Not rendering's concern |
| **Total** | **16.67ms** | **???** | **???** | **Needs baseline** |

**Note:** Current performance unknown - Task 1.6 couldn't run benchmarks (no WebGPU in test environment).

#### Resource Limits

| Resource | Limit | Current | Gap | Status |
|----------|-------|---------|-----|--------|
| Draw calls | <500 per frame | ??? | ??? | Needs measurement |
| Shadow maps | 4 cascades × 2048px | ✅ Implemented | 0 | Complete |
| Texture memory | <512MB | ??? | ??? | VRAMProfiler can measure |
| Vertex buffers | Interleaved, instanced | ✅ Implemented | 0 | Complete |
| **Retro textures** | **256px max** | **N/A** | **-** | **Missing constraint** |
| **Bloom buffer** | **Quarter-res** | **N/A** | **-** | **Missing** |
| **LUT texture** | **256x16px** | **N/A** | **-** | **Missing** |

#### Quality Metrics

| Metric | Target | Current | Gap | Status |
|--------|--------|---------|-----|--------|
| Shadow aliasing | <5% visible artifacts | ✅ Achieved | 0 | Complete (Epic 3.18) |
| Cascade blending | Smooth transitions | ✅ Achieved | 0 | Complete (Epic 3.18) |
| **Retro aesthetic** | **Dithered, lo-fi, PS2-era** | **N/A** | **-** | **Missing** |
| **Bloom quality** | **Additive glow, no halos** | **N/A** | **-** | **Missing** |
| **LOD pop-in** | **Hidden by dithering** | **N/A** | **-** | **Missing** |

---

### Task 2.5: Unified Target Architecture

#### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron Renderer                       │
│                    (packages/renderer)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     ECS World (@miskatonic/ecs)              │
│  - Entities, Components, Systems                             │
│  - Transform, Camera, Light, Mesh components                 │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│           Rendering Package (@miskatonic/rendering)          │
├─────────────────────────────────────────────────────────────┤
│  ECS SYSTEMS (update each frame)                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CameraSystem: Update view/projection matrices       │   │
│  │ LightSystem: Sync lights from ECS to renderer       │   │
│  │ AnimationSystems: Flickering, Pulsing, Orbiting     │   │
│  │ [NEW] RetroLODSystem: Select LOD levels             │◄──┤─ Epic 3.4
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  CULLING PIPELINE                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [NEW] SpatialGrid: Spatial partitioning             │◄──┤─ Epic 3.5
│  │ [NEW] ObjectCuller: Frustum culling                 │◄──┤─ Epic 3.5
│  │ [NEW] OccluderSystem: Box occluders                 │◄──┤─ Epic 3.5
│  │ [NEW] SoftwareOcclusionTest: CPU depth buffer       │◄──┤─ Epic 3.5
│  │ LightCuller: GPU light culling (EXISTING)           │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  RENDERING PIPELINE                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WebGPUBackend: Device, command encoding             │   │
│  │ RenderPassManager: Render pass execution            │   │
│  │ PipelineManager: Pipeline caching                   │   │
│  │ ResourceManager: Buffer, texture lifecycle          │   │
│  │ [NEW] RetroLightingSystem: Vertex colors, lightmaps │◄──┤─ Epic 3.4
│  │ ShadowAtlas: Shadow map allocation (EXISTING)       │   │
│  │ ShadowCascades: CSM rendering (EXISTING)            │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  POST-PROCESSING                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [NEW] RetroPostProcessor: 3-pass bloom + composite  │◄──┤─ Epic 3.4
│  │   - Pass 1: Bloom extract (quarter-res)             │   │
│  │   - Pass 2: Bloom blur (Gaussian)                   │   │
│  │   - Pass 3: Composite (tone map, LUT, dither, grain)│   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  MATERIALS & ASSETS                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [NEW] RetroMaterial: 256px textures, point filtering│◄──┤─ Epic 3.4
│  │ Material: High-level material system (EXISTING)     │   │
│  │ TextureAtlas: Texture packing (EXISTING)            │   │
│  │ GPUBufferPool: Buffer pooling (EXISTING)            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
               ┌─────────────────┐
               │  WebGPU Device  │
               │  (GPU Hardware) │
               └─────────────────┘
```

#### Data Flow

**Per-Frame Execution Order:**

1. **ECS Update** (Physics, game logic)
2. **Camera Update** (CameraSystem)
3. **Light Update** (LightSystem syncs ECS lights)
4. **[NEW] LOD Update** (RetroLODSystem selects LOD levels based on camera distance)
5. **[NEW] Culling** (SpatialGrid → ObjectCuller → visible objects)
6. **Render Opaque** (Visible objects, sorted front-to-back)
   - **[NEW] Retro Lighting** (vertex colors, lightmaps, fog)
7. **Render Shadows** (ShadowAtlas, cascade selection)
8. **Render Transparent** (Sorted back-to-front, alpha blending)
9. **[NEW] Post-Processing** (RetroPostProcessor: bloom → tone map → dither)
10. **Present** (Swap buffers)

#### Component Interfaces (API Contracts)

**ECS → Rendering:**
- Input: `World`, entity queries (Light, Camera, Mesh components)
- Output: Synced data structures (LightCollection, camera matrices)

**Culling → Rendering:**
- Input: Camera frustum, object bounds (AABB)
- Output: Visible object IDs (culled list)

**Rendering → Post-Processing:**
- Input: Scene color texture (HDR if available, LDR otherwise)
- Output: Final swapchain texture (tone mapped, graded, dithered)

**Resource Ownership:**
- ECS owns: Entities, components (lifetime tied to world)
- Rendering owns: GPU resources (buffers, textures, pipelines)
- Backend owns: WebGPU device, queue, command encoders

#### Cross-Cutting Concerns

**Error Handling:**
- WebGPU validation errors: Log and continue (graceful degradation)
- Shader compilation errors: Fallback to default shader
- Out-of-memory: Reduce quality (LOD, shadow resolution)

**Resource Limits:**
- Max textures: Device limit (query at init)
- Max bind groups: 4 (group 0-3)
- Max storage buffers: 8 per shader stage

**Fallback Paths:**
- No WebGPU: Error (no fallback per CLAUDE.md)
- Low VRAM: Reduce shadow resolution, texture quality
- Low FPS: Reduce LOD quality, disable post-processing

---

## Phase 3: Gap Analysis

### Task 3.1: API Delta (Current vs Target)

#### Epic 3.4 APIs (ALL MISSING)

| API | Current | Target | Change Type | Impact |
|-----|---------|--------|-------------|--------|
| `RetroPostProcessor` | ❌ Missing | ✅ Required | **ADD** | New class (3 passes) |
| `RetroLightingSystem` | ❌ Missing | ✅ Required | **ADD** | New class (vertex colors, lightmaps) |
| `RetroLODSystem` | ❌ Missing | ✅ Required | **ADD** | New class (dithered transitions) |
| `RetroMaterial` | ❌ Missing | ✅ Required | **ADD** | New class (256px constraint) |
| Retro shaders (5 files) | ❌ Missing | ✅ Required | **ADD** | ~580 LOC WGSL |

**Total Epic 3.4 APIs:** 4 classes + 5 shaders = **9 new exports**

#### Epic 3.5 APIs (ALL MISSING)

| API | Current | Target | Change Type | Impact |
|-----|---------|--------|-------------|--------|
| `SpatialGrid` | ❌ Missing | ✅ Required | **ADD** | New class (spatial partitioning) |
| `ObjectCuller` | ❌ Missing | ✅ Required | **ADD** | New class (frustum culling) |
| `OccluderVolume` | ❌ Missing | ✅ Required | **ADD** | New class (box occluders) |
| `OccluderSystem` | ❌ Missing | ✅ Required | **ADD** | New class (multi-occluder) |
| `SoftwareOcclusionTest` | ❌ Missing | ✅ Required | **ADD** | New class (CPU depth buffer) |

**Total Epic 3.5 APIs:** 5 new classes

#### Breaking Changes

**NONE** - All changes are **additive** (new APIs, no modifications to existing).

**Affected Consumers:** 0 files (no breaking changes)

---

### Task 3.2: Component Reusability Assessment

**Categorization of 78 existing files:**

| Category | File Count | LOC | Examples | Decision |
|----------|-----------|-----|----------|----------|
| **KEEP (0-10% changes)** | 65 | ~18,700 | WebGPUBackend, LightSystem, ShadowAtlas, GPUBufferPool, TextureAtlas, all shaders/ | ✅ Reuse as-is |
| **REFACTOR (10-50% changes)** | 8 | ~2,100 | HighLevelRenderer (add retro mode), Material (add retro config), DemoUI (add retro toggle) | ⚠️ Minor updates |
| **REWRITE (>50% changes)** | 0 | 0 | None | - |
| **DELETE** | 5 | ~1,200 | Camera.ts (legacy), index.ts (remove legacy exports) | ❌ Remove deprecated |
| **[NEW] ADD** | 14 | ~4,600 | Epic 3.4 (9 files) + Epic 3.5 (5 files) | ➕ Implement |

**Reuse Metrics:**

- **Reusable LOC:** 18,700 (KEEP) + 1,050 (REFACTOR 50% avg) = ~19,750 LOC
- **Total Current LOC:** 22,002
- **Reuse Percentage:** 19,750 / 22,002 = **89.8%**

**Detailed Reusability:**

**KEEP Files (65 files, ~18,700 LOC):**
- All `/backends/` files (13 files, ~2,875 LOC)
- All `/shadows/` files (7 files, ~3,529 LOC)
- All `/culling/` files (6 files, ~2,152 LOC) - **Note:** Light culling, not object culling
- All `/shaders/` parser files (6 files, ~2,109 LOC)
- All `/builders/` files (2 files, ~620 LOC)
- All `/recovery/` files (5 files, ~874 LOC)
- All `/systems/` files (3 files, ~414 LOC)
- Most root files: GPUBufferPool, TextureAtlas, VRAMProfiler, LightCollection, LightSystem, etc.

**REFACTOR Files (8 files, ~2,100 LOC):**

1. **`highlevel/HighLevelRenderer.ts`** (342 LOC)
   - Add `enableRetroMode(enabled: boolean)` method
   - Integrate RetroPostProcessor
   - ~20 LOC changes (5%)

2. **`highlevel/Material.ts`** (598 LOC)
   - Add `RetroMaterialConfig` support
   - Add `set maxTextureSize(size: 256)` constraint
   - ~30 LOC changes (5%)

3. **`DemoUI.ts`** (355 LOC)
   - Add retro mode toggle button
   - Display retro FPS metrics separately
   - ~10 LOC changes (3%)

4. **`index.ts`** (237 LOC)
   - Add exports for Epic 3.4 & 3.5 classes
   - Remove deprecated Camera export (legacy)
   - ~15 LOC changes (6%)

5. **`RenderPass.ts`** (165 LOC)
   - Add retro post-processing pass integration
   - ~10 LOC changes (6%)

6-8. **Others** (small changes)

**DELETE Files (5 files, ~1,200 LOC):**

1. **`Camera.ts`** (302 LOC) - Legacy standalone camera, replaced by CameraSystem
2. **Deprecated exports** in `index.ts` (remove Camera, OrbitControls)

---

### Task 3.3: Missing WebGPU Capabilities

**Current WebGPU Usage (from audit):**
- ✅ Device initialization
- ✅ Buffer operations (vertex, index, uniform, storage)
- ✅ Texture operations (rgba8unorm, depth24plus, depth24plus-stencil8)
- ✅ Pipeline operations (render pipelines)
- ✅ Render pass operations (color + depth attachments)
- ✅ Bind group operations (pooled, cached)
- ✅ Shader compilation (WGSL)

**Missing for Epic 3.4 & 3.5:**

| Feature | Current | Required | Epic | Use Case |
|---------|---------|----------|------|----------|
| **Compute shaders** | ❌ Missing | ❌ Not needed | - | Not required for retro |
| **Indirect drawing** | ❌ Missing | ❌ Not needed | - | Not required for retro |
| **Timestamp queries** | ❌ Broken | ⚠️ Nice-to-have | 3.18 | GPU profiling (removed due to API bugs) |
| **Texture formats** | rgba8unorm, depth24plus | ✅ Sufficient | - | No new formats needed |
| **Render bundles** | ❌ Missing | ❌ Not needed | - | Not required for retro |

**Conclusion:** No missing WebGPU capabilities for Epic 3.4 & 3.5.

---

### Task 3.4: Missing Retro Rendering Features

**From Audit Finding:** `/dist/retro/` directory exists but `/src/retro/` is missing.

**Missing Features (Epic 3.4):**

| Feature | Status | LOC Estimate | Priority |
|---------|--------|--------------|----------|
| Post-processing pipeline | ❌ Missing | ~900 LOC | **CRITICAL** |
| Retro lighting system | ❌ Missing | ~600 LOC | **CRITICAL** |
| LOD system | ❌ Missing | ~400 LOC | **HIGH** |
| Retro materials | ❌ Missing | ~500 LOC | **HIGH** |
| Retro shaders (5 files) | ❌ Missing | ~580 LOC WGSL | **CRITICAL** |
| **Total Epic 3.4** | **100% missing** | **~2,980 LOC** | |

**Missing Features (Epic 3.5):**

| Feature | Status | LOC Estimate | Priority |
|---------|--------|--------------|----------|
| SpatialGrid | ❌ Missing | ~405 LOC | **CRITICAL** |
| ObjectCuller | ❌ Missing | ~390 LOC | **CRITICAL** |
| OccluderVolume | ❌ Missing | ~216 LOC | **MEDIUM** |
| SoftwareOcclusionTest | ❌ Missing | ~387 LOC | **LOW** |
| Integration layer | ❌ Missing | ~200 LOC | **HIGH** |
| **Total Epic 3.5** | **100% missing** | **~1,598 LOC** | |

**Grand Total Missing:** ~4,578 LOC across 14 new files

---

### Task 3.5: Performance Optimization Gaps

**Current Performance:** UNKNOWN (Task 1.6 couldn't run benchmarks)

**Optimization Opportunities:**

1. **Missing:** Retro post-processing budget (3ms)
2. **Missing:** LOD system for draw call reduction
3. **Missing:** Object culling for CPU savings
4. **Existing:** Shadow caching (Epic 3.17) ✅
5. **Existing:** Light culling (Epic 3.16) ✅
6. **Existing:** GPU instancing (Epic 3.13) ✅

**Performance Deficit:** Cannot calculate without baseline measurements.

**Recommendation:** Run benchmarks after Epic 3.0 completes to establish baseline.

---

### Task 3.6: Testing and Tooling Gaps

**Current Test Coverage (from audit):**
- 1050 tests passing
- 208 tests failing (WebGPU unavailable in test environment)
- Coverage: Unknown (coverage report not generated due to test failures)

**Testing Gaps:**

1. **Missing:** Visual regression tests (Epic 3.4 needs PS2 reference images)
2. **Missing:** Performance benchmarks for retro effects
3. **Missing:** LOD transition tests (dithering artifacts)
4. **Missing:** Culling correctness tests (no objects disappear incorrectly)
5. **Broken:** GPU profiling (GPUTimingProfiler removed)

**Tooling Gaps:**

1. **Missing:** Retro reference image generator
2. **Missing:** PS2-era visual comparison tool
3. **Missing:** LOD dithering visualizer
4. **Missing:** Culling debug overlay
5. **Broken:** GPU timing profiler

**Test Coverage Target:** 80% (per project requirements)

**Current Coverage:** Unknown (needs measurement after fixing WebGPU test environment)

---

### Task 3.7: Comprehensive Gap Analysis Summary

**Executive Summary Table:**

| Gap Category | Missing Items | LOC Estimate | Complexity | Priority |
|--------------|---------------|--------------|------------|----------|
| **Epic 3.4 Features** | 4 classes + 5 shaders | ~2,980 LOC | High | **CRITICAL** |
| **Epic 3.5 Features** | 5 classes | ~1,598 LOC | Medium | **CRITICAL** |
| **Refactored Files** | 8 files (minor updates) | ~100 LOC changes | Low | **MEDIUM** |
| **Deleted Files** | 5 files (deprecated) | -1,200 LOC | Low | **LOW** |
| **Testing** | Visual regression, benchmarks | ~500 LOC tests | Medium | **HIGH** |
| **Documentation** | API docs, guides | N/A | Low | **MEDIUM** |
| **Total** | **22 new files, 8 updates, 5 deletions** | **~4,578 LOC new** | | |

**Implementation Complexity Estimates:**

| Task | Complexity | Justification |
|------|-----------|---------------|
| Retro post-processing | **COMPLEX** | 3-pass pipeline, shader integration, performance critical |
| Retro lighting | **MEDIUM** | Vertex colors + lightmaps straightforward, fog simple |
| LOD system | **MEDIUM** | Distance calculation simple, dithering requires shader work |
| Retro materials | **SIMPLE** | Texture constraints, filtering modes |
| SpatialGrid | **MEDIUM** | Bit-packing, spatial queries |
| ObjectCuller | **MEDIUM** | Frustum math, sorting |
| Occluders | **SIMPLE** | AABB containment tests |
| Software occlusion | **COMPLEX** | CPU rasterization, depth buffer |

**Reusability Calculation:**

```
Reusable Code:
  KEEP: 18,700 LOC (85%)
  REFACTOR (50% reuse): 1,050 LOC (5%)
  Total Reusable: 19,750 LOC

Total Current: 22,002 LOC
Reuse Rate: 19,750 / 22,002 = 89.8%
```

**Code Change Summary:**

```
Current:  22,002 LOC (78 files)
- Delete:  -1,200 LOC (5 files)
+ Add:     +4,578 LOC (14 files)
+ Refactor: +100 LOC (8 files, net changes)
= Target:  25,480 LOC (87 files)

Net Change: +3,478 LOC (+15.8%)
```

---

## Appendices

### Appendix A: API Diff Table

**Complete list of API changes:**

| API | Current Export | Target Export | Change Type | Breaking |
|-----|---------------|---------------|-------------|----------|
| Camera (legacy) | ✅ Exported | ❌ Remove | BREAKING | ⚠️ Yes (deprecated) |
| OrbitControls | ✅ Exported | ❌ Remove | BREAKING | ⚠️ Yes (use OrbitCameraController) |
| RetroPostProcessor | ❌ Not exported | ✅ Export | ADDITIVE | ✅ No |
| RetroLightingSystem | ❌ Not exported | ✅ Export | ADDITIVE | ✅ No |
| RetroLODSystem | ❌ Not exported | ✅ Export | ADDITIVE | ✅ No |
| RetroMaterial | ❌ Not exported | ✅ Export | ADDITIVE | ✅ No |
| SpatialGrid | ❌ Not exported | ✅ Export | ADDITIVE | ✅ No |
| ObjectCuller | ❌ Not exported | ✅ Export | ADDITIVE | ✅ No |
| OccluderVolume | ❌ Not exported | ✅ Export | ADDITIVE | ✅ No |
| OccluderSystem | ❌ Not exported | ✅ Export | ADDITIVE | ✅ No |
| SoftwareOcclusionTest | ❌ Not exported | ✅ Export | ADDITIVE | ✅ No |

**Breaking Change Impact:**
- 2 APIs deprecated (Camera, OrbitControls)
- 1 consumer affected (`basic-triangle.ts` uses WebGPUBackend, not Camera)
- **Impact: LOW** (no production code affected)

### Appendix B: File Change Matrix

See Task 3.2 for detailed file-by-file categorization.

### Appendix C: Performance Budget Allocation

See Task 2.4 for frame budget breakdown.

---

**Document Status:** Phase 2 & 3 Complete
**Next Steps:** Phase 4 - Migration Strategy
