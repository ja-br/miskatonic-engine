# Epic 3.13: Draw Call Batching & Instancing - Design Document

**Status:** In Development
**Priority:** P1 - IMPORTANT (PERFORMANCE)
**Dependencies:** Epic 3.12 (Render Queue) ✅ COMPLETE

## Problem Statement

Naive rendering of 1000 objects = 1000 draw calls = 10-100ms CPU time (exceeds 16.67ms frame budget!).

Each draw call has overhead:
- State validation
- Uniform updates
- Descriptor binding
- CPU → GPU synchronization

**Goal:** Reduce 1000 draw calls to <100 via batching and instancing.

---

## Solution Architecture

### Three Techniques (in priority order):

#### 1. Instance Rendering (HIGHEST PRIORITY)
**Performance:** 100x+ reduction
**Use case:** Multiple identical objects (trees, rocks, enemies)
**Example:** 1000 trees = 1 draw call

#### 2. Static Batching
**Performance:** 10x reduction
**Use case:** Static geometry that never moves
**Example:** 100 wall segments = 1 combined mesh

#### 3. Dynamic Batching
**Performance:** 5x reduction
**Use case:** Small meshes (<300 verts) with same material
**Example:** 50 particles = 1 combined mesh (rebuilt each frame)

---

## 1. Instance Rendering Design

### Core Concept

GPU draws N copies of the same mesh with different per-instance data (transform, color, etc.).

**WebGL2:**
```javascript
gl.drawElementsInstanced(
  gl.TRIANGLES,
  indexCount,
  gl.UNSIGNED_SHORT,
  0,
  instanceCount  // Draw N instances
);
```

**WebGPU:**
```rust
renderPass.drawIndexed(indexCount, instanceCount, 0, 0, 0);
```

### Instance Buffer Structure

```
Per-Instance Data Layout (stride = 64 bytes):
  - Model Matrix (mat4):  16 floats = 64 bytes

Total for 1000 instances: 1000 * 64 = 64KB
```

**Optimizations:**
- Use `Float32Array` for zero-copy transfer to GPU
- Pool instance buffers by size (avoid reallocation)
- Update only changed instances (dirty tracking)

### Vertex Shader Changes

**Standard (non-instanced):**
```glsl
attribute vec3 a_position;
uniform mat4 u_modelMatrix;
uniform mat4 u_viewProjection;

void main() {
  gl_Position = u_viewProjection * u_modelMatrix * vec4(a_position, 1.0);
}
```

**Instanced:**
```glsl
attribute vec3 a_position;
attribute mat4 a_instanceMatrix;  // Per-instance (divisor=1)
uniform mat4 u_viewProjection;

void main() {
  gl_Position = u_viewProjection * a_instanceMatrix * vec4(a_position, 1.0);
}
```

**Key:** `gl.vertexAttribDivisor(location, 1)` makes attribute advance per-instance, not per-vertex.

### Instance Detection Algorithm

```typescript
// Group commands by (mesh, material) key
const instanceGroups = new Map<string, QueuedDrawCommand[]>();

for (const cmd of commands) {
  const key = `${cmd.meshId}-${cmd.materialId}`;
  if (!instanceGroups.has(key)) {
    instanceGroups.set(key, []);
  }
  instanceGroups.get(key)!.push(cmd);
}

// Threshold: Only instance if ≥10 objects (avoid overhead for small groups)
const INSTANCE_THRESHOLD = 10;

for (const [key, group] of instanceGroups) {
  if (group.length >= INSTANCE_THRESHOLD) {
    // Create instance buffer and submit instanced draw call
    submitInstanced(group);
  } else {
    // Too few, submit individual draw calls
    for (const cmd of group) {
      submit(cmd);
    }
  }
}
```

---

## 2. Static Batching Design

### Core Concept

Combine multiple static meshes into one big mesh at build time. Never changes at runtime.

**Example:**
```
100 wall segments (each 24 verts) = 2400 verts combined
100 draw calls → 1 draw call
```

### Mesh Combining Algorithm

