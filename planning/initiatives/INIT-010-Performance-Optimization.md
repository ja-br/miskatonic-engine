## Initiative 10: Performance & Optimization (INIT-010)
**Dependencies:** All initiatives
**Outcome:** Optimized engine performance

### Epic 10.1: Threading Architecture
**Priority:** P1 - IMPORTANT
**Status:** ⏭️ Not Started
**Dependencies:** Epic 2.8 (Game Loop)
**Complexity:** High
**Estimated Effort:** 1-2 weeks (design phase)

**Problem Statement:**
Everything runs on a single thread, using ~12.5% of available compute on an 8-core CPU. Modern games need multi-core utilization for physics, AI, and parallel system execution. Need a threading model that leverages Web Workers while maintaining determinism.

**Acceptance Criteria:**
- ✅ Thread safety model documented
- ✅ Systems categorized (parallel-safe vs single-thread)
- ✅ Dependency graph computed
- ✅ Web Worker strategy defined
- ✅ SharedArrayBuffer requirements understood
- ✅ Synchronization points defined

#### User Stories:
1. **As a developer**, I want a documented threading model
2. **As a developer**, I want to know which systems are thread-safe
3. **As a developer**, I want a system dependency graph
4. **As a developer**, I want a Web Worker integration strategy
5. **As a game**, I need multi-core CPU utilization

#### Tasks Breakdown:
- [ ] Document thread safety categories (single-thread, read-only, synchronized, worker-isolated)
- [ ] Analyze all systems for thread safety
- [ ] Create system dependency graph (which systems can run in parallel)
- [ ] Define synchronization points in frame timeline
- [ ] Design SharedArrayBuffer communication protocol
- [ ] Document Web Worker constraints (no DOM, no WebGL)
- [ ] Create thread-safe ECS access patterns
- [ ] Define frame synchronization strategy
- [ ] Document memory model for multi-threaded access
- [ ] Create threading architecture documentation
- [ ] Design worker lifecycle management
- [ ] Plan performance measurement strategy

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/core/` (threading design)

**Thread Safety Categories:**
1. **Single-Thread Only**: Rendering (WebGL), DOM manipulation, main event loop
2. **Parallel-Safe (Read-Only)**: Component queries, collision queries, pathfinding, AI
3. **Parallel-Safe (Synchronized)**: Component writes, entity creation, resource loading
4. **Worker-Isolated**: Physics simulation, heavy AI, asset processing

**Synchronization Points:**
```
Frame N Timeline:
  0ms    → Sync Point 1: Flush deferred ops, commit entity changes
  5ms    → Input + Game Logic (parallel OK, read-only queries)
  8ms    → Sync Point 2: Collect component writes, resolve conflicts
  10ms   → Physics (single-threaded or worker)
  14ms   → Sync Point 3: Copy physics results to ECS
  15ms   → Rendering (single-threaded)
  16.67ms → Frame end
```

**Web Worker Strategy:**
- **What to Move**: Physics, AI pathfinding, asset processing, audio decoding
- **Communication**: SharedArrayBuffer (low-latency), MessageChannel (commands), Transferable objects (large data)
- **Constraints**: No DOM, no WebGL context, CORS headers required for SharedArrayBuffer

#### Design Principles:
1. **Determinism First**: Threading must not break deterministic simulation
2. **Progressive**: Start single-threaded, add parallelism incrementally
3. **Measurable**: Always benchmark parallel vs single-threaded performance
4. **Safe**: Prevent race conditions with clear synchronization

#### Dependencies:
- Epic 2.8: Game Loop Architecture (execution flow)

---

### Epic 10.2: Parallel System Execution
**Priority:** P1 - IMPORTANT
**Status:** ⏭️ Not Started
**Dependencies:** Epic 10.1 (Threading Architecture)
**Complexity:** High
**Estimated Effort:** 3-4 weeks

**Problem Statement:**
Independent systems run sequentially even though they could run in parallel. Need to implement parallel system execution using the dependency graph from Epic 10.1 to utilize multiple CPU cores.

**Acceptance Criteria:**
- ✅ Independent systems run in parallel
- ✅ No race conditions detected
- ✅ Performance improvement measured (>20% speedup target)
- ✅ Frame timing consistent (no jitter)
- ✅ Scales with CPU cores (linear up to 4 cores)

#### User Stories:
1. **As a game**, I need to utilize multiple CPU cores
2. **As a developer**, I want parallel system execution without race conditions
3. **As a developer**, I want measurable performance improvement
4. **As a game**, I need consistent frame timing despite parallelism

#### Tasks Breakdown:
- [ ] Implement dependency graph builder (topological sort)
- [ ] Create parallel execution scheduler
- [ ] Add thread pool for system execution
- [ ] Implement synchronization barriers between phases
- [ ] Add read/write conflict detection
- [ ] Create thread-safe component access wrappers
- [ ] Implement atomic operations for entity changes
- [ ] Add performance measurement (parallel vs sequential)
- [ ] Create parallel execution tests
- [ ] Add race condition detection (ThreadSanitizer-style)
- [ ] Implement fallback to sequential execution
- [ ] Write comprehensive unit tests (>80% coverage)
- [ ] Document parallel execution API

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/core/`

