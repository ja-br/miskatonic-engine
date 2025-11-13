# Epic 3.19: Lighting Demo Application (Vite-Based)

**Initiative:** INIT-003 - Rendering & Graphics
**Status:** Not Started
**Priority:** P1
**Dependencies:** Epic 3.14 (Modern Rendering API), Epic 3.15 (Light Component & Integration), Epic 3.16 (Light Culling), Epic 3.17 (Shadow Mapping), Epic 3.18 (Performance & Utilities)
**Estimated Duration:** 12-15 days (2.5-3 weeks)

---

## Problem Statement

The current lighting demo (`packages/renderer/src/lighting-demo.ts`) is fundamentally broken with 22+ critical issues:

1. **Complete System Duplication**: Re-implements geometry creation, camera, light management instead of using existing systems
2. **ECS Violations**: Direct access to private internals (`world['archetypeManager']`)
3. **Epic 3.14-3.18 Ignorance**: Doesn't use any of the Modern Rendering API infrastructure
4. **Data Structure Mismatches**: TypeScript interfaces don't match WGSL shader structures
5. **Performance Disasters**: Per-entity buffer allocations, synchronous updates, no pooling
6. **Missing Implementations**: TODOs everywhere, no rotation support, hardcoded canvas size
7. **False Advertising**: Promises animations but provides static lights

We need to **completely rewrite** the lighting demo in `packages/renderer/` as a Vite-based demo page that:
- Properly integrates with existing Vite dev server (like `joints.html`)
- Leverages all Epic 3.14-3.18 infrastructure without duplication
- Follows proper ECS patterns and public APIs
- Showcases 100+ dynamic lights with excellent performance
- Demonstrates all lighting features: directional, point, spot, shadows, culling, animations

This will serve as both a technical validation of the lighting system and a reference implementation for game developers.

---

## Acceptance Criteria

### Application Architecture
- [ ] Vite-based demo page in `packages/renderer/`
- [ ] Accessed via: `http://localhost:5173/lighting-demo.html`
- [ ] Uses existing Vite dev server and hot-reload infrastructure
- [ ] No code duplication with existing engine packages
- [ ] Follows same patterns as `joints.html` demo

### Epic 3.14-3.18 Integration
- [ ] Uses `LightCollection` and `LightSystem` for light management (not direct ECS queries)
- [ ] Uses `RenderQueue` and `RenderPassManager` for rendering pipeline
- [ ] Uses `OrbitCameraController` for camera controls (NOT custom CameraControlSystem)
- [ ] Uses `GPUBufferPool` for memory management
- [ ] Uses `VRAMProfiler` for performance tracking
- [ ] Uses `FlickeringLightSystem`, `PulsingLightSystem`, `OrbitingLightSystem` for animations
- [ ] Uses `DemoUI` component for user interface
- [ ] Uses Epic 3.14 Modern Rendering API (storage buffers, bind groups, compute pipelines)

### Lighting Features Demonstrated
- [ ] 1 directional light with CSM shadows (sun/moon)
- [ ] 8+ point lights with dynamic shadows and cubemap rendering
- [ ] 2+ spot lights with projected shadows
- [ ] 1 ambient light for fill lighting
- [ ] 20+ flickering lights (torches, fire)
- [ ] 20+ pulsing lights (magic orbs, indicators)
- [ ] 10+ orbiting lights (celestial bodies, patrol patterns)
- [ ] Total: 100+ dynamic lights with good performance (60 FPS target)

### Interactive Features
- [ ] Quality tier switching (LOW/MEDIUM/HIGH) via UI
- [ ] Debug visualization cycling (F3 key, dropdown)
- [ ] Real-time performance metrics display
- [ ] Camera controls (orbit, pan, zoom) via existing `OrbitCameraController`
- [ ] Light property adjustment (intensity, color, radius)
- [ ] Shadow quality toggling per light type

