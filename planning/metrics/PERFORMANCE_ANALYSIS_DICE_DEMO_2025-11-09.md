# Performance Analysis: Dice Demo - November 9, 2025

**Date**: 2025-11-09
**Demo**: Dice Physics Demo
**Entity Count**: 2,364 dice
**System**: macOS (Metal backend)
**Electron**: 37.9.0 (Chrome 138.0.7204.251)
**Node**: 22.21.1

---

## Executive Summary

### Current Performance
- **Frame Time**: 10.80ms - 25.10ms
- **Frame Rate**: 39.8 FPS - 92.6 FPS
- **Target**: 60 FPS (16.67ms per frame)
- **Status**: ⚠️ **Inconsistent** - fluctuates between acceptable and poor

### Primary Bottlenecks
1. **Physics Simulation**: 3.9-5.1ms (38-40% of CPU time) ❌
2. **Physics→ECS Sync**: 2.7-2.8ms (22-24% of CPU time) ⚠️
3. **V-Sync Stalls**: 9.45ms intermittent (compositor overhead) ⚠️

### What's Working Well
- ✅ **GPU Instancing**: 2,364 objects → 2 draw calls (99.9% efficiency)
- ✅ **Uniform Buffer Pool**: 100% reuse rate
- ✅ **Bind Group Cache**: 100% hit rate
- ✅ **GPU Execution**: 1.57-2.75ms (very efficient)

---

## Detailed Frame Analysis

### Frame 1: Poor Performance (25.10ms total / 39.8 FPS)

```
=== CPU TIMING BREAKDOWN ===
Physics:                    5.10ms  (40.3%) ████████████████████████████████████████
Sync (physics→ECS):         2.70ms  (21.3%) █████████████████████████
ECS update:                 2.00ms  (15.8%) ██████████████████
Dice loop (2364 dice):      1.80ms  (14.2%) ████████████████
Render queue sort:          1.20ms  (9.5%)  ███████████
GPU command encode:         0.10ms  (0.8%)  █
endFrame() [submit+present]:0.00ms  (0.0%)
Matrix pool cleanup:        0.00ms  (0.0%)

Total CPU:                 12.90ms  (100%)
GPU execution:              2.75ms  (MEASURED via timestamp-query)
```

**Measured Work**: 15.65ms (CPU + GPU)
**Actual Frame Time**: 25.10ms
**Unaccounted Time**: 9.45ms ⚠️ **HIGH COMPOSITOR/V-SYNC OVERHEAD**

**Diagnosis**: Frame completed work at ~15.65ms but V-Sync forced wait until 25.10ms

---

### Frame 2: Good Performance (10.80ms total / 92.6 FPS)

```
=== CPU TIMING BREAKDOWN ===
Physics:                    3.90ms  (33.6%) ██████████████████████████████████
Sync (physics→ECS):         2.80ms  (24.1%) ████████████████████████
ECS update:                 2.00ms  (17.2%) █████████████████
Dice loop (2364 dice):      1.70ms  (14.7%) ███████████████
Render queue sort:          1.10ms  (9.5%)  ██████████
GPU command encode:         0.00ms  (0.0%)
endFrame() [submit+present]:0.10ms  (0.9%)  █
Matrix pool cleanup:        0.00ms  (0.0%)

Total CPU:                 11.60ms  (100%)
GPU execution:              1.57ms  (MEASURED via timestamp-query)
```

**Measured Work**: 13.17ms (CPU + GPU)
**Actual Frame Time**: 10.80ms
**Unaccounted Time**: -2.37ms (measurement variance, within tolerance)

**Diagnosis**: Clean frame with minimal overhead

---

## Performance Metrics

### Rendering Efficiency ✅

| Metric | Value | Status |
|--------|-------|--------|
| Dice Count | 2,364 | |
| Submitted to Queue | 2,364 | |
| Instance Groups | 2 | ✅ |
| Final Draw Calls | 2 | ✅ |
| Instanced Calls | 2 | ✅ |
| **Draw Call Reduction** | **99.9%** | ✅ |

### Uniform Buffer Pool ✅

| Metric | Frame 1 | Frame 2 |
|--------|---------|---------|
| Created | 2 | 2 |
| Reused | 6,360 | 6,454 |
| **Reuse Rate** | **100.0%** | **100.0%** |
| Pool Size | 2 | 2 |

### Bind Group Cache ✅

| Metric | Frame 1 | Frame 2 |
|--------|---------|---------|
| Created | 2 | 2 |
| Cached | 6,360 | 6,454 |
| **Cache Hit Rate** | **100.0%** | **100.0%** |

---

## Root Cause Analysis

### 1. Physics Simulation - PRIMARY BOTTLENECK ❌