**Parallel Execution API:**
```typescript
interface SystemDependencies {
  reads: ComponentType[];    // Components this system reads
  writes: ComponentType[];   // Components this system writes
  runAfter?: System[];       // Explicit dependencies
  runBefore?: System[];
}

class ParallelScheduler {
  // Build dependency graph
  buildGraph(systems: System[]): DependencyGraph;

  // Execute systems in parallel where possible
  executeSystems(systems: System[], deltaTime: number): Promise<void>;

  // Check for conflicts
  detectConflicts(systems: System[]): Conflict[];
}
```

**Execution Example:**
```
Frame N:
  Parallel Group 1: [InputSystem, AISystem, ParticleSystem]
    → No conflicts, run in parallel on 3 threads

  Synchronization Barrier

  Parallel Group 2: [PhysicsSystem]
    → Writes to Position, runs alone

  Synchronization Barrier

  Parallel Group 3: [RenderSystem]
    → Single-threaded (WebGL constraint)
```

**Key Features:**
- Automatic dependency graph construction
- Parallel execution of independent systems
- Synchronization barriers between groups
- Read/write conflict detection
- Performance measurement and comparison

#### Design Principles:
1. **Safety First**: Reject conflicting systems, never allow race conditions
2. **Automatic**: Developers specify reads/writes, scheduler handles parallelism
3. **Measurable**: Always measure speedup, fall back if slower
4. **Deterministic**: Parallel execution produces identical results to sequential

#### Dependencies:
- Epic 10.1: Threading Architecture (thread safety model)

---

### Epic 10.3: Web Worker Integration
**Priority:** P2 - NICE TO HAVE
**Status:** ⏭️ Not Started
**Dependencies:** Epic 10.2 (Parallel System Execution)
**Complexity:** High
**Estimated Effort:** 3-4 weeks

**Problem Statement:**
Heavy systems (physics, AI) still run on main thread, blocking rendering. Need to move these to Web Workers to free up main thread for smooth UI and rendering.

**Acceptance Criteria:**
- ✅ Physics runs in separate worker
- ✅ Communication overhead <0.5ms
- ✅ Main thread freed up (>30% reduction in main thread time)
- ✅ Performance improved (overall speedup >10%)
- ✅ No impact on determinism

#### User Stories:
1. **As a game**, I need physics off the main thread
2. **As a developer**, I want low-latency worker communication
3. **As a rendering system**, I need free main thread time
4. **As a physics system**, I need determinism preserved

#### Tasks Breakdown:
- [ ] Create Web Worker wrapper infrastructure
- [ ] Implement SharedArrayBuffer communication
- [ ] Add MessageChannel for commands
- [ ] Create Transferable object optimization
- [ ] Move physics simulation to worker
- [ ] Implement worker lifecycle management (start/stop/restart)
- [ ] Add worker error handling and recovery
- [ ] Create worker synchronization with main thread
- [ ] Implement state transfer between worker and main
- [ ] Add performance measurement (overhead tracking)
- [ ] Create determinism verification tests
- [ ] Write comprehensive unit tests (>80% coverage)
- [ ] Document Web Worker API and migration guide

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/workers/` (NEW)

**Web Worker API:**
```typescript
class WorkerManager {
  // Lifecycle
  createWorker(script: string): Worker;
  terminateWorker(worker: Worker): void;

  // Communication
  postMessage(worker: Worker, msg: any): void;
  postTransferable(worker: Worker, msg: any, transfer: Transferable[]): void;

  // SharedArrayBuffer
  createSharedBuffer(size: number): SharedArrayBuffer;
  writeToShared(buffer: SharedArrayBuffer, offset: number, data: ArrayLike<number>): void;
  readFromShared(buffer: SharedArrayBuffer, offset: number, length: number): Float64Array;
}

// Physics worker example
class PhysicsWorker {
  private worker: Worker;
  private sharedState: SharedArrayBuffer;