### Performance Targets
- [ ] 60 FPS on mid-range GPU (RTX 3060) at HIGH quality
- [ ] 30 FPS minimum on integrated GPU (Intel Iris Xe) at LOW quality
- [ ] <4ms GPU time for shadow rendering
- [ ] <1ms for light culling (CPU or GPU)
- [ ] <3ms for lighting pass
- [ ] <256MB VRAM usage at HIGH quality

### Scene Composition
- [ ] Ground plane with PBR material
- [ ] 10+ props (cubes, spheres, cylinders) for shadow receivers
- [ ] Light volume visualization (debug mode)
- [ ] Shadow cascade frustum visualization (debug mode)
- [ ] Tile culling heatmap (debug mode)

### Code Quality
- [ ] No access to private internals (no `world['archetypeManager']`)
- [ ] No direct ECS queries (use `LightSystem.getPointLights()` etc.)
- [ ] No code duplication with engine packages
- [ ] Proper ECS patterns (components, systems, queries)
- [ ] Type-safe throughout (no `as any`)
- [ ] >80% test coverage for application logic

### Documentation
- [ ] Code comments explaining Epic 3.14-3.18 API usage
- [ ] HTML page with usage instructions overlay
- [ ] Performance tuning guide in comments

---

## Technical Design

### File Structure (Vite-Based)

```
packages/renderer/
├── lighting-demo.html              # REPLACE existing broken demo
├── src/
│   ├── lighting-demo.ts            # REPLACE main entry point
│   ├── lighting-demo/              # NEW organized demo code
│   │   ├── LightingDemoApp.ts     # Main application class
│   │   ├── SceneBuilder.ts        # Creates demo scene entities
│   │   ├── GeometryUtils.ts       # Mesh generation utilities
│   │   ├── MaterialPresets.ts     # PBR material presets
│   │   └── DebugVisualizer.ts     # Debug rendering overlay
│   └── shaders/
│       └── demo-pbr.wgsl          # NEW multi-light PBR shader
├── vite.config.ts                  # Already configured
└── index.html                      # Demo navigation page
```

### Core Application Architecture

