# Initiative 3: Rendering & Graphics (INIT-003)

**Dependencies:** INIT-002  
**Outcome:** Modern rendering pipeline with WebGPU  
**Status:** Foundation Complete, Advanced Features In Progress

---

## Completed Epics

### ✅ Epic 3.1: Rendering Pipeline Foundation
**Status:** COMPLETE  
**Priority:** P0

**Deliverables:**
- WebGPU renderer with command buffers
- Draw call batching and multi-pass rendering
- Render state caching and statistics
- Comprehensive shader, texture, and buffer management

**Critical Fixes:**
- Event listener memory leak (CRITICAL)
- Shader detachment memory leak (CRITICAL)
- Vertex attribute setup (was missing - CRITICAL)
- O(n) buffer lookup (performance - CRITICAL)
- Added bounded resource limits with LRU eviction
- Added flexible index types (uint8, uint16, uint32)

### ✅ Epic 3.2: WebGPU Implementation
**Status:** COMPLETE (January 2026)  
**Priority:** P1

**Deliverables:**
- WebGPU backend with compute shader support
- Automatic WebGL2 fallback
- Backend abstraction layer (IRendererBackend)
- Opaque resource handles (no backend leakage)

**Browser Support:**
- WebGPU: Chrome 113+, Safari 26+, Firefox 141+
- WebGL2: Universal

**Architecture:**
- Command-based rendering (no immediate mode)
- Automatic capability detection
- Graceful degradation (WebGPU → WebGL2 → error)

### ✅ Epic 3.3: PBR Material System
**Status:** COMPLETE  
**Priority:** P0

**Deliverables:**
- Cook-Torrance BRDF implementation
- PBR material properties (baseColor, metallic, roughness)
- Material textures (baseColorMap, metallicRoughnessMap, normalMap)
- MaterialManager with validation
- Default material fallback system

**Shader Features:**
- Physically-based Cook-Torrance specular BRDF
- Lambertian diffuse with energy conservation
- Normal mapping with TBN matrix
- Metallic/roughness workflow
- Tone mapping and gamma correction

**Deferred to Epic 3.6:**
- Material batching and instancing
- IBL (Image-Based Lighting)
- Material LOD system
- Material editor UI
- Hot-reload functionality

### ✅ Epic 3.7: Renderer Integration & Demo Scene
**Status:** COMPLETE  
**Priority:** P0  
**Dependencies:** Epic 1.1, Epic 3.1, Epic 3.3

**Deliverables:**
- Electron app with WebGPU renderer
- Demo scene with PBR materials
- Interactive camera controls (orbit)
- FPS counter and performance stats
- Basic geometry primitives (cube, sphere, plane)
- Blinn-Phong lighting demo

### ✅ Epic 3.8: GPU Memory Management
**Status:** COMPLETE (Nov 11, 2025)  
**Priority:** P1 - IMPORTANT  
**Dependencies:** Epic 3.1, Epic 2.13

**Problem:** GPU/VRAM management critical for rendering performance but not explicitly planned. Without buffer pooling and texture atlasing, excessive reallocation and VRAM exhaustion risks.

**Deliverables:**
- GPUBufferPool (367 lines, 90.9% tests passing)
  - Power-of-2 bucketing (256B - 2MB)
  - Device loss handling
  - <3 buffer reallocations/frame (exceeded <5 target by 40%)
- TextureAtlas (309 lines, 100% tests passing)
  - MaxRects bin-packing algorithm
  - Defragmentation support
  - >90% coverage
- VRAMProfiler (369 lines, 100% tests passing)
  - Real-time allocation tracking
  - Budget warnings at 90% threshold
  - 256MB target budget
- WebGPU backend integration

**Performance Achieved:**
- Buffer reallocation: <3/frame (40% better than target)
- Test coverage: 239/264 passing (90.5%)
- VRAM budgets: Textures 128MB, Buffers 64MB, Render Targets 48MB

### ✅ Epic 3.9: Shader Management System
**Status:** COMPLETE (December 2025)  
**Priority:** P0 - CRITICAL  
**Dependencies:** Epic 3.1

**Deliverables:**
- Hot-reload with file watching (<100ms)
- Include system with circular dependency detection
- WGSL shader support
- Compilation error reporting
- LRU shader cache (max 1000 programs)

### ✅ Epic 3.10: Camera System
**Status:** COMPLETE  
**Priority:** P0  
**Tests:** 52 passing

**Deliverables:**
- ECS Camera component
- Perspective and orthographic projection
- View/projection matrix generation
- Orbit camera controller (third-person)
- First-person camera controller
- Smooth camera interpolation

### ✅ Epic 3.11: Transform System
**Status:** COMPLETE  
**Priority:** P0  
**Memory:** ~185 bytes per transform

**Deliverables:**
- Cache-efficient SoA matrix storage
- Hierarchical transforms with linked list
- Zero-allocation matrix operations
- Local-to-world transformation propagation

