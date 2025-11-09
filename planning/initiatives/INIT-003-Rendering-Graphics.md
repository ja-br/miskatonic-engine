## Initiative 3: Rendering & Graphics (INIT-003)
**Dependencies:** INIT-002
**Outcome:** Modern rendering pipeline with WebGL2/WebGPU

### Epic 3.1: Rendering Pipeline Foundation
**Priority:** P0
**Acceptance Criteria:**
- WebGL2 renderer implemented
- Basic draw call batching working
- Render command buffer system
- Multi-pass rendering support

#### User Stories:
1. **As a developer**, I want a flexible rendering pipeline
2. **As a developer**, I want automatic draw call batching
3. **As a developer**, I want multi-pass rendering support
4. **As a game**, I need 60 FPS on mid-range hardware

#### Tasks Breakdown:
- [x] Setup WebGL2 context and state management
- [x] Implement render command buffer
- [x] Create draw call batching system
- [x] Add multi-pass rendering support
- [x] Build shader management system
- [x] Implement texture and buffer management
- [x] Create render state caching
- [x] Add render statistics collection

#### Additional Work Completed:
- [x] Fixed CRITICAL event listener memory leak
- [x] Fixed CRITICAL shader detachment memory leak
- [x] Fixed CRITICAL vertex attribute setup (was completely missing)
- [x] Fixed CRITICAL O(n) buffer lookup performance issue
- [x] Added configurable index types (uint8, uint16, uint32)
- [x] Added bounded resource limits with LRU eviction
- [x] Redesigned DrawCommand API for type safety and performance
- [x] Created comprehensive README documentation
- [x] Implemented FramebufferManager for render-to-texture
- [x] Implemented RenderPass system with dependency resolution
- [x] Added multi-pass rendering with topological pass sorting

### Epic 3.2: WebGPU Implementation
**Status:** ✅ COMPLETE (January 2026)
**Priority:** P1
**Acceptance Criteria:**
- ✅ WebGPU renderer implemented
- ✅ Automatic fallback to WebGL2
- ✅ Compute shader support (WebGPU only)
- ✅ Backend abstraction layer

#### User Stories:
1. ✅ **As a developer**, I want next-gen WebGPU rendering
2. ✅ **As a developer**, I want compute shader support
3. ✅ **As a player**, I want automatic GPU feature detection
4. ✅ **As a game**, I need seamless fallback to WebGL2

#### Tasks Breakdown:
- [x] Create IRendererBackend abstraction interface
- [x] Implement WebGL2Backend (command-based rendering)
- [x] Implement WebGPUBackend with basic rendering
- [x] Add compute shader capability detection
- [x] Create BackendFactory with automatic capability detection
- [x] Implement seamless fallback logic (WebGPU → WebGL2)
- [x] Add backend capability querying
- [x] Export backend abstractions from main index

#### Implementation Details:
**Files Created:**
- `src/backends/IRendererBackend.ts` - Backend abstraction interface with opaque handles
- `src/backends/WebGL2Backend.ts` - WebGL2 implementation (1000+ lines)
- `src/backends/WebGPUBackend.ts` - WebGPU implementation with compute support
- `src/backends/BackendFactory.ts` - Automatic capability detection and fallback
- `src/backends/index.ts` - Public API exports

**Architecture:**
- Opaque resource handles (BackendShaderHandle, BackendBufferHandle, etc.)
- Command-based rendering (no immediate mode)
- Zero WebGL/WebGPU types in interface (backend-agnostic)
- Automatic browser capability detection
- Graceful degradation (WebGPU → WebGL2 → error)

**Browser Support (as of January 2026):**
- WebGPU: Chrome 113+, Safari 26+, Firefox 141+
- WebGL2: Universal browser support

**Capabilities:**
- WebGL2: No compute shaders, max 16x anisotropy, compression depends on extensions
- WebGPU: Compute shaders, up to 16x anisotropy, ASTC/ETC2/BC compression support

**Notes:**
- Shader transpilation (WGSL ↔ GLSL) deferred to future work
- Full feature parity between backends requires shader translation
- Basic rendering works on both backends
- WebGPU backend includes compute shader capability

### Epic 3.3: PBR Material System 
**Status:**  Complete
**Priority:** P0
**Acceptance Criteria:**
-  PBR shader implementation complete
- ⏸️ Material editor working (Deferred to Epic 3.6)
- ⏸️ Texture pipeline optimized (Deferred to Epic 3.6)
- ⏸️ IBL support added (Deferred to Epic 3.6)

#### User Stories:
1. **As an artist**, I want physically-based materials
2. **As an artist**, I want a visual material editor
3. **As a developer**, I want efficient material batching
4. **As a game**, I need realistic lighting

#### Tasks Breakdown:
- [x] Implement PBR shading model
  - [x] Cook-Torrance BRDF implementation
  - [x] Fresnel-Schlick approximation
  - [x] GGX/Trowbridge-Reitz NDF
  - [x] Smith's Schlick-GGX geometry function
- [x] Create material property system
  - [x] PBR material properties (baseColor, metallic, roughness)
  - [x] Material textures (baseColorMap, metallicRoughnessMap, normalMap, etc.)
  - [x] MaterialManager with validation and lifecycle management
  - [x] GPU binding with full shader/texture integration
  - [x] Property validation and security (clamping)
  - [x] Default material fallback system
- [x] Fixed shader compilation issues
  - [x] Changed bool uniforms to int for compatibility
  - [x] Fixed EPSILON precision for mobile GPUs
  - [x] Corrected ShaderManager API usage
- [ ] Build material instance batching (deferred to Epic 3.6)
- [ ] Add texture array support (deferred to Epic 3.6)
- [ ] Implement IBL (Image-Based Lighting) (deferred to Epic 3.6)
- [ ] Create material LOD system (deferred to Epic 3.6)
- [ ] Build material editor UI (deferred to Epic 3.6)
- [ ] Add material hot-reload (deferred to Epic 3.6)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/rendering/`
- **Material.ts**: Material property system with PBR properties and MaterialManager
- **shaders/pbr.vert.glsl**: PBR vertex shader with TBN matrix for normal mapping
- **shaders/pbr.frag.glsl**: PBR fragment shader with Cook-Torrance BRDF
  - Physically-based Cook-Torrance specular BRDF
  - Lambertian diffuse with energy conservation
  - Normal mapping support
  - Metallic/roughness workflow
  - Tone mapping and gamma correction

### Epic 3.4: Advanced Rendering Features
**Priority:** P1
**Acceptance Criteria:**
- Shadow mapping implemented
- Post-processing pipeline complete
- LOD system working
- Instanced rendering optimized

#### User Stories:
1. **As a player**, I want dynamic shadows
2. **As a player**, I want post-processing effects
3. **As a developer**, I want automatic LOD management
4. **As a developer**, I want efficient instanced rendering

#### Tasks Breakdown:
- [ ] Implement cascaded shadow maps
- [ ] Create post-processing pipeline
- [ ] Build LOD generation and selection
- [ ] Optimize instanced rendering
- [ ] Add screen-space effects (SSAO, SSR)
- [ ] Implement temporal anti-aliasing
- [ ] Create render feature toggles
- [ ] Build quality preset system

### Epic 3.5: Culling & Optimization
**Priority:** P1
**Acceptance Criteria:**
- Frustum culling implemented
- Occlusion culling working
- Spatial partitioning complete
- Draw call optimization done

#### User Stories:
1. **As a game**, I need efficient frustum culling
2. **As a game**, I need occlusion culling for complex scenes
3. **As a developer**, I want automatic spatial partitioning
4. **As a game**, I need minimal draw calls

#### Tasks Breakdown:
- [ ] Implement frustum culling with SIMD
- [ ] Add GPU-based occlusion culling
- [ ] Create octree/BVH spatial structures
- [ ] Build draw call merging system
- [ ] Implement visibility buffer
- [ ] Add LOD-based culling
- [ ] Create culling debug visualization
- [ ] Optimize culling performance

### Epic 3.6: Advanced Material Features
**Priority:** P2
**Status:** ⏸️ Deferred
**Acceptance Criteria:**
- Material batching and instancing implemented
- IBL (Image-Based Lighting) support added
- Material LOD system working
- Material editor UI complete
- Hot-reload functionality working

#### User Stories:
1. **As a developer**, I want efficient material batching for performance
2. **As an artist**, I want realistic environment-based lighting
3. **As an artist**, I want a visual material editor
4. **As a developer**, I want material hot-reload for rapid iteration

#### Tasks Breakdown:
- [ ] Build material instance batching (deferred from Epic 3.3)
- [ ] Add texture array support (deferred from Epic 3.3)
- [ ] Implement IBL (Image-Based Lighting) (deferred from Epic 3.3)
  - [ ] Environment map loading
  - [ ] Prefiltered environment maps
  - [ ] BRDF integration LUT
  - [ ] Diffuse irradiance
  - [ ] Specular IBL
- [ ] Create material LOD system (deferred from Epic 3.3)
- [ ] Build material editor UI (deferred from Epic 3.3)
- [ ] Add material hot-reload (deferred from Epic 3.3)

### Epic 3.7: Renderer Integration & Demo Scene
**Priority:** P0
**Status:**  Complete
**Dependencies:** Epic 1.1, Epic 3.1, Epic 3.3
**Acceptance Criteria:**
-  Electron app launches without errors
-  WebGL2 renderer initialized in renderer process
-  Canvas element rendering 3D content
-  Demo scene with PBR materials visible
-  Interactive camera controls working
-  FPS counter and performance stats displayed

#### User Stories:
1. **As a developer**, I want to verify the rendering engine works end-to-end 
2. **As a developer**, I want to test PBR materials visually 
3. **As a developer**, I want interactive camera controls for viewing 3D scenes 
4. **As a developer**, I want performance metrics visible during development 

#### Tasks Breakdown:
- [x] Fix preload script build (Epic 1.1 cleanup)
- [x] Fix preload path resolution
- [x] Fix CSP violations in index.html
- [x] Add canvas element to renderer
- [x] Import and initialize @miskatonic/rendering
- [x] Create render loop with requestAnimationFrame
- [x] Implement basic geometry primitives (cube, sphere, plane)
- [x] Create Camera class with perspective projection
- [x] Add orbit camera controls (mouse drag to rotate, wheel to zoom)
- [x] Build demo scene with Blinn-Phong lighting
- [x] Add directional light to shader
- [x] Create FPS counter UI
- [x] Display performance stats (draw calls, triangle count)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/renderer/`

**Files to Create:**
- `src/renderer/RenderLoop.ts` - Animation loop management
- `src/renderer/Camera.ts` - Camera and orbit controls
- `src/renderer/primitives.ts` - Mesh generation (cube, sphere, plane)
- `src/renderer/Scene.ts` - Scene setup and management
- `src/ui/MaterialEditor.ts` - Material property controls
- `src/ui/Stats.ts` - FPS and performance display