```typescript
// packages/renderer/src/lighting-demo/LightingDemoApp.ts
import { World, Transform, Camera } from '@miskatonic/ecs';
import {
  BackendFactory,
  IRendererBackend,
  LightSystem,
  CameraSystem,
  OrbitCameraController,
  RenderQueue,
  GPUBufferPool,
  VRAMProfiler,
  FlickeringLightSystem,
  PulsingLightSystem,
  OrbitingLightSystem,
  DemoUI,
} from '@miskatonic/rendering';
import { SceneBuilder } from './SceneBuilder';
import { DebugVisualizer } from './DebugVisualizer';

export class LightingDemoApp {
  private world: World;
  private backend!: IRendererBackend;  // Initialized in initialize()
  private lightSystem: LightSystem;
  private cameraSystem: CameraSystem;
  private cameraEntity!: number;  // Created in initialize()
  private cameraController!: OrbitCameraController;  // Created in initialize()
  private renderQueue: RenderQueue;
  private bufferPool!: GPUBufferPool;  // Created after backend
  private vramProfiler: VRAMProfiler;

  // Animation systems (Epic 3.18)
  private flickeringSystem: FlickeringLightSystem;
  private pulsingSystem: PulsingLightSystem;
  private orbitingSystem: OrbitingLightSystem;

  private demoUI: DemoUI;
  private sceneBuilder: SceneBuilder;
  private debugVisualizer!: DebugVisualizer;  // Created after backend

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.world = new World();

    // Initialize ECS systems
    this.lightSystem = new LightSystem(this.world);
    this.cameraSystem = new CameraSystem(this.world);

    this.renderQueue = new RenderQueue();
    this.vramProfiler = new VRAMProfiler(256 * 1024 * 1024);

    // Animation systems
    this.flickeringSystem = new FlickeringLightSystem(this.world);
    this.pulsingSystem = new PulsingLightSystem(this.world);
    this.orbitingSystem = new OrbitingLightSystem(this.world);

    this.sceneBuilder = new SceneBuilder(this.world);

    // Initialize UI (Epic 3.18)
    this.demoUI = new DemoUI({
      onQualityChange: (tier) => this.handleQualityChange(tier),
      onDebugModeChange: (mode) => this.debugVisualizer.setMode(mode),
      onDebugCycle: () => this.debugVisualizer.cycleMode()
    });
  }

  async initialize(): Promise<void> {
    // CORRECT: Use BackendFactory (Phase 0 Pattern 3)
    this.backend = await BackendFactory.create(this.canvas, {
      antialias: true,
      alpha: false,
      depth: true,
      powerPreference: 'high-performance',
    });

    // Initialize backend-dependent objects
    this.bufferPool = new GPUBufferPool(this.backend.getDevice());
    this.debugVisualizer = new DebugVisualizer(this.world, this.backend);

    // CORRECT: Create camera entity first (Phase 0 Pattern 1)
    this.cameraEntity = this.world.createEntity();
    this.world.addComponent(
      this.cameraEntity,
      Transform,
      new Transform(0, 25, 35)
    );
    this.world.addComponent(
      this.cameraEntity,
      Camera,
      Camera.perspective(Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 1000)
    );

    // CORRECT: Create controller with entity (Phase 0 Pattern 1)
    this.cameraController = new OrbitCameraController(
      this.cameraEntity,
      this.world,
      35  // distance
    );

    // Wire up input events (Phase 0 Pattern 2: event-driven, not update loop)
    this.setupCameraControls();

    // Build scene
    this.sceneBuilder.buildScene();  // Creates 100+ lights
    this.demoUI.mount();
  }

  private setupCameraControls(): void {
    let isDragging = false;

    this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button === 0) isDragging = true;
    });

    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      if (isDragging && e.buttons === 1) {
        // CORRECT: Event-driven rotation (Phase 0 Pattern 2)
        this.cameraController.rotate(e.movementX * 0.005, e.movementY * 0.005);
      }
    });

    this.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      // CORRECT: Event-driven zoom (Phase 0 Pattern 2)
      this.cameraController.zoom(e.deltaY * 0.01);
    });
  }

  private update(dt: number): void {
    // Update animation systems (Epic 3.18 - Phase 0 Pattern 4)
    this.flickeringSystem.update(dt);
    this.pulsingSystem.update(dt);
    this.orbitingSystem.update(dt);

    // Update light system (sync with ECS)
    this.lightSystem.update();

    // Update camera system (NOT controller - it's event-driven)
    // Phase 0 Pattern 2: OrbitCameraController has NO update() method
    this.cameraSystem.update();

    // Render using Epic 3.14 Modern API
    this.renderFrame();

    // Update performance UI
    this.updatePerformanceMetrics();
  }

  private renderFrame(): void {
    // Get lights from LightSystem (NOT direct ECS queries)
    const lights = this.lightSystem.getActiveLights();

    // Use Epic 3.14 Modern Rendering API with storage buffers
    // Use RenderQueue for draw command batching
    // Use proper bind groups and pipelines

    // Render debug visualization if enabled
    this.debugVisualizer.render();
  }
}
```

### HTML Entry Point

```html
<!-- packages/renderer/lighting-demo.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Lighting Demo - Epic 3.14 Modern Rendering API</title>
    <style>
      /* Demo styling */
    </style>
  </head>
  <body>
    <canvas id="demo-canvas"></canvas>
    <div id="info-overlay">
      <h1>Lighting Demo - Epic 3.14-3.18</h1>
      <p>100+ Dynamic Lights with Shadows</p>
    </div>
    <div class="nav-links">
      <a href="/">← Back to Main Demo</a>
      <a href="/joints.html">View Joints Demo</a>
    </div>
    <script type="module" src="/src/lighting-demo.ts"></script>
  </body>
</html>
```

---

## Tasks Breakdown

### Phase 0: Validation & Planning (1 day) ✅ COMPLETE (2025-11-12)

