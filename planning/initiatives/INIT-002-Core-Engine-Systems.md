## Initiative 2: Core Engine Systems (INIT-002)
**Dependencies:** INIT-001
**Outcome:** ECS architecture with hot-swappable systems

### Epic 2.1: Entity Component System (ECS) Core ⚠️ **NEEDS REFACTORING**
**Priority:** P0
**Status:** ⚠️ Complete but uses suboptimal storage (object arrays instead of typed arrays)
**Cache Analysis Status:** ❌ **CRITICAL** - Current implementation uses cache-unfriendly object arrays
**Acceptance Criteria:**
-  Entity management system complete
- ❌ Component storage NOT optimized (uses object arrays, not typed arrays)
-  System execution pipeline working
-  Query engine implemented
- ❌ Cache performance NOT validated

**⚠️ BLOCKING ISSUE:** Cache analysis reveals current storage is "Option A" (object arrays) which is:
- 10x slower than typed arrays (per cache analysis)
- Poor spatial locality (objects scattered)
- High GC pressure
- Pointer chasing overhead

**Required:** Epic 2.10 (Component Storage Research) and Epic 2.11 (Cache-Efficient Refactoring)

#### User Stories:
1.  **As a developer**, I want to create entities and attach components dynamically
2.  **As a developer**, I want efficient queries over entity components
3.  **As a developer**, I want ordered system execution
4.  **As a developer**, I want component change detection (deferred to Epic 2.5)

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

### Epic 2.3: Event System  **COMPLETE**
**Priority:** P0
**Status:**  Completed November 2025
**Acceptance Criteria:**
-  Event bus implemented
-  Typed event system working
-  Event priorities and filtering
-  Performance optimized

#### User Stories:
1.  **As a developer**, I want type-safe event publishing and subscription
2.  **As a developer**, I want event priority and ordering control
3.  **As a developer**, I want event filtering and namespacing
4.  **As a system**, I need high-performance event dispatch

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

### Epic 2.4: Resource Management  **COMPLETE**
**Priority:** P0
**Status:**  Completed November 2025
**Acceptance Criteria:**
-  Resource loading system complete
-  Reference counting implemented
-  Memory management optimized
-  Resource hot-reload working

#### User Stories:
1.  **As a developer**, I want automatic resource lifecycle management
2.  **As a developer**, I want resource reference counting
3.  **As a developer**, I want resource hot-reloading
4.  **As a system**, I need efficient memory usage

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
1.  **As a developer**, I want component change detection for reactive systems
2.  **As a developer**, I want entity prefab system for efficient entity creation
3.  **As a developer**, I want change detection to be performant
4.  **As a developer**, I want prefabs to support composition

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
1.  **As a developer**, I want ECS debugging tools to inspect entities and components
2.  **As a developer**, I want performance benchmarks to measure ECS operations
3.  **As a developer**, I want event replay for debugging complex interactions
4.  **As a developer**, I want event profiling to identify bottlenecks

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

### Epic 2.7: Main Engine Class  **COMPLETE**
**Priority:** P0 - CRITICAL
**Status:**  Completed November 2025
**Dependencies:** Epic 2.1 (ECS), Epic 2.3 (Events), Epic 2.4 (Resources)
**Complexity:** Medium
**Estimated Effort:** 2-3 weeks

**Problem Statement:**
We have built excellent individual systems (ECS, Events, Resources, Physics, Network), but there is no integration layer that coordinates them into a functioning game engine. We need a `MiskatonicEngine` main class that manages system lifecycle, configuration, and provides a unified API.

**Acceptance Criteria:**
-  Can initialize engine with configuration
-  Can start/stop engine cleanly
-  All systems registered and accessible via clean API
-  Clean shutdown with resource cleanup
-  Example game runs from main engine class
-  Configuration system with sensible defaults
-  System lifecycle management (init, update, shutdown)

#### User Stories:
1. **As a developer**, I want to initialize the engine with a single configuration object
2. **As a developer**, I want to access all engine systems through a unified API
3. **As a developer**, I want the engine to handle startup/shutdown sequences automatically
4. **As a developer**, I want sensible defaults that work out of the box
5. **As a game**, I need clean resource cleanup on shutdown

#### Tasks Breakdown:
- [x] Design `EngineConfig` interface with all system configurations
- [x] Implement `MiskatonicEngine` main class
- [x] Add system registration and lifecycle management
- [x] Create initialization sequence (load config → init systems → verify)
- [x] Implement shutdown sequence (pause → cleanup → release)
- [x] Add system accessor API (`engine.world`, `engine.physics`, etc.)
- [x] Create default configuration with fail-safe values
- [x] Add configuration validation and error handling
- [x] Implement engine state management (initializing, running, paused, stopped)
- [x] Create engine event bus integration
- [x] Write comprehensive unit tests (44/44 passing, 100% coverage)
- [x] Create example: minimal game using MiskatonicEngine
- [x] Document API with JSDoc and examples

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/core/` (NEW)

**API Design:**
```typescript
interface EngineConfig {
  targetFPS: number;              // Default: 60
  fixedTimestep: number;          // Default: 1/60
  maxDeltaTime: number;           // Default: 0.1
  physics: PhysicsConfig;
  rendering: RenderingConfig;
  network: NetworkConfig;
  debug: DebugConfig;
  performance: PerformanceConfig;
}

class MiskatonicEngine {
  // Lifecycle
  static async create(config: Partial<EngineConfig>): Promise<MiskatonicEngine>;
  async initialize(): Promise<void>;
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  async shutdown(): Promise<void>;

  // System access
  get world(): World;
  get events(): EventBus;
  get resources(): ResourceManager;
  get physics(): PhysicsWorld;
  get network(): StateReplicationManager;
  get renderer(): IRenderer;

  // Configuration
  updateConfig(partial: Partial<EngineConfig>): void;
  getConfig(): Readonly<EngineConfig>;