```typescript
function combineStaticMeshes(meshes: Mesh[]): Mesh {
  let totalVertices = 0;
  let totalIndices = 0;

  // Calculate sizes
  for (const mesh of meshes) {
    totalVertices += mesh.vertexCount;
    totalIndices += mesh.indexCount;
  }

  // Allocate buffers
  const combinedVertices = new Float32Array(totalVertices * vertexStride);
  const combinedIndices = new Uint16Array(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;

  // Copy mesh data with transforms baked in
  for (const mesh of meshes) {
    // Copy vertices (transform to world space)
    for (let i = 0; i < mesh.vertexCount; i++) {
      const pos = mesh.getPosition(i);
      const worldPos = mesh.transform.transformPoint(pos);
      combinedVertices.set([worldPos.x, worldPos.y, worldPos.z], vertexOffset);
      vertexOffset += vertexStride;
    }

    // Copy indices (offset by vertex base)
    for (let i = 0; i < mesh.indexCount; i++) {
      combinedIndices[indexOffset++] = mesh.indices[i] + vertexBase;
    }

    vertexBase += mesh.vertexCount;
  }

  return new Mesh(combinedVertices, combinedIndices);
}
```

**Limitation:** Combined mesh is STATIC. Can't move individual parts.

---

## 3. Dynamic Batching Design

### Core Concept

Combine small meshes at runtime each frame. Useful for particles, decals, etc.

**Threshold:** Only batch meshes <300 vertices (overhead of combining large meshes exceeds benefit).

### Performance Analysis

```
10 particle meshes (each 24 verts):
  - Naive: 10 draw calls = ~500μs CPU
  - Batched: Combine 240 verts (~50μs) + 1 draw call (~50μs) = ~100μs total
  - Savings: 400μs (80% reduction)

Large mesh (5000 verts):
  - Combine time: ~1000μs
  - Draw time: ~50μs
  - Total: 1050μs (WORSE than individual draws!)
```

**Rule:** Only batch if `combineCost + drawCost < N * individualDrawCost`

### Implementation

```typescript
function dynamicBatch(commands: QueuedDrawCommand[]): DrawCommand | null {
  // Only batch small meshes
  const smallMeshes = commands.filter(cmd => cmd.vertexCount < 300);
  if (smallMeshes.length < 2) return null;

  // Estimate cost
  const combineCost = estimateCombineCost(smallMeshes);
  const batchDrawCost = 50; // μs
  const individualDrawCost = 50 * smallMeshes.length;

  if (combineCost + batchDrawCost >= individualDrawCost) {
    return null; // Not worth it
  }

  // Combine meshes
  return combineMeshes(smallMeshes);
}
```

---

## Implementation Plan

### Phase 1: Instance Buffer Management ✅ (Current)
**Files to create:**
- `src/InstanceBuffer.ts` - Instance buffer pool and management
- `src/InstanceDetector.ts` - Detect instanceable commands

**Key classes:**
- `InstanceBuffer` - Manages GPU buffers for per-instance data
- `InstancePool` - Pools buffers by size to avoid reallocations
- `InstanceDetector` - Groups commands by (mesh, material) key

### Phase 2: Backend Support
**Files to modify:**
- `src/backends/IRendererBackend.ts` - Add `drawInstanced()` method
- `src/backends/WebGL2Backend.ts` - Implement `gl.drawElementsInstanced()`
- `src/backends/WebGPUBackend.ts` - Implement WebGPU instancing

### Phase 3: RenderQueue Integration
**Files to modify:**
- `src/RenderQueue.ts` - Add instance detection and grouping
- `src/types.ts` - Add instance-related types

### Phase 4: Shader Support
**Files to modify:**
- `src/ShaderManager.ts` - Add instanced shader variant compilation
- `shaders/vertex/*.glsl` - Add instanced variants with `a_instanceMatrix`

### Phase 5: Static & Dynamic Batching
**Files to create:**
- `src/StaticBatcher.ts` - Build-time mesh combining
- `src/DynamicBatcher.ts` - Runtime mesh combining

