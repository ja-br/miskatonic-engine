# EPIC: Rendering Core API Consolidation

**Epic ID:** RENDERING-01
**Status:** Not Started
**Priority:** HIGH (Blocking)
**Estimated Effort:** 38 hours
**Target Completion:** Week 1

## Objective

Consolidate three overlapping command interfaces (DrawCommand, NewDrawCommand, ModernDrawCommand) into a single unified, type-safe command interface, and implement persistent bind group pools to eliminate per-frame GPU resource allocations.

## Success Criteria

- [x] Single unified `DrawCommand` interface eliminates all 3 legacy types
- [x] Zero `as any` casts in codebase (down from 83)
- [x] Bind group cache hit rate improved from 70% to 95%+
- [x] Per-frame bind group allocations reduced by 80%
- [x] All demos and tests updated to use new unified API
- [x] Test coverage >80% for new command system
- [x] Performance benchmarks show no regression

## Current State

### Problems
1. **Multiple Command Types**: Three overlapping interfaces cause confusion
   - `DrawCommand` (types.ts) - Legacy with shader ID + uniforms Map
   - `NewDrawCommand` (NewDrawCommand.ts) - Epic 3.14 with bind groups
   - `ModernDrawCommand` (IRendererBackend.ts) - Backend variant

2. **Type Safety Issues**: 83 instances of `as any` casts to bypass type errors

3. **Performance Issues**: Bind groups created per frame despite caching infrastructure

### Impact
- Confusing API surface for developers
- Risk of using wrong command type
- Duplicate code paths in WebGPUBackend
- Wasted GPU allocations every frame

## Implementation Tasks

### Task 1.1: Define Unified DrawCommand Interface (3 hours)

**Deliverable:** `/packages/rendering/src/commands/DrawCommand.ts`

```typescript
export interface DrawCommand {
  // Core (required)
  pipeline: BackendPipelineHandle;
  bindGroups: Map<number, BackendBindGroupHandle>;

  // Geometry (discriminated union for type safety)
  geometry: IndexedGeometry | NonIndexedGeometry | IndirectGeometry | ComputeGeometry;

  // Optional
  label?: string;
  debugInfo?: DrawDebugInfo;
}

export interface IndexedGeometry {
  type: 'indexed';
  vertexBuffers: BackendBufferHandle[];
  indexBuffer: BackendBufferHandle;
  indexFormat: 'uint16' | 'uint32';
  indexCount: number;
  instanceCount?: number;
  firstIndex?: number;
  baseVertex?: number;
  firstInstance?: number;
}

export interface NonIndexedGeometry {
  type: 'nonIndexed';
  vertexBuffers: BackendBufferHandle[];
  vertexCount: number;
  instanceCount?: number;
  firstVertex?: number;
  firstInstance?: number;
}

export interface IndirectGeometry {
  type: 'indirect';
  vertexBuffers: BackendBufferHandle[];
  indexBuffer?: BackendBufferHandle;
  indirectBuffer: BackendBufferHandle;
  indirectOffset: number;
}

export interface ComputeGeometry {
  type: 'compute';
  workgroups: [number, number, number];
  // Validation: workgroups must not exceed device limits
  // Check against device.limits.maxComputeWorkgroupsPerDimension
}

export interface DrawDebugInfo {
  drawCallId?: string;
  pass?: string;
  objectName?: string;
}
```

**Acceptance Criteria:**
- [ ] All geometry types defined with discriminated unions
- [ ] TypeScript strict mode passes
- [ ] Export all types from commands/index.ts
- [ ] JSDoc comments on all interfaces
- [ ] IndexFormat validation (must match buffer type uint16/uint32)
- [ ] Workgroup size validation against device limits
- [ ] Type guards for geometry types

**Dependencies:** None

---

### Task 1.2: Implement DrawCommandBuilder (4 hours)

**Deliverable:** `/packages/rendering/src/commands/DrawCommandBuilder.ts`