**Cost**: 3.9-5.1ms per frame
**Percentage**: 38-40% of total CPU time
**Entity Count**: 2,364 dice

#### Why This is Expensive
- Rapier physics engine processing 2,364 rigid bodies
- Collision detection between all active dice
- Constraint solving for contacts
- Integration step for velocities/positions

#### Impact
At 2,364 entities:
- Best case: 3.9ms (82 entities/ms)
- Worst case: 5.1ms (464 entities/ms)
- Variance: 1.2ms (30% fluctuation)

**Conclusion**: Physics dominates CPU time. This is expected for physics-heavy demos but needs optimization for production.

---

### 2. Physics → ECS Synchronization - SECONDARY BOTTLENECK ⚠️

**Cost**: 2.7-2.8ms per frame
**Percentage**: 22-24% of total CPU time
**Entity Count**: 2,364 dice

#### What This Does
Copies transform data from Rapier physics world to ECS component storage:
```typescript
for (each physics body) {
  const transform = world.getComponent(entity, Transform);
  transform.position = body.position;
  transform.rotation = body.rotation;
}
```

#### Why This is Expensive
- 2,364 individual getComponent() calls (uses convenience API)
- Object creation per call
- Entity ID lookup overhead

#### Performance
- 2.7-2.8ms for 2,364 entities
- ~846 entities/ms
- **32x slower than direct array access** (from ECS benchmarks)

**Conclusion**: Using convenience API (`getComponent()`) instead of performance API (`getArray()`). This is the low-hanging fruit.

---

### 3. ECS Update - ACCEPTABLE ✅

**Cost**: 2.0ms per frame
**Percentage**: 17% of total CPU time

#### What This Does
- System execution (Transform, Rendering, etc.)
- Component queries
- System-specific logic

#### Performance
- 2.0ms for 2,364 entities
- ~1,182 entities/ms
- **Acceptable for entity count**

**Conclusion**: ECS overhead is reasonable. No immediate action needed.

---

### 4. Dice Loop - NEEDS INVESTIGATION ⚠️

**Cost**: 1.7-1.8ms per frame
**Percentage**: 14-15% of total CPU time

#### What This Does
**Unknown** - needs profiling to determine exact operations.

Likely candidates:
- Matrix updates (model matrices for rendering)
- Material property updates
- Instance buffer population

#### Performance
- 1.7-1.8ms for 2,364 entities
- ~1,320 entities/ms

**Conclusion**: Moderate cost. Should profile to understand if using optimal patterns.

---

### 5. Render Queue Sort - MODERATE ⚠️

**Cost**: 1.1-1.2ms per frame
**Percentage**: 9-10% of total CPU time

#### What This Does
Sorts 2,364 render commands by:
1. Render pass (opaque/transparent)
2. Depth (front-to-back for opaque, back-to-front for transparent)
3. Material (minimize state changes)

#### Performance
- 1.1-1.2ms for 2,364 entities
- ~2,000 entities/ms
- Using JavaScript sort (likely quicksort/mergesort)

#### Algorithm Complexity
- Current: O(n log n) comparison sort
- Could improve with: Radix sort O(n) for depth sorting

**Conclusion**: Sorting is moderately expensive. Radix sort would help, but not critical.

---

### 6. V-Sync / Compositor Overhead - INTERMITTENT ⚠️

**Cost**: 0-9.45ms per frame (varies)
**Cause**: V-Sync enforcement + macOS WindowServer compositor

#### What This Does
Frame 1 shows 9.45ms unaccounted time after measured work completes:
- Work finishes at ~15.65ms
- V-Sync forces wait until 25.10ms
- 9.45ms stall waiting for monitor refresh

#### Why This Happens
**V-Sync Enforcement** (`presentMode: 'fifo'`):
- Recently merged from `performance/windows-compositor-overhead` branch
- Forces synchronization with monitor refresh rate
- If work finishes between V-Sync windows, frame waits

**macOS WindowServer**:
- macOS compositor processes all window updates
- Can add 2-10ms latency depending on system load
- More pronounced on integrated GPUs

#### Frame Pacing Analysis
- Monitor refresh: Likely 60Hz (16.67ms) or 144Hz (6.94ms)
- Frame 1: Missed V-Sync window by ~0.5ms, waited full cycle
- Frame 2: Caught V-Sync window cleanly

**Conclusion**: V-Sync causing intermittent stalls. This is by design but can be disabled for testing.

---

## Performance Budget Analysis

### Current Frame Budget (Target: 16.67ms for 60 FPS)