- [x] Validate Epic 3.14-3.18 APIs work correctly with small test
- [x] Create minimal test scene (10 lights) to validate integration
- [x] Measure performance baseline with existing systems
- [x] Document any API issues discovered
- [x] Create task breakdown with time estimates

**Files Created**:
- `packages/renderer/phase0-validation.html` - Validation page
- `packages/renderer/src/phase0-validation.ts` - Validation script (626 lines)
- `planning/PHASE0_VALIDATION_RESULTS.md` - Results documentation

**Key Discoveries**:
1. OrbitCameraController requires `(entity, world, distance)` constructor - NOT empty constructor
2. OrbitCameraController is event-driven (rotate/zoom/setTarget) - NOT frame-driven (no update method)
3. BackendFactory.create() is correct initialization pattern - NOT direct WebGPUBackend instantiation
4. All animation systems (Flickering, Pulsing, Orbiting) ARE exported and have update() methods
5. Validation requires WebGPU-capable environment (Electron or Chrome with flags enabled)

**Running Phase 0 Validation**:
```bash
# Method 1: Run in Electron (recommended)
npm run dev
# Then navigate to phase0-validation.html

# Method 2: Run in Chrome with WebGPU enabled
# 1. Open chrome://flags/#enable-unsafe-webgpu
# 2. Enable "Unsafe WebGPU"
# 3. Restart Chrome
# 4. npm run dev:renderer
# 5. Open http://localhost:5173/phase0-validation.html
```

**Success Criteria**: ✅ APIs validated, correct usage patterns documented

### Phase 1: Application Architecture ✅ COMPLETE (2025-11-12)

- [x] Delete broken `packages/renderer/src/lighting-demo.ts` and `lighting-demo-renderer.ts`
- [x] Create new `packages/renderer/src/lighting-demo/` directory
- [x] Implement `LightingDemoApp.ts` main application class (281 lines)
  - [x] Constructor with ECS systems (NOT backend - async)
  - [x] `initialize()` method: BackendFactory.create() (Phase 0 Pattern 3)
  - [x] Create camera entity with Transform + Camera components (Phase 0 Pattern 1)
  - [x] Create OrbitCameraController(entity, world, distance) (Phase 0 Pattern 1)
  - [x] Wire up event handlers for rotate/zoom (Phase 0 Pattern 2)
  - [x] `update(dt)` main loop (NO controller.update() call!)
  - [x] `renderFrame()` placeholder (TODO Phase 3)
  - [x] Error handling and WebGPU capability checks
- [x] Integrate `LightSystem` for light management
- [x] Integrate animation systems with update(dt) calls (Phase 0 Pattern 4)
- [x] Integrate `RenderQueue` for draw command management
- [x] Integrate UI system (DemoUI integration)
- [x] Create `SceneBuilder.ts` (105 lights - 211 lines)
- [x] Create `GeometryUtils.ts` (plane, cube, sphere, cone - 345 lines)
- [x] Create new `lighting-demo.html` entry point
- [x] Create `src/lighting-demo.ts` entry point (65 lines)
- [x] Test demo launches in Electron

**Files Created:**
- `packages/renderer/src/lighting-demo/LightingDemoApp.ts` (281 lines)
- `packages/renderer/src/lighting-demo/SceneBuilder.ts` (211 lines)
- `packages/renderer/src/lighting-demo/GeometryUtils.ts` (345 lines)
- `packages/renderer/lighting-demo.html` (168 lines)
- `packages/renderer/src/lighting-demo.ts` (65 lines)

**Total:** 1,070 lines of implementation code

**Success Criteria**: ✅ Demo launches, initializes correctly, 105 lights created
**Next:** Phase 2 - Complete SceneBuilder with geometry and materials

### Phase 2: Scene Creation ✅ COMPLETE (2025-11-12)

- [x] Complete `SceneBuilder.ts` implementation
  - [x] `buildScene()` orchestrates all creation
  - [x] `createGround()` - 200x200 plane, 20 subdivisions, concrete material
  - [x] `createProps()` - 8 cubes + 6 spheres with random PBR materials
  - [x] `createLights()` - all light types with animations (completed Phase 1)
