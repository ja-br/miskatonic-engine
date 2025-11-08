# ECS Migration Guide: Epic 2.11

## Breaking Changes - Alpha Software

**This is alpha software (v0.x.x). Breaking changes are expected and necessary for performance improvements.**

Epic 2.11 refactored the ECS from Object Arrays (AoS) to Typed Arrays (SoA - Structure of Arrays) for **4.16x performance improvement** validated in Epic 2.10 benchmarks.

---

## Breaking Change #1: `getComponent()` Returns Plain Objects

### Before (Epic 2.10 and earlier):
```typescript
const transform = world.getComponent(entityId, Transform);
// transform is an instance of Transform class
console.log(transform instanceof Transform); // true
transform.setPosition(10, 20, 30); // Methods available
```

### After (Epic 2.11):
```typescript
const transform = world.getComponent(entityId, Transform);
// transform is a plain object with Transform's numeric fields
console.log(transform instanceof Transform); // FALSE
console.log(transform); // { x: 0, y: 0, z: 0, rotationX: 0, ... }
// transform.setPosition(10, 20, 30); // ERROR: Methods not available
```

### Why This Change:
- Typed arrays can only store primitives (numbers), not class instances
- SoA pattern separates each field into its own typed array
- Returning class instances would require creating new objects every call (killing performance)

### Migration Strategy:
1. **Don't rely on `instanceof` checks** - components are now plain objects
2. **Don't call component methods** - access fields directly
3. **If you need methods**, create helper functions:
   ```typescript
   // Before
   transform.setPosition(10, 20, 30);

   // After
   function setPosition(transform: Partial<Transform>, x: number, y: number, z: number) {
     transform.x = x;
     transform.y = y;
     transform.z = z;
   }
   setPosition(transform, 10, 20, 30);
   ```

---

## Breaking Change #2: `archetype.entities` is Now Hidden

### Before:
```typescript
const archetype = archetypeManager.getOrCreateArchetype([Transform]);
console.log(archetype.entities.length); // Works, shows count
console.log(archetype.entities); // Array of entity IDs
```

### After:
```typescript
const archetype = archetypeManager.getOrCreateArchetype([Transform]);
console.log(archetype.count); // Use .count instead of .entities.length
console.log(archetype.entities.length); // 256 (capacity, NOT count!)
// Use accessor methods instead:
const entities = archetypeManager.getEntities(archetype); // Returns Array
const entityId = archetypeManager.getEntityAt(archetype, 0); // Get by index
```

### Why This Change:
- `archetype.entities` is now a Uint32Array with fixed capacity (256, 512, 1024...)
- `entities.length` returns capacity, not count
- Exposing raw typed arrays caused test failures and confusion

### Migration Strategy:
1. Replace `archetype.entities.length` → `archetype.count`
2. Replace `archetype.entities[i]` → `archetypeManager.getEntityAt(archetype, i)`
3. Replace `archetype.entities` array operations → `archetypeManager.getEntities(archetype)`

---

## Breaking Change #3: Component Registration Required

### Before:
```typescript
// Components worked automatically
world.addComponent(entityId, Transform, new Transform(10, 20, 30));
```

### After:
```typescript
// Components must be registered BEFORE use
import { ComponentRegistry, createFieldDescriptor } from '@miskatonic/ecs';
import { Transform } from '@miskatonic/ecs';

ComponentRegistry.register(Transform, [
  createFieldDescriptor('x', 0),
  createFieldDescriptor('y', 0),
  createFieldDescriptor('z', 0),
  createFieldDescriptor('rotationX', 0),
  createFieldDescriptor('rotationY', 0),
  createFieldDescriptor('rotationZ', 0),
  createFieldDescriptor('scaleX', 1),
  createFieldDescriptor('scaleY', 1),
  createFieldDescriptor('scaleZ', 1),
]);

// Now it works
world.addComponent(entityId, Transform, new Transform(10, 20, 30));
```

### Why This Change:
- SoA requires knowing field names and types upfront
- Typed arrays need to be created with correct TypedArray constructor (Float32Array, Int32Array, etc.)

### Migration Strategy:
1. Register all components at startup
2. Built-in components (Transform, Velocity) are auto-registered when you import from `@miskatonic/ecs`
3. Custom components need manual registration

---

## Non-Breaking Improvements

### ✅ Same API for Adding/Removing Components
```typescript
// Still works exactly the same
world.addComponent(entityId, Transform, new Transform());
world.removeComponent(entityId, Transform);
```

### ✅ Same Query API
```typescript
// Still works exactly the same
const query = world.query().with(Transform, Velocity).build();
const results = world.executeQuery(query);
```

### ✅ Same System API
```typescript
// Still works exactly the same
world.registerSystem(new MovementSystem());
world.update(deltaTime);
```

---

## Performance Benefits

Epic 2.10 benchmarks (Apple Silicon M1/M2):
- **4.16x faster** iteration at 100k entities
- **Zero GC pressure** (0 allocations per frame)
- **~75% less memory** (12 bytes vs 48 bytes per component)

Expected on x86 (Intel/AMD with smaller caches):
- **5-10x faster** iteration
- Even greater benefits at scale

---

## Migration Checklist

- [ ] Update all `instanceof Transform` checks to field checks
- [ ] Replace component method calls with helper functions
- [ ] Replace `archetype.entities.length` with `archetype.count`
- [ ] Replace direct `archetype.entities` access with accessor methods
- [ ] Register all custom components with `ComponentRegistry`
- [ ] Update tests to expect plain objects from `getComponent()`
- [ ] Update tests to use `archetype.count` instead of `entities.length`

---

## Questions?

This is alpha software - breaking changes are necessary to discover the right design. If you encounter issues during migration, please file an issue on GitHub.

**Epic 2.11 Status:** ✅ Core refactoring complete, test updates in progress
**Performance:** ✅ 4.16x validated on Apple Silicon, 5-10x expected on x86