### ✅ Epic 3.12: Render Queue
**Status:** COMPLETE  
**Priority:** P0  
**Tests:** 35 passing  
**Performance:** <1ms sorting for 1000 objects

**Deliverables:**
- Opaque/transparent/alpha-test material sorting
- Front-to-back optimization for opaque
- Back-to-front sorting for transparency
- State change minimization through grouping

### ✅ Epic 3.13: Draw Call Batching & Instancing
**Status:** COMPLETE  
**Priority:** P0  
**Tests:** 264 passing  
**Performance:** 96.7% draw call reduction (60 objects → 2 calls)

**Deliverables:**
- Instance buffer management
- GPU instancing support
- Automatic instance detection and grouping
- Material state hashing (shader + textures + render state)
- Dynamic instance buffer resizing

---

## In Progress Epics

### 🚧 Epic 3.14-3.15: Advanced Rendering
**Status:** Partially Complete  
**Priority:** P0 - HIGH PRIORITY  
**Dependencies:** Epic 3.1-3.3, 3.9-3.13 ✅

**Completed:**
- Transparency sorting (Epic 3.12)

**Remaining:**
- Multi-light system with Forward+ culling
- Shadow mapping with cascaded shadow maps
- PBR lighting integration
- Performance target: <5ms lighting pass with 100+ lights

**User Stories:**
1. As a player, I want dynamic shadows
2. As a developer, I want multiple light sources
3. As a game, I need efficient lighting with 100+ lights
4. As a player, I want realistic PBR lighting

---

## Planned Epics

### 📋 Epic 3.4: Advanced Rendering Features
**Priority:** P1  
**Dependencies:** Epic 3.14-3.15

**Acceptance Criteria:**
- Post-processing pipeline complete
- LOD system working
- Screen-space effects (SSAO, SSR)
- Temporal anti-aliasing
- Quality preset system

### 📋 Epic 3.5: Culling & Optimization
**Priority:** P1  
**Dependencies:** Epic 3.1-3.3 ✅

**Acceptance Criteria:**
- Frustum culling with SIMD
- GPU-based occlusion culling
- Octree/BVH spatial structures
- Visibility buffer optimization
- LOD-based culling

### 📋 Epic 3.6: Advanced Material Features
**Priority:** P2  
**Status:** Deferred from Epic 3.3

**Acceptance Criteria:**
- Material batching and instancing
- IBL (Image-Based Lighting)
- Material LOD system
- Material editor UI
- Hot-reload functionality

### 📋 Epic 3.7 Extensions: Post-Processing
**Priority:** P2  
**Dependencies:** Epic 3.1 ✅

**Acceptance Criteria:**
- Bloom, tone mapping, color grading
- SSAO (Screen-Space Ambient Occlusion)
- Depth of field and motion blur
- Anti-aliasing (FXAA, TAA)

### 📋 Epic 3.8 Extensions: Particle System
**Priority:** P1  
**Dependencies:** Epic 3.1 ✅, Epic 3.13 ✅

**Acceptance Criteria:**
- GPU-based particle simulation
- Particle emitters and forces
- Texture atlas support
- Performance: 100k+ particles at 60 FPS

---

## Lighting System (Epics 3.15-3.18) - Detailed Plan

### Epic 3.15: Light Component & Integration
**Status:** 🚧 PLANNED  
**Priority:** P0 - BLOCKING  
**Dependencies:** Epic 3.3 (PBR) ✅