- [x] Complete `GeometryUtils.ts` (completed Phase 1)
  - [x] `generatePlane(width, depth, subdivisions)` - Subdivided quads
  - [x] `generateCube(size)` - 24 vertices, 36 indices
  - [x] `generateSphere(radius, segments)` - Icosphere subdivision
  - [x] `generateCone(radius, height)` - For debug volumes
- [x] Implement `MaterialPresets.ts` (138 lines)
  - [x] `concrete()`, `stone()` - Ground materials
  - [x] `brushedMetal()`, `polishedMetal()`, `gold()`, `copper()` - Metallic presets
  - [x] `plastic()`, `bluePlastic()`, `greenPlastic()` - Dielectric presets
  - [x] `wood()`, `rubber()` - Additional variety
  - [x] `emissive()` - Glowing materials
  - [x] `randomProp()` - Random material selection
- [x] Light creation with spatial distribution (completed Phase 1)
  - [x] `createDirectionalLight()` with CSM shadows
  - [x] `createFlickeringLights(40)` - Circle arrangement
  - [x] `createPulsingLights(40)` - Larger circle
  - [x] `createOrbitingLights(20)` - Orbital paths
  - [x] `createSpotLights(4)` - Corner searchlights with shadows
- [x] 105 lights total with even spatial distribution
- [x] Add MeshData interface for Phase 3 rendering
- [x] Scene mesh tracking (Map<entity, {geometry, material}>)

**Files Updated:**
- `SceneBuilder.ts`: +70 lines (now 281 lines total)
- `MaterialPresets.ts`: 138 lines (new)

**Scene Composition:**
- 1 ground plane (200x200, 441 vertices, 800 triangles)
- 8 cubes (various sizes 2-5 units)
- 6 spheres (various sizes 1.5-3.5 units)
- 105 lights (40 flickering, 40 pulsing, 20 orbiting, 4 spot, 1 directional)

**Total Phase 2:** 208 lines added

**Success Criteria**: ✅ 15 meshes created, 105 lights, all with geometry and materials
**Next:** Phase 3 - Rendering Integration with Epic 3.14 Modern API

### Phase 3: Rendering Integration ✅ COMPLETE (2025-11-12)

- [x] Create `lighting-demo.wgsl` shader (233 lines)
  - [x] Multi-light support using storage buffers (Epic 3.14)
  - [x] PBR lighting calculations (Cook-Torrance BRDF)
  - [x] Directional, point, and spot light support
  - [x] Distance and cone attenuation
- [x] Create `DemoRenderer.ts` (475 lines)
  - [x] WebGPU pipeline and bind group management
  - [x] Storage buffers for unbounded light arrays (Epic 3.14)
  - [x] Three bind groups: scene (camera+lights), object (transforms), material (PBR)
  - [x] Mesh cache with GPU buffers
  - [x] Interleaved vertex format (position, normal, texCoord)
  - [x] Depth testing enabled
- [x] Integrate renderer into `LightingDemoApp.ts`
  - [x] Initialize renderer after backend creation
  - [x] Upload all scene meshes to GPU
  - [x] Update scene uniforms per frame (camera, lights)
  - [x] Render loop calling renderer.render()
- [x] Implement proper camera matrices
  - [x] Model matrix from Transform
  - [x] Perspective projection matrix
  - [x] Look-at view matrix
  - [x] View-projection matrix multiplication
  - [x] Camera position for lighting calculations

**Files Created:**
- `lighting-demo.wgsl` (233 lines) - PBR multi-light shader
- `DemoRenderer.ts` (475 lines) - WebGPU rendering system
- `MatrixUtils.ts` (115 lines) - Camera matrix calculations

**Files Updated:**
- `LightingDemoApp.ts` (+80 lines) - Renderer integration, proper camera matrices

**Total Phase 3:** 903 lines

