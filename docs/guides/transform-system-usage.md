# Transform System Usage Guide (Epic 3.11.5)

This guide shows how to use the cache-efficient Transform system after Epic 3.11.5 refactoring.

## Key Changes from Epic 3.11

**Before (Epic 3.11):**
- Transform had helper methods like `setPosition()`, `markDirty()`
- Parent/children stored as object properties
- Matrices allocated every frame (960KB/sec garbage)

**After (Epic 3.11.5):**
- Transform is **pure data** (no methods)
- ALL data in typed arrays (cache-efficient SoA)
- Zero allocations in hot paths
- Helper methods moved to TransformSystem
- Convenience API on World for common operations

---

## Basic Setup

```typescript
import { World } from '@miskatonic/ecs';
import { Transform } from '@miskatonic/ecs';
import { TransformSystem } from '@miskatonic/ecs';

// Create world and register TransformSystem
const world = new World();
const transformSystem = new TransformSystem(world, 1024); // capacity: 1024 entities
world.registerSystem(transformSystem);
world.init();

// Create entity with transform
const entity = world.createEntity();
world.addComponent(entity, Transform, new Transform(0, 0, 0));
```

---

## Modifying Transforms

### Using World Convenience API (Recommended)

```typescript
// Set position
world.setPosition(entity, 10, 5, 0);

// Set rotation (Euler angles in radians)
world.setRotation(entity, 0, Math.PI / 4, 0); // 45 degrees around Y

// Set scale
world.setScale(entity, 2, 2, 2); // Double size
```

### Using TransformSystem Directly (Advanced)

```typescript
const transformSystem = world.getSystem<TransformSystem>('TransformSystem');

transformSystem.setPosition(entity, 10, 5, 0);
transformSystem.setRotation(entity, 0, Math.PI / 4, 0);
transformSystem.setScale(entity, 2, 2, 2);
transformSystem.markDirty(entity); // Manually mark dirty
```

### Modifying Raw Data (Expert Only)

```typescript
const transform = world.getComponent(entity, Transform) as TransformData;

// WARNING: Returns plain object, not Transform instance!
// Must manually mark dirty after modifications
transform.x = 10;
transform.y = 5;
transform.z = 0;
transform.dirty = 1; // IMPORTANT: Mark dirty!
```

---

## Hierarchical Transforms

### Setting Parent-Child Relationships

```typescript
// Create parent and child
const parent = world.createEntity();
const child = world.createEntity();
world.addComponent(parent, Transform, new Transform(10, 0, 0));
world.addComponent(child, Transform, new Transform(5, 0, 0));

// Set parent (with circular dependency detection)
world.setParent(child, parent);
// Child world position is now (15, 0, 0) = parent + child local

// Clear parent
world.setParent(child); // or world.setParent(child, undefined);
```

### Iterating Children

```typescript
const children = world.getChildren(parent);
console.log(`Parent has ${children.length} children`);

for (const childId of children) {
  console.log(`Child: ${childId}`);
}
```

### Circular Dependency Prevention

```typescript
// This is SAFE - automatically detected and prevented
world.setParent(parent, child); // ERROR: would create cycle
// Console: "Cannot set parent X for entity Y: would create circular dependency"
```

---

## Getting Matrices

### World Matrix (For Rendering)

```typescript
// Get world matrix (automatically updates if dirty)
const worldMatrix = world.getWorldMatrix(entity);
if (worldMatrix) {
  // Pass to renderer/shader
  renderer.setModelMatrix(worldMatrix);
}
```

### Local Matrix (For Debugging)

```typescript
const localMatrix = world.getLocalMatrix(entity);
if (localMatrix) {
  console.log('Local matrix:', localMatrix);
}
```

### Advanced: Direct MatrixStorage Access

```typescript
const transformSystem = world.getSystem<TransformSystem>('TransformSystem');
const matrixStorage = transformSystem.getMatrixStorage();

const stats = matrixStorage.getStats();
console.log(`Matrix memory: ${stats.memoryBytes} bytes`);
console.log(`Utilization: ${stats.utilization}%`);
```

---

## Game Loop Integration

```typescript
// In your game loop
function gameLoop(deltaTime: number) {
  // Update all systems (including TransformSystem)
  world.update(deltaTime);

  // TransformSystem automatically:
  // 1. Recalculates dirty transforms
  // 2. Updates hierarchies
  // 3. Zero allocations (uses *To() variants)

  // Render entities
  const query = world.query().with(Transform).build();
  const entities = world.executeQuery(query);

  for (const { entity: entityId } of entities) {
    const worldMatrix = world.getWorldMatrix(entityId);
    renderer.drawEntity(entityId, worldMatrix);
  }
}
```

---

## Performance Best Practices

### ✅ DO THIS

```typescript
// Use World convenience API
world.setPosition(entity, x, y, z);

// Batch modifications before marking dirty
const transform = world.getComponent(entity, Transform);
transform.x = 10;
transform.y = 5;
transform.z = 0;
transform.dirty = 1; // Mark dirty ONCE
```

### ❌ DON'T DO THIS