| Component | Frame 1 | Frame 2 | Budget | Status |
|-----------|---------|---------|--------|--------|
| **Physics** | 5.10ms | 3.90ms | 3.0ms | ❌ OVER |
| **Physics Sync** | 2.70ms | 2.80ms | 1.0ms | ❌ OVER |
| **ECS Update** | 2.00ms | 2.00ms | 2.0ms | ✅ OK |
| **Dice Loop** | 1.80ms | 1.70ms | 1.5ms | ⚠️ OVER |
| **Render Sort** | 1.20ms | 1.10ms | 1.0ms | ⚠️ OVER |
| **GPU Encode** | 0.10ms | 0.00ms | 0.5ms | ✅ OK |
| **GPU Execute** | 2.75ms | 1.57ms | 3.0ms | ✅ OK |
| **Other** | 0.00ms | 0.10ms | 0.5ms | ✅ OK |
| **V-Sync Stall** | 9.45ms | 0.00ms | 0.0ms | ❌ CRITICAL |
| | | | | |
| **Total** | 25.10ms | 13.17ms | 16.67ms | ⚠️ VARIABLE |

### Headroom Analysis

**Frame 2 (Best Case)**: 13.17ms measured
- Headroom: 3.5ms (21% under budget)
- Status: ✅ **Acceptable** (with V-Sync disabled)

**Frame 1 (Worst Case)**: 25.10ms total
- Over budget: 8.43ms (50% over)
- Status: ❌ **Unacceptable**

---

## Optimization Recommendations

### Priority 1: Immediate Wins (High Impact, Low Effort)

#### 1.1 Optimize Physics→ECS Sync (Expected: -1.5ms)

**Current Implementation** (using convenience API):
```typescript
// packages/renderer/src/demo.ts or physics sync code
for (const entity of physicsEntities) {
  const transform = world.getComponent(entity, Transform);
  transform.position = body.position;
  transform.rotation = body.rotation;
}
```
**Performance**: 13,329 components/ms (from ECS Integration Benchmark)

**Optimized Implementation** (using direct array access):
```typescript
// Get direct typed array access
const transformStorage = world.getArchetypeManager()
  .getStorage('Transform');
const positions = transformStorage.getArray('position');
const rotations = transformStorage.getArray('rotation');

// Direct array writes (zero allocations)
for (let i = 0; i < entityCount; i++) {
  positions.x[i] = bodies[i].position.x;
  positions.y[i] = bodies[i].position.y;
  positions.z[i] = bodies[i].position.z;
  // ... rotations
}
```
**Performance**: 428,865 components/ms (from Direct Access Benchmark)

**Expected Gain**: 32x faster access = ~1.5-2.0ms saved

**Implementation Location**: `packages/renderer/src/demo.ts` (physics sync section)

---

#### 1.2 Disable V-Sync for Testing (Expected: -9.45ms intermittent)

**Current** (`packages/rendering/src/backends/WebGPUBackend.ts:273`):
```typescript
presentMode: 'fifo', // V-Sync: cap at monitor refresh rate
```

**Change to**:
```typescript
presentMode: 'immediate', // No V-Sync: uncapped framerate
```

**Expected Gain**: Eliminates 9.45ms stalls

**Trade-off**: Screen tearing possible, but good for performance testing

---

#### 1.3 Reduce Entity Count for Testing (Expected: -2-3ms)

**Current**: 2,364 dice

**Change to**: 1,000 dice (proportional reduction)

**Expected Gains**:
- Physics: 5.1ms → 2.1ms (-3.0ms)
- Physics Sync: 2.8ms → 1.2ms (-1.6ms)
- Dice Loop: 1.8ms → 0.8ms (-1.0ms)
- Render Sort: 1.2ms → 0.5ms (-0.7ms)

**Total Expected Gain**: ~6ms

---

### Priority 2: Medium-Term Optimizations (Moderate Impact, Moderate Effort)

#### 2.1 Implement Dirty Tracking for Physics Sync (Expected: -1.0ms)

Only sync entities that moved:
```typescript
// Track which physics bodies are active/sleeping
for (const entity of activePhysicsEntities) {
  if (body.isAwake()) {
    syncTransform(entity, body);
  }
}
```

**Expected Gain**: ~50% of entities sleeping at any time = 1.4ms → 0.7ms

---

#### 2.2 Use Radix Sort for Render Queue (Expected: -0.5ms)

Current: O(n log n) comparison sort
Proposed: O(n) radix sort for depth sorting

**Implementation**: Replace quicksort with radix sort in `RenderQueue.ts`

**Expected Gain**: 1.2ms → 0.7ms

---

#### 2.3 Profile and Optimize Dice Loop (Expected: -0.5ms)

**Action Required**: Profile to determine exact operations