  // Extension
  registerSystem(system: System): void;
  unregisterSystem(system: System): void;
}
```

**Key Features:**
- Progressive enhancement (simple defaults, deep customization available)
- Fail-safe defaults for all configurations
- Observable state via event bus
- Clean separation of concerns
- Type-safe configuration with validation

#### Design Principles:
1. **Progressive Enhancement**: Works with `{}` config, allows deep customization
2. **Fail-Safe Defaults**: Every config option has sensible default
3. **Observable State**: All state changes emit events
4. **Clean API**: Hide complexity, expose only what's needed

#### Dependencies:
- Epic 2.1: Entity Component System (ECS) Core ( complete)
- Epic 2.3: Event System ( complete)
- Epic 2.4: Resource Management ( complete)
- Physics Engine ( complete)
- Network Sync ( complete)

---

### Epic 2.8: Game Loop Architecture  **COMPLETE**
**Priority:** P0 - CRITICAL
**Status:**  Completed November 2025
**Dependencies:** Epic 2.7 (Main Engine Class)
**Complexity:** Medium
**Estimated Effort:** 1-2 weeks

**Problem Statement:**
We have no defined execution flow for the game loop. Unclear which systems run when, no fixed vs variable timestep distinction, and no coordination of frame execution phases. Need a robust game loop that handles Input → Update → Simulate → Render with proper timestep management.

**Acceptance Criteria:**
-  Documented execution order (phase-based)
-  60 FPS game loop working
-  Fixed timestep for physics (16.67ms)
-  Variable timestep for rendering
-  Systems execute in correct order
-  Frame pacing consistent
-  Handles spiral of death (max delta time)

#### User Stories:
1. **As a developer**, I want clear documentation of when each system executes
2. **As a physics system**, I need fixed timestep for determinism
3. **As a rendering system**, I need variable timestep for smooth visuals
4. **As a developer**, I want to register systems with execution order
5. **As a game**, I need consistent frame pacing (no stuttering)

#### Tasks Breakdown:
- [x] Design phase-based execution model (PRE_UPDATE, UPDATE, POST_UPDATE, RENDER)
- [x] Implement `GameLoop` class with accumulator pattern
- [x] Create `SystemPhase` enum and phase management
- [x] Add fixed timestep for physics (accumulator with substeps)
- [x] Add variable timestep for rendering with interpolation
- [x] Implement frame pacing (requestAnimationFrame integration)
- [x] Add spiral of death protection (max delta time clamp)
- [x] Priority-based system ordering within phases
- [x] Add frame timing statistics
- [x] Write comprehensive unit tests (18/18 passing, 100% coverage)
- [x] Integrate with MiskatonicEngine
- [x] Document execution phases and timestep behavior

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/core/`

**Game Loop Structure:**
```typescript
enum SystemPhase {
  PRE_UPDATE,   // Early update (spawning, despawning)
  UPDATE,       // Main game logic
  POST_UPDATE,  // Late update (camera follow, etc.)
  RENDER,       // Rendering prep
}

interface SystemDependencies {
  runAfter?: System[];
  runBefore?: System[];
  phase: SystemPhase;
}

abstract class System {
  abstract name: string;
  abstract budget: number; // ms
  abstract dependencies: SystemDependencies;
  abstract update(deltaTime: number): void;

  initialize?(): void;
  shutdown?(): void;
}

class GameLoop {
  private accumulator: number = 0;
  private lastFrameTime: number = 0;

  run(): void; // Start loop
  stop(): void; // Stop loop
  private tick(): void; // Single frame
  private updateSystems(phase: SystemPhase, dt: number): void;
}
```

**Execution Flow:**
```
Frame N:
  0ms    → Input (variable dt)
  1ms    → PRE_UPDATE systems (variable dt)
  3ms    → UPDATE systems (variable dt)
  6ms    → POST_UPDATE systems (variable dt)
  8ms    → Physics (fixed 16.67ms via accumulator)
  12ms   → RENDER systems (variable dt with interpolation)
  16.67ms → Frame end
```

**Key Features:**
- Phase-based execution (clear ordering)
- Fixed timestep for physics (deterministic)
- Variable timestep for rendering (smooth)
- Accumulator pattern (handles variable frame times)
- Frame pacing (consistent 60 FPS target)
- Spiral of death protection (max delta clamp)

#### Design Principles:
1. **Phase-Based Execution**: Fixed phases, flexible ordering within
2. **Timestep Separation**: Fixed for physics, variable for rendering
3. **Frame Budget Awareness**: Each system has time budget
4. **Predictable Ordering**: Topological sort ensures dependencies

#### Dependencies:
- Epic 2.7: Main Engine Class (foundation)
- Epic 2.1: Entity Component System (systems to execute)

---

### Epic 2.9: Command System  **COMPLETE**
**Priority:** P1 - IMPORTANT
**Status:**  Completed November 2025
**Dependencies:** Epic 2.7 (Main Engine), Epic 2.3 (Events)
**Complexity:** Low-Medium
**Estimated Effort:** 1 week

**Problem Statement:**
Event bus is great for notifications ("something happened"), but we need a command pattern for imperative actions ("do this thing"). Commands should be validated, queued, and executed with guaranteed handlers. This enables debug console, scripting, and UI actions.

**Acceptance Criteria:**
-  Commands can be registered with handlers
-  Commands can be sent synchronously or queued
-  Commands can be validated before execution
-  Debug console can execute commands
-  Example commands work (spawn entity, change physics, etc.)
-  Command history tracking
-  Undo/redo support (optional)

#### User Stories:
1. **As a developer**, I want to register commands with typed handlers
2. **As a debug console**, I need to execute commands from text input
3. **As a developer**, I want command validation before execution
4. **As a developer**, I want to queue commands for batch execution
5. **As a UI system**, I need to send commands for user actions

#### Tasks Breakdown:
- [x] Design command interface and handler types with Zod schemas
- [x] Implement `CommandRegistry` for registration with aliases and categories
- [x] Create `CommandBus` for execution
- [x] Add command validation (Zod schema-based)
- [x] Implement synchronous and async command execution
- [x] Add command queuing and frame-based processing
- [x] Create command history tracking with configurable size
- [x] Implement undo/redo support for reversible commands
- [x] Create 8 built-in commands (help, echo, stats, clear, state, config, pause, resume)
- [x] Integrate with event bus for command events
- [x] Write comprehensive unit tests (66/66 passing, 100% coverage)
- [x] Document command API with examples in README

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/core/src/commands/` (integrated with @miskatonic/core)

**API Design:**
```typescript
interface Command {
  type: string;
  args: Record<string, any>;
}

type CommandHandler<T extends Command> = (cmd: T) => void | Promise<void>;