```typescript
export class DrawCommandBuilder {
  private command: Partial<DrawCommand> = {
    bindGroups: new Map()
  };

  pipeline(handle: BackendPipelineHandle): this {
    this.command.pipeline = handle;
    return this;
  }

  bindGroup(slot: number, handle: BackendBindGroupHandle): this {
    this.command.bindGroups!.set(slot, handle);
    return this;
  }

  indexed(
    vertexBuffers: BackendBufferHandle[],
    indexBuffer: BackendBufferHandle,
    indexFormat: 'uint16' | 'uint32',
    indexCount: number
  ): this {
    this.command.geometry = {
      type: 'indexed',
      vertexBuffers,
      indexBuffer,
      indexFormat,
      indexCount
    };
    return this;
  }

  nonIndexed(vertexBuffers: BackendBufferHandle[], vertexCount: number): this {
    this.command.geometry = {
      type: 'nonIndexed',
      vertexBuffers,
      vertexCount
    };
    return this;
  }

  indirect(
    vertexBuffers: BackendBufferHandle[],
    indirectBuffer: BackendBufferHandle,
    indirectOffset: number,
    indexBuffer?: BackendBufferHandle
  ): this {
    this.command.geometry = {
      type: 'indirect',
      vertexBuffers,
      indirectBuffer,
      indirectOffset,
      indexBuffer
    };
    return this;
  }

  compute(workgroups: [number, number, number]): this {
    this.command.geometry = {
      type: 'compute',
      workgroups
    };
    return this;
  }

  label(label: string): this {
    this.command.label = label;
    return this;
  }

  build(): DrawCommand {
    if (!this.command.pipeline) {
      throw new Error('Pipeline is required');
    }
    if (!this.command.geometry) {
      throw new Error('Geometry is required');
    }
    return this.command as DrawCommand;
  }
}
```

**Acceptance Criteria:**
- [ ] Fluent builder API implemented
- [ ] All geometry types supported (indexed, nonIndexed, indirect, compute)
- [ ] Validation throws descriptive errors
- [ ] Type safety enforced at compile time
- [ ] Prevent calling multiple geometry methods (throws error)
- [ ] Unit tests cover all methods
- [ ] Example code in JSDoc comments

**Dependencies:** Task 1.1

---

### Task 1.3: Update IRendererBackend Interface (2 hours)

**Deliverable:** Update `/packages/rendering/src/backends/IRendererBackend.ts`

**Changes:**
```typescript
// REMOVE:
executeCommands(commands: RenderCommand[]): void;
executeModernRenderPass(command: ModernDrawCommand): void;

// ADD:
executeDrawCommand(command: DrawCommand): void;
```

**Acceptance Criteria:**
- [ ] Old methods removed
- [ ] New method signature documented
- [ ] TypeScript compilation passes
- [ ] Backend interface exports updated

**Dependencies:** Task 1.1

---

### Task 1.4: Update WebGPUBackend Implementation (5 hours)

**Deliverable:** Update `/packages/rendering/src/backends/WebGPUBackend.ts`

**Changes:**
- Implement `executeDrawCommand(command: DrawCommand)`
- Remove `executeCommands()` and `executeModernRenderPass()`
- Update internal command execution logic to use discriminated unions
- Add geometry type handling switch statement

**Acceptance Criteria:**
- [ ] executeDrawCommand() handles all geometry types
- [ ] Old command execution methods removed
- [ ] Error handling for invalid commands
- [ ] Integration tests pass
- [ ] Performance benchmarks show no regression

**Dependencies:** Task 1.3

---

### Task 1.5: Implement BindGroupPool (8 hours)

**Deliverable:** `/packages/rendering/src/pools/BindGroupPool.ts`

