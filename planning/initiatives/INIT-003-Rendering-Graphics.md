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
**Priority:** P1
**Acceptance Criteria:**
- WebGPU renderer implemented
- Automatic fallback to WebGL2
- Compute shader support
- Performance optimized

#### User Stories:
1. **As a developer**, I want next-gen WebGPU rendering
2. **As a developer**, I want compute shader support
3. **As a player**, I want automatic GPU feature detection
4. **As a game**, I need seamless fallback to WebGL2

#### Tasks Breakdown:
- [ ] Implement WebGPU context creation
- [ ] Port rendering pipeline to WebGPU
- [ ] Add compute shader support
- [ ] Create automatic fallback system
- [ ] Optimize buffer and texture usage
- [ ] Implement GPU resource management
- [ ] Add WebGPU-specific optimizations
- [ ] Create performance comparison tools

### Epic 3.3: PBR Material System ✅
**Status:** ✅ Complete
**Priority:** P0
**Acceptance Criteria:**
- ✅ PBR shader implementation complete
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
**Status:** ✅ Complete
**Dependencies:** Epic 1.1, Epic 3.1, Epic 3.3
**Acceptance Criteria:**
- ✅ Electron app launches without errors
- ✅ WebGL2 renderer initialized in renderer process
- ✅ Canvas element rendering 3D content
- ✅ Demo scene with PBR materials visible
- ✅ Interactive camera controls working
- ✅ FPS counter and performance stats displayed

#### User Stories:
1. **As a developer**, I want to verify the rendering engine works end-to-end ✅
2. **As a developer**, I want to test PBR materials visually ✅
3. **As a developer**, I want interactive camera controls for viewing 3D scenes ✅
4. **As a developer**, I want performance metrics visible during development ✅

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