interface CommandDefinition<T extends Command> {
  type: string;
  description: string;
  validate?: (args: any) => args is T['args'];
  handler: CommandHandler<T>;
}

class CommandRegistry {
  register<T extends Command>(def: CommandDefinition<T>): void;
  unregister(type: string): void;
  get(type: string): CommandDefinition<any> | undefined;
  list(): CommandDefinition<any>[];
}

class CommandBus {
  execute(command: Command): Promise<void>;
  executeSync(command: Command): void;
  queue(command: Command): void;
  flush(): Promise<void>;
  parse(text: string): Command;
  getSuggestions(partial: string): string[];
}
```

**Example Commands:**
```typescript
// Register command
commandBus.register({
  type: 'spawn',
  description: 'Spawn entity at position',
  validate: (args): args is { type: string; x: number; y: number } => {
    return typeof args.type === 'string' &&
           typeof args.x === 'number' &&
           typeof args.y === 'number';
  },
  handler: async ({ type, x, y }) => {
    const entity = world.createEntity();
    world.addComponent(entity, Position, { x, y, z: 0 });
    // ... add other components based on type
  }
});

// Execute command
await commandBus.execute({ type: 'spawn', args: { type: 'player', x: 10, y: 5 } });

// Parse from text
const cmd = commandBus.parse('spawn player 10 5');
await commandBus.execute(cmd);
```

**Standard Commands:**
- `spawn <type> <x> <y> <z>` - Create entity
- `destroy <entityId>` - Remove entity
- `inspect <entityId>` - Show entity details
- `list entities` - List all entities
- `list systems` - List all systems
- `set <component>.<field> <value>` - Modify component
- `get <component>.<field>` - Read component value
- `physics.gravity <x> <y> <z>` - Set gravity
- `physics.pause` - Pause physics
- `physics.step` - Single physics step
- `help <command>` - Show command help

#### Design Principles:
1. **Type Safety**: Full TypeScript typing with validation
2. **Extensibility**: Easy to add new commands
3. **Validation**: Commands validated before execution
4. **Integration**: Works with debug console, UI, scripting

#### Dependencies:
- Epic 2.7: Main Engine Class (access to systems)
- Epic 2.3: Event System (command events)

#### Code Quality:
- 100% test coverage (137/137 tests passing: 19 registry + 20 bus + 27 integration + 62 engine + 9 security)
- TypeScript strict mode throughout
- Full Zod schema validation on all command inputs
- Comprehensive event integration
- Production-ready with all features implemented
- All CRITICAL security issues resolved (rate limiting, queue limits, timeouts, shutdown cleanup)

#### Key Features Delivered:
- **CommandRegistry** - Central registration with alias and category support
- **CommandBus** - Execution engine with validation, queueing, history, undo
- **CommandSystem** - Unified API coordinating registry and bus
- **8 Built-in Commands** - help, echo, stats, clear, state, config, pause, resume
- **Zod Validation** - Type-safe input validation with detailed error messages
- **Command Queue** - Frame-based batch processing integrated with game loop
- **History & Undo** - Full command history with undo/redo support
- **Event Integration** - Complete lifecycle events (registered, executed, failed, validation-failed)
- **Introspection** - List commands, categories, get command info
- **Documentation** - Comprehensive README with examples

#### Security Features:
- **Rate Limiting** - 100 commands/second maximum (sliding window algorithm)
- **Queue Size Limit** - 1000 commands maximum (prevents memory exhaustion)
- **Command Timeout** - 30 second execution timeout (prevents infinite loops)
- **Shutdown Cleanup** - Proper cleanup of queued commands and resources on engine shutdown
- **Input Sanitization** - Try-catch blocks and optional chaining in built-in commands
- **Undo Safety** - Fixed array corruption bug using findLastIndex pattern
- **Security Test Suite** - 9 comprehensive tests covering all CRITICAL security issues

---

### Epic 2.10: Component Storage Research & Benchmarking  **COMPLETE**
**Priority:** P0 - CRITICAL (BLOCKS PERFORMANCE)
**Status:**  Completed November 2025
**Dependencies:** None (foundational research)
**Complexity:** Medium
**Estimated Effort:** 1-2 weeks

**Problem Statement:**
Current ECS uses object arrays (cache-unfriendly "Option A"). Cache analysis shows this is 10x slower than typed arrays (SoA). Need to benchmark all storage options and make data-driven decision before refactoring.

**From Cache Analysis:**
> "Component storage strategy undefined (P0 - BLOCKS EVERYTHING)"
> "Sequential vs random: ~10x expected"
> "Objects vs typed arrays: ~10x expected"

**Acceptance Criteria:**
-  All storage options benchmarked (objects, typed arrays SoA, hybrid)
-  Sequential vs random access measured (1.55x penalty at 100k scale)
-  Loop ordering impact validated (1.08x penalty at 100k scale)
-  GC impact measured for each option
-  Storage decision made with data: **Typed Arrays (SoA)**
-  Performance validated: **4.16x speedup** at 100k entities

#### User Stories:
1. **As an engineer**, I want benchmark data comparing storage options
2. **As an engineer**, I want to validate cache analysis predictions (~10x)
3. **As an engineer**, I want GC pressure measurements
4. **As an engineer**, I want clear storage decision with rationale
5. **As a developer**, I want component API that's both fast and ergonomic

#### Tasks Breakdown:
- [x] Implement benchmark: Object arrays (AoS) iteration
- [x] Implement benchmark: Typed arrays (SoA) iteration
- [x] Implement benchmark: Hybrid (objects backed by typed arrays)
- [x] Implement benchmark: Sequential vs random access
- [x] Implement benchmark: Loop ordering (cache effects)
- [x] Measure GC pressure for each approach
- [x] Test at multiple scales (1k, 10k, 100k entities)
- [x] Compare results against cache analysis predictions
- [x] Document findings and rationale
- [x] Make storage decision: **Typed Arrays (SoA)** - 4.16x speedup validated
- [x] Define component storage API (in FINDINGS.md)
- [x] Create migration plan (Epic 2.11 will implement)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/benchmarks/storage/` (NEW)

**Benchmark Suite:**
```typescript
// Test 1: Sequential vs Random (validate 10x prediction)
const positions = new Float32Array(100000);

// Sequential
for (let i = 0; i < positions.length; i++) {
  positions[i] *= 2;
}

// Random
for (const i of shuffledIndices) {
  positions[i] *= 2;
}

// Test 2: Object vs Typed Array
// Test 3: Loop ordering (article's example)
// Test 4: Component size impact
```