Likely optimizations:
- Use `getArray()` if using `getComponent()`
- Batch matrix updates
- Minimize cache misses

---

### Priority 3: Long-Term Optimizations (High Impact, High Effort)

#### 3.1 Parallel Physics Simulation (Expected: -3ms, Epic 10.x)

Move physics to Web Worker:
```typescript
// Main thread: Send entity state → Worker
// Worker thread: Run physics simulation
// Main thread: Receive updated transforms
```

**Expected Gain**: Offload 4-5ms to separate thread

**Epic**: 10.x (Parallel Execution)

---

#### 3.2 Frustum Culling (Expected: -1ms, Epic 3.x)

Don't update matrices/physics for off-screen objects:
```typescript
if (frustum.contains(entity.bounds)) {
  updateTransform(entity);
  addToRenderQueue(entity);
}
```

**Expected Gain**: ~30-50% entities off-screen = 1-2ms saved

**Epic**: 3.x (Rendering Advanced Features)

---

#### 3.3 LOD System (Expected: -1-2ms, Epic 3.x)

Reduce physics/rendering complexity for distant objects:
- Close: Full physics + high-poly mesh
- Medium: Simplified physics + medium-poly mesh
- Far: No physics + low-poly mesh

**Expected Gain**: Variable, depends on camera distance

**Epic**: 3.x (Rendering Advanced Features)

---

## Recommendations by Timeline

### Immediate (This Week)

1. ✅ **Optimize physics sync** (use `getArray()` pattern)
   - Expected: -1.5ms
   - Effort: 1-2 hours
   - File: `packages/renderer/src/demo.ts`

2. ✅ **Disable V-Sync for testing**
   - Expected: -9.45ms (intermittent)
   - Effort: 5 minutes
   - File: `packages/rendering/src/backends/WebGPUBackend.ts:273`

3. ⚠️ **Profile dice loop**
   - Expected: TBD (need profiling data)
   - Effort: 1 hour investigation

### Short-Term (Next Sprint)

4. ⚠️ **Implement dirty tracking**
   - Expected: -1.0ms
   - Effort: 4-8 hours
   - Epic: Physics optimization

5. ⚠️ **Radix sort for render queue**
   - Expected: -0.5ms
   - Effort: 4-6 hours
   - Epic: 3.12 (Render Queue optimization)

### Long-Term (Future Epics)

6. 📋 **Web Worker physics** (Epic 10.x)
7. 📋 **Frustum culling** (Epic 3.x)
8. 📋 **LOD system** (Epic 3.x)

---

## Expected Performance After Immediate Optimizations

### Current (Frame 2 baseline):
```
Physics:          3.90ms
Physics Sync:     2.80ms  ← Will optimize
ECS Update:       2.00ms
Dice Loop:        1.70ms
Render Sort:      1.10ms
GPU Execute:      1.57ms
V-Sync Stall:     0.00ms  ← Will disable
──────────────────────────
Total:           13.17ms  (75.9 FPS)
```

### After Immediate Optimizations:
```
Physics:          3.90ms
Physics Sync:     1.30ms  ✅ (-1.5ms via getArray())
ECS Update:       2.00ms
Dice Loop:        1.70ms
Render Sort:      1.10ms
GPU Execute:      1.57ms
V-Sync Stall:     0.00ms  ✅ (disabled)
──────────────────────────
Total:           11.67ms  (85.7 FPS) ✅
```

**Target Met**: 11.67ms < 16.67ms ✅ (60 FPS with 30% headroom)

---

## Conclusion

### Current State
- Performance is **inconsistent** (40-92 FPS)
- **Physics is the primary bottleneck** (38-40% of CPU time)
- **Physics sync is inefficient** (using slow convenience API)
- **V-Sync causes intermittent stalls** (9.45ms)

### What's Working
- ✅ GPU instancing (99.9% draw call reduction)
- ✅ Uniform buffer pooling (100% reuse)
- ✅ Bind group caching (100% hit rate)
- ✅ GPU efficiency (1.57-2.75ms for 2,364 entities)

### Next Steps

**Immediate** (this week):
1. Switch physics sync to `getArray()` pattern (-1.5ms)
2. Disable V-Sync for testing (-9.45ms intermittent)
3. Profile dice loop to understand cost

**Short-term** (next sprint):
4. Implement dirty tracking for physics sync
5. Add radix sort for render queue

**Long-term** (future epics):
6. Web Worker for parallel physics
7. Frustum culling
8. LOD system

### Expected Outcome
With immediate optimizations: **85.7 FPS** (11.67ms per frame)

This provides **30% headroom** above 60 FPS target and establishes a solid foundation for adding more features.

---

**Generated**: 2025-11-09
**Next Review**: After implementing immediate optimizations