```typescript
interface BindGroupPoolEntry {
  bindGroup: GPUBindGroup;
  id: number;
  lastUsed: number;
  inUse: boolean;
}

export class BindGroupPool {
  private pools = new Map<string, BindGroupPoolEntry[]>();
  private nextId = 1;
  private stats = {
    poolHits: 0,
    poolMisses: 0,
    totalCreated: 0,
    totalReleased: 0
  };
  private maxPoolSize = 1000; // Prevent unbounded growth

  constructor(private device: GPUDevice) {
    // Register device loss handler
    this.device.lost.then(() => {
      this.handleDeviceLoss();
    });
  }

  acquire(
    layout: GPUBindGroupLayout,
    resources: BindGroupResources,
    cacheKey?: string
  ): { bindGroup: GPUBindGroup; id: number } {
    const key = cacheKey ?? this.generateCacheKey(layout, resources);
    const pool = this.pools.get(key) ?? [];

    // Find available bind group (not in use)
    const available = pool.find(entry => !entry.inUse);

    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      this.stats.poolHits++;
      return { bindGroup: available.bindGroup, id: available.id };
    }

    // Check pool size limit
    if (pool.length >= this.maxPoolSize) {
      console.warn(`BindGroupPool size limit reached for key: ${key}`);
      // Evict oldest unused entry
      const oldest = pool
        .filter(e => !e.inUse)
        .sort((a, b) => a.lastUsed - b.lastUsed)[0];
      if (oldest) {
        const index = pool.indexOf(oldest);
        pool.splice(index, 1);
      }
    }

    // Create new bind group
    const bindGroup = this.device.createBindGroup({
      layout,
      entries: this.mapResources(resources)
    });

    const entry: BindGroupPoolEntry = {
      bindGroup,
      id: this.nextId++,
      lastUsed: Date.now(),
      inUse: true
    };

    pool.push(entry);
    this.pools.set(key, pool);
    this.stats.poolMisses++;
    this.stats.totalCreated++;

    return { bindGroup: entry.bindGroup, id: entry.id };
  }

  release(id: number): void {
    for (const pool of this.pools.values()) {
      const entry = pool.find(e => e.id === id);
      if (entry) {
        entry.inUse = false;
        this.stats.totalReleased++;
        return;
      }
    }
  }

  releaseAll(): void {
    for (const pool of this.pools.values()) {
      for (const entry of pool) {
        entry.inUse = false;
      }
    }
    this.stats.totalReleased += this.stats.totalCreated - this.stats.totalReleased;
  }

  cleanup(maxAge: number = 5000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, pool] of this.pools) {
      const keep = pool.filter(entry =>
        entry.inUse || now - entry.lastUsed < maxAge
      );

      cleaned += pool.length - keep.length;

      if (keep.length === 0) {
        this.pools.delete(key);
      } else {
        this.pools.set(key, keep);
      }
    }

    return cleaned;
  }

  getStats() {
    return {
      ...this.stats,
      cacheHitRate: this.stats.poolHits / (this.stats.poolHits + this.stats.poolMisses),
      totalPooled: Array.from(this.pools.values()).reduce((sum, pool) => sum + pool.length, 0),
      activeCount: Array.from(this.pools.values()).reduce(
        (sum, pool) => sum + pool.filter(e => e.inUse).length, 0
      )
    };
  }

  private handleDeviceLoss(): void {
    // Clear all pools on device loss
    this.pools.clear();
    this.stats = {
      poolHits: 0,
      poolMisses: 0,
      totalCreated: 0,
      totalReleased: 0
    };
  }

  private generateCacheKey(layout: GPUBindGroupLayout, resources: BindGroupResources): string {
    // Use resource handle IDs for stable cache key
    const parts: string[] = [];

    // Add layout hash
    parts.push(layout.label || 'default');

    // Add resource IDs from handles
    for (const [binding, resource] of Object.entries(resources)) {
      const bindingNum = parseInt(binding);
      if ('buffer' in resource) {
        // Assume BackendBufferHandle has .id property
        const handle = resource.buffer as any;
        parts.push(`${bindingNum}:buf:${handle.id || '?'}`);
      } else if ('texture' in resource) {
        const handle = resource.texture as any;
        parts.push(`${bindingNum}:tex:${handle.id || '?'}`);
      } else if ('sampler' in resource) {
        const handle = resource.sampler as any;
        parts.push(`${bindingNum}:smp:${handle.id || '?'}`);
      }
    }

    return parts.join('_');
  }

  private mapResources(resources: BindGroupResources): GPUBindGroupEntry[] {
    const entries: GPUBindGroupEntry[] = [];
    for (const [binding, resource] of Object.entries(resources)) {
      entries.push({
        binding: parseInt(binding),
        resource: 'buffer' in resource ? resource : resource.texture || resource.sampler
      });
    }
    return entries;
  }
}
```