**Storage Options to Test:**

**Option A: Object Arrays (Current)**
```typescript
const positions: { x: number, y: number, z: number }[] = [];
// Expected: Baseline (slowest)
```

**Option B: SoA Typed Arrays (Recommended)**
```typescript
class PositionStorage {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
}
// Expected: 10x faster than Option A
```

**Option C: Hybrid**
```typescript
class Position {
  constructor(private storage: Float32Array, private index: number) {}
  get x() { return this.storage[this.index * 3]; }
}
// Expected: 3-5x faster than Option A
```

**Key Metrics:**
- Iteration time (ms per 100k components)
- GC allocations per frame
- Memory overhead per component
- API ergonomics (developer experience)

#### Design Principles:
1. **Data-Driven**: Decision based on actual benchmarks, not assumptions
2. **Validate Theory**: Confirm cache analysis predictions (~10x)
3. **Real-World**: Test at production scales (100k+ entities)
4. **Practical**: Consider API ergonomics alongside performance

#### Dependencies:
- None (foundational research)

**Deliverables:**
-  Benchmark suite with results (benchmarks/storage/)
-  Performance comparison report (FINDINGS.md)
-  Storage decision document (README.md + FINDINGS.md)
-  Component API specification (in FINDINGS.md)
-  Migration plan (deferred to Epic 2.11)

#### Results Summary:

**Performance (100,000 entities, 1000 iterations):**
- Object Arrays (baseline): 0.611 ms/iteration
- Typed Arrays (SoA): 0.147 ms/iteration - **4.16x faster** 
- Hybrid: 0.330 ms/iteration - 1.85x faster

**Cache Effects:**
- Sequential vs Random: 1.55x penalty (less than predicted 10x, but validates principle)
- Loop Ordering: 1.08x penalty (minimal impact due to modern CPU optimizations)

**GC Pressure:**
- Object Arrays: 0 allocations per iteration (100k one-time setup)
- Typed Arrays: 0 allocations per iteration (6 one-time arrays)
- Hybrid: 200,000 allocations (wrapper objects) - **REJECTED**

**Decision:**
 **Typed Arrays (SoA)** - Proceed to Epic 2.11 for refactoring
- 4.16x performance improvement validated
- Zero GC pressure
- Cache-friendly sequential layout
- SIMD optimization potential

**Files Created:**
- `benchmarks/storage/package.json`
- `benchmarks/storage/benchmark-runner.js`
- `benchmarks/storage/option-a-objects.js`
- `benchmarks/storage/option-b-typed-arrays.js`
- `benchmarks/storage/option-c-hybrid.js`
- `benchmarks/storage/sequential-vs-random.js`
- `benchmarks/storage/loop-ordering.js`
- `benchmarks/storage/README.md`
- `benchmarks/storage/FINDINGS.md`

---

### Epic 2.11: Cache-Efficient ECS Refactoring
**Priority:** P0 - CRITICAL
**Status:** 🔨 IN PROGRESS - Core refactoring complete, tests in progress
**Dependencies:** Epic 2.10 (Storage Research)  COMPLETE
**Complexity:** High
**Estimated Effort:** 3-4 weeks
**Actual Effort:** ~1 week core implementation + code-critic review fixes

**Problem Statement:**
Current ECS implementation uses cache-unfriendly object arrays. Epic 2.10 benchmarks validate that SoA typed arrays provide **4.16x performance improvement** at 100k entity scale on Apple Silicon, with zero GC pressure. Need to refactor Archetype storage to realize these validated gains. Note: x86 platforms with smaller L1 caches may show even higher speedups (est. 5-10x) as object arrays suffer more on constrained cache hierarchies.

**Implementation Summary (November 2025):**
-  Created ComponentStorage class (SoA pattern with typed arrays)
-  Created ComponentRegistry for schema management
-  Refactored Archetype & ArchetypeManager to use ComponentStorage
-  Updated World and Query systems for new storage
-  Fixed 6 CRITICAL/HIGH issues identified by code-critic:
  1. Removed count management from ComponentStorage (Archetype is single source of truth)
  2. Fixed count synchronization bugs
  3. Hidden typed arrays behind accessor methods
  4. Documented breaking changes (MIGRATION.md)
  5. Added integer overflow protection (max 2^30 entities)
  6. Added type validation for component values
- 🔨 Tests partially updated (Entity: 18/18 passing, Archetype: partial, World: partial)
-  Performance validation pending
-  x86 cross-platform validation pending

**Acceptance Criteria:**
-  Archetype storage refactored to use SoA typed arrays (validated in Epic 2.10: 4.16x speedup)
-  Component iteration >100k components/ms (Epic 2.10 achieved: 680k components/ms on Apple Silicon) - validation pending
-  Sequential access implemented (Epic 2.10: 1.55x at 100k scale)
-  Higher penalties expected on x86 platforms (validation required - smaller L1 caches)
-  GC pressure <100 objects/frame (Epic 2.10 validated: 0 allocations per iteration)
-  All 65 tests still passing (IN PROGRESS: 18/65 passing, others need API updates)
-  Migration guide provided (packages/ecs/MIGRATION.md)
-  Cache performance benchmarks validation pending
-  Cross-platform validation on x86 hardware pending

#### User Stories:
1. **As a game**, I need 4x+ faster component iteration (Epic 2.10 validated: 4.16x on Apple Silicon)
2. **As a game**, I need minimal GC pressure (Epic 2.10 validated: 0 allocations per iteration)
3. **As a developer**, I want the same ECS API (or clear migration guide)
4. **As a system**, I need cache-friendly iteration patterns
5. **As an engineer**, I want validated cache performance across platforms (Apple Silicon + x86)

#### Tasks Breakdown:
- [x] Design new Archetype storage (SoA typed arrays per Epic 2.10 decision)
- [x] Implement component storage abstraction (ComponentStorage class)
- [x] Refactor ArchetypeManager to use new storage
- [x] Update component add/remove operations (setComponentData, swap methods)
- [x] Implement entity migration between archetypes (still works via World.addComponent/removeComponent)
- [x] Refactor query system for new storage (uses archetype.count)
- [x] Fix CRITICAL issues from code-critic review:
  - [x] Remove count management from ComponentStorage (single source of truth: Archetype)
  - [x] Add integer overflow protection (max 2^30 entities)
  - [x] Add type validation (finite numbers only)
  - [x] Hide typed arrays behind accessor methods (getEntities, getEntityAt)
  - [x] Document breaking changes (MIGRATION.md)