  async step(deltaTime: number): Promise<void> {
    // Send command to worker
    this.worker.postMessage({ type: 'step', deltaTime });

    // Wait for completion
    await this.waitForCompletion();

    // Read results from SharedArrayBuffer
    const results = this.readSharedState();
    return results;
  }
}
```

**Communication Strategy:**
- **Low-frequency, high-latency**: MessageChannel for commands (~1ms latency)
- **High-frequency, low-latency**: SharedArrayBuffer for state (~0.1ms latency)
- **Large data**: Transferable objects for zero-copy transfer

**Key Features:**
- Physics in Web Worker
- SharedArrayBuffer for low-latency state transfer
- Worker lifecycle management
- Error handling and recovery
- Performance monitoring

#### Design Principles:
1. **Latency-Aware**: Use fastest communication method for each use case
2. **Fault-Tolerant**: Worker crashes don't crash main thread
3. **Zero-Copy**: Use Transferable objects where possible
4. **Deterministic**: Worker execution produces same results as main thread

#### Dependencies:
- Epic 10.2: Parallel System Execution (parallel execution infrastructure)

---

### Epic 10.4: Frame Budget System
**Priority:** P0 - CRITICAL
**Status:** ⏭️ Not Started
**Dependencies:** Epic 2.8 (Game Loop)
**Complexity:** Medium
**Estimated Effort:** 1-2 weeks

**Problem Statement:**
Performance budgets are documented but not enforced at runtime. Systems can overrun their time budget with no automatic throttling or warnings. Need a FrameTimer that measures each system and enforces budgets.

**Acceptance Criteria:**
- ✅ Each system measured per frame
- ✅ Warnings logged when budget exceeded
- ✅ Performance data available to analytics
- ✅ Maintains 60 FPS when possible
- ✅ Graceful degradation under load

#### User Stories:
1. **As a developer**, I want automatic budget enforcement
2. **As a developer**, I want warnings when systems overrun
3. **As a developer**, I want performance data for analysis
4. **As a game**, I need 60 FPS target maintained
5. **As a game**, I need graceful degradation if 60 FPS impossible

#### Tasks Breakdown:
- [ ] Create `FrameTimer` class for measuring systems
- [ ] Add budget configuration per system
- [ ] Implement automatic warning on budget exceeded
- [ ] Create performance metrics collection
- [ ] Add frame pacing for consistent timing
- [ ] Implement adaptive quality system (reduce detail if overrunning)
- [ ] Create budget visualization (debug overlay)
- [ ] Add performance analytics integration
- [ ] Implement emergency throttling (if critical budget exceeded)
- [ ] Write comprehensive unit tests (>80% coverage)
- [ ] Document budget configuration and tuning

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/core/`

**Frame Budget API:**
```typescript
interface SystemBudget {
  system: string;
  targetMs: number;     // Ideal time
  criticalMs: number;   // Maximum before throttling
  adaptiveQuality: boolean; // Can reduce quality if slow
}

const DEFAULT_BUDGETS: SystemBudget[] = [
  { system: 'Input',     targetMs: 0.5,  criticalMs: 1.0,  adaptiveQuality: false },
  { system: 'GameLogic', targetMs: 3.0,  criticalMs: 5.0,  adaptiveQuality: true  },
  { system: 'Physics',   targetMs: 2.0,  criticalMs: 4.0,  adaptiveQuality: true  },
  { system: 'Rendering', targetMs: 8.0,  criticalMs: 12.0, adaptiveQuality: true  },
  { system: 'Network',   targetMs: 1.0,  criticalMs: 2.0,  adaptiveQuality: false },
];

class FrameTimer {
  // Measurement
  beginSystem(name: string): void;
  endSystem(name: string): void;

  // Budget
  setBudget(system: string, budget: SystemBudget): void;
  getBudget(system: string): SystemBudget;

  // Reporting
  getMetrics(system: string): SystemMetrics;
  checkBudget(system: string): BudgetStatus;
}

interface SystemMetrics {
  lastFrameMs: number;
  avgMs: number;
  maxMs: number;
  budgetOverruns: number;
}

enum BudgetStatus {
  OK,              // Within target
  WARNING,         // Over target but under critical
  CRITICAL,        // Over critical threshold
}
```

**Adaptive Quality:**
```typescript
class AdaptiveQualityManager {
  private qualityLevel: number = 1.0; // 0.0 - 1.0

  update(frameTime: number): void {
    const target = 16.67; // 60 FPS

    if (frameTime > target * 1.2) {
      // Running slow, reduce quality
      this.qualityLevel = Math.max(0.5, this.qualityLevel - 0.1);
      this.applyQuality();
    } else if (frameTime < target * 0.8) {
      // Running fast, increase quality
      this.qualityLevel = Math.min(1.0, this.qualityLevel + 0.05);
      this.applyQuality();
    }
  }

  private applyQuality(): void {
    // Adjust rendering quality
    renderer.setQuality(this.qualityLevel);

    // Adjust physics substeps
    if (this.qualityLevel < 0.7) {
      physics.setSubsteps(1); // Reduce from 2
    }
  }
}
```

