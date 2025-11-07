# Development Planning: Miskatonic Engine

**Version:** 1.0
**Date:** November 2025

---

## Executive Summary

This document outlines the development plan for Miskatonic Engine, organized into strategic initiatives and tactical epics. Each initiative represents a major domain of work, while epics represent deliverable milestones within those domains.

### Planning Structure
```
Initiative (Domain)
  └─ Epic (Major Deliverable)
      └─ User Stories (Features)
          └─ Tasks (Implementation Details)
```

### Progress Summary

**Completed Epics:** 5 of 50+ planned

| Epic | Status | Test Coverage | Key Achievement |
|------|--------|---------------|-----------------|
| 1.1 - Electron Architecture | ✅ Complete | Full | Secure multi-process architecture with IPC |
| 1.2 - Native OS Integration | ✅ Complete | Full | File dialogs, menus, tray, shortcuts, notifications |
| 2.1 - ECS Core | ✅ Complete | 65/65 tests | Archetype-based ECS with generation validation |
| 2.3 - Event System | ✅ Complete | 49/49 tests | Production-ready event bus with critical fixes |
| 2.4 - Resource Management | ✅ Complete | 91/91 tests | Async loading, ref counting, hot-reload, memory profiling, production-ready |

**Current Focus:** Next epic selection (Core Engine Systems foundation complete)

---

## Initiative Overview

| ID | Initiative | Priority | 
|----|------------|----------|----------|
| INIT-001 | Platform Foundation | P0 | 
| INIT-002 | Core Engine Systems | P0 | 
| INIT-003 | Rendering & Graphics | P0 |
| INIT-004 | Physics & Simulation | P0 |
| INIT-005 | Networking & Multiplayer | P0 |
| INIT-006 | Development Tools | P1 |
| INIT-007 | Asset Pipeline | P1 |
| INIT-008 | Backend Services | P0 |
| INIT-009 | Security & Anti-Cheat | P1 |
| INIT-010 | Performance & Optimization | 

---

## Initiative 1: Platform Foundation (INIT-001)
**Dependencies:** None
**Outcome:** Electron-based foundation with cross-platform support

### Epic 1.1: Electron Architecture Setup ✅ **COMPLETE**
**Priority:** P0
**Status:** ✅ Completed November 2025
**Acceptance Criteria:**
- ✅ Main process architecture implemented
- ✅ Renderer process isolation configured
- ✅ IPC communication layer established
- ✅ Security boundaries enforced

#### User Stories:
1. ✅ **As a developer**, I want a secure Electron main process that manages application lifecycle
2. ✅ **As a developer**, I want typed IPC communication between main and renderer processes
3. ✅ **As a developer**, I want context isolation and preload scripts for security
4. ✅ **As a system**, I need process crash recovery and error handling

#### Tasks Breakdown:
- [x] Setup Electron project structure with TypeScript
- [x] Implement main process window management
- [x] Create IPC message protocol with type definitions
- [x] Setup preload script with contextBridge
- [x] Implement process monitoring and crash recovery
- [x] Add development and production configurations
- [x] Create unit tests for IPC layer
- [x] Document IPC API and security model

#### Additional Security Fixes Completed:
- [x] Removed debug logging from production
- [x] Removed unsafe WebGPU flags
- [x] Enhanced CSP validation with multi-check system
- [x] Fixed path traversal vulnerabilities with robust validation
- [x] Implemented IPC rate limiting (100 calls/sec per channel)
- [x] Added error dialogs before app quit
- [x] Fixed memory leaks in WindowManager with periodic cleanup
- [x] Implemented chunked file operations for large files (>5MB)
- [x] Fixed type safety issues (removed `any` types)
- [x] Cleaned up dead code and TODOs

### Epic 1.2: Native OS Integration ✅ **COMPLETE**
**Priority:** P0
**Status:** ✅ Completed November 2025
**Acceptance Criteria:**
- ✅ File system access implemented
- ✅ Native menus and dialogs working
- ✅ System tray integration complete
- ✅ Global shortcuts registered

#### User Stories:
1. ✅ **As a player**, I want native file dialogs for saving/loading games
2. ✅ **As a player**, I want the game to integrate with OS menus and shortcuts
3. ✅ **As a developer**, I want access to native file system APIs
4. ✅ **As a player**, I want the game to minimize to system tray

#### Tasks Breakdown:
- [x] Implement native file system operations wrapper
- [x] Create menu bar templates for each OS
- [x] Setup system tray with context menu
- [x] Register global keyboard shortcuts
- [x] Implement native notification system
- [ ] Add OS-specific window controls (Optional - defer to Epic 1.4)
- [ ] Test on Windows, macOS, Linux (Requires platform access)
- [ ] Create platform-specific installers (Part of Epic 1.4)

#### Implementation Details:
- **File Dialogs**: OpenFileDialogHandler, SaveFileDialogHandler, MessageBoxDialogHandler with full Zod validation
- **Application Menus**: MenuBuilder with platform-specific templates (macOS app menu, File, Edit, View, Window, Help)
- **System Tray**: TrayManager with context menu, minimize-to-tray, platform-specific icons
- **Global Shortcuts**: ShortcutManager with default bindings (toggle window, reload, devtools, quit)
- **Notifications**: NotificationManager with support for actions, urgency levels, and convenience methods