- [ ] Update all 65 tests for new storage (PARTIALLY DONE: Archetype.test.ts and World.test.ts updated)
- [ ] Add cache performance benchmarks
- [x] Create migration guide (MIGRATION.md created)
- [ ] Validate 4x+ improvement over old implementation (Epic 2.10: 4.16x on Apple Silicon)
- [ ] Run benchmarks on x86 hardware (Intel/AMD) to validate higher expected speedup
- [ ] Compare Apple Silicon vs x86 cache penalty differences
- [ ] Document platform-specific performance characteristics
- [ ] Document cache-aware iteration patterns
- [ ] Add component size guidelines (<64 bytes for x86, note 128B cache lines on Apple Silicon)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/ecs/`

**New Archetype Storage (SoA):**
```typescript
class Archetype {
  private entityIds: Uint32Array;
  private components: Map<ComponentType, ComponentStorage>;

  // Component storage per type
  class ComponentStorage<T> {
    private arrays: Map<keyof T, TypedArray>;

    get(index: number, field: keyof T): any {
      return this.arrays.get(field)![index];
    }

    set(index: number, field: keyof T, value: any): void {
      this.arrays.get(field)![index] = value;
    }
  }
}
```

**Cache-Aware System Pattern:**
```typescript
class MovementSystem {
  update(dt: number) {
    // Iterate archetypes (spatial locality)
    for (const archetype of this.archetypes) {
      const positions = archetype.getStorage(Position);
      const velocities = archetype.getStorage(Velocity);

      // Sequential iteration (temporal locality)
      for (let i = 0; i < archetype.count; i++) {
        positions.x[i] += velocities.x[i] * dt;
        positions.y[i] += velocities.y[i] * dt;
        positions.z[i] += velocities.z[i] * dt;
      }
    }
  }
}
```

**Performance Requirements:**
- Component iteration: >100k components/ms (Epic 2.10: 680k components/ms on Apple Silicon)
- Query execution: <1ms for 1000 entities
- Archetype migration: <1ms for 1000 entities
- GC pressure: <100 objects/frame (Epic 2.10: 0 objects/iteration validated)
- Memory: ~12 bytes per component (typed arrays, vs 48 bytes for objects)

**Platform Considerations:**
- **Benchmarks performed on Apple Silicon** (M1/M2 with 128KB L1 cache, 128-byte cache lines)
- **x86 platforms (Intel/AMD)** have smaller L1 caches (32-48KB) and 64-byte cache lines
- **Conservative assumption:** 4x minimum speedup (validated on Apple Silicon)
- **Expected on x86:** 5-10x speedup due to object arrays suffering more from smaller caches
- **Design principle:** Optimize for x86 (worst case), validate on both platforms

**Validation:**
- Sequential vs random: 1.55x difference on Apple Silicon (Epic 2.10), potentially 3-10x on x86
- New vs old: 4.16x improvement validated at 100k entities (Epic 2.10)
- Scaling behavior: 1.51x → 1.71x → 4.16x speedup (1k → 10k → 100k entities)
- Production test: Smooth 60 FPS with 10k+ entities
- Cross-platform: Validate on x86 hardware (Intel/AMD)

#### Design Principles:
1. **Cache First**: Spatial locality, sequential access, small structures
2. **Validate Performance**: Benchmark everything, no regressions
3. **API Stability**: Minimize breaking changes if possible
4. **Documentation**: Clear migration guide and patterns

#### Dependencies:
- Epic 2.10: Component Storage Research (provides decision)

**Deliverables:**
- Refactored archetype storage
- All tests passing
- Cache performance benchmarks
- Migration guide
- System design pattern documentation

---

### Epic 2.12: Cache-Aware System Design Guidelines
**Priority:** P1 - IMPORTANT
**Status:**  Not Started
**Dependencies:** Epic 2.11 (Cache-Efficient Refactoring)
**Complexity:** Low
**Estimated Effort:** 1 week

**Problem Statement:**
Developers need clear guidelines for writing cache-efficient systems. Without patterns, they could write cache-unfriendly code that destroys the 4.16x performance gain (up to 10x on x86) from Epic 2.11.

**From Epic 2.10 Benchmarks:**
- Cache penalties less pronounced than predicted: 1.55x for random access (vs predicted 10x) on Apple Silicon
- Loop ordering penalty minimal: 1.08x (vs predicted 10-100x) on Apple Silicon
- Modern CPUs (especially Apple Silicon) have sophisticated prefetchers masking some "bad" patterns
- However, typed arrays still provide 4.16x speedup, validating cache-aware design principles
- x86 platforms with smaller caches expected to show higher penalties (3-10x)

**Acceptance Criteria:**
-  System design patterns documented
-  Code examples (good vs bad patterns)
-  Component size guidelines (<64 bytes)
-  Loop ordering rules defined
-  Code review checklist created
-  All examples benchmarked to show difference

#### User Stories:
1. **As a developer**, I want clear patterns for cache-efficient systems
2. **As a developer**, I want code examples showing good vs bad patterns
3. **As a developer**, I want component design guidelines
4. **As a reviewer**, I want checklist for cache-aware code review
5. **As a team**, I want to avoid cache-unfriendly patterns

#### Tasks Breakdown:
- [ ] Document mandatory iteration pattern (sequential archetype iteration)
- [ ] Create code examples: Good patterns (sequential, batched)
- [ ] Create code examples: Bad patterns (random, scattered)
- [ ] Benchmark examples to show performance difference
- [ ] Define component size guidelines (<64 bytes target)
- [ ] Document loop ordering rules
- [ ] Create component design patterns (split large components)
- [ ] Build code review checklist
- [ ] Add linting rules (if feasible)
- [ ] Document access pattern best practices

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/docs/ecs-patterns.md` (NEW)