**Key Achievements:**
- ✅ Epic 3.14 Modern API: Storage buffers for lights
- ✅ Epic 3.14 Modern API: Bind groups for scene/object/material
- ✅ Epic 3.14 Modern API: Proper index buffer format handling (uint16/uint32)
- ✅ Epic 3.15 API: LightSystem integration
- ✅ Cook-Torrance PBR with proper BRDF
- ✅ Proper perspective projection and view matrices
- ✅ 15 meshes rendering with 105 dynamic lights
- ✅ WebGPU pipeline fully functional with depth testing

**TODO Phase 4 (Shadows):**
- Integrate Epic 3.17 shadow systems (CSM, cubemap, projected)
- Shadow atlas management
- Shadow map rendering passes

**Success Criteria**: ✅ All meshes render with PBR lighting from 105 lights
**Next:** Phase 4 - Shadow System Integration

### Phase 4: Debug Visualization (1-2 days)

- [ ] Implement `DebugVisualizer.ts`
  - [ ] Integration with existing shadow debug visualizers from Epic 3.18
  - [ ] `setMode(mode)` to switch visualization
  - [ ] `cycleMode()` for F3 key
  - [ ] `render()` to draw debug overlays
- [ ] Implement debug modes
  - [ ] NONE (default)
  - [ ] LIGHT_VOLUMES (wireframe spheres/cones)
  - [ ] CASCADE_FRUSTUMS (colored frustum boxes)
  - [ ] SHADOW_ATLAS (texture preview)
  - [ ] TILE_HEATMAP (light count per tile)
  - [ ] DEPTH_MAP (shadow map preview)
- [ ] Wire up F3 key to cycle modes
- [ ] Generate light volume wireframes using GeometryUtils
- [ ] Write 5+ tests for debug visualization

**Success Criteria**: All debug modes render correctly, F3 cycling works

### Phase 5: UI & Interactions (1-2 days)

- [ ] Wire up `DemoUI` quality tier dropdown
  - [ ] Resize shadow atlas: LOW (1024²), MEDIUM (2048²), HIGH (4096²)
  - [ ] Update VRAM budget accordingly
  - [ ] Display new metrics immediately
- [ ] Wire up debug mode selector dropdown
  - [ ] Sync with F3 key cycling
  - [ ] Update DebugVisualizer mode
- [ ] Implement performance overlay
  - [ ] FPS color-coded (green >60, yellow >30, red <30)
  - [ ] GPU timing breakdown bars
  - [ ] Memory usage bar with budget threshold
  - [ ] Light count (total, visible, shadow-casting)
- [ ] Add camera control hints to overlay
- [ ] Configure `OrbitCameraController` sensitivity
- [ ] Test all interactive features

**Success Criteria**: All UI controls work, performance metrics accurate

### Phase 6: Performance Validation (2-3 days)

- [ ] Benchmark on RTX 3060 (or equivalent mid-range GPU)
  - [ ] Verify 60 FPS at HIGH quality with 100 lights
  - [ ] Measure GPU timings (shadow, culling, lighting)
  - [ ] Measure VRAM usage (should be <256MB)
  - [ ] Document results in comments
- [ ] Benchmark on Intel Iris Xe (or equivalent integrated GPU)
  - [ ] Verify 30 FPS at LOW quality with 100 lights
  - [ ] Document degradation vs discrete GPU
  - [ ] Identify bottlenecks
- [ ] Profile CPU overhead
  - [ ] Animation systems should be <0.1ms total
  - [ ] UI updates should be <0.5ms
  - [ ] Camera controls should be <0.1ms
- [ ] Validate light culling effectiveness
  - [ ] Log visible light count vs total
  - [ ] Verify GPU tile culling activates correctly
  - [ ] Measure culling overhead (<1ms)
- [ ] Memory leak testing
  - [ ] Run demo for 10 minutes
  - [ ] Monitor VRAM growth (should stabilize)
  - [ ] Monitor CPU memory (should be <100MB)
- [ ] Create automated performance benchmark
  - [ ] Measure FPS at each quality tier
  - [ ] Log to console for CI integration
- [ ] Write 5+ performance tests

