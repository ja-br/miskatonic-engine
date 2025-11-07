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