**Acceptance Criteria:**
- [ ] inUse flag tracking prevents double-acquisition
- [ ] ID-based release system works correctly
- [ ] LRU cleanup removes stale bind groups
- [ ] Cache key generation uses stable handle IDs
- [ ] Device loss handler clears pools
- [ ] Max pool size prevents unbounded growth
- [ ] Stats tracking shows cache hit rate and active count
- [ ] Unit tests cover all scenarios:
  - Acquire new bind group
  - Acquire from pool
  - Release by ID and releaseAll
  - Cleanup removes old entries
  - Device loss recovery
  - Max pool size eviction
  - Stats are accurate
- [ ] Benchmark shows 95%+ hit rate in typical scene

**Dependencies:** None

---

### Task 1.6: Integrate BindGroupPool with WebGPUBackend (3 hours)

**Deliverable:** Update `/packages/rendering/src/backends/WebGPUBackend.ts`

**Changes:**
- Add `private bindGroupPool: BindGroupPool`
- Replace manual bind group cache with pool
- Store bind group IDs for release at end of frame
- Call `pool.releaseAll()` at end of frame
- Call `pool.cleanup()` periodically (time-based, every 5 seconds)
- Expose pool stats in endFrame() results
- Migrate existing bindGroupCache entries to pool

**Acceptance Criteria:**
- [ ] All bind group creation goes through pool
- [ ] Manual cache map removed
- [ ] Frame stats include pool hit rate and active count
- [ ] Time-based cleanup (every 5 seconds, not frame-based)
- [ ] Existing cache entries migrated smoothly
- [ ] Integration test shows 95%+ hit rate

**Dependencies:** Task 1.5

---

### Task 1.7: Delete Old Command Types (2 hours)

**Files to Delete:**
- `/packages/rendering/src/NewDrawCommand.ts`
- `DrawCommand` interface from `/packages/rendering/src/types.ts`
- `ModernDrawCommand` from `/packages/rendering/src/backends/IRendererBackend.ts`

**Files to Update:**
- Remove exports from `/packages/rendering/src/index.ts`
- Update all imports throughout codebase

**Acceptance Criteria:**
- [ ] All old command types removed
- [ ] No compilation errors
- [ ] No orphaned imports
- [ ] Git shows files properly deleted

**Dependencies:** Task 1.4

---

### Task 1.8: Update Demos and Tests (6 hours)

**Files to Update:**
- All files in `/packages/renderer/src/` (including HTML demos)
  - phase0-validation.html
  - joints.html
  - Any other demo files
- All test files using old command types (30+ files in tests/)
- `/packages/rendering/src/instance-demo.ts`
- Test mocks in `tests/mocks/` and `tests/helpers/`
- Update mock WebGPU implementations

**Acceptance Criteria:**
- [ ] All demos compile and run
- [ ] All HTML demos load and render correctly
- [ ] All tests pass (30+ test files updated)
- [ ] Visual output unchanged
- [ ] New builder API used in examples
- [ ] Mock implementations updated for new command structure

**Dependencies:** Task 1.7

---

### Task 1.9: Performance Benchmarks (3 hours)

**Deliverable:** Baseline and post-implementation benchmarks