**Mandatory Pattern: Sequential Archetype Iteration**
```typescript
//  GOOD: Cache-friendly
class MovementSystem {
  update(dt: number) {
    for (const archetype of this.archetypes) {
      const pos = archetype.getStorage(Position);
      const vel = archetype.getStorage(Velocity);

      // Sequential access
      for (let i = 0; i < archetype.count; i++) {
        pos.x[i] += vel.x[i] * dt;
        pos.y[i] += vel.y[i] * dt;
        pos.z[i] += vel.z[i] * dt;
      }
    }
  }
}

// ❌ BAD: Cache-unfriendly (1.5-10x slower depending on platform)
// Note: Apple Silicon shows ~1.55x penalty, x86 may be 3-10x worse due to smaller caches
class MovementSystem {
  update(dt: number) {
    for (const entityId of randomEntityIds) {
      const entity = world.getEntity(entityId);  // Random lookup
      entity.position.add(entity.velocity);       // Pointer chasing
    }
  }
}
```

### Modern CPU Realities vs Theoretical Penalties

Epic 2.10 benchmarks revealed that **theoretical cache penalties are less extreme in practice** on modern hardware:

| Pattern | Theoretical Prediction | Apple Silicon (Actual) | x86 (Expected) |
|---------|----------------------|----------------------|----------------|
| Random vs Sequential Access | ~10x | **1.55x** | 3-5x |
| Bad Loop Ordering | 10-100x | **1.08x** | 2-10x |
| Objects vs Typed Arrays | ~10x | **4.16x** | 5-10x |

**Why are penalties lower than predicted?**
1. **V8 JIT optimizations** - Hidden class caching, inline caching, TurboFan optimizations
2. **Modern hardware prefetchers** - Especially sophisticated on Apple Silicon (DMP prefetcher)
3. **Large caches** - Working set (100k entities) fits in L3/SLC for many workloads
4. **Out-of-order execution** - Modern CPUs hide memory latency through instruction reordering
5. **Apple Silicon advantages** - 128KB L1 cache (vs 32-48KB x86), 128-byte cache lines

**However:**
- 4.16x speedup from typed arrays is still substantial and production-critical
- Penalties increase with scale: 1.51x → 1.71x → 4.16x (1k → 10k → 100k entities)
- x86 platforms with smaller caches will likely show worse penalties (closer to theoretical)
- Cache-aware design remains critical for hitting 60 FPS target with 1000+ entities

**Guideline:** Design as if penalties are 10x (conservative approach for x86), but don't panic if Apple Silicon benchmarks show lower penalties. The fundamental principles (sequential access, small components, typed arrays) remain valid regardless of exact penalty magnitude.

**Component Size Guidelines:**
```typescript
//  GOOD: Small, focused (<64 bytes target)
// Rationale: 64 bytes = typical x86 cache line size
// Note: Apple Silicon uses 128-byte cache lines, but target 64 bytes for x86 compatibility
interface Position { x: number; y: number; z: number; } // 12 bytes (Float32Array in SoA)

// ⚠️ ACCEPTABLE: Medium components (64-128 bytes)
// May span cache lines on x86 but acceptable if access pattern is sequential
interface Transform {
  position: [number, number, number];   // 12 bytes
  rotation: [number, number, number];   // 12 bytes
  scale: [number, number, number];      // 12 bytes
  matrix: Float32Array;                 // 64 bytes
  // Total: 100 bytes (spans 2 cache lines on x86, fits in 1 on Apple Silicon)
}

// ❌ BAD: Large, unfocused (>128 bytes)
interface Character {
  x, y, z: number;              // 12 bytes (typed array)
  vx, vy, vz: number;           // 12 bytes
  health, mana, level: number;  // 12 bytes
  inventory: any[];             // Variable, unpredictable
  // Total: >128 bytes, spans multiple cache lines on all platforms
}
// Solution: Split into Position + Velocity + Stats + Inventory (separate components)
```

**Code Review Checklist:**
- [ ] System uses sequential iteration (not random access)
- [ ] No entity lookups in hot loops
- [ ] Components <64 bytes target, <128 bytes maximum (or justified with benchmark)
- [ ] Loop ordering is cache-friendly (sequential array access)
- [ ] No unnecessary pointer chasing
- [ ] Performance validated on both Apple Silicon and x86 (for critical paths)
- [ ] GC allocations measured in hot paths (<100 objects/frame)
- [ ] References Epic 2.10 benchmark results where applicable

### Platform-Specific Guidelines

**Apple Silicon (M1/M2/M3):**
- **L1 Cache:** 128KB data + 192KB instruction (performance cores)
- **Cache Lines:** 128 bytes
- **Prefetcher:** Sophisticated DMP (data memory-dependent prefetcher)
- **Result:** Cache penalties less pronounced (~1.5x for random access at 100k scale)
- **Implication:** More forgiving of suboptimal patterns, use for optimistic validation

**x86 (Intel/AMD):**
- **L1 Cache:** 32-48KB typical
- **Cache Lines:** 64 bytes
- **Prefetcher:** Less aggressive (varies by generation)
- **Expected:** Higher cache penalties (~3-10x for random access)
- **Implication:** Design and optimize for x86 (conservative), ensures good performance everywhere

**Cross-Platform Design Principles:**
1. **Optimize for x86** (worst case) - Use 64-byte component size target
2. **Validate on both platforms** - Don't rely solely on Apple Silicon results
3. **Performance budgets based on x86** - Conservative approach ensures targets met
4. **Apple Silicon is "easy mode"** - If it runs well on x86, it will excel on Apple Silicon
5. **Test at scale** - Cache effects amplify at 100k+ entities

**When to Test Cross-Platform:**
- Critical rendering paths (every frame)
- Physics simulation loops
- Large-scale entity iteration (>10k entities)
- System registration/hot paths
- Performance-critical algorithms

#### Design Principles:
1. **Sequential First**: Default to sequential iteration
2. **Justify Exceptions**: Random access requires strong rationale
3. **Small Components**: <64 bytes target (cache line mental model)
4. **Enforce Patterns**: Code review catches violations

#### Dependencies:
- Epic 2.11: Cache-Efficient Refactoring (provides patterns to document)

**Deliverables:**
- System design pattern guide
- Code example library
- Component design guidelines
- Code review checklist

---

### Epic 2.13: Memory Management Foundation
**Priority:** P0 - CRITICAL
**Status:**  Not Started
**Dependencies:** None (foundational)
**Complexity:** Medium
**Estimated Effort:** 3-4 weeks

