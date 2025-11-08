## Architecture Decision Records

### ADR-001: Electron as Desktop Platform

**Status**: Accepted
**Context**: Need cross-platform desktop support with modern web technologies
**Decision**: Use Electron for desktop application framework
**Consequences**:
- ✅ Single codebase for Windows, macOS, Linux
- ✅ Access to native APIs and filesystem
- ✅ Modern web technologies (WebGL2, WebGPU)
- ❌ Larger application size (~100MB base)
- ❌ Higher memory usage than native

### ADR-002: ECS Architecture

**Status**: Accepted
**Context**: Need flexible, performant game object model
**Decision**: Implement Entity Component System as core architecture
**Consequences**:
- ✅ Cache-efficient data layout
- ✅ Flexible composition over inheritance
- ✅ Parallelizable system execution
- ❌ Learning curve for developers
- ❌ More complex than traditional OOP

### ADR-003: Server-Authoritative Multiplayer

**Status**: Accepted
**Context**: Competitive multiplayer games need anti-cheat
**Decision**: Server owns authoritative game state
**Consequences**:
- ✅ Effective anti-cheat
- ✅ Consistent game state
- ✅ Fair gameplay
- ❌ Requires client prediction for responsiveness
- ❌ Higher server costs

### ADR-004: Hot-Swappable Physics Engines

**Status**: Accepted
**Context**: Different games need different physics capabilities
**Decision**: Abstract physics behind interface, support multiple engines
**Consequences**:
- ✅ Developer choice
- ✅ Optimal engine per game type
- ✅ Future-proof
- ❌ Abstraction overhead
- ❌ Multiple engines to maintain

### ADR-005: TypeScript Strict Mode

**Status**: Accepted
**Context**: Large codebase needs type safety
**Decision**: Use TypeScript with strict: true
**Consequences**:
- ✅ Catch errors at compile time
- ✅ Better IDE support
- ✅ Self-documenting code
- ❌ Initial development slower
- ❌ Some libraries need type definitions

### ADR-006: Main Engine Class as Integration Layer

**Status**: Accepted (November 2025)
**Context**: Individual subsystems (ECS, Physics, Network) exist but lack coordination
**Decision**: Implement MiskatonicEngine class as central coordinator
**Consequences**:
- ✅ Single entry point for engine initialization
- ✅ Unified configuration system
- ✅ Clear subsystem access pattern
- ✅ Lifecycle management (start, stop, pause, shutdown)
- ❌ Additional abstraction layer
- ❌ Potential single point of failure

### ADR-007: Phase-Based Game Loop

**Status**: Accepted (November 2025)
**Context**: Need clear, predictable system execution order
**Decision**: Implement phase-based game loop (INPUT → PRE_UPDATE → UPDATE → PHYSICS → POST_UPDATE → RENDER → NETWORK)
**Consequences**:
- ✅ Predictable execution order
- ✅ Clear phase semantics
- ✅ Easier to reason about system interactions
- ✅ Supports both fixed and variable timesteps
- ❌ Less flexible than dependency graphs
- ❌ Phases may be too rigid for some use cases

### ADR-008: Runtime Frame Budget Enforcement

**Status**: Accepted (November 2025)
**Context**: Performance budgets documented but not enforced
**Decision**: Implement FrameBudgetManager with per-system timing and adaptive quality
**Consequences**:
- ✅ Automatic performance monitoring
- ✅ Warning on budget overruns
- ✅ Adaptive quality maintains target framerate
- ✅ Real-time performance visibility
- ❌ Overhead of timing measurements (~0.1ms)
- ❌ Adaptive quality may reduce visual fidelity

### ADR-009: Integrated Debug Console

**Status**: Accepted (November 2025)
**Context**: Slow development iteration due to recompile requirement
**Decision**: Implement in-game debug console with command execution
**Consequences**:
- ✅ Rapid prototyping without recompile
- ✅ Runtime entity/system inspection
- ✅ Reproduce bugs with console commands
- ✅ Better developer experience
- ❌ Additional code complexity
- ❌ Security risk if exposed in production