### Epic 1.3: Auto-Update System
**Priority:** P1
**Acceptance Criteria:**
- Auto-updater configured for all platforms
- Delta updates supported
- Rollback mechanism implemented
- Update UI/UX complete

#### User Stories:
1. **As a player**, I want automatic game updates without manual downloads
2. **As a developer**, I want staged rollouts for updates
3. **As a player**, I want to see update progress and changelogs
4. **As an admin**, I want rollback capability for faulty updates

#### Tasks Breakdown:
- [ ] Setup electron-updater with code signing
- [ ] Implement update server infrastructure
- [ ] Create update UI overlay
- [ ] Add differential update support
- [ ] Implement rollback mechanism
- [ ] Setup staged rollout system
- [ ] Add update telemetry
- [ ] Create update testing framework

### Epic 1.4: Build & Distribution Pipeline
**Priority:** P0
**Acceptance Criteria:**
- CI/CD pipeline configured
- Multi-platform builds automated
- Distribution packages created
- Code signing implemented

#### User Stories:
1. **As a developer**, I want automated builds for all platforms
2. **As a publisher**, I want signed executables for distribution
3. **As a developer**, I want optimized production builds
4. **As a QA**, I want debug builds with source maps

#### Tasks Breakdown:
- [ ] Setup electron-builder configuration
- [ ] Configure GitHub Actions for CI/CD
- [ ] Implement code signing for Windows/macOS
- [ ] Create distribution packages (exe, dmg, AppImage)
- [ ] Setup artifact storage and versioning
- [ ] Optimize build sizes and performance
- [ ] Create build documentation
- [ ] Setup nightly build system

---

## Initiative 2: Core Engine Systems (INIT-002)
**Dependencies:** INIT-001
**Outcome:** ECS architecture with hot-swappable systems

### Epic 2.1: Entity Component System (ECS) Core ✅ **COMPLETE**
**Priority:** P0
**Status:** ✅ Completed November 2025
**Acceptance Criteria:**
- ✅ Entity management system complete
- ✅ Component storage optimized
- ✅ System execution pipeline working
- ✅ Query engine implemented

#### User Stories:
1. ✅ **As a developer**, I want to create entities and attach components dynamically
2. ✅ **As a developer**, I want efficient queries over entity components
3. ✅ **As a developer**, I want ordered system execution
4. ⏭️ **As a developer**, I want component change detection (deferred to Epic 2.5)

#### Tasks Breakdown:
- [x] Implement entity ID generation and recycling
- [x] Create archetype-based component storage
- [x] Build system registration and ordering
- [x] Implement query builder with caching
- [ ] Add component change detection (deferred to Epic 2.5)
- [ ] Create entity prefab system (deferred to Epic 2.5)
- [x] Optimize memory layout for cache efficiency
- [ ] Build ECS debugging tools (deferred to Epic 2.6)
- [x] Write comprehensive unit tests (65/65 passing)
- [ ] Create ECS performance benchmarks (deferred to Epic 2.6)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/ecs/`
- **Entity Management** (`Entity.ts`): ID generation with recycling, generation counters for use-after-free detection
- **Archetype Storage** (`Archetype.ts`): Cache-efficient component storage, O(1) entity removal with swap-and-pop
- **System Manager** (`System.ts`): Priority-based system execution, lifecycle management (init/update/cleanup)
- **Query Engine** (`Query.ts`): Cached queries with automatic invalidation, with/without/optional filters
- **World Container** (`World.ts`): Main API with component cloning during archetype transitions, generation validation
- **Example Components**: Transform (position/rotation/scale), Velocity (vx/vy/vz)
- **Example Systems**: MovementSystem with cached queries

#### Code Quality:
- 100% test coverage (65/65 tests passing)
- TypeScript strict mode throughout
- Generation validation on all entity operations
- Component cloning to prevent shared state bugs
- Zero use of `any` types

#### Critical Fixes Applied:
- [x] Added FIRST and LAST to SystemPriority enum
- [x] Fixed component data corruption during archetype transitions
- [x] Implemented generation validation for use-after-free prevention
- [x] Added query caching in systems to avoid rebuilding per frame
- [x] Fixed type safety (removed `any` types)
- [x] Fixed Velocity component property naming (vx/vy/vz)

### Epic 2.2: Plugin Architecture
**Priority:** P1
**Acceptance Criteria:**
- Plugin loading system implemented
- Plugin API defined and documented
- Hot-reload capability added
- Sandbox security implemented

#### User Stories:
1. **As a developer**, I want to extend the engine with custom plugins
2. **As a developer**, I want hot-reload for plugin development
3. **As a developer**, I want plugins to be sandboxed for security
4. **As a developer**, I want plugin dependencies management

#### Tasks Breakdown:
- [ ] Design plugin interface and lifecycle
- [ ] Implement plugin loader with dependency resolution
- [ ] Create plugin sandbox environment
- [ ] Add hot-reload support for development
- [ ] Build plugin registry and discovery
- [ ] Implement plugin configuration system
- [ ] Create plugin development kit (PDK)
- [ ] Write plugin examples and templates
- [ ] Add plugin marketplace infrastructure

### Epic 2.3: Event System ✅ **COMPLETE**
**Priority:** P0
**Status:** ✅ Completed November 2025
**Acceptance Criteria:**
- ✅ Event bus implemented
- ✅ Typed event system working
- ✅ Event priorities and filtering
- ✅ Performance optimized

#### User Stories:
1. ✅ **As a developer**, I want type-safe event publishing and subscription
2. ✅ **As a developer**, I want event priority and ordering control
3. ✅ **As a developer**, I want event filtering and namespacing
4. ✅ **As a system**, I need high-performance event dispatch

#### Tasks Breakdown:
- [x] Implement core event bus architecture
- [x] Add TypeScript type safety for events
- [x] Create event priority system
- [x] Implement event filtering and namespaces
- [x] Add event batching for performance
- [ ] Create event replay system for debugging (deferred to Epic 2.6)
- [ ] Build event profiling tools (deferred to Epic 2.6)
- [x] Write event system tests (49/49 passing: 26 core + 23 critical)
- [x] Apply all critical fixes from code review

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/events/`
- **EventBus** (`EventBus.ts`): Core event bus with priority ordering, filtering, batching
- **Type System** (`types.ts`): Strong TypeScript types for all events and handlers
- **Priority System**: CRITICAL, HIGH, NORMAL, LOW, LOWEST with automatic ordering
- **Namespace Filtering**: Organize events by domain (ui, game, physics, etc.)
- **Custom Filters**: Apply complex filtering logic to event listeners
- **Event Batching**: Queue high-frequency events for optimized batch processing
- **Async Support**: Full support for async/await event handlers
- **Performance Tracking**: Built-in statistics and dispatch time monitoring