**Success Criteria**: Performance targets met, no memory leaks, benchmarks automated

### Phase 7: Documentation & Polish (2-3 days)

- [ ] Add comprehensive code comments
  - [ ] Explain Epic 3.14 API usage patterns
  - [ ] Reference Epic 3.15-3.18 systems used
  - [ ] Document light arrangement patterns
  - [ ] Explain shadow configuration choices
  - [ ] Note performance optimization techniques
- [ ] Update `lighting-demo.html` with usage guide
  - [ ] Controls overlay (mouse, keyboard, F3)
  - [ ] Feature descriptions
  - [ ] Performance tips
- [ ] Add to main demo navigation page
  - [ ] Link from `index.html`
  - [ ] Add thumbnail/preview
  - [ ] Brief description
- [ ] Create troubleshooting section in comments
  - [ ] Common issues and solutions
  - [ ] Performance optimization tips
  - [ ] WebGPU compatibility notes
- [ ] Final code review
  - [ ] Remove all debugging console.logs
  - [ ] Verify type safety (no `any`)
  - [ ] Check for code duplication
  - [ ] Validate Epic 3.14-3.18 API usage
  - [ ] Ensure >80% test coverage
- [ ] Test in multiple browsers
  - [ ] Chrome/Edge (primary)
  - [ ] Firefox (if WebGPU available)
  - [ ] Safari (if WebGPU available)
- [ ] Record demo video/GIF for documentation

**Success Criteria**: Code is well-documented, demo works in all browsers, test coverage >80%

---

## Performance Targets

### Frame Budget (60 FPS = 16.67ms total)

**GPU (11ms budget):**
- Shadow Rendering: <4ms (1 directional CSM + 8 point cubemaps + 2 spot)
  - Directional CSM: <1.5ms (3 cascades)
  - Point cubemaps: <2ms (8 lights with LOD)
  - Spot projected: <0.5ms (2 lights)
- Light Culling: <0.5ms (GPU tile-based compute - Epic 3.16)
- Lighting Pass: <3ms (PBR shading with shadow sampling)
- Debug Visualization: <2ms (when enabled)
- Other: <1ms (buffer uploads, state changes)

**CPU (5ms budget):**
- Animation Systems: <0.1ms (100 animated lights)
- ECS Updates: <0.5ms (LightSystem, CameraSystem sync)
- Camera Controls: <0.1ms (OrbitCameraController input)
- UI Updates: <0.5ms (performance metrics formatting)
- Scene Graph: <1ms (transform propagation)
- Render Queue: <1ms (draw command sorting)
- Other: <1.8ms (event handling, system overhead)

**Memory Budget:**
- HIGH tier: 64MB shadow atlas + 20MB buffers + 10MB textures = 94MB GPU
- MEDIUM tier: 16MB shadow atlas + 10MB buffers + 5MB textures = 31MB GPU
- LOW tier: 4MB shadow atlas + 5MB buffers + 2MB textures = 11MB GPU
- CPU memory: <100MB

---

## Risk Assessment

### HIGH Priority Risks

**Risk: Epic 3.14-3.18 APIs have undiscovered issues at 100+ light scale**
- Likelihood: MEDIUM
- Impact: HIGH (could block completion)
- Mitigation: Phase 0 validates APIs with small test first
- Mitigation: Incremental scaling (10 → 50 → 100 lights)
- Fallback: Reduce target to 60-80 lights if necessary

**Risk: Performance targets unachievable with 100+ lights**
- Likelihood: MEDIUM
- Impact: HIGH (core success criterion)
- Mitigation: Aggressive light culling (GPU tile-based - Epic 3.16)
- Mitigation: Shadow LOD to reduce render cost
- Mitigation: Profile early in Phase 2
- Fallback: Reduce light count or quality targets

**Risk: Existing shaders don't support 100+ lights**
- Likelihood: LOW (Epic 3.14 added storage buffer support)
- Impact: MEDIUM (requires shader work)
- Mitigation: Verify shader capacity in Phase 0
- Fallback: Extend existing shaders with storage buffers