### Phase 6: Testing
**Files to create:**
- `tests/InstanceBuffer.test.ts` - Instance buffer tests
- `tests/InstanceDetector.test.ts` - Detection logic tests
- `tests/Batching.test.ts` - Static/dynamic batching tests

---

## Performance Targets

### Draw Call Reduction
- **Naive:** 1000 objects = 1000 draw calls
- **Target:** 1000 objects = <100 draw calls
- **Achievement method:**
  - Instance rendering: 900 trees + 50 rocks + 50 enemies = 3 draw calls
  - Static batching: 20 wall groups = 20 draw calls
  - Dynamic batching: 80 particles = 4 draw calls
  - **Total:** ~27 draw calls (97% reduction!) ✅

### CPU Time
- **Naive:** 1000 draws × 50μs = 50ms (EXCEEDS BUDGET!)
- **Target:** 100 draws × 50μs = 5ms ✅ (within 16.67ms frame budget)

### Memory
- **Instance buffers:** 1000 instances × 64 bytes = 64KB
- **Combined meshes:** ~500KB (static batching)
- **Total:** <1MB overhead ✅

---

## Testing Strategy

### Unit Tests

1. **Instance Buffer Tests** (20 tests)
   - Buffer allocation and resizing
   - Instance data updates
   - Buffer pooling and reuse
   - Memory leak detection

2. **Instance Detection Tests** (15 tests)
   - Group by (mesh, material) key
   - Threshold logic (≥10 instances)
   - Mixed scene (some instanced, some individual)

3. **Batching Tests** (25 tests)
   - Static mesh combining
   - Dynamic mesh combining
   - Cost estimation accuracy
   - Vertex format compatibility

### Integration Tests

1. **Instanced Rendering Test**
   - Render 1000 identical cubes
   - Verify: 1 draw call
   - Verify: All cubes visible with correct transforms

2. **Mixed Batching Test**
   - 500 trees (instanced) + 20 walls (static batch) + 80 particles (dynamic batch)
   - Verify: <30 draw calls
   - Verify: 60 FPS with 1000 objects

### Performance Benchmarks

```typescript
benchmark('Instance rendering (1000 objects)', () => {
  // Setup
  const scene = create1000Trees();

  // Measure
  const start = performance.now();
  renderer.render(scene);
  const end = performance.now();

  // Assert
  expect(end - start).toBeLessThan(5); // <5ms target
  expect(stats.drawCalls).toBeLessThan(100);
});
```

---

## API Examples

### 1. Automatic Instancing (Recommended)

```typescript
// RenderQueue automatically detects and instances
const queue = new RenderQueue();

for (let i = 0; i < 1000; i++) {
  queue.submit({
    meshId: 'tree',        // Same mesh
    materialId: 'bark',    // Same material
    worldMatrix: transforms[i],
    // ... other properties
  });
}

queue.sort();            // Groups by (mesh, material)
renderer.render(queue);  // Renders as instanced draw call
// Result: 1 draw call instead of 1000
```

### 2. Manual Static Batching

```typescript
// Combine walls at build time
const walls = loadWallMeshes();
const combined = StaticBatcher.combine(walls);

// Upload once
const meshId = renderer.uploadMesh(combined);

// Draw once per frame (never changes)
queue.submit({
  meshId: meshId,
  materialId: 'stone',
  worldMatrix: identity,
});
```

### 3. Dynamic Batching (Particles)

```typescript
// Particles change every frame
const particles = updateParticles(deltaTime);

// Batch small particle meshes
const batched = DynamicBatcher.batch(particles);

queue.submit({
  meshId: batched.meshId,
  materialId: 'particle',
  worldMatrix: identity,
});
```

---

## Success Criteria

✅ **Performance:**
- 1000 objects render in <5ms CPU time
- <100 draw calls for typical scene
- 60 FPS maintained

✅ **Quality:**
- >80% test coverage
- All tests passing
- No visual artifacts

✅ **Documentation:**
- API usage examples
- Performance guidelines
- Batching best practices

---

**Next Steps:**
1. Implement `InstanceBuffer` class
2. Add backend `drawInstanced()` support
3. Integrate with `RenderQueue`
4. Write comprehensive tests