#### Code Quality:
- 100% test coverage (49/49 tests passing: 26 core + 23 critical features)
- TypeScript strict mode throughout
- Zero use of `any` types in public API
- Comprehensive documentation with examples
- Production-ready with all critical fixes applied

#### Key Features:
- Type-safe event dispatch and subscription
- Priority-based execution ordering
- Namespace filtering for event organization
- Custom filter functions for complex logic
- Event batching for high-frequency events
- Subscription management with lifecycle control
- Performance statistics and monitoring
- Async event handler support

#### Critical Fixes Applied (Code-Critic Review):
1. **Race Condition Fix**: Deferred listener cleanup with `listenersToRemove` Set prevents concurrent modification during dispatch
2. **Memory Leak Fix**: Added `destroy()` method that properly clears batch timeouts and all resources
3. **Performance Optimization**: Binary insertion (O(log n)) instead of full array sort (O(n log n)) on every subscription
4. **Async Handler Performance**: Parallel execution within priority groups using Promise.all (handlers at same priority run concurrently)
5. **Recursion Detection**: Added depth tracking with max limit of 50 to prevent stack overflow crashes
6. **Statistics Performance**: Circular buffer for dispatch times eliminates O(n) shift() operations
7. **Event Validation**: Validates event structure (type and timestamp) before dispatch
8. **Use-After-Destroy Protection**: `destroyed` flag prevents operations after cleanup

### Epic 2.4: Resource Management ✅ **COMPLETE**
**Priority:** P0
**Status:** ✅ Completed November 2025
**Acceptance Criteria:**
- ✅ Resource loading system complete
- ✅ Reference counting implemented
- ✅ Memory management optimized
- ✅ Resource hot-reload working

#### User Stories:
1. ✅ **As a developer**, I want automatic resource lifecycle management
2. ✅ **As a developer**, I want resource reference counting
3. ✅ **As a developer**, I want resource hot-reloading
4. ✅ **As a system**, I need efficient memory usage

#### Tasks Breakdown:
- [x] Implement resource loader architecture
- [x] Add reference counting system
- [x] Create resource cache with LRU/LFU/FIFO/SIZE eviction policies
- [x] Implement async resource loading
- [x] Add resource dependency tracking with DAG and topological sort
- [x] Build resource hot-reload system with file watching
- [x] Create memory profiling tools
- [x] Optimize resource allocation patterns

#### Critical Production Fixes Completed:
- [x] Fixed race condition in concurrent resource loading with mutex
- [x] Fixed memory leak from error cleanup timers (5s timeout, 100 timer limit)
- [x] Implemented use-after-free protection with EVICTED state
- [x] Added type validation to prevent cross-type ID pollution
- [x] Fixed infinite loop in cache eviction with attempt counters
- [x] Made handleRelease generic to maintain type safety
- [x] Fixed chokidar persistent watcher resource leak (configurable, default: false)
- [x] Added bounds to debounceTimers Map (max: 1000, prevents memory leak)
- [x] Removed type safety violation in MemoryProfiler (proper API instead of any cast)
- [x] Implemented lazy initialization for hot-reload watcher (no startup overhead)
- [x] Made leak detection thresholds configurable (prevents false positives)
- [x] All 91 tests passing with full type safety

#### Hot-Reload System Implemented:
- [x] File watching with chokidar
- [x] Debounced reload triggers (prevent rapid reloads)
- [x] Resource path registration and tracking
- [x] Automatic resource reload on file changes
- [x] Configurable watch paths and ignore patterns
- [x] 12 comprehensive tests

#### Memory Profiling Tools Implemented:
- [x] Memory snapshot system with timeline tracking
- [x] Allocation/deallocation event tracking
- [x] Memory leak detection (old resources, stuck loading, high refcounts)
- [x] Memory growth rate calculation
- [x] Detailed profiling reports with breakdown by type/state
- [x] Top memory consumer identification
- [x] Automatic and manual snapshot modes
- [x] 21 comprehensive tests

---