**Unified Light Design:**
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
  spotAngle?: number;
  spotPenumbra?: number;

  // Shadow configuration
  castsShadows?: boolean;
  shadowBias?: number;
}
```

**Deliverables:**
- Light ECS component (directional, point, spot, ambient)
- LightCollection manager
- Material system integration (add light uniforms)
- PBR shader updates (multiple light support)
- Tests: 200+ (Component: 60, Collection: 40, Integration: 100)

### Epic 3.16: Light Culling
**Status:** 📋 PLANNED  
**Priority:** P0 - BLOCKING  
**Dependencies:** Epic 3.15

**Deliverables:**
- WebGPU: Forward+ tile culling (16x16 grid, compute shader)
- WebGL2: Frustum culling (8-light limit)
- CPU overhead target: <1ms per frame
- Stress test: 1000 lights culled to 16 per tile
- Tests: 130+ (Frustum: 60, Forward+: 50, Fallback: 20)

**Performance Targets:**
- WebGPU: 16 lights @ 60 FPS
- WebGL2: 8 lights @ 60 FPS
- Integrated GPU: 4 lights @ 60 FPS

### Epic 3.17: Shadow Mapping
**Status:** 📋 PLANNED  
**Priority:** P0 - BLOCKING  
**Dependencies:** Epic 3.15, Epic 3.16

**Shadow Map Atlas (CRITICAL: 2 bindings, not 12):**
- Atlas Size: 4096x4096 R32F (5.5MB vs 27MB naive - 80% reduction)
- Directional CSM: 3 cascades @ 1024x1024 (3.1MB, 75% reduction)
- Point Cubemaps: 4 lights @ 256x256x6 (1.5MB, 75% reduction)
- Spot Shadows: 4 lights @ 512x512 (1MB, 75% reduction)

**Shadow Quality Tiers:**
- HIGH (desktop): 5.5MB atlas, 4 shadowed lights, PCF 2x2
- MEDIUM (default): 2MB atlas, 2 shadowed lights, PCF 2x2
- LOW (integrated): 0.5MB, single 512x512 directional, no PCF

**Shadow Filtering:**
- PCF 2x2 (4 samples, not 16 - 75% reduction)
- Rotated Poisson disk for temporal AA
- Optional PCSS (HIGH quality only)

**Deliverables:**
- Shadow atlas management
- Directional shadows with CSM (3 cascades)
- Point light shadows (cubemaps)
- Spot light shadows
- Quality tier system
- Tests: 230+ (Atlas: 30, Directional: 50, CSM: 60, Point: 40, Spot: 30, Quality: 20)

**Performance Target:** <4ms GPU time for shadow rendering

### Epic 3.18: Lighting Performance & Utilities
**Status:** 📋 PLANNED  
**Priority:** P0  
**Dependencies:** Epic 3.15, 3.16, 3.17

**Deliverables:**
- Performance validation (5 benchmark configurations)
- Light animation components (Flickering, Pulsing, Orbiting)
- Debug visualization (volumes, frustums, heatmaps, tiles, cascades)
- Demo integration (8+ dynamic lights with shadows)
- Quality tier UI toggle

**Performance Benchmarks:**
1. Best case: 1 directional, no shadows (60 FPS)
2. Typical: 1 directional + 8 point + 2 spot, all shadowed (60 FPS)
3. Heavy: 16 point, 4 shadowed (60 FPS WebGPU)
4. Pathological: 1 directional + 100 point, culled to 16 (60 FPS)
5. Stress: 1000 point with tile culling (measure perf)

**Hardware Validation:**
- Mid-range GPU: RTX 3060 / RX 6600
- Integrated GPU: Intel Iris Xe (LOW quality)

**Tests:** 55+ (Performance: 30, Animation: 15, Debug: 10)

**Performance Targets:**
- Lighting pass: <4ms GPU
- Culling: <1ms CPU
- 60 FPS on mid-range GPU
- 60 FPS on integrated GPU (LOW quality)

---

## Technical Specifications

### Shader Variant Strategy
**Problem:** Avoid 1,280 variant explosion

**Solution:**
- Ubershader: Dynamic branching for shadow types
- Precompiled variants: ONLY 4 common configurations
  1. 1 directional (no shadows)
  2. 1 directional (with CSM)
  3. 4 point lights (no shadows)
  4. 8 mixed lights (with shadows)
- On-demand compilation: Rare variants (200ms stall warning)
- Memory: 200KB (vs 64MB for all variants - 99.7% reduction)

### Testing Requirements
**Total: 615+ tests across Epics 3.15-3.18**
- Epic 3.15: 200+ tests
- Epic 3.16: 130+ tests
- Epic 3.17: 230+ tests
- Epic 3.18: 55+ tests
- Coverage target: >85% (Epics 3.15-3.17), >80% (Epic 3.18)

### Performance Budgets
- Frame Rate: 60 FPS target / 30 FPS minimum
- Draw Calls: 500 target / 1000 maximum
- Lighting Pass: <5ms target (WebGPU: <4ms)
- Shadow Rendering: <4ms target
- Light Culling: <1ms CPU target
- VRAM Usage: <256MB typical scene

---

## Known Issues & Blockers

### 🔴 Epic 3.14-3.15: Advanced Rendering (HIGH PRIORITY)
- **Blocker:** Multi-light system and shadow mapping not yet implemented
- **Impact:** Games limited to basic lighting
- **Resolution:** Complete Epics 3.15-3.18
- **Timeline:** Q1 2025

---

## Key Documentation

- **[DEVELOPMENT_PLAN.md](../DEVELOPMENT_PLAN.md)** - Detailed epic breakdowns
- **[EPIC_PROGRESS.md](../EPIC_PROGRESS.md)** - Status tracking
- **[HLD.md](../HLD.md)** - Rendering architecture
- **packages/rendering/README.md** - Package documentation

---

## Update History

- **January 2026** - Epic 3.2 (WebGPU Implementation) completed
- **December 2025** - Epic 3.9 (Shader Management) completed
- **November 2025** - Epic 3.8 (GPU Memory Management) completed
- **November 2025** - Epic 3.13 (Batching/Instancing) completed
- **October 2025** - Epics 3.10-3.12 (Camera, Transform, Render Queue) completed
- **September 2025** - Epic 3.7 (Integration & Demo) completed
- **August 2025** - Epic 3.3 (PBR Materials) completed
- **July 2025** - Epic 3.1 (Rendering Pipeline) completed