**Files to Modify:**
- `index.html` - Add canvas, fix CSP
- `src/index.ts` - Initialize renderer and demo scene
- `package.json` - Add @miskatonic/rendering dependency

**Goal:** Create a working 3D demo that proves the rendering engine integrates correctly with Electron and showcases the PBR material system.

---

### Epic 3.8: GPU Memory Management
**Priority:** P1 - IMPORTANT
**Status:**  Not Started
**Dependencies:** Epic 3.1 (Rendering Pipeline Foundation), Epic 2.13 (Memory Management Foundation)

**Problem Statement:**
GPU/VRAM memory management is critical for rendering performance but not explicitly planned. Without buffer pooling, texture atlasing, and VRAM budgets, rendering will reallocate buffers excessively, upload textures repeatedly, and risk VRAM exhaustion.

**From Memory Analysis:**
> "GPU memory equally critical for rendering"
> "Buffer reallocation expensive, texture uploads slow, VRAM exhaustion crashes"

**Acceptance Criteria:**
-  GPU buffer pool implemented (vertex, index, uniform buffers)
-  Texture atlas management working (packing, defragmentation)
-  VRAM budget defined and enforced (256MB target)
-  VRAM profiling integrated (tracking, warnings)
-  Buffer reallocation <5 per frame
-  Texture atlas coverage >90%
-  GPU resource lifecycle management (proper cleanup)

#### User Stories:
1. **As a renderer**, I need efficient GPU buffer reuse
2. **As a renderer**, I need texture atlasing to minimize texture binds
3. **As a developer**, I want VRAM profiling and budget warnings
4. **As a system**, I need GPU resources properly released (no leaks)
5. **As a game**, I need stable VRAM usage <256MB

#### Tasks Breakdown:
- [ ] Implement GPUBufferPool (size-based bucketing, power-of-2)
- [ ] Add buffer pool integration with renderer
- [ ] Create TextureAtlas (bin-packing algorithm)
- [ ] Implement UV transformation for atlas regions
- [ ] Add texture atlas defragmentation
- [ ] Create VRAMProfiler (allocation tracking per category)
- [ ] Add VRAM budget definitions (256MB target)
- [ ] Implement VRAM budget warnings (approaching limit)
- [ ] Add GPU resource lifecycle tracking (leak detection)
- [ ] Integrate with existing BufferManager
- [ ] Write comprehensive unit tests (>80% coverage)
- [ ] Document GPU memory management patterns

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/rendering/` (extend)

**GPUBufferPool Design:**
```typescript
class GPUBufferPool {
  private pools: Map<GPUBufferUsage, Map<number, GPUBuffer[]>>;

  acquireBuffer(usage: GPUBufferUsage, sizeBytes: number): GPUBuffer {
    const bucket = this.findBucket(sizeBytes);  // Power-of-2
    const pool = this.pools.get(usage)?.get(bucket);

    if (pool && pool.length > 0) {
      return pool.pop()!;
    }

    // Allocate new buffer
    return device.createBuffer({
      size: bucket,
      usage: usage
    });
  }

  release(buffer: GPUBuffer): void {
    const bucket = this.findBucket(buffer.size);
    this.pools.get(buffer.usage)?.get(bucket)?.push(buffer);
  }

  private findBucket(sizeBytes: number): number {
    // Round up to next power of 2
    return Math.pow(2, Math.ceil(Math.log2(sizeBytes)));
  }
}

// Buckets: 256, 512, 1KB, 2KB, 4KB, 8KB, 16KB, 32KB, 64KB, 128KB, 256KB, 512KB, 1MB, 2MB
```

**TextureAtlas Design:**
```typescript
interface AtlasRegion {
  atlasId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

class TextureAtlas {
  private atlases: GPUTexture[] = [];
  private packer: BinPacker;  // Shelf/Guillotine algorithm

  addTexture(image: ImageData): AtlasRegion {
    const region = this.packer.insert(image.width, image.height);

    if (!region) {
      // Create new atlas or promote to larger size
      this.growAtlas();
      return this.addTexture(image);
    }

    // Upload to atlas
    this.uploadToAtlas(region, image);
    return region;
  }

  getUVTransform(region: AtlasRegion): mat3 {
    const atlas = this.atlases[region.atlasId];
    return mat3.fromScaling(
      region.width / atlas.width,
      region.height / atlas.height
    ).translate(
      region.x / atlas.width,
      region.y / atlas.height
    );
  }

  defragment(): void {
    // Repack all textures, update regions, free old atlases
  }
}

// Atlas sizes: 512, 1024, 2048, 4096
```

**VRAMProfiler Design:**
```typescript
class VRAMProfiler {
  private allocations: Map<GPUBuffer | GPUTexture, AllocationInfo>;
  private budgets = {
    textures: 128 * 1024 * 1024,      // 128MB
    buffers: 64 * 1024 * 1024,        // 64MB
    renderTargets: 48 * 1024 * 1024   // 48MB
  };

  trackAllocation(resource: GPUBuffer | GPUTexture, category: string, sizeBytes: number): void {
    this.allocations.set(resource, { category, size: sizeBytes, timestamp: Date.now() });
    this.checkBudget();
  }

  trackDeallocation(resource: GPUBuffer | GPUTexture): void {
    this.allocations.delete(resource);
  }

  private checkBudget(): void {
    const usage = this.getCategoryUsage();

    for (const [category, size] of Object.entries(usage)) {
      const budget = this.budgets[category];
      if (size > budget * 0.9) {
        console.warn(`VRAM ${category} approaching budget: ${size}/${budget} bytes`);
      }
    }
  }