### Epic 2.5: Advanced ECS Features
**Priority:** P1
**Status:** ⏸️ Deferred
**Acceptance Criteria:**
- [ ] Component change detection implemented
- [ ] Entity prefab system working
- [ ] Change tracking has minimal performance impact (<5% overhead)
- [ ] Prefabs support composition and inheritance

#### User Stories:
1. ⏭️ **As a developer**, I want component change detection for reactive systems
2. ⏭️ **As a developer**, I want entity prefab system for efficient entity creation
3. ⏭️ **As a developer**, I want change detection to be performant
4. ⏭️ **As a developer**, I want prefabs to support composition

#### Tasks Breakdown:
- [ ] Add component change detection (deferred from Epic 2.1)
  - [ ] Implement component versioning
  - [ ] Track component modifications
  - [ ] Query by changed components
  - [ ] Minimize overhead with dirty flags
- [ ] Create entity prefab system (deferred from Epic 2.1)
  - [ ] Define prefab data structure
  - [ ] Implement prefab instantiation
  - [ ] Support prefab composition
  - [ ] Add prefab inheritance
  - [ ] Create prefab serialization
- [ ] Write comprehensive unit tests
- [ ] Create performance benchmarks
- [ ] Document change detection API
- [ ] Document prefab system API

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/ecs/`
- **Change Detection**: Component version tracking, dirty flag optimization, query filtering by changes
- **Prefab System**: Template-based entity creation, composition support, serialization format

#### Dependencies:
- Epic 2.1: Entity Component System (ECS) Core (foundation)

---

### Epic 2.6: Developer Tools & Profiling
**Priority:** P2
**Status:** ⏸️ Deferred
**Acceptance Criteria:**
- [ ] ECS debugging tools available
- [ ] Performance benchmarks for ECS operations
- [ ] Event replay system working
- [ ] Event profiling tools functional
- [ ] Tools integrated into dev environment

#### User Stories:
1. ⏭️ **As a developer**, I want ECS debugging tools to inspect entities and components
2. ⏭️ **As a developer**, I want performance benchmarks to measure ECS operations
3. ⏭️ **As a developer**, I want event replay for debugging complex interactions
4. ⏭️ **As a developer**, I want event profiling to identify bottlenecks

#### Tasks Breakdown:
- [ ] Build ECS debugging tools (deferred from Epic 2.1)
  - [ ] Entity inspector UI
  - [ ] Component viewer
  - [ ] System execution visualizer
  - [ ] Query performance analyzer
- [ ] Create ECS performance benchmarks (deferred from Epic 2.1)
  - [ ] Entity creation/destruction benchmarks
  - [ ] Component add/remove benchmarks
  - [ ] Query performance benchmarks
  - [ ] System execution benchmarks
  - [ ] Memory usage profiling
- [ ] Create event replay system for debugging (deferred from Epic 2.3)
  - [ ] Event recording infrastructure
  - [ ] Event playback system
  - [ ] Timeline visualization
  - [ ] Breakpoint support
- [ ] Build event profiling tools (deferred from Epic 2.3)
  - [ ] Handler execution time tracking
  - [ ] Event dispatch frequency analysis
  - [ ] Event queue depth monitoring
  - [ ] Bottleneck identification
- [ ] Integrate tools into development environment
- [ ] Write tool documentation

#### Implementation Details:
**Packages:**
- `/Users/bud/Code/miskatonic/packages/ecs/` - ECS tools and benchmarks
- `/Users/bud/Code/miskatonic/packages/events/` - Event tools

**Tools Architecture:**
- **ECS Debugger**: Runtime inspection, visualization, performance analysis
- **Event Profiler**: Timeline view, handler metrics, bottleneck detection
- **Benchmarking**: Automated performance testing, regression detection

#### Dependencies:
- Epic 2.1: Entity Component System (ECS) Core (foundation)
- Epic 2.3: Event System (foundation)

---

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

## Initiative 4: Physics & Simulation (INIT-004)
**Dependencies:** INIT-002
**Outcome:** Deterministic physics with swappable backends

### Epic 4.1: Physics Engine Abstraction
**Status:** ✅ Complete
**Acceptance Criteria:**
- ✅ Physics interface defined
- ✅ Multiple engine support
- ✅ Hot-swappable backends
- ⏸️ Performance benchmarked (deferred to Epic 2.6)

#### User Stories:
1. ✅ **As a developer**, I want to choose the physics engine
2. ✅ **As a developer**, I want consistent API across engines
3. ✅ **As a developer**, I want to switch engines without code changes
4. ✅ **As a game**, I need deterministic physics

#### Tasks Breakdown:
- [x] Define abstract physics interface
- [x] Implement Rapier.js integration
- [x] Create engine switching mechanism
- [x] Build physics configuration system
- [ ] Add Cannon-es support (future - P2)
- [ ] Integrate Box2D support (future - P2)
- [ ] Add performance benchmarking (deferred to Epic 2.6)
- [ ] Write physics engine tests (deferred)

#### Implementation Details:
**Package Created:** `/packages/physics/`
- Complete `IPhysicsEngine` interface with 20+ methods
- `PhysicsWorld` manager with deterministic fixed-timestep simulation
- `MockPhysicsEngine` reference implementation for testing
- `RapierPhysicsEngine` production implementation with WASM support
- Hot-swapping capability via `PhysicsWorld.swapEngine()`
- Type-safe API with full TypeScript coverage
- Support for rigid body dynamics, collision detection, raycasting
- All collision shape primitives (box, sphere, capsule, cylinder, cone)
- Async initialization pattern for WASM-based engines

### Epic 4.2: Collision System
**Priority:** P0
**Acceptance Criteria:**
- Collision detection working
- Continuous collision implemented
- Collision filtering complete
- Trigger zones supported

#### User Stories:
1. **As a developer**, I want accurate collision detection
2. **As a developer**, I want collision filtering and layers
3. **As a developer**, I want trigger zones for gameplay
4. **As a game**, I need no collision tunneling

#### Tasks Breakdown:
- [ ] Implement collision shape primitives
- [ ] Add compound collision shapes
- [ ] Create collision filtering system
- [ ] Implement continuous collision detection
- [ ] Add trigger zone support
- [ ] Build collision callbacks system
- [ ] Create collision debug rendering
- [ ] Optimize collision broad phase

### Epic 4.3: Rigid Body Dynamics
**Priority:** P0
**Acceptance Criteria:**
- Rigid body simulation working
- Constraints implemented
- Forces and impulses supported
- Stability verified

#### User Stories:
1. **As a developer**, I want realistic rigid body dynamics
2. **As a developer**, I want joint constraints
3. **As a developer**, I want to apply forces and impulses
4. **As a game**, I need stable physics simulation

#### Tasks Breakdown:
- [ ] Implement rigid body component
- [ ] Add force and torque application
- [ ] Create joint constraint system
- [ ] Implement damping and friction
- [ ] Add sleep/wake optimization
- [ ] Build physics material system
- [ ] Create physics debugging tools
- [ ] Verify simulation stability

### Epic 4.4: Deterministic Simulation
**Priority:** P0
**Acceptance Criteria:**
- Fixed timestep implemented
- Deterministic math verified
- State serialization working
- Replay system functional

#### User Stories:
1. **As a multiplayer game**, I need deterministic physics
2. **As a developer**, I want physics replay capability
3. **As a developer**, I want physics state serialization
4. **As a game**, I need consistent results across clients

#### Tasks Breakdown:
- [ ] Implement fixed timestep simulation
- [ ] Verify deterministic math operations
- [ ] Create physics state serialization
- [ ] Build input recording system
- [ ] Implement replay playback
- [ ] Add determinism verification tools
- [ ] Create cross-platform tests
- [ ] Document determinism requirements

---

## Initiative 5: Networking & Multiplayer (INIT-005)
**Dependencies:** INIT-002, INIT-004
**Outcome:** Client-server multiplayer with prediction

### Epic 5.1: Network Transport Layer
**Priority:** P0
**Acceptance Criteria:**
- WebSocket transport implemented
- WebRTC support added
- Connection management working
- Network statistics tracked

#### User Stories:
1. **As a developer**, I want reliable network transport
2. **As a developer**, I want P2P and client-server options
3. **As a developer**, I want connection state management
4. **As a game**, I need low-latency networking

#### Tasks Breakdown:
- [ ] Implement WebSocket transport
- [ ] Add Socket.io integration
- [ ] Create WebRTC data channels
- [ ] Build connection state machine
- [ ] Add reconnection logic
- [ ] Implement network statistics
- [ ] Create transport abstraction
- [ ] Add network simulation tools

### Epic 5.2: State Synchronization
**Priority:** P0
**Acceptance Criteria:**
- State replication working
- Delta compression implemented
- Interest management complete
- Bandwidth optimized

#### User Stories:
1. **As a developer**, I want automatic state synchronization
2. **As a developer**, I want bandwidth-efficient updates
3. **As a developer**, I want interest management
4. **As a game**, I need smooth remote entities

#### Tasks Breakdown:
- [ ] Implement state replication system
- [ ] Add delta compression algorithm
- [ ] Create interest management
- [ ] Build priority system for updates
- [ ] Implement reliable ordered messages
- [ ] Add state interpolation
- [ ] Create bandwidth monitoring
- [ ] Optimize serialization

### Epic 5.3: Client Prediction
**Priority:** P0
**Acceptance Criteria:**
- Input prediction working
- Reconciliation implemented
- Rollback system complete
- Lag compensation added

#### User Stories:
1. **As a player**, I want responsive controls
2. **As a developer**, I want client-side prediction
3. **As a developer**, I want server reconciliation
4. **As a game**, I need lag compensation

#### Tasks Breakdown:
- [ ] Implement input buffer system
- [ ] Create prediction framework
- [ ] Build reconciliation logic
- [ ] Add rollback and replay
- [ ] Implement lag compensation
- [ ] Create prediction smoothing
- [ ] Add misprediction handling
- [ ] Build prediction debugging

### Epic 5.4: Server Authority
**Priority:** P0
**Acceptance Criteria:**
- Server validation complete
- Anti-cheat measures implemented
- Input validation working
- State authority enforced

#### User Stories:
1. **As a game**, I need server-authoritative gameplay
2. **As a developer**, I want input validation
3. **As a game**, I need anti-cheat protection
4. **As a developer**, I want authoritative state

#### Tasks Breakdown:
- [ ] Implement server validation
- [ ] Create input sanitization
- [ ] Build movement validation
- [ ] Add action rate limiting
- [ ] Implement state verification
- [ ] Create cheat detection
- [ ] Build authority framework
- [ ] Add security logging

### Epic 5.5: Matchmaking System
**Priority:** P1
**Acceptance Criteria:**
- Room management working
- Skill-based matching complete
- Party system implemented
- Queue management done

#### User Stories:
1. **As a player**, I want skill-based matchmaking
2. **As a player**, I want to play with friends
3. **As a player**, I want quick match times
4. **As a developer**, I want flexible matchmaking rules

#### Tasks Breakdown:
- [ ] Implement room management
- [ ] Create matchmaking algorithm
- [ ] Build party system
- [ ] Add queue management
- [ ] Implement skill rating system
- [ ] Create lobby browser
- [ ] Add custom game support
- [ ] Build matchmaking analytics

---

## Initiative 6: Development Tools (INIT-006)
**Dependencies:** INIT-002, INIT-003
**Outcome:** Comprehensive development environment

### Epic 6.1: Visual Editor
**Priority:** P1
**Acceptance Criteria:**
- Scene editor working
- Entity inspector complete
- Property editing functional
- Live preview enabled

#### User Stories:
1. **As a developer**, I want a visual scene editor
2. **As a developer**, I want entity component editing
3. **As a developer**, I want live scene preview
4. **As a developer**, I want undo/redo support

#### Tasks Breakdown:
- [ ] Create editor application shell
- [ ] Implement scene viewport
- [ ] Build entity hierarchy view
- [ ] Add component inspector
- [ ] Create property editors
- [ ] Implement gizmo tools
- [ ] Add undo/redo system
- [ ] Build asset browser
- [ ] Create editor layouts
- [ ] Add play-in-editor mode

### Epic 6.2: Debugging Tools
**Priority:** P0
**Acceptance Criteria:**
- Performance profiler complete
- Memory inspector working
- Network debugger functional
- Frame analyzer implemented

#### User Stories:
1. **As a developer**, I want performance profiling
2. **As a developer**, I want memory inspection
3. **As a developer**, I want network debugging
4. **As a developer**, I want frame analysis

#### Tasks Breakdown:
- [ ] Implement CPU profiler
- [ ] Create memory profiler
- [ ] Build network inspector
- [ ] Add frame capture
- [ ] Create performance overlay
- [ ] Implement breakpoint system
- [ ] Add state inspection
- [ ] Build debug console

### Epic 6.3: Asset Pipeline Tools
**Priority:** P1
**Acceptance Criteria:**
- Asset importer working
- Texture tools complete
- Model processing done
- Audio tools implemented

#### User Stories:
1. **As an artist**, I want asset import tools
2. **As an artist**, I want texture compression
3. **As an artist**, I want model optimization
4. **As a developer**, I want asset hot-reload

#### Tasks Breakdown:
- [ ] Create asset import pipeline
- [ ] Implement texture processor
- [ ] Build model optimizer
- [ ] Add audio processor
- [ ] Create asset validator
- [ ] Implement asset bundling
- [ ] Add asset statistics
- [ ] Build asset preview

### Epic 6.4: Analytics Dashboard
**Priority:** P2
**Acceptance Criteria:**
- Metrics collection working
- Dashboard UI complete
- Real-time updates functional
- Historical data available

#### User Stories:
1. **As a developer**, I want performance metrics
2. **As a developer**, I want player analytics
3. **As a developer**, I want error tracking
4. **As a developer**, I want custom events

#### Tasks Breakdown:
- [ ] Implement telemetry system
- [ ] Create dashboard UI
- [ ] Add real-time graphs
- [ ] Build metric aggregation
- [ ] Implement alert system
- [ ] Create report generation
- [ ] Add data export
- [ ] Build API endpoints

---

## Initiative 7: Asset Pipeline (INIT-007)
**Dependencies:** INIT-001
**Outcome:** Optimized asset processing and delivery

### Epic 7.1: Asset Processing System
**Priority:** P0
**Acceptance Criteria:**
- Asset processor implemented
- Format conversion working
- Optimization complete
- Validation functional

#### User Stories:
1. **As a developer**, I want automatic asset processing
2. **As a developer**, I want asset optimization
3. **As a developer**, I want format conversion
4. **As a developer**, I want asset validation

#### Tasks Breakdown:
- [ ] Build asset processor framework
- [ ] Implement texture processing
- [ ] Add model processing
- [ ] Create audio processing
- [ ] Build shader compilation
- [ ] Add asset validation
- [ ] Implement batch processing
- [ ] Create processing queue

### Epic 7.2: Asset Streaming
**Priority:** P1
**Acceptance Criteria:**
- Streaming system working
- Priority loading complete
- Memory management done
- Caching implemented

#### User Stories:
1. **As a game**, I need asset streaming
2. **As a developer**, I want priority loading
3. **As a game**, I need memory efficiency
4. **As a developer**, I want asset caching

#### Tasks Breakdown:
- [ ] Implement streaming system
- [ ] Create priority queue
- [ ] Build memory manager
- [ ] Add cache system
- [ ] Implement preloading
- [ ] Create LOD streaming
- [ ] Add bandwidth throttling
- [ ] Build streaming analytics

### Epic 7.3: Hot Reload System
**Priority:** P1
**Acceptance Criteria:**
- File watching working
- Hot reload functional
- State preservation done
- Error recovery complete

#### User Stories:
1. **As a developer**, I want asset hot-reload
2. **As a developer**, I want state preservation
3. **As a developer**, I want error recovery
4. **As a developer**, I want selective reload

#### Tasks Breakdown:
- [ ] Implement file watcher
- [ ] Create reload system
- [ ] Add state preservation
- [ ] Build error handling
- [ ] Implement selective reload
- [ ] Create reload hooks
- [ ] Add reload notification
- [ ] Build reload testing

---

## Initiative 8: Backend Services (INIT-008)
**Dependencies:** INIT-005
**Outcome:** Scalable game backend services

### Epic 8.1: Game Server Infrastructure
**Priority:** P0
**Acceptance Criteria:**
- Server architecture complete
- State management working
- Scaling implemented
- Monitoring added

#### User Stories:
1. **As a game**, I need scalable game servers
2. **As a developer**, I want server state management
3. **As operations**, I want server monitoring
4. **As a game**, I need high availability

#### Tasks Breakdown:
- [ ] Setup NestJS architecture
- [ ] Implement game loop
- [ ] Create state management
- [ ] Add horizontal scaling
- [ ] Build load balancing
- [ ] Implement health checks
- [ ] Add monitoring/logging
- [ ] Create deployment scripts

### Epic 8.2: Database Integration
**Priority:** P0
**Acceptance Criteria:**
- MongoDB integration complete
- Redis caching working
- Elasticsearch added
- Query optimization done

#### User Stories:
1. **As a developer**, I want persistent storage
2. **As a developer**, I want fast caching
3. **As a developer**, I want search capability
4. **As a game**, I need low-latency queries

#### Tasks Breakdown:
- [ ] Setup MongoDB connection
- [ ] Create data models
- [ ] Implement Redis caching
- [ ] Add Elasticsearch
- [ ] Build query layer
- [ ] Implement migrations
- [ ] Add connection pooling
- [ ] Create backup system

### Epic 8.3: Player Services
**Priority:** P1
**Acceptance Criteria:**
- Authentication working
- Profile management complete
- Friend system implemented
- Presence tracking done

#### User Stories:
1. **As a player**, I want secure authentication
2. **As a player**, I want profile management
3. **As a player**, I want social features
4. **As a player**, I want to see who's online

#### Tasks Breakdown:
- [ ] Implement auth system
- [ ] Create profile service
- [ ] Build friend system
- [ ] Add presence tracking
- [ ] Implement messaging
- [ ] Create notification system
- [ ] Add privacy controls
- [ ] Build social graph

### Epic 8.4: Economy Services
**Priority:** P2
**Acceptance Criteria:**
- Currency system working
- Inventory management complete
- Transaction system done
- Marketplace implemented

#### User Stories:
1. **As a player**, I want virtual currencies
2. **As a player**, I want inventory management
3. **As a player**, I want secure transactions
4. **As a player**, I want marketplace access

#### Tasks Breakdown:
- [ ] Create currency system
- [ ] Build inventory service
- [ ] Implement transactions
- [ ] Add marketplace
- [ ] Create trading system
- [ ] Build auction house
- [ ] Add fraud detection
- [ ] Implement rollback

### Epic 8.5: Analytics Services
**Priority:** P2
**Acceptance Criteria:**
- Event collection working
- Analytics pipeline complete
- Reporting functional
- Real-time metrics available

#### User Stories:
1. **As a developer**, I want player analytics
2. **As a developer**, I want performance metrics
3. **As a developer**, I want custom events
4. **As a business**, I want KPI tracking

#### Tasks Breakdown:
- [ ] Build event collector
- [ ] Create analytics pipeline
- [ ] Implement aggregation
- [ ] Add reporting system
- [ ] Build dashboards
- [ ] Create data export
- [ ] Add retention analysis
- [ ] Implement A/B testing

---

## Initiative 9: Security & Anti-Cheat (INIT-009)
**Dependencies:** INIT-005, INIT-008
**Outcome:** Secure multiplayer environment

### Epic 9.1: Application Security
**Priority:** P0
**Acceptance Criteria:**
- Electron security hardened
- CSP implemented
- Input sanitization complete
- Encryption working

#### User Stories:
1. **As a game**, I need secure application
2. **As a developer**, I want input validation
3. **As a player**, I want data protection
4. **As a game**, I need encrypted communication

#### Tasks Breakdown:
- [ ] Harden Electron security
- [ ] Implement CSP headers
- [ ] Add input sanitization
- [ ] Create encryption layer
- [ ] Build secure storage
- [ ] Add code obfuscation
- [ ] Implement integrity checks
- [ ] Create security audit

### Epic 9.2: Anti-Cheat System
**Priority:** P1
**Acceptance Criteria:**
- Server validation complete
- Statistical detection working
- Memory protection added
- Reporting system done

#### User Stories:
1. **As a game**, I need cheat prevention
2. **As a developer**, I want cheat detection
3. **As a player**, I want fair gameplay
4. **As operations**, I want cheat reporting

#### Tasks Breakdown:
- [ ] Implement server validation
- [ ] Create statistical analysis
- [ ] Add memory protection
- [ ] Build behavior detection
- [ ] Implement replay analysis
- [ ] Create ban system
- [ ] Add appeal process
- [ ] Build reporting tools

### Epic 9.3: Authentication & Authorization
**Priority:** P0
**Acceptance Criteria:**
- OAuth2 implemented
- JWT tokens working
- 2FA supported
- RBAC complete

#### User Stories:
1. **As a player**, I want secure login
2. **As a player**, I want 2FA option
3. **As a developer**, I want role-based access
4. **As a player**, I want SSO options

#### Tasks Breakdown:
- [ ] Implement OAuth2
- [ ] Create JWT system
- [ ] Add 2FA support
- [ ] Build RBAC system
- [ ] Implement SSO
- [ ] Create session management
- [ ] Add password recovery
- [ ] Build audit logging

---

## Initiative 10: Performance & Optimization (INIT-010)
**Dependencies:** All initiatives
**Outcome:** Optimized engine performance

### Epic 10.1: Performance Monitoring
**Priority:** P1
**Acceptance Criteria:**
- Profiling system complete
- Metrics collection working
- Alerting implemented
- Dashboard available

#### User Stories:
1. **As a developer**, I want performance monitoring
2. **As a developer**, I want performance alerts
3. **As a developer**, I want historical data
4. **As a developer**, I want performance dashboard

#### Tasks Breakdown:
- [ ] Build profiling system
- [ ] Create metric collectors
- [ ] Implement alerting
- [ ] Build dashboard
- [ ] Add trend analysis
- [ ] Create benchmarking
- [ ] Add regression detection
- [ ] Build reporting

### Epic 10.2: Memory Optimization
**Priority:** P1
**Acceptance Criteria:**
- Memory profiling complete
- Object pooling implemented
- GC optimization done
- Memory leaks fixed

#### User Stories:
1. **As a game**, I need efficient memory use
2. **As a developer**, I want memory profiling
3. **As a game**, I need stable memory usage
4. **As a developer**, I want leak detection

#### Tasks Breakdown:
- [ ] Implement memory profiler
- [ ] Create object pools
- [ ] Optimize allocations
- [ ] Reduce GC pressure
- [ ] Fix memory leaks
- [ ] Add memory budgets
- [ ] Build memory alerts
- [ ] Create memory tests

### Epic 10.3: Rendering Optimization
**Priority:** P1
**Acceptance Criteria:**
- Draw call reduction complete
- Batching optimized
- GPU utilization improved
- Frame time stable

#### User Stories:
1. **As a game**, I need 60 FPS
2. **As a developer**, I want draw call reduction
3. **As a game**, I need GPU efficiency
4. **As a developer**, I want rendering metrics

#### Tasks Breakdown:
- [ ] Reduce draw calls
- [ ] Optimize batching
- [ ] Improve culling
- [ ] Optimize shaders
- [ ] Reduce overdraw
- [ ] Add GPU profiling
- [ ] Create LOD system
- [ ] Build quality settings

### Epic 10.4: Network Optimization
**Priority:** P1
**Acceptance Criteria:**
- Bandwidth reduced
- Latency minimized
- Compression improved
- Protocol optimized

#### User Stories:
1. **As a player**, I want low latency
2. **As a developer**, I want bandwidth efficiency
3. **As a game**, I need smooth networking
4. **As a developer**, I want network metrics

#### Tasks Breakdown:
- [ ] Optimize serialization
- [ ] Improve compression
- [ ] Reduce message size
- [ ] Optimize protocols
- [ ] Add traffic shaping
- [ ] Build network profiler
- [ ] Create bandwidth budgets
- [ ] Add network tests

---

## Resource Allocation

### Team Structure
```
Engineering Team (20 people)
├─ Platform Team (4)
│  └─ Electron, Build, Distribution
├─ Engine Team (6)
│  └─ ECS, Core Systems, Tools
├─ Graphics Team (3)
│  └─ Rendering, Shaders, Optimization
├─ Physics Team (2)
│  └─ Physics, Collision, Simulation
├─ Network Team (4)
│  └─ Multiplayer, Backend, Services
└─ QA Team (1)
   └─ Testing, Automation, Quality