**Problem Statement:**
Memory management is not treated as a first-class concern despite being critical for 60 FPS with 1000+ objects. No GC mitigation strategy, no frame allocators, no object pooling infrastructure. GC pauses can break the 16.67ms frame budget.

**From Memory Analysis:**
> "Memory management is not optional for Miskatonic's performance targets."
> "GC pause >5ms leaves only 11.67ms for actual work"

**Acceptance Criteria:**
-  Object pool infrastructure implemented (generic, reusable)
-  Frame allocator implemented (ArrayBuffer-based)
-  GC monitoring integrated (pause tracking, heap stats)
-  GC pause budget enforced (<5ms)
-  Per-frame allocation tracking working
-  Memory profiling available in dev mode
-  V8 tuning strategy documented

#### User Stories:
1. **As a developer**, I want to pool reusable objects to reduce GC pressure
2. **As a system**, I need frame-based temporary allocation without GC
3. **As an engineer**, I want to monitor GC pauses and heap usage
4. **As a team**, I want clear guidelines on when to pool vs allocate
5. **As a developer**, I want memory profiling tools integrated

#### Tasks Breakdown:
- [ ] Implement ObjectPool<T> class (generic, configurable)
- [ ] Implement FrameAllocator (ArrayBuffer-based, typed array views)
- [ ] Add GC monitoring (v8.getHeapStatistics, pause tracking)
- [ ] Create MemoryProfiler integration
- [ ] Add per-frame allocation tracking
- [ ] Implement V8 GC tuning (flags: --max-old-space-size, --trace-gc)
- [ ] Create memory budget definitions (500MB RAM, GC <5ms)
- [ ] Document pooling patterns (when to pool, when typed arrays)
- [ ] Add memory profiling UI (dev console integration)
- [ ] Write comprehensive unit tests (>80% coverage)
- [ ] Create developer guide (pooling, frame allocation, budgets)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/memory/` (NEW)

**ObjectPool Design:**
```typescript
class ObjectPool<T> {
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number,
    maxSize: number = Infinity
  );

  acquire(): T;  // Get object from pool
  release(obj: T): void;  // Return object to pool
  getStats(): { total: number; available: number; inUse: number };
}

// Usage:
const entityPool = new ObjectPool(
  () => ({ id: 0, components: [] }),
  (e) => { e.id = 0; e.components.length = 0; },
  1000,  // initial
  10000  // max
);
```

**FrameAllocator Design:**
```typescript
class FrameAllocator {
  constructor(sizeBytes: number);

  allocateFloat32(count: number): Float32Array;
  allocateUint32(count: number): Uint32Array;
  allocateUint8(count: number): Uint8Array;
  reset(): void;  // Called at frame start
  getUsage(): number;
  getHighWaterMark(): number;
}

// Usage:
const renderAllocator = new FrameAllocator(1024 * 1024); // 1MB

function gameLoop() {
  renderAllocator.reset();  // Frame start
  const cullingResults = renderAllocator.allocateUint32(1000);
  // ... use it ...
  // Auto-freed at next reset()
}
```

**GC Monitoring:**
```typescript
class GCMonitor {
  recordGCPause(durationMs: number): void;
  getAveragePause(): number;
  getMaxPause(): number;
  getHeapStats(): v8.HeapStatistics;
}

// Integration:
const gcMonitor = new GCMonitor();
// Warns if pause >5ms
```

**Memory Budgets:**
```
RAM: 500MB target, 1GB critical max
- ECS: 100MB
- Rendering: 50MB
- Physics: 50MB
- Network: 50MB
- Audio: 50MB
- Assets: 100MB
- Engine: 50MB
- Game Logic: 50MB

GC Budget:
- Pause time: <5ms (leaves 11.67ms for work)
- Per-frame allocations: <1000 objects (steady state)
- Network allocations: <50 objects/tick
- Rendering allocations: <100 objects/frame
```

**Pooling Candidates:**
- Event objects
- Network packets
- Collision results
- Rendering temporary objects

#### Design Principles:
1. **Minimize Allocations**: Especially in hot paths (60 FPS loops)
2. **Pool Reusable Objects**: Reduce GC pressure
3. **Frame-Based Temporaries**: Use FrameAllocator for per-frame data
4. **Monitor and Enforce**: Track GC pauses, enforce budgets
5. **TypedArrays for Data**: Minimize GC pressure from data structures

#### Dependencies:
None (foundational infrastructure)

**Deliverables:**
- ObjectPool<T> implementation
- FrameAllocator implementation
- GC monitoring utilities
- Memory profiling integration
- Developer guide (when to pool, allocate, use typed arrays)
- Budget definitions documented

---

### Epic 2.14: GC Mitigation and V8 Tuning
**Priority:** P0 - CRITICAL
**Status:**  Not Started
**Dependencies:** Epic 2.13 (Memory Management Foundation)
**Complexity:** Medium
**Estimated Effort:** 2 weeks

**Problem Statement:**
JavaScript GC is non-deterministic and can break frame budget. Without GC mitigation, random frame drops will occur. Need strategy to minimize GC pressure and tune V8 for game engine workload.

**From Memory Analysis:**
> "GC pauses can break entire frame budget"
> "16.67ms total budget - 5.00ms GC pause budget = 11.67ms available for work"

**Acceptance Criteria:**
-  GC pause budget <5ms achieved
-  Per-frame allocations <1000 objects (steady state)
-  V8 heap tuning strategy documented
-  GC profiling integrated (--trace-gc analysis)
-  Allocation hotspots identified and optimized
-  Long-running stability verified (no memory leaks)

#### User Stories:
1. **As a game**, I need predictable frame times without GC spikes
2. **As a developer**, I want to identify allocation hotspots
3. **As an engineer**, I want V8 tuned for game workloads
4. **As a team**, I want automated GC regression detection
5. **As a player**, I want smooth 60 FPS without frame drops

#### Tasks Breakdown:
- [ ] Profile baseline GC behavior (vanilla Electron)
- [ ] Identify allocation hotspots (profiling tools)
- [ ] Test V8 flags (--max-old-space-size, --expose-gc, --trace-gc)
- [ ] Implement GC pause tracking (real-time monitoring)
- [ ] Create allocation budget enforcement
- [ ] Add GC regression tests (CI/CD integration)
- [ ] Document V8 tuning strategy (production flags)
- [ ] Create GC profiling workflow (Chrome DevTools integration)
- [ ] Add automatic GC testing (long-running stability)
- [ ] Optimize identified hotspots (pooling, typed arrays)
- [ ] Verify <5ms GC pauses in production scenarios
- [ ] Write developer guide (GC-aware patterns)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/memory/`