  getCategoryUsage(): Record<string, number> {
    const usage: Record<string, number> = {};
    for (const [_, info] of this.allocations) {
      usage[info.category] = (usage[info.category] || 0) + info.size;
    }
    return usage;
  }
}
```

**VRAM Budgets:**
```
VRAM: 256MB target
- Textures: 128MB
- Vertex/Index Buffers: 64MB
- Render Targets: 48MB
- Other: 16MB
```

**Performance Targets:**
- Buffer reallocation: <5 per frame
- Texture atlas coverage: >90%
- VRAM usage: <256MB typical scene
- GPU resource leak detection: 0 leaks

#### Design Principles:
1. **Pool Buffers**: Reuse GPU buffers by size bucket
2. **Atlas Textures**: Pack small textures, minimize texture binds
3. **Track VRAM**: Monitor allocations, enforce budgets
4. **Lifecycle Management**: Proper cleanup, no GPU leaks
5. **Performance First**: Minimize GPU memory operations

#### Dependencies:
- Epic 3.1: Rendering Pipeline Foundation (provides buffers/textures)
- Epic 2.13: Memory Management Foundation (provides profiling patterns)

**Deliverables:**
- GPUBufferPool implementation
- TextureAtlas implementation
- VRAMProfiler integration
- Budget enforcement
- GPU memory management guide

---

### Epic 3.9: Shader Management System
**Priority:** P0 - CRITICAL (BLOCKS RENDERING)
**Status:**  COMPLETE
**Completed:** December 2025
**Dependencies:** Epic 3.1 (Rendering Pipeline Foundation)

**Problem Statement:**
Cannot render without shaders. No shader management system defined. Need to organize shader source, handle compilation, manage variants, support hot-reload, and handle both WGSL (WebGPU) and GLSL ES 3.0 (WebGL2).

**From Rendering Analysis:**
> "Shader management system undefined (can't render without shaders)"
> "WGSL vs GLSL - maintenance burden? Transpilation?"

**Acceptance Criteria:**
-  Shader source organization (files, includes)
-  Compilation strategy (on-demand, caching)
-  Variant management (defines, feature combinations)
-  Hot-reload in development (<100ms)
-  Error handling and clear reporting
-  WGSL and GLSL ES 3.0 support
-  Include system for shared functions

#### User Stories:
1. **As a developer**, I want to write shaders in organized files
2. **As a developer**, I want shaders to compile automatically
3. **As a developer**, I want shader variants for different features
4. **As a developer**, I want hot-reload during development
5. **As a system**, I need clear compilation error messages

#### Tasks Breakdown:
- [x] Design shader source organization (common/, vertex/, fragment/)
- [x] Implement shader file loading system
- [x] Create shader compilation pipeline (GLSL ES 3.0)
- [x] Add shader caching (avoid recompilation)
- [x] Implement include system (#include resolution)
- [x] Create variant generation (feature defines)
- [x] Add hot-reload support (file watching)
- [x] Implement error reporting (line numbers, messages)
- [x] Add shader validation (syntax, uniforms)
- [x] Create ShaderManager API
- [x] Write comprehensive unit tests (>80% coverage)
- [ ] Document shader writing guidelines (deferred)
- [ ] WGSL support (deferred to WebGPU backend implementation)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/rendering/` (extend)

**Shader Source Organization:**
```
assets/shaders/
├── common/
│   ├── math.wgsl           # Shared math functions
│   ├── lighting.wgsl       # Shared lighting calculations
│   └── transforms.wgsl     # Shared transform code
├── vertex/
│   ├── standard.wgsl       # Basic vertex shader
│   ├── skinned.wgsl        # Skeletal animation
│   └── instanced.wgsl      # Instance rendering
├── fragment/
│   ├── unlit.wgsl          # No lighting
│   ├── lit.wgsl            # Phong/Blinn-Phong
│   └── pbr.wgsl            # Physically-Based Rendering
```

**ShaderManager API:**
```typescript
class ShaderManager {
  private cache = new Map<string, CompiledShader>();

  async getShader(name: string): Promise<CompiledShader>;
  async getVariant(baseName: string, features: ShaderFeatures): Promise<CompiledShader>;
  async precompile(name: string): Promise<void>;
  enableHotReload(): void;
}

interface ShaderFeatures {
  lit: boolean;           // Lighting enabled
  skinned: boolean;       // Skeletal animation
  textured: boolean;      // Texture sampling
  normalMapped: boolean;  // Normal mapping
  instanced: boolean;     // Instance rendering
}
```

**Hot-Reload Integration:**
```typescript
// Development mode: watch files, recompile on change
watcher.on('change', async (path) => {
  const shader = await this.compile(path);
  this.cache.set(path, shader);
  this.notifyMaterials(path);  // Materials rebind automatically
});
```

**Include System:**
```wgsl
// In shader:
#include "common/math.wgsl"
#include "common/lighting.wgsl"

// Shader manager resolves includes before compilation
```

**Performance Targets:**
- Hot-reload: <100ms compilation time
- Shader cache: 100% hit rate after warmup
- Variant generation: <10ms
- Include resolution: <1ms

#### Design Principles:
1. **Organized Source**: Clear file structure, reusable code
2. **Fast Iteration**: Hot-reload for rapid development
3. **Error Clarity**: Clear error messages with line numbers
4. **Variant Efficiency**: Generate only needed variants
5. **Cross-API**: Support both WGSL and GLSL ES 3.0

#### Dependencies:
- Epic 3.1: Rendering Pipeline Foundation (provides rendering context)

**Deliverables:**
-  ShaderManager implementation (enhanced with loading and variants)
-  ShaderLoader implementation (file loading, includes, preprocessing)
-  Shader loading and compilation (GLSL ES 3.0)
-  Variant generation system (feature defines)
-  Hot-reload support (file watching with chokidar)
-  Include system (#include resolution with circular dependency detection)
-  Error reporting (line numbers, context in compilation errors)
-  Shader organization (common/math.glsl, common/lighting.glsl, common/transforms.glsl)
-  PBR shaders (vertex/pbr.vert.glsl, fragment/pbr.frag.glsl)

**Test Results:**
- 59/59 tests passing (35 RenderQueue + 24 ShaderLoader)
- 100% test coverage on ShaderLoader
- Performance targets met:
  - Hot-reload: <100ms 
  - Include resolution: <1ms 
  - Variant generation: <10ms 

**Implementation Notes:**
- GLSL ES 3.0 only (WebGL2). WGSL support deferred to WebGPU backend implementation
- Include system with include guards (same file can be included multiple times)
- Circular dependency detection using recursion stack
- Variant generation uses #define directives (camelCase → UPPER_SNAKE_CASE)
- Hot-reload uses chokidar for file watching (Node.js only)
- Cache-friendly with LRU eviction for compiled programs
- Environment detection prevents Node.js imports in browser

**Security & Quality (Code-Critic Review - December 2025):**
All critical and major issues fixed:
-  Path traversal vulnerability fixed (path normalization + validation)
-  Resource limits added (maxFileSize: 1MB, maxIncludeDepth: 10, maxCacheSize: 100)
-  Circular dependency detection fixed (recursion stack + include guards)
-  Hot-reload variant tracking fixed (proper program-to-variant mapping)
-  Cache race conditions fixed (loading promises prevent duplicate reads)
-  LRU memory leak fixed (filter instead of splice)
-  Environment detection added (Node.js vs browser check)

**Files Created:**
- `/packages/rendering/src/ShaderLoader.ts` (352 lines)
- `/packages/rendering/src/shaders/common/math.glsl` (shared math functions)
- `/packages/rendering/src/shaders/common/lighting.glsl` (PBR lighting calculations)
- `/packages/rendering/src/shaders/common/transforms.glsl` (transform utilities)
- `/packages/rendering/src/shaders/vertex/pbr.vert.glsl` (reorganized)
- `/packages/rendering/src/shaders/fragment/pbr.frag.glsl` (reorganized with includes)
- `/packages/rendering/tests/ShaderLoader.test.ts` (386 lines, 24 tests)

**Files Modified:**
- `/packages/rendering/src/ShaderManager.ts` (added variant support, hot-reload)
- `/packages/rendering/src/index.ts` (added exports)

---

### Epic 3.10: Camera System
**Priority:** P0 - CRITICAL (BLOCKS RENDERING)
**Status:**  COMPLETE
**Completed:** January 2026
**Dependencies:** Epic 2.1 (ECS Core)

**Note:** A standalone Camera class exists in `/packages/rendering/src/Camera.ts` but this is NOT the ECS-integrated camera system required by this epic. Epic 3.10 requires Camera as an ECS component in `/packages/ecs/`.

**Problem Statement:**
Cannot render without camera. Need view and projection matrices. No camera system defined - no component, no matrix generation, no control modes.

**From Rendering Analysis:**
> "Camera system undefined (can't generate view/projection matrices)"
> "Camera control modes (orbit, FPS, TPS, cinematic)"

**Acceptance Criteria:**
-  Camera component (ECS) ✅
-  View matrix generation (lookAt) ✅
-  Projection matrix generation (perspective, orthographic) ✅
-  Camera control modes (orbit, FPS) ✅
-  Active camera selection ✅
-  Multiple camera support ✅

#### User Stories:
1. **As a developer**, I want a Camera component for entities
2. **As a developer**, I want perspective and orthographic projections
3. **As a player**, I want orbit camera controls (editor-style)
4. **As a player**, I want first-person controls (FPS games)
5. **As a developer**, I want to switch between cameras

#### Tasks Breakdown:
- [x] Create Camera component (projection, viewport, clearColor)
- [x] Implement PerspectiveProjection (FOV, near, far)
- [x] Implement OrthographicProjection (bounds, near, far)
- [x] Create CameraSystem (ECS system)
- [x] Implement view matrix generation (Mat4.lookAt)
- [x] Implement projection matrix generation
- [x] Create OrbitCameraController (mouse drag, wheel zoom)
- [x] Create FirstPersonCameraController (WASD + mouse)
- [x] Add active camera management
- [x] Support multiple cameras (split-screen, PIP)
- [x] Write comprehensive unit tests (52/52 passing, 100% coverage)
- [x] Fix all test failures (11 bugs fixed)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/ecs/` (component), `/packages/rendering/` (system)

**Camera Component:**
```typescript
interface Camera {
  projection: PerspectiveProjection | OrthographicProjection;
  viewport: { x: number; y: number; width: number; height: number };
  clearColor: [number, number, number, number];
  renderTarget?: RenderTexture;  // null = screen
}

interface PerspectiveProjection {
  type: 'perspective';
  fov: number;      // Radians (Math.PI / 4 = 45°)
  near: number;
  far: number;
}

interface OrthographicProjection {
  type: 'orthographic';
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
}
```

**Camera System:**
```typescript
class CameraSystem {
  getViewMatrix(entity: Entity): Mat4 {
    const transform = entity.get(Transform);
    const forward = transform.rotation.forward();
    const target = transform.position.add(forward);
    const up = transform.rotation.up();
    return Mat4.lookAt(transform.position, target, up);
  }

  getProjectionMatrix(entity: Entity, aspectRatio: number): Mat4 {
    const camera = entity.get(Camera);
    if (camera.projection.type === 'perspective') {
      return Mat4.perspective(
        camera.projection.fov,
        aspectRatio,
        camera.projection.near,
        camera.projection.far
      );
    } else {
      return Mat4.orthographic(
        camera.projection.left,
        camera.projection.right,
        camera.projection.top,
        camera.projection.bottom,
        camera.projection.near,
        camera.projection.far
      );
    }
  }
}
```

**Orbit Camera Controller:**
```typescript
class OrbitCameraController {
  private distance = 10;
  private azimuth = 0;      // Horizontal rotation
  private elevation = 30;   // Vertical rotation
  private target = Vec3.zero();

  update(input: InputState, dt: number) {
    // Mouse drag rotates
    if (input.mouseButton(1)) {
      this.azimuth += input.mouseDelta.x * 0.01;
      this.elevation += input.mouseDelta.y * 0.01;
      this.elevation = clamp(this.elevation, -89, 89);
    }

    // Mouse wheel zooms
    this.distance -= input.mouseWheel * 0.1;
    this.distance = clamp(this.distance, 1, 100);

    // Update camera transform
    const position = this.calculatePosition();
    this.entity.get(Transform).position = position;
    this.entity.get(Transform).lookAt(this.target);
  }
}
```

**First-Person Camera Controller:**
```typescript
class FirstPersonCameraController {
  private yaw = 0;
  private pitch = 0;
  private moveSpeed = 5.0;
  private lookSpeed = 0.002;

  update(input: InputState, dt: number) {
    const transform = this.entity.get(Transform);

    // Mouse look
    this.yaw += input.mouseDelta.x * this.lookSpeed;
    this.pitch += input.mouseDelta.y * this.lookSpeed;
    this.pitch = clamp(this.pitch, -Math.PI/2, Math.PI/2);

    transform.rotation = Quat.fromEuler(this.pitch, this.yaw, 0);

    // WASD movement
    const forward = transform.rotation.forward();
    const right = transform.rotation.right();

    let movement = Vec3.zero();
    if (input.key('w')) movement = movement.add(forward);
    if (input.key('s')) movement = movement.sub(forward);
    if (input.key('d')) movement = movement.add(right);
    if (input.key('a')) movement = movement.sub(right);

    if (movement.length() > 0) {
      movement = movement.normalize().scale(this.moveSpeed * dt);
      transform.position = transform.position.add(movement);
    }
  }
}
```

**Performance Targets:**
- Matrix generation: <0.1ms
- Controller update: <0.5ms
- Smooth camera movement (no jitter)

#### Design Principles:
1. **ECS Integration**: Camera is a component
2. **Flexible Projection**: Perspective and orthographic
3. **Smooth Controls**: Configurable sensitivity
4. **Multiple Cameras**: Support split-screen, PIP

#### Dependencies:
- Epic 2.1: ECS Core (Transform component, entity system)

**Deliverables:**
-  Camera component (`/packages/ecs/src/components/Camera.ts`)
-  CameraSystem implementation (`/packages/rendering/src/CameraSystem.ts`)
-  OrbitCameraController (`/packages/rendering/src/CameraControllers.ts`)
-  FirstPersonCameraController (`/packages/rendering/src/CameraControllers.ts`)
-  Active camera management (getActiveCamera, setActiveCamera)
-  Component registration in ECS
-  Matrix generation (view, projection, view-projection)

**Test Results:**
- 52/52 tests passing (23 CameraSystem + 29 CameraControllers)
- 100% test coverage
- All critical bugs fixed

**Bugs Fixed (January 2026):**
1. **Core ECS Bug**: Fixed `inferArrayType()` in ComponentStorage - was truncating floats to integers
2. **Implementation Bug**: Fixed `CameraSystem.setActiveCamera()` - wasn't persisting snapshot changes
3. **Test Issues**: Fixed 6 snapshot pattern violations in tests
4. **Type Safety**: Fixed 3 missing component type arguments
5. **Floating-Point**: Fixed precision issue in OrbitCameraController distance test
6. **Matrix Identity**: Fixed VP multiplication test with non-identity transform

**Architectural Lessons:**
- Snapshot pattern (getComponent → mutate → setComponent) requires explicit write-back
- Type inference ambiguity (default value `0` could be int or float) resolved by defaulting to Float32Array
- Documentation critical for explaining SoA snapshot behavior

**Status: PRODUCTION READY**

---

### Epic 3.11: Transform System
**Priority:** P0 - CRITICAL (BLOCKS RENDERING)
**Status:**  COMPLETE
**Completed:** November-December 2025
**Dependencies:** Epic 2.1 (ECS Core)

**Problem Statement:**
Need to convert ECS Transform components into 4×4 matrices for GPU. No transform system defined - no matrix generation, no hierarchical transforms, no dirty flag optimization.

**From Rendering Analysis:**
> "Transform system undefined (can't convert ECS to matrices)"
> "Hierarchical transforms essential for articulated objects"

**Acceptance Criteria:**
-  Model matrix generation from Transform component
-  Hierarchical transform support (parent/child)
-  World matrix calculation
-  Dirty flag optimization (only recalculate if changed)
-  Matrix caching
-  <0.5ms for 1000 transforms

#### User Stories:
1. **As a system**, I need model matrices from Transform components
2. **As a developer**, I want hierarchical transforms (parent/child)
3. **As a renderer**, I need world matrices for rendering
4. **As a system**, I need efficient updates (dirty flags)
5. **As a game**, I need fast matrix generation (<0.5ms for 1000 entities)

#### Tasks Breakdown:
- [x] Create TransformSystem (ECS system)
- [x] Implement model matrix generation (T × R × S)
- [x] Add parent/child relationship support (linked list hierarchy)
- [x] Implement world matrix calculation (iterative, prevents stack overflow)
- [x] Add dirty flag system (only update if changed)
- [x] Create matrix caching (MatrixStorage with contiguous arrays)
- [x] Optimize for sequential access (cache-friendly SoA storage)
- [x] Add transform hierarchy utilities (setParent, getChildren)
- [x] Implement setParent/getParent/getChildren (with circular dependency detection)
- [x] Add transform utilities via TransformSystem (setPosition, setRotation, setScale)
- [x] Add World API convenience methods
- [x] Document transform system usage (TRANSFORM_USAGE.md)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/ecs/` (extend)

**Transform Component (already exists):**
```typescript
interface Transform {
  position: Vec3;
  rotation: Quat;  // Or Euler angles
  scale: Vec3;

  // Hierarchy
  parent?: EntityId;
  children: EntityId[];

  // Cached matrices
  localMatrix?: Mat4;
  worldMatrix?: Mat4;

  // Dirty flag
  dirty: boolean;
}
```

**TransformSystem:**
```typescript
class TransformSystem {
  update() {
    // Update transforms that changed
    for (const entity of this.entities) {
      const transform = entity.get(Transform);

      if (transform.dirty) {
        // Recalculate local matrix
        transform.localMatrix = this.calculateLocalMatrix(transform);

        // Recalculate world matrix
        transform.worldMatrix = this.calculateWorldMatrix(entity);

        // Mark clean
        transform.dirty = false;

        // Dirty children (their world matrix depends on parent)
        for (const childId of transform.children) {
          const child = this.world.getEntity(childId);
          child.get(Transform).dirty = true;
        }
      }
    }
  }

  private calculateLocalMatrix(transform: Transform): Mat4 {
    const T = Mat4.translation(transform.position);
    const R = Mat4.fromQuat(transform.rotation);
    const S = Mat4.scale(transform.scale);
    return T.multiply(R).multiply(S);  // Order: T × R × S
  }

  private calculateWorldMatrix(entity: Entity): Mat4 {
    const transform = entity.get(Transform);
    const local = transform.localMatrix!;

    if (transform.parent) {
      const parent = this.world.getEntity(transform.parent);
      const parentWorld = parent.get(Transform).worldMatrix!;
      return parentWorld.multiply(local);
    }

    return local;
  }
}
```

**Hierarchical Transform Examples:**
```typescript
// Arm attached to shoulder
const shoulder = world.createEntity();
shoulder.add(Transform, { position: [0, 1.5, 0], ... });

const arm = world.createEntity();
arm.add(Transform, { position: [0.5, 0, 0], ... });
arm.get(Transform).parent = shoulder.id;

// When shoulder moves, arm moves with it automatically
```

**Dirty Flag Optimization:**
```typescript
// Only recalculate if transform changed
transform.position = newPosition;
transform.dirty = true;  // Mark dirty

// TransformSystem recalculates only dirty transforms
```

**Performance Targets:**
- Matrix generation: <0.5ms for 1000 transforms
- Hierarchical update: <1ms for 100 hierarchies
- Dirty flag overhead: negligible
- Memory: ~128 bytes per transform (2 matrices cached)

#### Design Principles:
1. **Lazy Update**: Only recalculate when dirty
2. **Cache Matrices**: Avoid redundant calculations
3. **Hierarchical**: Parent/child relationships automatic
4. **ECS Integration**: Works seamlessly with ECS

#### Dependencies:
- Epic 2.1: ECS Core (Transform component exists, need system)

**Deliverables:**
- TransformSystem implementation
- Model matrix generation
- Hierarchical transform support
- World matrix calculation
- Dirty flag optimization
- Transform utilities
- Transform system documentation

**Status Update (December 2025):**
-  Basic implementation complete (November 2025)
-  Code-critic review completed
-  Epic 3.11.5 COMPLETE - All critical issues fixed
-  **PRODUCTION READY**

---

### Epic 3.11.5: Cache-Efficient Transform Storage (CRITICAL FIX)
**Priority:** P0 - CRITICAL (BLOCKS PRODUCTION)
**Status:**  COMPLETE
**Completed:** December 2025
**Dependencies:** Epic 3.11 (Transform System - Basic Implementation)
**Source:** Code-Critic Review

**Problem Statement:**
Epic 3.11's initial implementation violates the cache-efficient SoA architecture from Epic 2.10-2.11. Critical data (parent/children, matrices) stored as object properties instead of typed arrays, causing memory fragmentation, cache misses, GC pressure, and performance degradation.

**Critical Issues from Code-Critic:**
1. **Parent/children not in typed arrays** → Destroys SoA architecture
2. **Memory allocations in hot path** → 960KB/sec garbage at 60 FPS
3. **Infinite recursion vulnerability** → No circular dependency detection
4. **Matrices not in SoA storage** → Cache misses on every access

**Acceptance Criteria:**
-  ALL Transform data in typed arrays (no object properties)
-  Parent/child hierarchy using linked list in typed arrays
-  MatrixStorage with contiguous typed arrays
-  Zero allocations in TransformSystem.update() loop
-  Circular dependency detection prevents crashes
-  <0.5ms for 1000 transforms (validated with benchmarks)
-  Zero GC pressure (verified with profiler)
-  ~185 bytes per transform (down from 400+)

#### Tasks Breakdown:

**Phase 1: Design**  COMPLETE
- [x] Design linked list hierarchy storage (parentId, firstChildId, nextSiblingId)
- [x] Design MatrixStorage for contiguous matrix pools
- [x] Design circular dependency detection with max depth limit

**Phase 2: Implementation**  COMPLETE
- [x] Update Transform component schema (add hierarchy fields to typed arrays)
- [x] Implement MatrixStorage class with contiguous Float32Arrays
- [x] Add zero-allocation Mat4 variants (multiplyTo, composeTRSTo, etc.)
- [x] Refactor TransformSystem to eliminate all allocations
- [x] Implement linked list hierarchy management (addChild, removeChild, iterate)
- [x] Add circular dependency detection in setParent()

**Phase 3: Critical Bug Fixes (from code-critic)**  COMPLETE
- [x] Fix variable shadowing bug in Mat4.composeTRSTo()
- [x] Add matrix cleanup on entity destruction (prevent memory leaks)
- [x] Fix parent update recursion (prevent stack overflow with deep hierarchies)

**Phase 4: Documentation**  COMPLETE
- [x] Update Transform component documentation
- [x] Update TransformSystem documentation
- [x] Document zero-allocation design
- [x] Write migration guide from Epic 3.11 (TRANSFORM_USAGE.md)
- [x] Update World API with convenience methods

#### Implementation Details:

**Linked List Hierarchy Storage:**
```typescript
// In Transform ComponentRegistry:
createFieldDescriptor('parentId', -1, Int32Array),
createFieldDescriptor('firstChildId', -1, Int32Array),
createFieldDescriptor('nextSiblingId', -1, Int32Array),
createFieldDescriptor('dirty', 1, Uint8Array),
```

**MatrixStorage (Contiguous Arrays):**
```typescript
class MatrixStorage {
  private localMatrices: Float32Array;  // 16 * capacity
  private worldMatrices: Float32Array;  // 16 * capacity

  getLocalMatrix(index: number): Float32Array {
    return this.localMatrices.subarray(index * 16, (index + 1) * 16);
  }
}
```

**Zero-Allocation Matrix Functions:**
```typescript
// Old: allocates every call
export function multiply(a, b): Float32Array { return new Float32Array(16); }

// New: zero allocation
export function multiplyTo(a, b, result): void { /* write to result */ }
```

**Circular Dependency Detection:**
```typescript
private detectCycle(childId: EntityId, parentId: EntityId): boolean {
  let current = parentId;
  let depth = 0;
  while (current !== -1 && depth < 32) {
    if (current === childId) return true;  // Cycle!
    current = getParent(current);
    depth++;
  }
  return depth >= 32;  // Max depth exceeded
}
```

**Performance Targets:**
- Update time: <0.3ms (flat), <0.5ms (deep), <0.4ms (wide) for 1000 entities
- Memory: ~185 bytes per transform
- Allocations: 0 during update loop
- GC pauses: 0 during transform updates

**Dependencies:**
- Must maintain Epic 3.11 test compatibility
- Must integrate with Epic 3.1 (Rendering)
- Should not break existing Epic 3.11 API where possible

**Deliverables:**
-  MatrixStorage implementation (`src/math/MatrixStorage.ts`)
-  Zero-allocation Mat4 functions (`src/math/Mat4.ts` - composeTRSTo, multiplyTo)
-  Linked list hierarchy management (TransformSystem)
-  Circular dependency detection (wouldCreateCycle in setParent)
-  World API convenience methods (`World.ts` - setPosition, setRotation, etc.)
-  Migration guide (`TRANSFORM_USAGE.md`)
-  Updated documentation (comprehensive JSDoc)
-  Critical bug fixes (rotation math, memory leaks, stack overflow)

**Completion Summary (December 2025):**

Epic 3.11.5 has been successfully completed and approved for production by code-critic review after critical bug fixes.

**What Was Delivered:**
1. **Pure Data Transform Component** - All methods removed, data in typed arrays
2. **MatrixStorage** - Contiguous Float32Array storage (128 bytes per entity)
3. **Zero-Allocation Matrix Math** - composeTRSTo(), multiplyTo() variants
4. **TransformSystem Refactor** - All logic moved from component to system
5. **World Convenience API** - Clean interface for transform operations
6. **Critical Bug Fixes**:
   - Fixed rotation math variable shadowing bug
   - Added matrix cleanup on entity destruction (prevents leaks)
   - Fixed parent update recursion (prevents stack overflow)

**Performance Results:**
- Memory: 185 bytes per entity (54% reduction from 400+ bytes)
- Allocations: 0 in hot paths (verified)
- Update time: <0.5ms for 1000 transforms (target met)
- GC pressure: 0 (verified)

**Status: PRODUCTION READY** 

---

### Epic 3.12: Render Queue Organization
**Priority:** P0 - CRITICAL (PERFORMANCE)
**Status:**  COMPLETE
**Completed:** December 2025
**Dependencies:** Epic 3.1, Epic 3.3 (Material System), Epic 3.11 (Transform System)

**Problem Statement:**
1000+ objects cannot be drawn in random order. Need batching, sorting, and state minimization to achieve 60 FPS. Draw calls are expensive - each requires state validation, uniform updates, descriptor binding.

**From Rendering Analysis:**
> "Render queue undefined (1000 objects need batching/sorting)"
> "1000 draw calls = 10-100ms CPU time - exceeds entire frame budget!"

**Acceptance Criteria:**
-  Render queue structure (opaque, alpha-test, transparent)
-  Draw command creation and submission
-  Sorting strategies (material, depth)
-  State change minimization
-  Transparent object sorting (back-to-front)
-  <100 draw calls for 1000 objects (batching/instancing)
-  <1ms sorting time for 1000 objects

#### User Stories:
1. **As a renderer**, I need efficient draw call batching
2. **As a renderer**, I need opaque objects sorted front-to-back
3. **As a renderer**, I need transparent objects sorted back-to-front
4. **As a system**, I need state changes minimized
5. **As a game**, I need <100 draw calls for 1000 objects

#### Tasks Breakdown:
- [x] Design RenderQueue structure (3 queues: opaque, alphaTest, transparent)
- [x] Create QueuedDrawCommand structure with sorting metadata
- [x] Implement queue submission (categorize by material blend mode)
- [x] Add depth calculation from camera (distance-based)
- [x] Implement opaque sorting (front-to-back by depth)
- [x] Implement transparent sorting (back-to-front by depth)
- [x] Implement alpha-test sorting (by material)
- [x] Add sort key optimization (pack criteria into single 32-bit number)
- [x] Create state change tracking (minimize redundant state)
- [x] Write comprehensive unit tests (30/30 tests passing, 100% coverage)
- [x] Export public API through index.ts

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/rendering/` (extend)

**RenderQueue Structure:**
```typescript
class RenderQueue {
  private opaque: DrawCommand[] = [];
  private alphaTest: DrawCommand[] = [];
  private transparent: DrawCommand[] = [];

  submit(command: DrawCommand) {
    const material = command.material;

    if (material.renderState.blend) {
      // Transparent: Calculate depth, needs sorting
      command.depth = this.calculateDepth(command.transform, this.camera);
      this.transparent.push(command);
    } else if (material.hasAlphaTest) {
      // Alpha cutout: No depth sorting needed
      this.alphaTest.push(command);
    } else {
      // Opaque: Calculate depth for early-z optimization
      command.depth = this.calculateDepth(command.transform, this.camera);
      this.opaque.push(command);
    }
  }

  render() {
    // 1. Opaque: Front-to-back (minimize overdraw)
    this.opaque.sort((a, b) => a.sortKey - b.sortKey);
    for (const cmd of this.opaque) {
      this.draw(cmd);
    }

    // 2. Alpha-test: By material (minimize state changes)
    this.alphaTest.sort((a, b) => a.material.id - b.material.id);
    for (const cmd of this.alphaTest) {
      this.draw(cmd);
    }

    // 3. Transparent: Back-to-front (correct blending)
    this.transparent.sort((a, b) => b.depth - a.depth);
    for (const cmd of this.transparent) {
      this.draw(cmd);
    }
  }

  clear() {
    this.opaque.length = 0;
    this.alphaTest.length = 0;
    this.transparent.length = 0;
  }
}
```

**DrawCommand Structure:**
```typescript
interface DrawCommand {
  // Mesh data
  mesh: MeshHandle;
  indexCount: number;
  indexOffset: number;

  // Material
  material: MaterialHandle;

  // Transform
  transform: Mat4;

  // Sorting
  depth: number;          // Distance from camera
  materialId: number;     // For batching
  sortKey: number;        // Precomputed (bits: material | depth)

  // Instancing (optional)
  instanceCount?: number;
  instanceData?: Float32Array;
}
```

**Sort Key Optimization:**
```typescript
// Pack sorting criteria into single number for fast comparison
function calculateSortKey(command: DrawCommand): number {
  // Bits 0-15: Material ID (65536 materials)
  // Bits 16-31: Depth (65536 depth levels)

  const materialBits = command.material.id & 0xFFFF;
  const depthBits = (Math.floor(command.depth * 1000) & 0xFFFF) << 16;

  return materialBits | depthBits;
}

// Single integer comparison (faster than multi-key sort)
opaque.sort((a, b) => a.sortKey - b.sortKey);
```

**State Change Minimization:**
```typescript
class RenderQueue {
  private lastMaterial: MaterialHandle | null = null;
  private lastMesh: MeshHandle | null = null;

  private draw(command: DrawCommand) {
    // Only change material if different (expensive)
    if (command.material !== this.lastMaterial) {
      this.bindMaterial(command.material);
      this.lastMaterial = command.material;
    }

    // Only bind mesh if different
    if (command.mesh !== this.lastMesh) {
      this.bindMesh(command.mesh);
      this.lastMesh = command.mesh;
    }

    // Update per-object uniforms (transform)
    this.updateUniforms(command.transform);

    // Draw
    this.renderer.drawIndexed(command.indexCount, command.indexOffset);
  }
}
```

**Performance Targets:**
- Sorting: <1ms for 1000 objects
- Draw calls: <100 for 1000 objects (with batching/instancing)
- State changes: <50 material changes per frame
- Overdraw: Minimized via front-to-back opaque sorting

#### Design Principles:
1. **Sort Smart**: Opaque front-to-back, transparent back-to-front
2. **Minimize State**: Group by material, minimize changes
3. **Fast Sorting**: Single sort key comparison
4. **Correct Blending**: Transparent back-to-front required

#### Dependencies:
- Epic 3.1: Rendering Pipeline Foundation (rendering context)
- Epic 3.3: Material System (material definitions)
- Epic 3.11: Transform System (world matrices)

**Deliverables:**
-  RenderQueue implementation (`src/RenderQueue.ts`)
-  QueuedDrawCommand structure with sorting metadata
-  Sorting implementation (opaque, alpha-test, transparent)
-  State change tracking (material/shader tracking)
-  Comprehensive test suite (30 tests, 100% pass rate)

**Completion Summary (December 2025):**

Epic 3.12 has been successfully completed with full test coverage.

**What Was Delivered:**
1. **RenderQueue Class** - Three separate queues (opaque, alphaTest, transparent)
2. **Smart Categorization** - Automatic routing based on blend mode
3. **Optimized Sorting**:
   - Opaque: Front-to-back by depth (minimize overdraw)
   - Transparent: Back-to-front by depth (correct blending)
   - Alpha-test: By material (minimize state changes)
4. **Sort Key Optimization** - 32-bit packed keys for fast single-integer comparison
5. **Depth Calculation** - Camera-based distance calculation for all objects
6. **State Tracking** - Material and state change statistics

**Test Results:**
- 35/35 tests passing (5 new validation tests added after code-critic review)
- 100% test coverage
- Performance: <1ms sorting for 1000 objects (target met)
- All edge cases covered (empty queue, single command, distant objects)
- Input validation tested (invalid matrix, material ID, etc.)

**Performance Achievements:**
- Sort time: <1ms for 1000 objects (target: <1ms) 
- Memory: Zero allocation during sort operations
- Categorization: O(1) per command submission
- Sort key calculation: Single integer comparison

**Code-Critic Review Fixes (December 2025):**
-  Fixed unused variable compilation errors (lastShaderId removed)
-  Documented alpha-test limitation (deferred to Epic 3.13)
-  Added input validation to submit() (validates worldMatrix, materialId, drawCommand)
-  Fixed depth quantization precision (logarithmic encoding for 0-65535 unit range)
-  Added 5 new validation tests (35 total tests)

**Status: PRODUCTION READY** 

---

### Epic 3.13: Draw Call Batching & Instancing ✅
**Priority:** P1 - IMPORTANT (PERFORMANCE)
**Status:** ✅ COMPLETE
**Completed:** November 8, 2025
**Dependencies:** Epic 3.12 (Render Queue) ✅

**Completion Summary:**
- ✅ GPU-side instance rendering implemented
- ✅ 1000 objects → 1 draw call (99.9% reduction achieved)
- ✅ Instance buffer pooling with power-of-2 buckets
- ✅ Automatic instance detection (mesh + material grouping)
- ✅ WebGL2 backend integration complete
- ✅ All 177 tests passing (100% pass rate)
- ✅ End-to-end demo and integration tests
- ✅ Zero-allocation pooling with in-flight tracking
- 📝 Static/dynamic batching deferred to future epic (instance rendering sufficient)

**Documentation:** `/Users/bud/Code/miskatonic/packages/rendering/EPIC_3_13_COMPLETE.md`

**Problem Statement:**
1000 objects with naive rendering = 1000 draw calls = slow (10-100ms CPU time). Need batching and instancing to reduce draw calls to <100. Each draw call has overhead: state validation, uniform updates, descriptor binding.

**From Rendering Analysis:**
> "Draw call batching undefined (1000 separate calls = slow)"
> "Instance rendering: ONE draw call for 1000 trees"

**Acceptance Criteria:**
-  Static batching (build-time mesh combining)
-  Dynamic batching (runtime, same material)
-  Instance rendering (GPU draws N copies)
-  <100 draw calls for typical 1000-object scene
-  Instance rendering: 1 call for N identical objects
-  Batch management system

#### User Stories:
1. **As a renderer**, I need static batching for static geometry
2. **As a renderer**, I need dynamic batching for moving objects
3. **As a renderer**, I need instance rendering for repeated objects
4. **As a game**, I need <100 draw calls for 1000 objects
5. **As a developer**, I want automatic batching

#### Tasks Breakdown:
- [ ] Implement static batching (combine static meshes at build time) - **DEFERRED** (not needed yet)
- [ ] Implement dynamic batching (combine at runtime, same material) - **DEFERRED** (not needed yet)
- [x] Implement instance rendering (GPU-side, N copies) ✅
- [x] Create batch generation strategies ✅ (instance grouping by mesh+material)
- [x] Add instance buffer management (per-instance transforms) ✅ (InstanceBuffer + pooling)
- [x] Implement automatic batching detection ✅ (InstanceDetector)
- [x] Add shader support for instancing (instance ID) ✅ (InstancedShaderManager)
- [x] Create batch statistics and profiling ✅ (RenderQueue.getStats())
- [ ] Optimize for small meshes (<300 vertices dynamic batching) - **DEFERRED** (not needed yet)
- [x] Add batch debugging tools ✅ (instance-demo.ts)
- [x] Write comprehensive unit tests (>80% coverage) ✅ (177/177 tests passing)
- [x] Document batching strategies ✅ (EPIC_3_13_COMPLETE.md)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/rendering/` (extend)

**Static Batching:**
```typescript
// Combine static geometry at build time
const combinedMesh = MeshBuilder.combine([
  tree1.mesh,
  tree2.mesh,
  tree3.mesh,
  // ... 100 trees
]);

// One draw call for 100 trees
renderer.draw(combinedMesh, treeMaterial);
```

**Dynamic Batching:**
```typescript
// Combine at runtime if same material and small meshes
const batchable = renderQueue.filter(cmd =>
  cmd.material === someMaterial &&
  cmd.mesh.vertexCount < 300  // Small meshes only
);

const combined = combineMeshes(batchable);
renderer.draw(combined, someMaterial);
```

**Instance Rendering (BEST):**
```typescript
// GPU draws N copies of same mesh
const instanceData = new Float32Array(1000 * 16);  // 1000 matrices
for (let i = 0; i < 1000; i++) {
  instanceData.set(trees[i].worldMatrix.data, i * 16);
}

renderer.drawInstanced(treeMesh, treeMaterial, 1000, instanceData);
// ONE draw call for 1000 trees
```

**Vertex Shader with Instancing:**
```wgsl
@group(0) @binding(0) var<storage, read> instanceMatrices: array<mat4x4<f32>>;

@vertex
fn main(
  @location(0) position: vec3<f32>,
  @builtin(instance_index) instanceIdx: u32
) -> VertexOutput {
  let instanceMatrix = instanceMatrices[instanceIdx];
  var output: VertexOutput;
  output.position = camera.viewProj * instanceMatrix * vec4(position, 1.0);
  return output;
}
```

**Automatic Batching Detection:**
```typescript
class RenderQueue {
  submit(command: DrawCommand) {
    // Detect if instanceable (same mesh + material)
    const key = `${command.mesh.id}-${command.material.id}`;

    if (!this.instances.has(key)) {
      this.instances.set(key, []);
    }

    this.instances.get(key)!.push(command);
  }

  render() {
    // Render instances
    for (const [key, commands] of this.instances) {
      if (commands.length > 10) {  // Threshold
        this.drawInstanced(commands);
      } else {
        // Too few, draw individually
        for (const cmd of commands) {
          this.draw(cmd);
        }
      }
    }
  }
}
```

**Performance Targets:**
- Static batching: 10x draw call reduction
- Dynamic batching: 5x draw call reduction (small meshes)
- Instance rendering: 100x+ draw call reduction (repeated objects)
- Target: <100 draw calls for 1000-object scene
- Overhead: <1ms batch generation

#### Design Principles:
1. **Instance First**: Best performance for repeated objects
2. **Static When Possible**: Build-time combining for static geometry
3. **Dynamic Carefully**: Only for small meshes (overhead)
4. **Automatic**: Detect and batch automatically

#### Dependencies:
- Epic 3.12: Render Queue Organization (provides draw commands)

**Deliverables:**
- Static batching implementation
- Dynamic batching implementation
- Instance rendering support
- Batch management system
- Batching documentation

---

### Epic 3.14: Transparency & Blending
**Priority:** P1 - IMPORTANT (VISUAL QUALITY)
**Status:**  Not Started
**Dependencies:** Epic 3.12 (Render Queue), Epic 3.3 (Material System)

**Problem Statement:**
Transparent objects require special handling - must render back-to-front for correct blending, cannot write to depth buffer. No transparency strategy defined. Sorting is expensive but required for visual correctness.

**From Rendering Analysis:**
> "Transparency handling undefined (requires sorting, performance cost)"
> "Blending is NOT commutative: A over B ≠ B over A"

**Acceptance Criteria:**
-  Transparent object sorting (back-to-front)
-  Depth buffer handling (read but don't write)
-  Alpha blending configuration
-  Alpha-test vs alpha-blend distinction
-  No transparency artifacts
-  <1ms sorting overhead for 200 transparent objects

#### User Stories:
1. **As a renderer**, I need transparent objects sorted back-to-front
2. **As a material**, I need depth write control (transparent = no write)
3. **As a developer**, I want alpha-test for cutouts (grass, fences)
4. **As a game**, I need correct transparency (no artifacts)
5. **As a system**, I need efficient sorting (<1ms)

#### Tasks Breakdown:
- [ ] Implement transparent sorting (back-to-front by depth)
- [ ] Add depth write configuration per material
- [ ] Implement blend mode configuration (blend factors)
- [ ] Add alpha-test support (discard in fragment shader)
- [ ] Create separate alpha-test queue (no sorting needed)
- [ ] Implement depth calculation (object center to camera)
- [ ] Add blend state management
- [ ] Optimize sorting (cache depths, incremental sort)
- [ ] Add transparency debugging tools
- [ ] Document transparency best practices
- [ ] Write comprehensive unit tests (>80% coverage)
- [ ] Create transparency examples

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/rendering/` (extend)

**Material Render State:**
```typescript
interface RenderState {
  // Blending
  blend: boolean;
  blendSrc: BlendFactor;          // 'src-alpha'
  blendDst: BlendFactor;          // 'one-minus-src-alpha'

  // Depth
  depthTest: boolean;             // true
  depthWrite: boolean;            // false for transparent
  depthCompare: CompareFunction;  // 'less'

  // Culling
  cullFace: CullMode;             // 'back', 'front', 'none'
  frontFace: FrontFace;           // 'ccw'
}
```

**Transparent vs Alpha-Test:**
```typescript
// Transparent: Alpha blending, no depth write, needs sorting
{
  blend: true,
  blendSrc: 'src-alpha',
  blendDst: 'one-minus-src-alpha',
  depthWrite: false,  // Important!
  depthTest: true
}

// Alpha-test: Cutout (discard), depth write, no sorting
{
  blend: false,
  depthWrite: true,
  depthTest: true,
  alphaTest: 0.5  // Threshold
}
```

**Sorting Implementation:**
```typescript
class RenderQueue {
  render() {
    // ... opaque and alpha-test ...

    // Transparent: Back-to-front
    this.transparent.sort((a, b) => b.depth - a.depth);

    for (const cmd of this.transparent) {
      // Configure blend state
      this.renderer.setBlendMode(cmd.material.blendSrc, cmd.material.blendDst);
      this.renderer.setDepthWrite(false);  // Don't write depth

      this.draw(cmd);
    }
  }
}
```

**Alpha-Test Fragment Shader:**
```wgsl
@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let color = textureSample(diffuseTexture, sampler, uv);

  // Alpha test: Discard if below threshold
  if (color.a < material.alphaTestThreshold) {
    discard;
  }

  return color;
}
```

**Depth Calculation:**
```typescript
function calculateDepth(transform: Mat4, camera: Camera): number {
  // Extract object position from transform
  const objectPos = transform.getTranslation();

  // Calculate distance to camera
  const cameraPos = camera.transform.position;
  return Vec3.distance(objectPos, cameraPos);
}
```

**Performance Targets:**
- Sorting: <1ms for 200 transparent objects
- No visual artifacts (correct ordering)
- Depth write: Disabled for transparent, enabled for alpha-test
- Blend configuration: Per material

#### Design Principles:
1. **Correct First**: Visual correctness over performance
2. **Back-to-Front**: Required for correct blending
3. **Alpha-Test When Possible**: Faster than blending
4. **Minimize Transparent**: Performance cost

#### Dependencies:
- Epic 3.12: Render Queue Organization (provides queue structure)
- Epic 3.3: Material System (provides render state)

**Deliverables:**
- Transparent sorting implementation
- Depth write configuration
- Blend mode configuration
- Alpha-test support
- Transparency documentation
- Best practices guide

---

### Epic 3.15: Light Component & Multi-Light Rendering

**Priority**: P1 - IMPORTANT (VISUAL QUALITY)
**Status**: Not Started

**Description**: Implement basic multi-light support with unified Light component system, material system refactor, and PBR shader integration. Replaces hardcoded single-light Blinn-Phong with production-ready multi-light PBR rendering.

**Current State**:
- Basic Blinn-Phong with single hardcoded directional light (Material.ts:270-280)
- PBR Cook-Torrance BRDF scaffolded but unused
- Epic 3.3 Material System does NOT support multi-light (hardcoded u_lightDirection in pbr.frag.glsl:40-42)
- No dynamic lights

**Target State**:
- Dynamic multi-light system with unified ECS Light component
- Directional, point, spot, and ambient light support (single component with type discriminator)
- Light prioritization (top 16 lights by contribution)
- Material system refactored for multi-light uniform buffers
- Full PBR integration with Cook-Torrance BRDF

**CRITICAL DEPENDENCIES**:
- **BLOCKING**: Epic 3.3 Material System must be retrofitted FIRST
  - MaterialManager.bindMaterial() must support LightData uniform buffer array
  - PBR shaders must accept light arrays, not single hardcoded light
  - Material system refactor required before starting Epic 3.15
- Epic 3.9: Shader System (shader management, variant compilation)
- Epic 3.10: Camera System (view/projection matrices)
- Epic 3.11: Transform System (world transforms for light positions)
- Epic 3.12: Render Queue Organization (opaque rendering pipeline)

---

#### User Stories (Light Component System):

1. **Unified Light Component** (CRITICAL FIX: Single component avoids archetype migration)
   - **As a** game developer
   - **I want** a single Light component with type discriminator
   - **So that** I can change light types without expensive archetype migrations

   **Tasks**:
   - [ ] Create unified `Light` component with type discriminator ('directional' | 'point' | 'spot' | 'ambient')
   - [ ] Add common properties: color, intensity
   - [ ] Add optional directional properties: direction
   - [ ] Add optional point/spot properties: position, radius
   - [ ] Add optional spot properties: spotAngle, spotPenumbra
   - [ ] Add light property validation (intensity > 0, normalized directions, NaN/Infinity checks)
   - [ ] Write component tests (60 tests including edge cases: zero radius, infinite radius, negative intensity)

2. **Light Collection & Prioritization System**
   - **As a** rendering system
   - **I want** efficient queries for active lights with prioritization
   - **So that** I can select top 16 lights by contribution when >16 lights exist

   **Tasks**:
   - [ ] Create `LightCollectorSystem` with ECS queries
   - [ ] Implement per-frame light gathering
   - [ ] Add light type filtering
   - [ ] Implement light prioritization (sort by intensity / distance²)
   - [ ] Add warning when light count exceeds 16
   - [ ] Create `LightData` uniform buffer structure
   - [ ] Write collection tests (40 tests including priority edge cases)

**Deliverables (Light Component System)**:
- Single unified Light component (avoids 4 separate types)
- Light collection system with prioritization
- 100 passing tests (including edge cases)
- Component documentation with type discriminator patterns

---

#### User Stories (Shader Integration & Material Refactor):

1. **Material System Multi-Light Support** (PREREQUISITE: Fix Epic 3.3)
   - **As a** rendering backend
   - **I want** MaterialManager to support light arrays
   - **So that** I can bind multi-light uniforms instead of hardcoded single light

   **Tasks**:
   - [ ] Refactor MaterialManager.bindMaterial() to accept LightData uniform buffer
   - [ ] Remove hardcoded u_lightDirection/u_lightColor/u_lightIntensity from Material.ts:270-280
   - [ ] Update pbr.frag.glsl:40-42 to use light array instead of single light
   - [ ] Write material system integration tests (20 tests)

2. **Multi-Light Shader Support with Ubershader**
   - **As a** rendering backend
   - **I want** shaders that support multiple lights with dynamic branching
   - **So that** I avoid 1,280 shader variant explosion

   **Tasks**:
   - [ ] Create `LightUniforms` buffer layout (max 16 lights)
   - [ ] Write WGSL/GLSL light evaluation functions with dynamic branching (avoid variants)
   - [ ] Implement directional light calculations
   - [ ] Implement point light calculations with attenuation
   - [ ] Implement spot light calculations with cone falloff
   - [ ] Add ambient light accumulation
   - [ ] Precompile ONLY 4 common variants (1 dir no shadow, 1 dir shadow, 4 point, 8 mixed)
   - [ ] Add 200ms stall warning for rare variant on-demand compilation
   - [ ] Write shader tests (50 tests)

3. **PBR Integration**
   - **As a** material system
   - **I want** PBR materials to respond to lights correctly
   - **So that** surfaces look physically accurate

   **Tasks**:
   - [ ] Integrate Cook-Torrance BRDF with light loop
   - [ ] Implement Fresnel-Schlick approximation per-light
   - [ ] Implement GGX normal distribution per-light
   - [ ] Implement Smith's geometry function per-light
   - [ ] Add energy conservation validation
   - [ ] Write PBR integration tests (30 tests)

**Deliverables (Shader Integration & Material Refactor)**:
- Material system refactored for multi-light support
- Multi-light ubershader (WGSL + GLSL) with dynamic branching
- 4 precompiled common variants (not 1,280)
- PBR integration with all light types
- 100 passing tests
- Shader variant documentation

---

#### Acceptance Criteria (Epic 3.15):
- Games can add/remove lights dynamically without performance hitches
- Scenes support 16+ lights with automatic prioritization
- PBR materials respond correctly to multiple light sources
- Material system no longer has hardcoded single-light limitation
- >85% test coverage
- All 200+ tests passing

---

### Epic 3.16: Light Culling & Optimization

**Priority**: P1 - IMPORTANT (PERFORMANCE)
**Status**: Not Started

**Description**: GPU-efficient light culling system for scalable multi-light rendering. Implements frustum culling for all backends and tile-based Forward+ culling for WebGPU compute shaders.

**Dependencies**:
- **BLOCKING**: Epic 3.15 (Light Component & Multi-Light Rendering)
- Epic 3.10: Camera System (frustum for culling)
- Epic 3.2: WebGPU Implementation (compute shader support)

---

#### User Stories:

1. **Frustum-Based Culling (All Backends)**
   - **As a** rendering system
   - **I want** lights culled against camera frustum
   - **So that** off-screen lights don't waste GPU time

   **Tasks**:
   - [ ] Create `LightCuller` class
   - [ ] Implement frustum-sphere intersection (point lights)
   - [ ] Implement frustum-cone intersection (spot lights)
   - [ ] Add per-frame culling pass (<1ms CPU target)
   - [ ] Write culling tests (60 tests including degenerate cases)
   - [ ] Edge case tests: light at camera position, light behind camera, zero/infinite radius, NaN/Infinity

2. **Tile-Based Culling (Forward+) - WebGPU ONLY**
   - **As a** rendering system
   - **I want** tile-based light assignment via compute shader
   - **So that** WebGPU can handle 16+ lights at 60 FPS

   **Tasks**:
   - [ ] Create screen-space tile grid (16x16 tiles)
   - [ ] Implement compute shader for light-tile intersection tests
   - [ ] Create per-tile light index buffer
   - [ ] Upload light indices to GPU
   - [ ] Modify WGSL shaders to use tile-based lookup
   - [ ] Write tile culling tests (50 tests)
   - [ ] Add stress test: 1000 lights culled to 16 per tile in <1ms

3. **WebGL2 Fallback Strategy**
   - **As a** WebGL2 backend
   - **I want** simple frustum culling without compute shaders
   - **So that** I avoid 2-3ms CPU overhead of CPU-side tile culling

   **Tasks**:
   - [ ] Detect backend type (WebGPU vs WebGL2)
   - [ ] WebGL2: Use frustum culling only (limit to 8 lights for performance)
   - [ ] WebGPU: Use compute-based Forward+ (supports 16+ lights)
   - [ ] Add backend capability detection
   - [ ] Write backend-specific tests (20 tests)

**Deliverables (Epic 3.16)**:
- Frustum culling system (all backends)
- Tile-based Forward+ culling (WebGPU compute shader)
- WebGL2 fallback (frustum only, 8-light limit)
- Backend capability documentation
- Performance documentation (WebGPU 16+ lights, WebGL2 8 lights @ 60 FPS)

**Acceptance Criteria (Epic 3.16)**:
- Off-screen lights culled correctly (no false negatives)
- WebGPU handles 16+ lights at 60 FPS via Forward+
- WebGL2 maintains 60 FPS with 8-light limit
- Culling completes in <1ms CPU time
- Stress test: 1000 lights culled to 16 per tile in <1ms
- >85% test coverage
- All 130+ tests passing (including edge cases: NaN, infinity, zero radius)

---

### Epic 3.17: Shadow Mapping System

**Priority**: P1 - IMPORTANT (VISUAL QUALITY)
**Status**: Not Started

**Description**: Production-ready shadow system with atlas optimization. Implements cascaded shadow maps for directional lights, cubemap shadows for point lights, and spot light shadows with configurable quality tiers.

**Dependencies**:
- **BLOCKING**: Epic 3.15 (Light Component & Multi-Light Rendering)
- Epic 3.10: Camera System (view matrices for shadow cameras)
- Epic 3.12: Render Queue Organization (depth-only render pass)

---

#### User Stories:

1. **Shadow Map Atlas** (CRITICAL: Avoid texture unit exhaustion)
   - **As a** rendering system
   - **I want** single shadow atlas texture for all shadow maps
   - **So that** I use 2 texture bindings instead of 12 (WebGL2 has 16-unit limit)

   **Tasks**:
   - [ ] Create shadow map atlas (4096x4096 R32F texture)
   - [ ] Allocate atlas regions: directional CSM (3 cascades @ 1024x1024 = 3MB)
   - [ ] Allocate atlas regions: point cubemaps (4 lights @ 256x256x6 = 1.5MB)
   - [ ] Allocate atlas regions: spot shadows (4 lights @ 512x512 = 1MB)
   - [ ] Total atlas memory: 5.5MB (vs 27MB in original plan - 80% reduction)
   - [ ] Implement atlas UV mapping and region management
   - [ ] Write atlas tests (30 tests)

2. **Directional Shadows with CSM**
   - **As a** game developer
   - **I want** directional lights to cast shadows
   - **So that** outdoor scenes have realistic sunlight shadows

   **Tasks**:
   - [ ] Create `ShadowMapRenderer` class
   - [ ] Implement depth-only render pass
   - [ ] Implement light-space matrix calculation
   - [ ] Add shadow map sampling in fragment shader
   - [ ] Implement PCF 2x2 filtering (4 samples, not 16 - 75% reduction)
   - [ ] Implement shadow bias configuration (depth bias, normal offset, slope-scaled)
   - [ ] Add bias visualization debug mode
   - [ ] Write shadow map tests (50 tests including bias edge cases)

3. **Cascaded Shadow Maps (CSM) - 3 Cascades**
   - **As a** rendering system
   - **I want** multiple shadow cascades
   - **So that** shadows are detailed near camera and cover large distances

   **Tasks**:
   - [ ] Create cascade split calculation (3 cascades @ 1024x1024 - optimized for mid-range GPU)
   - [ ] Implement per-cascade view-projection matrices
   - [ ] Create shadow map array in atlas (3x 1024x1024 = 4.1MB vs 16.7MB - 75% reduction)
   - [ ] Implement cascade selection in fragment shader (50+ lines, not 1 line)
   - [ ] Implement cascade blending at boundaries (10% soft overlap to prevent seams)
   - [ ] Implement cascade jitter stabilization (snap to texel grid to prevent swimming)
   - [ ] Add cascade debug visualization (color overlay showing splits)
   - [ ] Write CSM tests (60 tests including blend and stabilization)

4. **Point Light Shadows (Cubemap) - Atlas Packed**
   - **As a** game developer
   - **I want** point lights to cast shadows
   - **So that** indoor scenes with lamps have realistic shadows

   **Tasks**:
   - [ ] Create cubemap shadow regions in atlas (256x256x6 per light, max 4 lights)
   - [ ] Implement 6-face depth rendering
   - [ ] Add omnidirectional shadow sampling
   - [ ] Implement PCF 2x2 for cubemaps (4 samples)
   - [ ] Add shadow bias for point lights (default: 0.1)
   - [ ] Write cubemap shadow tests (40 tests)

5. **Spot Light Shadows - Atlas Packed**
   - **As a** game developer
   - **I want** spot lights to cast shadows
   - **So that** flashlights and focused lights have realistic shadows

   **Tasks**:
   - [ ] Create spot shadow regions in atlas (512x512 per light, max 4 lights)
   - [ ] Implement spot light-space matrix
   - [ ] Add spot shadow sampling
   - [ ] Implement PCF 2x2 for spot lights
   - [ ] Add shadow bias for spot lights (default: 0.005)
   - [ ] Write spot shadow tests (30 tests)

6. **Shadow Quality Tiers** (Mid-range & Integrated GPU Support)
   - **As a** game developer
   - **I want** configurable shadow quality levels
   - **So that** integrated GPUs can run at 60 FPS

   **Tasks**:
   - [ ] Implement HIGH quality (current spec: 5.5MB atlas, 4 shadowed lights)
   - [ ] Implement MEDIUM quality (default: 3 cascades @ 512x512, 2 shadowed point lights = 2MB)
   - [ ] Implement LOW quality (integrated GPU: single 512x512 directional shadow = 0.5MB)
   - [ ] Add runtime quality switching
   - [ ] Write quality tier tests (20 tests)

**Deliverables (Epic 3.17)**:
- Shadow map atlas system (2 texture bindings, not 12)
- Directional CSM (3 cascades @ 1024x1024 = 4.1MB)
- Point cubemap shadows (4 lights @ 256x256x6 = 1.5MB)
- Spot shadows (4 lights @ 512x512 = 1MB)
- PCF 2x2 filtering (4 samples, not 16)
- Shadow bias configuration (depth, normal offset, slope-scaled)
- CSM cascade blending and stabilization
- Shadow quality tiers (HIGH/MEDIUM/LOW)
- Shadow quality and atlas documentation

**Acceptance Criteria (Epic 3.17)**:
- Directional lights cast CSM shadows (3 cascades, no swimming artifacts)
- Point lights cast omnidirectional shadows (4 shadowed lights max)
- Spot lights cast cone shadows (4 shadowed lights max)
- Shadow atlas uses only 2 texture bindings (not 12)
- Total atlas memory ≤ 5.5MB (HIGH quality)
- Cascade blending prevents visible seams
- Jitter stabilization prevents shadow swimming
- Shadow bias prevents acne on grazing angles
- Mid-range GPU (RTX 3060) maintains 60 FPS with 4 shadowed lights
- Integrated GPU (Intel Iris Xe) maintains 60 FPS with LOW quality tier
- >85% test coverage
- All 230+ tests passing

---

### Epic 3.18: Lighting System Polish & Integration

**Priority**: P2 - NICE TO HAVE (DEVELOPER EXPERIENCE)
**Status**: Not Started

**Description**: Performance validation, utilities, and demo integration for the complete lighting system. Provides animation components, debug visualization tools, and comprehensive benchmarking across hardware tiers.

**Dependencies**:
- **BLOCKING**: Epic 3.15 (Light Component)
- **BLOCKING**: Epic 3.16 (Light Culling)
- **BLOCKING**: Epic 3.17 (Shadow Mapping)
- Epic 3.7: Renderer Integration & Demo Scene (demo updates)

---

#### User Stories:

1. **Comprehensive Performance Validation** (5 Configurations)
   - **As a** developer
   - **I want** lighting to meet performance budgets across real-world scenarios
   - **So that** games maintain 60 FPS with complex lighting

   **Tasks**:
   - [ ] Benchmark configuration 1: Best case (1 directional, no shadows) - target 60 FPS
   - [ ] Benchmark configuration 2: Typical (1 directional + 8 point + 2 spot, all shadowed) - target 60 FPS
   - [ ] Benchmark configuration 3: Heavy (16 point lights, 4 shadowed) - target 60 FPS WebGPU
   - [ ] Benchmark configuration 4: Pathological (1 directional + 100 point, culled to 16 visible) - target 60 FPS
   - [ ] Benchmark configuration 5: Stress test (1000 point lights with tile culling) - measure culling perf
   - [ ] Validate on mid-range GPU (RTX 3060 / RX 6600)
   - [ ] Validate on integrated GPU (Intel Iris Xe) with LOW quality tier
   - [ ] Profile GPU time for lighting pass (<4ms target)
   - [ ] Profile CPU time for culling (<1ms target)
   - [ ] Optimize hot paths if needed
   - [ ] Write performance tests (30 tests covering all 5 configurations)

2. **Light Animation Utilities**
   - **As a** game developer
   - **I want** pre-built light animation components
   - **So that** I can easily create dynamic lighting effects

   **Tasks**:
   - [ ] Create `FlickeringLight` component (for torches/campfires)
   - [ ] Create `PulsingLight` component (for alarms/warnings)
   - [ ] Create `OrbitingLight` component (for rotating lights)
   - [ ] Write animation component tests (15 tests)

3. **Debug Visualization**
   - **As a** developer
   - **I want** visual debugging tools for lighting
   - **So that** I can diagnose performance and quality issues

   **Tasks**:
   - [ ] Add light bounding volume rendering (spheres for point, cones for spot)
   - [ ] Add shadow frustum visualization
   - [ ] Add light intensity heatmaps
   - [ ] Add tile culling debug view (show which tiles have which lights)
   - [ ] Add cascade split visualization (color overlay)
   - [ ] Write debug visualization tests (10 tests)

4. **Demo Integration**
   - **As a** demo user
   - **I want** lighting showcase in demos
   - **So that** I can see the lighting system capabilities

   **Tasks**:
   - [ ] Update dice demo with 8 dynamic lights (4 point, 2 spot, 1 directional, 1 ambient)
   - [ ] Add light movement/animation using animation components
   - [ ] Add shadow visualization
   - [ ] Create dedicated lighting demo scene
   - [ ] Add quality tier UI toggle (HIGH/MEDIUM/LOW)
   - [ ] Write demo documentation

**Deliverables (Epic 3.18)**:
- Performance benchmarks (5 configurations: best/typical/heavy/pathological/stress)
- Validated on mid-range GPU (RTX 3060 / RX 6600) AND integrated GPU (Intel Iris Xe)
- Light animation components (FlickeringLight, PulsingLight, OrbitingLight)
- Debug visualization tools (volumes, frustums, heatmaps, tile culling, cascades)
- Updated demos with 8+ dynamic lights
- Quality tier UI toggle (HIGH/MEDIUM/LOW)
- Final performance analysis documentation

**Acceptance Criteria (Epic 3.18)**:
- All 5 benchmark configurations meet 60 FPS target on mid-range GPU
- Integrated GPU (Intel Iris Xe) achieves 60 FPS with LOW quality tier
- Lighting pass GPU time <4ms
- Culling CPU time <1ms
- Dice demo showcases 8 dynamic lights with shadows
- Debug tools visualize light volumes, shadow frustums, tile assignments, cascades
- >80% test coverage
- All 55+ tests passing

---

## Technical Specifications (Epics 3.15-3.18)

### Light Component (Unified Design):
```typescript
type LightType = 'directional' | 'point' | 'spot' | 'ambient';

interface Light {
  type: LightType;
  color: [number, number, number];
  intensity: number;

  // Directional only
  direction?: [number, number, number];

  // Point/Spot only
  position?: [number, number, number];
  radius?: number;

  // Spot only
  spotAngle?: number;      // Inner cone angle (radians)
  spotPenumbra?: number;   // Outer cone angle (radians)

  // Shadow configuration
  castsShadows?: boolean;
  shadowBias?: number;
}
```

**Light Uniform Buffer Layout**:
```rust
struct Light {
    type: u32,           // 0=directional, 1=point, 2=spot, 3=ambient
    position: vec3<f32>, // point/spot
    direction: vec3<f32>, // directional/spot
    color: vec3<f32>,
    intensity: f32,
    radius: f32,         // point/spot
    spotAngle: f32,      // spot inner angle
    spotPenumbra: f32,   // spot outer angle
    shadowMapIndex: i32, // -1 if no shadows, else atlas region index
    shadowBias: f32,
    padding: vec2<f32>
}

struct LightData {
    lights: array<Light, 16>,
    lightCount: u32,
    ambientColor: vec3<f32>
}
```

**Shadow Map Atlas Configuration** (CRITICAL: 2 bindings, not 12):
- **Atlas Size**: 4096x4096 R32F (single texture)
- **Total Memory**: 5.5MB (vs 27MB in naive approach - 80% reduction)

**Atlas Regions**:
- **Directional CSM**: 3 cascades @ 1024x1024 = 3.1MB (75% reduction from 4x2048x2048)
- **Point Cubemaps**: 4 lights @ 256x256x6 = 1.5MB (75% reduction from 512x512x6)
- **Spot Shadows**: 4 lights @ 512x512 = 1MB (75% reduction from 1024x1024)

**Shadow Quality Tiers**:
- **HIGH** (desktop): 5.5MB atlas, 4 shadowed lights, PCF 2x2
- **MEDIUM** (default): 2MB atlas, 2 shadowed lights, CSM @ 512x512, PCF 2x2
- **LOW** (integrated GPU): 0.5MB, single 512x512 directional shadow, no PCF

**Shadow Filtering**:
- **PCF 2x2**: 4 texture samples (not 16 - 75% reduction)
- **Rotated Poisson disk**: 2x2 kernel with rotation for temporal AA
- **Optional PCSS**: Percentage-closer soft shadows (HIGH quality only)

**Shadow Bias Configuration**:
- **Depth bias**: 0.005 (directional), 0.1 (point), 0.005 (spot)
- **Normal offset**: 0.01 (configurable per light)
- **Slope-scaled bias**: enabled (prevents acne on grazing angles)
- **Bias visualization**: debug mode to see bias application

**Light Culling**:
- **WebGPU**: Compute shader Forward+ (16x16 tile grid, supports 16+ lights)
- **WebGL2**: Frustum culling only (8-light limit for performance)
- **CPU overhead target**: <1ms per frame
- **Stress test**: 1000 lights culled to 16 per tile in <1ms

**Performance Targets**:
- **WebGPU**: 16 lights @ 60 FPS (mid-range GPU: RTX 3060 / RX 6600)
- **WebGL2**: 8 lights @ 60 FPS (mid-range GPU)
- **Integrated GPU**: 4 lights @ 60 FPS (Intel Iris Xe with LOW quality)
- **Shadowed lights**: 4 shadowed @ 60 FPS (1 directional CSM, 3 point/spot)
- **Light culling**: <1ms CPU overhead
- **Shadow rendering**: <4ms GPU time (including atlas updates)

**Shader Variant Strategy** (Avoid 1,280 variant explosion):
- **Ubershader**: Dynamic branching for shadow types
- **Precompiled variants**: ONLY 4 common configurations
  1. 1 directional (no shadows)
  2. 1 directional (with CSM shadows)
  3. 4 point lights (no shadows)
  4. 8 mixed lights (with shadows)
- **On-demand compilation**: Rare variants with 200ms stall warning
- **Estimated memory**: 200KB (vs 64MB for all variants - 99.7% reduction)

### Testing Requirements (Total: 615+ tests across Epics 3.15-3.18):
- **Epic 3.15**: 200+ tests (Component: 60, Collection: 40, Material refactor: 20, Shader integration: 50, PBR integration: 30)
- **Epic 3.16**: 130+ tests (Frustum culling: 60, Forward+ tile culling: 50, WebGL2 fallback: 20)
- **Epic 3.17**: 230+ tests (Shadow atlas: 30, Directional shadows: 50, CSM: 60, Point shadows: 40, Spot shadows: 30, Quality tiers: 20)
- **Epic 3.18**: 55+ tests (Performance: 30, Animation components: 15, Debug visualization: 10)
- **Visual tests**: Shadow map validation, PBR correctness, cascade blending
- **Performance tests**: 5 benchmark configurations (best/typical/heavy/pathological/stress)
- **Hardware validation**: Mid-range GPU (RTX 3060), Integrated GPU (Intel Iris Xe)
- **Coverage target**: >85% (Epics 3.15-3.17), >80% (Epic 3.18)

---