```typescript
// DON'T try to call methods on retrieved components
const transform = world.getComponent(entity, Transform);
transform.setPosition(x, y, z); // ERROR: setPosition is not a function

// DON'T forget to mark dirty
const transform = world.getComponent(entity, Transform);
transform.x = 10; // Changed
// FORGOT: transform.dirty = 1; // Matrix won't update!

// DON'T allocate matrices manually
const matrix = Mat4.composeTRS(...); // ALLOCATION!
// Use: transformSystem.getWorldMatrix(entity) instead
```

---

## Memory Layout (Epic 3.11.5)

### Per-Entity Memory

```
Transform Component: 57 bytes (typed arrays)
  - Position: 12 bytes (3 × Float32)
  - Rotation: 12 bytes (3 × Float32)
  - Scale: 12 bytes (3 × Float32)
  - Hierarchy: 12 bytes (3 × Int32)
  - Dirty: 1 byte (Uint8)
  - Matrix indices: 8 bytes (2 × Int32)

Matrix Storage: 128 bytes (separate from component)
  - Local matrix: 64 bytes (16 × Float32)
  - World matrix: 64 bytes (16 × Float32)

Total: 185 bytes per transform
```

### Compared to Epic 3.11

```
Epic 3.11: 400+ bytes (matrices + hierarchy objects)
Epic 3.11.5: 185 bytes (54% reduction)

Garbage: 960KB/sec @ 60 FPS for 1000 entities (Epic 3.11)
Garbage: 0 KB/sec (Epic 3.11.5) ✅
```

---

## Troubleshooting

### "setPosition is not a function"

**Problem:** Tried to call method on retrieved component

```typescript
const transform = world.getComponent(entity, Transform);
transform.setPosition(x, y, z); // ERROR
```

**Solution:** Use World API or TransformSystem

```typescript
world.setPosition(entity, x, y, z); // ✅ Correct
```

### Matrices not updating

**Problem:** Modified raw data but forgot to mark dirty

```typescript
const transform = world.getComponent(entity, Transform);
transform.x = 10;
// Forgot: transform.dirty = 1;
```

**Solution:** Always mark dirty after modifications

```typescript
const transform = world.getComponent(entity, Transform);
transform.x = 10;
transform.dirty = 1; // ✅ Mark dirty
```

### "TransformSystem not registered"

**Problem:** Trying to use World convenience API before registering TransformSystem

**Solution:** Register TransformSystem first

```typescript
const transformSystem = new TransformSystem(world);
world.registerSystem(transformSystem); // ✅ Register first
world.init();
```

---

## Migration from Epic 3.11

### Before (Epic 3.11)

```typescript
const transform = world.getComponent(entity, Transform);
transform.setPosition(10, 5, 0);
transform.setRotation(0, Math.PI / 4, 0);
transform.markDirty();
```

### After (Epic 3.11.5)

```typescript
// Option 1: World convenience API
world.setPosition(entity, 10, 5, 0);
world.setRotation(entity, 0, Math.PI / 4, 0);

// Option 2: TransformSystem directly
const transformSystem = world.getSystem<TransformSystem>('TransformSystem');
transformSystem.setPosition(entity, 10, 5, 0);
transformSystem.setRotation(entity, 0, Math.PI / 4, 0);

// Option 3: Raw data (expert)
const transform = world.getComponent(entity, Transform);
transform.x = 10; transform.y = 5; transform.z = 0;
transform.rotationY = Math.PI / 4;
transform.dirty = 1; // Don't forget!
```

---

## Advanced Topics

### Custom Matrix Operations

```typescript
const transformSystem = world.getSystem<TransformSystem>('TransformSystem');
const worldMatrix = transformSystem.getWorldMatrix(entity);

// Modify matrix directly (advanced)
worldMatrix[12] = 100; // Set X translation
transformSystem.markDirty(entity); // Mark dirty for recalc
```

### Force Update (Bypass Dirty Flag)

```typescript
const transformSystem = world.getSystem<TransformSystem>('TransformSystem');

// Force update single entity
transformSystem.forceUpdate(entity);

// Force update all (expensive!)
transformSystem.forceUpdateAll();
```

### Statistics and Debugging

```typescript
const transformSystem = world.getSystem<TransformSystem>('TransformSystem');
const stats = transformSystem.getStats();

console.log(`Total transforms: ${stats.totalTransforms}`);
console.log(`Dirty transforms: ${stats.dirtyTransforms}`);
console.log(`Hierarchical transforms: ${stats.hierarchicalTransforms}`);
console.log(`Matrix memory: ${stats.matrixMemoryBytes} bytes`);
console.log(`Matrix utilization: ${stats.matrixUtilization}%`);
```

---

## Summary

**Epic 3.11.5 achieves:**
- ✅ Zero allocations in hot paths
- ✅ 54% memory reduction (185 bytes vs 400+ bytes)
- ✅ Cache-efficient SoA storage
- ✅ Circular dependency detection
- ✅ Clean API through World convenience methods
- ✅ Proper ECS design: data in components, logic in systems

**Use World convenience API for most cases:**

```typescript
world.setPosition(entity, x, y, z);
world.setRotation(entity, rx, ry, rz);
world.setScale(entity, sx, sy, sz);
world.setParent(child, parent);
const matrix = world.getWorldMatrix(entity);
```

**This is the recommended way to work with transforms!**