### MEDIUM Priority Risks

**Risk: Test coverage >80% difficult for rendering code**
- Likelihood: HIGH
- Impact: LOW (tests are validation, not blocker)
- Mitigation: Focus tests on application logic
- Mitigation: Integration tests for rendering use real WebGPU
- Fallback: Accept 70% coverage for rendering paths

**Risk: Hot-reload breaks with large scenes**
- Likelihood: LOW
- Impact: LOW (development convenience)
- Mitigation: Vite handles this well already
- Fallback: Manual refresh if needed

### LOW Priority Risks

**Risk: Browser WebGPU compatibility issues**
- Likelihood: MEDIUM (WebGPU still experimental)
- Impact: LOW (development target is Chrome)
- Mitigation: Document browser requirements
- Fallback: Chrome/Edge only if necessary

---

## Success Criteria Summary

**Technical:**
- [ ] Demo accessible at `http://localhost:5173/lighting-demo.html`
- [ ] 100+ dynamic lights render at 60 FPS (RTX 3060)
- [ ] All Epic 3.14-3.18 systems integrated correctly
- [ ] No code duplication with engine packages
- [ ] No access to private internals
- [ ] Uses existing `OrbitCameraController` (not custom system)
- [ ] >80% test coverage (40+ tests minimum)
- [ ] Zero type safety violations

**Functional:**
- [ ] Quality tier switching works (LOW/MEDIUM/HIGH)
- [ ] Debug visualization modes work (6 modes)
- [ ] Camera controls smooth via existing OrbitCameraController
- [ ] Performance metrics update in real-time
- [ ] All light types present and animating
- [ ] Shadows render correctly for all light types

**Performance:**
- [ ] 60 FPS on RTX 3060 @ HIGH (100 lights)
- [ ] 30 FPS on Intel Iris Xe @ LOW (100 lights)
- [ ] <4ms GPU shadow rendering
- [ ] <1ms light culling
- [ ] <3ms lighting pass
- [ ] <256MB VRAM usage at HIGH

**Quality:**
- [ ] Code well-commented with Epic 3.14-3.18 usage notes
- [ ] HTML has usage instructions overlay
- [ ] Architecture follows Vite demo patterns
- [ ] Serves as reference implementation

---

## Timeline Estimate

**Total Duration: 12-15 days (2.5-3 weeks)**

- Phase 0: Validation & Planning (1 day)
- Phase 1: Application Architecture (2-3 days)
- Phase 2: Scene Creation (2 days)
- Phase 3: Rendering Integration (3-4 days)
- Phase 4: Debug Visualization (1-2 days)
- Phase 5: UI & Interactions (1-2 days)
- Phase 6: Performance Validation (2-3 days)
- Phase 7: Documentation & Polish (2-3 days)

**Parallelization Opportunities:**
- Phase 2 (Scene) can partially overlap with Phase 1 (Architecture) once app structure is defined
- Phase 4 (Debug) can overlap with Phase 5 (UI)

---

## Key Simplifications from Standalone Approach

1. **No Electron complexity**: Uses existing Vite dev server
2. **No package creation**: Reuse `packages/renderer/` structure
3. **No IPC channels**: Browser-only application
4. **No main process**: No separate process management
5. **Faster iteration**: Vite hot-reload already working
6. **Simpler deployment**: Just HTML + TypeScript files

**Estimated time savings: 6-10 days** compared to standalone Electron app approach.

---

## Deferred Features (Post-Epic 3.19)

Not included in initial demo:
1. Custom light types (only built-in directional/point/spot/ambient)
2. Post-processing effects (no bloom, tone mapping, SSAO)
3. Particle systems (separate demo)
4. Complex materials (only PBR with basic textures)
5. Audio (no sound effects)
6. Physics integration (no dynamic props)
7. Asset loading (no external GLTF models)
8. Save/load scenes
9. Mobile/touch support

---

**End of Epic 3.19: Lighting Demo Application (Vite-Based)**