### ADR-010: Web Workers for Heavy Subsystems

**Status**: Accepted (November 2025)
**Context**: Single-threaded execution not utilizing multi-core CPUs
**Decision**: Move physics and AI to Web Workers with SharedArrayBuffer
**Consequences**:
- ✅ Better CPU utilization (40-60% speedup)
- ✅ Main thread freed for rendering
- ✅ Scalable to more cores
- ❌ Communication overhead (<0.5ms)
- ❌ Requires CORS headers for SharedArrayBuffer
- ❌ Increased complexity

### ADR-011: Deterministic Physics Requirement

**Status**: Accepted (November 2025)
**Context**: Multiplayer games need consistent physics across clients
**Decision**: Fixed timestep (16.67ms), full state serialization, replay support
**Consequences**:
- ✅ Identical physics results across platforms
- ✅ Replay debugging possible
- ✅ Rollback networking feasible
- ✅ Server-side validation
- ❌ Fixed timestep can cause issues at low FPS
- ❌ More complex than variable timestep

### ADR-012: SoA Typed Arrays for Component Storage

**Status**: Accepted (November 2025)
**Context**: ECS implementation blocked by undefined component storage strategy. Cache analysis reveals 10-100x performance difference between sequential and random access patterns.
**Decision**: Use Structure of Arrays (SoA) backed by typed arrays (Float32Array, Uint32Array, etc.) for all component storage
**Rationale**:
- **Cache Efficiency**: Modern CPUs load 64-byte cache lines. Sequential access in typed arrays maximizes cache line utilization (~200x speedup for cached data: 0.5ns L1 hit vs 100ns RAM access)
- **Spatial Locality**: All X positions contiguous, all Y positions contiguous. Loading positions.x[0] brings x[1-15] into cache
- **Predictable Performance**: V8 optimizes typed arrays with JIT, eliminates bounds checks in hot loops
- **GC Benefits**: Typed arrays don't create per-element objects. Minimal GC pressure (<100 objects/frame target)
- **Benchmarked**: 10x faster than object arrays in sequential iteration tests
**Implementation**:
```typescript
// Per-archetype storage
class PositionStorage {
  x: Float32Array;  // [x0, x1, x2, ...]
  y: Float32Array;  // [y0, y1, y2, ...]
  z: Float32Array;  // [z0, z1, z2, ...]
}
```
**Consequences**:
- ✅ 10-100x performance improvement for sequential access
- ✅ Minimal GC pressure (typed arrays don't allocate per-element)
- ✅ Predictable V8 optimization behavior
- ✅ Memory efficiency (50% savings using Float32 vs Float64)
- ✅ Clear cache optimization strategy
- ❌ Less ergonomic API than object arrays (positions.x[i] vs positions[i].x)
- ❌ Requires SoA-aware system design
- ❌ Component growth requires typed array reallocation

### ADR-013: Sequential Iteration Requirement

**Status**: Accepted (November 2025)
**Context**: Cache analysis shows 10-100x performance penalty for random access vs sequential iteration. Without enforced patterns, developers could write cache-unfriendly systems.
**Decision**: All ECS systems MUST iterate sequentially over archetypes. Random entity access is anti-pattern.
**Rationale**:
- **Cache Lines**: 64-byte cache lines hold ~16 Float32 values. Sequential access hits cache for next 15 values
- **Prefetching**: CPUs detect sequential patterns and prefetch next cache lines
- **Performance**: Benchmarks show 10x difference between sequential and random access
- **Determinism**: Sequential iteration order is predictable and reproducible
**Mandatory Pattern**:
```typescript
class System {
  update(dt: number) {
    // MANDATORY: Iterate archetypes sequentially
    for (const archetype of this.matchingArchetypes) {
      const components = archetype.getComponents();

      // MANDATORY: Index-based sequential access
      for (let i = 0; i < archetype.count; i++) {
        // Process components[i]
      }
    }
  }
}
```
**Anti-Patterns (Forbidden)**:
```typescript
// FORBIDDEN: Random entity lookup
for (const entityId of randomEntityIds) {
  const entity = world.getEntity(entityId);  // Cache miss
}

// FORBIDDEN: Scattered access
for (const i of shuffledIndices) {
  process(components[i]);  // Random jumps
}
```
**Consequences**:
- ✅ Enforces cache-friendly access patterns
- ✅ 10-100x performance benefit maintained
- ✅ Clear system design guidelines
- ✅ Prevents accidental cache-unfriendly code
- ✅ Enables query result caching
- ❌ Less flexible than entity-based iteration
- ❌ Requires archetype-aware programming model
- ❌ Random access requires justification (rare cases)
**Enforcement**:
- Code review must check iteration patterns
- Benchmark tests compare sequential vs random
- System base class enforces archetype iteration
- Documentation provides good/bad examples

### ADR-014: Object Pooling and Frame Allocators

**Status**: Accepted (November 2025)
**Context**: V8 garbage collection pauses can break 60 FPS frame budget. Running on JavaScript (Electron/V8) means GC is unavoidable, but GC pressure can be minimized. Memory management analysis identifies this as P0 critical gap.
**Decision**: Implement object pooling and frame allocators as core memory management patterns
**Rationale**:
- **GC Reality**: V8 GC pauses can be 5-20ms. With 16.67ms frame budget, GC >5ms leaves only 11.67ms for actual work
- **Allocation Pressure**: Every object allocation increases GC pressure. 1000+ allocations/frame triggers frequent GC
- **Frame Allocators**: Temporary per-frame data (culling, sorting, collision pairs) is completely useless next frame. Reuse pre-allocated buffers instead of allocating
- **Object Pools**: Frequently created/destroyed objects (events, packets, temporary results) should be pooled
- **Performance Impact**: Can reduce GC pauses from 10-20ms to <5ms (2-4x improvement)
**Implementation**:
```typescript
// Object Pool for reusable objects
class ObjectPool<T> {
  acquire(): T;  // Get from pool or create new
  release(obj: T): void;  // Return to pool after reset
}

// Frame Allocator for temporary data
class FrameAllocator {
  private buffer: ArrayBuffer;
  allocateFloat32(count: number): Float32Array;
  reset(): void;  // Called at frame start
}

// Subsystem allocators
const renderAllocator = new FrameAllocator(1024 * 1024); // 1MB
const physicsAllocator = new FrameAllocator(512 * 1024); // 512KB
const networkAllocator = new FrameAllocator(256 * 1024); // 256KB
```
**GC Budget Targets**:
- GC pause: <5ms (must leave 11.67ms for work)
- Per-frame allocations: <1000 objects (steady state)
- Network allocations: <50 objects/tick
- Rendering allocations: <100 objects/frame
**Pooling Candidates**:
- Event objects (frequent creation/destruction)
- Network packets (60 ticks/second)
- Collision results (physics queries)
- Temporary rendering objects (culling, sorting)
**Frame Allocator Use Cases**:
- Rendering: Culling results, sorting keys, draw batching
- Physics: Collision pairs, solver temporaries, query results
- Network: Serialization staging, delta compression buffers
- AI: Pathfinding temporaries, behavior tree scratch space
**Consequences**:
- ✅ Reduces GC pauses from 10-20ms to <5ms target
- ✅ Predictable frame times (no random GC spikes)
- ✅ Meets 60 FPS target with GC overhead
- ✅ Minimal allocation pressure (<1000 objects/frame)
- ✅ Frame allocators have zero GC pressure (pre-allocated ArrayBuffers)
- ✅ Object pools reduce allocation rate by 90%+
- ❌ Additional code complexity (acquire/release pattern)
- ❌ Manual memory management (must release objects)
- ❌ Buffer overflow possible (frame allocator capacity)
- ❌ Developer discipline required (easy to forget release)
**V8 Tuning**:
- `--max-old-space-size=512`: Enforce 512MB heap limit
- `--expose-gc`: Enable GC profiling (dev mode)
- `--trace-gc`: Monitor GC behavior
**Enforcement**:
- GC monitoring integrated into profiler
- Allocation tracking per frame
- Budget violations logged and flagged
- Code review checks for pooling opportunities
