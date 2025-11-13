# Lighting Demo - Epic 3.19

**Status:** Phases 0-3 Complete (Rendering Functional)
**Epic:** INIT-003-19-lighting-demo-app

## Overview

This demo showcases the integration of Epic 3.14-3.18 Modern Rendering APIs:
- **Epic 3.14:** Modern Rendering API (storage buffers, bind groups)
- **Epic 3.15:** LightSystem API
- **Epic 3.16:** Light Culling (planned Phase 4)
- **Epic 3.17:** Shadow Mapping (planned Phase 4)
- **Epic 3.18:** Animation Systems

## Scene Composition

- **Meshes:** 15 total (1 ground plane + 8 cubes + 6 spheres)
- **Lights:** 105 dynamic lights
  - 40 flickering lights (torches in circle)
  - 40 pulsing lights (power cores in larger circle)
  - 20 orbiting lights (satellites)
  - 4 spot lights (searchlights at corners)
  - 1 directional light (sun with CSM shadows - Phase 4)

## Running the Demo

```bash
npm run dev
```

Navigate to `http://localhost:5173/lighting-demo.html` in the Electron window.

## Controls

- **Left Mouse Drag:** Rotate camera around scene
- **Mouse Wheel:** Zoom in/out
- **F3:** Toggle debug visualization (Phase 5)

## Technical Details

### Rendering Pipeline

**Shader:** `src/shaders/lighting-demo.wgsl`
- Cook-Torrance PBR BRDF
- Storage buffers for unbounded light arrays
- Support for directional, point, and spot lights

**Bind Groups:**
```
Group 0 (Scene):  Camera + Lights storage buffer + Light count
Group 1 (Object): Model matrix + Normal matrix
Group 2 (Material): Base color + Metallic + Roughness
```

### Performance Targets

- **Target:** 60 FPS with 100+ lights
- **GPU:** Mid-range (RTX 3060 equivalent)
- **Resolution:** 1920x1080
- **Quality:** HIGH (all features enabled)

### Code Structure

```
src/lighting-demo/
├── LightingDemoApp.ts     # Main application (361 lines)
├── DemoRenderer.ts        # WebGPU rendering (475 lines)
├── SceneBuilder.ts        # Scene creation (281 lines)
├── GeometryUtils.ts       # Procedural geometry (345 lines)
├── MaterialPresets.ts     # PBR materials (138 lines)
└── MatrixUtils.ts         # Camera math (115 lines)
```

## Phase Status

### ✅ Phase 0: API Validation (Complete)
- Validated all Epic 3.14-3.18 APIs
- Discovered correct OrbitCameraController patterns
- Documented proper initialization sequences

### ✅ Phase 1: Application Architecture (Complete)
- Main application with Phase 0 patterns
- Scene creation with 105 lights
- Event-driven camera controls
- Animation system integration

### ✅ Phase 2: Scene Creation (Complete)
- 12 PBR material presets
- Procedural geometry generation
- 15 meshes with materials

### ✅ Phase 3: Rendering Integration (Complete)
- PBR shader with Cook-Torrance BRDF
- WebGPU rendering system
- Storage buffers for lights
- Proper camera matrices

### 📋 Phase 4: Shadow System Integration (Planned)
- CSM for directional lights
- Cubemaps for point lights
- Shadow atlas management

### 📋 Phase 5: Interactive Features (Planned)
- Quality tier switching (LOW/MEDIUM/HIGH)
- Performance overlay
- Debug visualization modes

### 📋 Phase 6: Performance Validation (Planned)
- 60 FPS validation
- Memory profiling
- Cross-platform testing

### 📋 Phase 7: Documentation & Polish (Planned)
- Code documentation
- Usage guide
- Final testing

## Known Limitations (Current Phase)

- ❌ No shadow rendering yet (Phase 4)
- ❌ No light culling optimization yet (Phase 4)
- ❌ No debug visualization yet (Phase 5)
- ❌ No quality tier switching yet (Phase 5)

## API Patterns (Phase 0 Validated)

### Pattern 1: OrbitCameraController
```typescript
// Create camera entity first
const cameraEntity = world.createEntity();
world.addComponent(cameraEntity, Transform, new Transform(0, 25, 35));
world.addComponent(cameraEntity, Camera, Camera.perspective(...));

// Create controller with entity
const controller = new OrbitCameraController(cameraEntity, world, 35);
```

### Pattern 2: Event-Driven Camera (NOT frame-driven)
```typescript
canvas.addEventListener('mousemove', (e) => {
  if (dragging) controller.rotate(e.movementX * 0.005, e.movementY * 0.005);
});

canvas.addEventListener('wheel', (e) => {
  controller.zoom(e.deltaY * 0.01);
});

// NO controller.update(dt) - it's event-driven!
```

### Pattern 3: Backend Initialization
```typescript
// Use BackendFactory.create()
const backend = await BackendFactory.create(canvas, {
  antialias: true,
  alpha: false,
  depth: true,
  powerPreference: 'high-performance',
});
```

### Pattern 4: Animation Systems
```typescript
// All animation systems have update(dt)
flickeringSystem.update(dt);
pulsingSystem.update(dt);
orbitingSystem.update(dt);
```

## Epic 3.14 Modern API Usage

### Storage Buffers for Lights
```wgsl
@group(0) @binding(1) var<storage, read> lights: array<LightData>;
```

### Bind Group Architecture
```typescript
// Scene bind group (camera + lights)
device.createBindGroup({
  layout: sceneBindGroupLayout,
  entries: [
    { binding: 0, resource: { buffer: cameraBuffer } },
    { binding: 1, resource: { buffer: lightStorageBuffer } },
    { binding: 2, resource: { buffer: lightCountBuffer } },
  ],
});
```

### Proper Index Format Handling
```typescript
const indexFormat: GPUIndexFormat =
  geometry.indices instanceof Uint16Array ? 'uint16' : 'uint32';
```

## References

- **Epic Documentation:** `planning/initiatives/INIT-003-19-lighting-demo-app.md`
- **Phase 0 Results:** `planning/PHASE0_VALIDATION_RESULTS.md`
- **Initiative:** `planning/initiatives/INIT-003-Rendering-Graphics.md`