**Key Features:**
- Per-system time measurement
- Configurable budgets (target and critical)
- Automatic warnings
- Adaptive quality reduction
- Performance metrics collection

#### Design Principles:
1. **Automatic**: No manual intervention required
2. **Adaptive**: Quality adjusts to maintain framerate
3. **Transparent**: Warnings show exact problem
4. **Configurable**: Budgets tunable per game

#### Dependencies:
- Epic 2.8: Game Loop Architecture (system execution)

---

### Epic 10.5: Performance Monitoring
**Priority:** P1 - IMPORTANT
**Status:** ⏭️ Not Started
**Dependencies:** Epic 10.4 (Frame Budget System)
**Complexity:** Low-Medium
**Estimated Effort:** 1 week

**Problem Statement:**
No real-time performance visibility. Developers can't see FPS, frame time, or which systems are slow without opening DevTools. Need an in-game performance overlay and reporting system.

**Acceptance Criteria:**
- ✅ FPS displayed in corner (dev mode)
- ✅ Frame time graph visible
- ✅ Can see which system is slow
- ✅ Memory usage tracked
- ✅ Can export CSV report

#### User Stories:
1. **As a developer**, I want real-time FPS counter
2. **As a developer**, I want frame time graph (last 100 frames)
3. **As a developer**, I want system performance breakdown
4. **As a developer**, I want memory usage tracking
5. **As a developer**, I want performance reports (CSV export)

#### Tasks Breakdown:
- [ ] Create performance overlay UI (FPS, frame time)
- [ ] Implement frame time graph (rolling window)
- [ ] Add system performance breakdown view
- [ ] Create memory usage tracker
- [ ] Implement CSV export for performance data
- [ ] Add performance history storage (last N minutes)
- [ ] Create performance alerts (FPS drop, memory spike)
- [ ] Add toggle for overlay (F3 key)
- [ ] Implement performance comparison (before/after)
- [ ] Write comprehensive unit tests (>80% coverage)
- [ ] Document performance monitoring tools

#### Implementation Details:
**Package:** `/Users/bud/Code/miskatonic/packages/performance-monitor/` (NEW)

**Performance Monitor API:**
```typescript
interface FrameMetrics {
  frameNumber: number;
  timestamp: number;
  totalTime: number;
  systemTimes: Map<string, number>;
  fps: number;
  droppedFrames: number;
  memoryUsed: number;
}

class PerformanceMonitor {
  // Recording
  recordFrame(metrics: FrameMetrics): void;

  // Analysis
  getAverageFPS(seconds: number): number;
  getFrameTimeHistory(count: number): number[];
  getSlowFrames(threshold: number): FrameMetrics[];

  // Export
  exportCSV(duration: number): string;
  exportJSON(duration: number): string;

  // Display
  showOverlay(): void;
  hideOverlay(): void;
  toggleOverlay(): void;
}
```

**Overlay Display:**
```
┌─ Performance ────────────┐
│ FPS: 60 (target: 60)     │
│ Frame: 14.2ms / 16.67ms  │
│                          │
│ [▂▃▄▅▆▇█▇▆▅▄▃▂] Graph    │
│                          │
│ Systems:                 │
│   Input:     0.3ms  ✓    │
│   Logic:     2.8ms  ✓    │
│   Physics:   1.9ms  ✓    │
│   Render:    8.2ms  ✓    │
│   Network:   1.0ms  ✓    │
│                          │
│ Memory: 423MB / 1024MB   │
└──────────────────────────┘
```

**Key Features:**
- Real-time FPS counter
- Frame time graph (rolling window)
- Per-system timing breakdown
- Memory usage tracking
- CSV/JSON export for analysis
- Performance history
- Slow frame detection

#### Design Principles:
1. **Always Available**: Monitoring available in dev mode
2. **Low Overhead**: Monitoring adds <0.5ms per frame
3. **Exportable**: Data can be analyzed offline
4. **Actionable**: Clearly shows bottlenecks

#### Dependencies:
- Epic 10.4: Frame Budget System (metrics source)

---

### Epic 10.6: Memory Optimization
**Priority:** P2
**Status:** ⏸️ Deferred

**Note:** Memory optimization deferred. Epic 2.4 (Resource Management) provides memory profiling and leak detection. Advanced optimization can be added later after core engine integration.

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