**Tasks:**
- Create performance baseline before changes
- Measure bind group allocation count
- Measure frame time with 1000 objects
- Compare before/after metrics
- Document results

**Acceptance Criteria:**
- [ ] Baseline metrics recorded
- [ ] Post-implementation metrics show no regression
- [ ] Bind group allocations reduced by 80%
- [ ] Cache hit rate >95%
- [ ] Benchmark results documented

**Dependencies:** Task 1.8

## Breaking Changes

### Removed APIs
- `DrawCommand` (old interface from types.ts)
- `NewDrawCommand` (NewDrawCommand.ts)
- `ModernDrawCommand` (IRendererBackend.ts)
- `IRendererBackend.executeCommands()`
- `IRendererBackend.executeModernRenderPass()`

### New Required APIs
- `IRendererBackend.executeDrawCommand(command: DrawCommand)`
- Must use new unified `DrawCommand` interface
- Must import from `commands/DrawCommand`

### Migration Pattern
**Before:**
```typescript
const command: ModernDrawCommand = {
  pipeline,
  bindGroups: new Map([[0, bindGroup]]),
  vertexBuffers: [vb],
  indexBuffer: ib,
  indexFormat: 'uint16',
  indexCount: 36
};
backend.executeModernRenderPass(command);
```

**After:**
```typescript
const command = new DrawCommandBuilder()
  .pipeline(pipeline)
  .bindGroup(0, bindGroup)
  .indexed([vb], ib, 'uint16', 36)
  .build();

backend.executeDrawCommand(command);
```

## Testing Requirements

### Unit Tests
- [ ] DrawCommand type validation
- [ ] DrawCommandBuilder all methods
- [ ] BindGroupPool acquire/release
- [ ] BindGroupPool cleanup logic
- [ ] Cache key generation stability

### Integration Tests
- [ ] WebGPUBackend executeDrawCommand() all geometry types
- [ ] Bind group pool hit rate >95% in typical scene
- [ ] Multiple frames with resource reuse

### Performance Tests
- [ ] Baseline vs new implementation (no regression)
- [ ] Bind group allocation count (80% reduction)
- [ ] Frame time comparison (no increase)

### Coverage Target
**>80% line coverage** for all new code

## Performance Targets

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Bind group cache hit rate | 70% | 95%+ | ✓ |
| `as any` casts | 83 | 0 | ✓ |
| Command types | 3 | 1 | ✓ |
| Per-frame bind group allocations | 100% | 20% | 80% reduction ✓ |
| Frame time | baseline | ≤baseline | No regression ✓ |

## Dependencies

### Blocks
- **EPIC_RENDERING_02_HIGHLEVEL_API** - High-level API needs unified commands

### Blocked By
- None (can start immediately)

## Risks & Mitigation

### High Risk
**Breaking all existing code**
- *Mitigation:* Update all demos/tests in same PR
- *Mitigation:* Provide clear migration guide
- *Mitigation:* Use feature flag for gradual rollout if needed

### Medium Risk
**BindGroupPool cache key collisions**
- *Mitigation:* Comprehensive cache key tests
- *Mitigation:* Include all resource IDs in key

**Performance regression from abstractions**
- *Mitigation:* Profile before/after
- *Mitigation:* Benchmark critical paths

### Low Risk
**Developer adoption of builder pattern**
- *Mitigation:* Clear documentation and examples

## Definition of Done

- [ ] All 9 tasks completed
- [ ] Zero `as any` casts in codebase (down from 83)
- [ ] All tests passing with >80% coverage
- [ ] Performance benchmarks show no regression
- [ ] Bind group cache hit rate >95%
- [ ] All demos updated and running (including HTML demos)
- [ ] Mock implementations updated
- [ ] Device loss handling in BindGroupPool
- [ ] Code reviewed and approved
- [ ] Documentation updated

---

*Epic created: November 2025*
*Priority: HIGH - Blocking other epics*
*Estimated effort: 38 hours*
*Last updated: November 2025 (refined by epic-refiner agent)*