**V8 Flags (Electron):**
```json
// package.json
{
  "scripts": {
    "dev": "electron . --max-old-space-size=512 --trace-gc",
    "prod": "electron . --max-old-space-size=512"
  }
}
```

**Flags:**
- `--max-old-space-size=512`: Limit heap to 512MB (enforce budget)
- `--expose-gc`: Allow manual GC (testing only, not production)
- `--trace-gc`: Log GC events (profiling)
- `--trace-gc-verbose`: Detailed GC logging (debug only)

**GC Pause Tracking:**
```typescript
class GCMonitor {
  private gcPauses: number[] = [];
  private maxHistory = 600; // 10 seconds at 60 FPS

  recordGCPause(durationMs: number): void {
    this.gcPauses.push(durationMs);
    if (durationMs > 5.0) {
      console.warn(`Long GC pause: ${durationMs.toFixed(2)}ms`);
    }
  }

  getStats(): {
    avg: number;
    max: number;
    p95: number;
    p99: number;
  };
}
```

**Allocation Tracking:**
```typescript
// Before frame:
const heapBefore = v8.getHeapStatistics().used_heap_size;

// ... run frame ...

// After frame:
const heapAfter = v8.getHeapStatistics().used_heap_size;
const allocated = heapAfter - heapBefore;

if (allocated > ALLOCATION_BUDGET) {
  console.warn(`Frame allocated ${allocated} bytes, budget: ${ALLOCATION_BUDGET}`);
}
```

**GC Mitigation Strategies:**
1. **Object Pooling**: Reuse event objects, packets, temporaries
2. **Typed Arrays**: Use for data (no GC pressure)
3. **Frame Allocators**: Temporary data per frame
4. **Pre-Allocation**: Allocate buffers upfront
5. **Batch Operations**: Avoid incremental allocations

#### Design Principles:
1. **Measure First**: Profile before optimizing
2. **Budget Enforcement**: Fail CI/CD on budget violations
3. **Continuous Monitoring**: Track GC in production
4. **V8-Aware**: Tune for V8's GC characteristics

#### Dependencies:
- Epic 2.13: Memory Management Foundation (provides monitoring tools)

**Deliverables:**
- GC profiling report (baseline behavior)
- V8 tuning strategy document
- GC regression tests (CI/CD integration)
- Allocation optimization guide
- Long-running stability validation

---

### Epic 2.15: Memory Leak Detection and Prevention
**Priority:** P1 - IMPORTANT
**Status:**  Not Started
**Dependencies:** Epic 2.13 (Memory Management Foundation)
**Complexity:** Medium
**Estimated Effort:** 1-2 weeks

**Problem Statement:**
Without automated memory leak detection, leaks accumulate and cause crashes. Need infrastructure to detect leaks in load/unload cycles, create/destroy patterns, and long-running sessions.

**Acceptance Criteria:**
-  Memory snapshot comparison working
-  Load/unload cycles verified leak-free
-  Create/destroy cycles verified leak-free
-  Long-running sessions stable (no heap growth)
-  Leak detection integrated in CI/CD
-  GPU resource leaks detected (texture, buffer cleanup)

#### User Stories:
1. **As a developer**, I want automated leak detection
2. **As a tester**, I want leak tests in CI/CD
3. **As a system**, I need GPU resources properly released
4. **As a player**, I want stable long-running sessions
5. **As an engineer**, I want leak regression prevention

#### Tasks Breakdown:
- [ ] Implement memory snapshot comparison
- [ ] Add load/unload cycle tests (assets, scenes)
- [ ] Add create/destroy cycle tests (entities, components)
- [ ] Create long-running stability tests (1 hour+)
- [ ] Add GPU resource tracking (buffers, textures)
- [ ] Implement leak detection in CI/CD
- [ ] Create leak debugging workflow
- [ ] Document common leak patterns (closures, event listeners)
- [ ] Add heap snapshot diffing tools
- [ ] Verify all subsystems leak-free
- [ ] Write developer guide (leak prevention)

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/memory/`

**Memory Snapshot Comparison:**
```typescript
class MemoryLeakDetector {
  takeSnapshot(): MemorySnapshot;
  compare(before: MemorySnapshot, after: MemorySnapshot): LeakReport;
}

// Usage in tests:
test('load/unload does not leak', () => {
  const before = detector.takeSnapshot();

  // Load/unload cycle
  scene.load('test');
  scene.unload('test');
  gc();  // Force GC

  const after = detector.takeSnapshot();
  const report = detector.compare(before, after);

  expect(report.leakedObjects).toBe(0);
  expect(report.heapGrowth).toBeLessThan(1024); // <1KB tolerance
});
```

**GPU Resource Tracking:**
```typescript
class GPUResourceTracker {
  trackBuffer(buffer: GPUBuffer): void;
  trackTexture(texture: GPUTexture): void;
  untrackBuffer(buffer: GPUBuffer): void;
  untrackTexture(texture: GPUTexture): void;

  getLeakedResources(): {
    buffers: GPUBuffer[];
    textures: GPUTexture[];
  };
}
```

**Common Leak Patterns:**
```typescript
// ❌ BAD: Event listener leak
class System {
  constructor(eventBus: EventBus) {
    eventBus.on('update', this.onUpdate);  // Never removed!
  }
}

//  GOOD: Cleanup on destroy
class System {
  constructor(eventBus: EventBus) {
    this.cleanup = eventBus.on('update', this.onUpdate);
  }

  destroy() {
    this.cleanup();  // Remove listener
  }
}
```

#### Design Principles:
1. **Automated Detection**: CI/CD catches leaks
2. **Comprehensive Testing**: All subsystems tested
3. **GPU Resources**: Track explicitly (no automatic GC)
4. **Developer Education**: Common patterns documented

#### Dependencies:
- Epic 2.13: Memory Management Foundation (profiling infrastructure)

**Deliverables:**
- Memory leak detector
- Load/unload tests (leak-free)
- Create/destroy tests (leak-free)
- Long-running stability tests
- GPU resource tracking
- Leak prevention guide

---