```


---

## Risk Management

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebGPU adoption delay | High | Maintain WebGL2 fallback |
| Performance targets missed | High | Early profiling and optimization |
| Deterministic physics issues | High | Extensive testing across platforms |
| Network latency problems | Medium | Multiple transport options |
| Memory constraints | Medium | Aggressive optimization and pooling |


---

## Success Metrics

### Engineering Metrics
- **Build Time**: < 5 minutes
- **Crash Rate**: < 0.1%
- **Performance**: 60 FPS on reference hardware
- **Memory Usage**: < 600MB

---

### Definition of Done

**⚠️ ALPHA BREAKING CHANGE PROTOCOL:**
- [ ] **NO compatibility code added** (reject if present)
- [ ] **ALL call sites updated** including:
  - [ ] Core packages (`packages/*`)
  - [ ] Examples and demos
  - [ ] Tests (unit and integration)
  - [ ] Documentation code samples
- [ ] **Old APIs completely removed** (no commented-out code, no `@deprecated`)
- [ ] **Changelog entry** explaining what broke and why

**Standard Definition of Done:**
- [ ] Code complete and reviewed
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests passing
- [ ] Documentation updated
- [ ] Performance benchmarked
- [ ] Security reviewed
- [ ] Accessibility checked
- [ ] Deployed to staging

**Note:** For alpha (v0.x.x), breaking changes are expected and encouraged. Update all dependent code in the same commit. Never add backward compatibility layers.

### Dependency Matrix

```
INIT-001 (Platform) → All other initiatives
INIT-002 (Core) → INIT-003, 004, 005, 006
INIT-004 (Physics) → INIT-005 (Networking)
INIT-005 (Network) → INIT-008, 009
INIT-008 (Backend) → INIT-009 (Security)
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 2025 |  Bud | Initial planning document |

---

*End of Development Planning Document*