# ECS API Reference

Comprehensive API documentation for `@miskatonic/ecs` - Archetype-based Entity Component System.

## Table of Contents

- [Core Classes](#core-classes)
  - [World](#world)
  - [Query & QueryBuilder](#query--querybuilder)
  - [ComponentRegistry](#componentregistry)
  - [ComponentStorage](#componentstorage)
- [Types & Interfaces](#types--interfaces)
- [Built-in Components](#built-in-components)
- [Built-in Systems](#built-in-systems)
- [Math Utilities](#math-utilities)

---

## Core Classes

### World

Central container for the ECS. Owns all entities, components, and systems.

#### Constructor

```typescript
constructor()
```

Creates a new World instance.

#### Entity Management

##### `createEntity(): EntityId`

Creates a new entity and returns its unique identifier.

**Returns:** `EntityId` - Unique entity identifier

**Example:**
```typescript
const player = world.createEntity();
```

---

##### `destroyEntity(entityId: EntityId): void`

Destroys an entity and removes all its components. Handles cleanup for TransformSystem matrices and updates internal indices.

**Parameters:**
- `entityId: EntityId` - Entity to destroy

**Notes:**
- Validates entity generation to prevent use-after-free bugs
- Cleans up TransformSystem matrix indices if entity has Transform component
- Uses swap-and-pop for O(1) removal from archetypes
- Invalidates query caches

**Example:**
```typescript
world.destroyEntity(player);
```

---

##### `hasEntity(entityId: EntityId): boolean`

Checks if an entity exists.

**Parameters:**
- `entityId: EntityId` - Entity to check

**Returns:** `boolean` - True if entity exists

**Example:**
```typescript
if (world.hasEntity(player)) {
  // Entity exists
}
```

---

#### Component Management

##### `addComponent<T extends Component>(entityId: EntityId, type: ComponentType<T>, component: T): void`

Adds a component to an entity. If the entity already has components, it will be moved to a different archetype.

**Parameters:**
- `entityId: EntityId` - Entity to modify
- `type: ComponentType<T>` - Component type constructor
- `component: T` - Component data

**Notes:**
- Clones existing components when moving archetypes to avoid shared state
- Validates entity generation to prevent use-after-free bugs
- Throws if entity doesn't exist
- O(n) operation where n = number of components on entity

**Example:**
```typescript
world.addComponent(player, Transform, new Transform(0, 0, 0));
world.addComponent(player, Velocity, new Velocity(1, 0, 0));
```

---

##### `removeComponent<T extends Component>(entityId: EntityId, type: ComponentType<T>): void`

Removes a component from an entity. Moves entity to appropriate archetype.

**Parameters:**
- `entityId: EntityId` - Entity to modify
- `type: ComponentType<T>` - Component type to remove

**Notes:**
- Clones remaining components when moving archetypes
- Validates entity generation
- O(n) operation where n = number of components on entity
- If no components remain, entity stays in world with null archetype

**Example:**
```typescript
world.removeComponent(player, Velocity);
```

---

##### `getComponent<T extends Component>(entityId: EntityId, type: ComponentType<T>): T | undefined`

Retrieves a component from an entity.

**Parameters:**
- `entityId: EntityId` - Entity to query
- `type: ComponentType<T>` - Component type to retrieve

**Returns:** `T | undefined` - Component data, or undefined if not found

**CRITICAL:** Returns a snapshot object from typed arrays. To persist changes, you must call `setComponent()`.

**Example:**
```typescript
const transform = world.getComponent(player, Transform);
if (transform) {
  console.log(`Position: ${transform.x}, ${transform.y}, ${transform.z}`);
}
```

---

##### `setComponent<T extends Component>(entityId: EntityId, type: ComponentType<T>, component: Partial<T>): void`

Writes component data back to storage. Required to persist changes made to component objects.

**Parameters:**
- `entityId: EntityId` - Entity to modify
- `type: ComponentType<T>` - Component type
- `component: Partial<T>` - Component data to write (partial update supported)

**Notes:**
- **REQUIRED** after modifying component data returned by `getComponent()`
- Supports partial updates (only specified fields are modified)
- Validates entity generation

**Example:**
```typescript
// Read-modify-write pattern
const transform = world.getComponent(player, Transform);
if (transform) {
  transform.x += 10;
  transform.y += 5;
  world.setComponent(player, Transform, transform); // Write back changes
}
```

---

##### `hasComponent<T extends Component>(entityId: EntityId, type: ComponentType<T>): boolean`

Checks if an entity has a specific component.

**Parameters:**
- `entityId: EntityId` - Entity to check
- `type: ComponentType<T>` - Component type

**Returns:** `boolean` - True if component exists on entity

**Example:**
```typescript
if (world.hasComponent(player, Health)) {
  // Player has health component
}
```

---

#### Query API

##### `query(): QueryBuilder`

Creates a new query builder for selecting entities.

**Returns:** `QueryBuilder` - Fluent query builder interface

**Example:**
```typescript
const movableEntities = world.query()
  .with(Transform)
  .with(Velocity)
  .without(Dead)
  .build();
```

---

##### `executeQuery(query: Query): QueryResult[]`

Executes a query and returns all matching entities.

**Parameters:**
- `query: Query` - Query to execute

**Returns:** `QueryResult[]` - Array of `{entity, components}` objects

**Example:**
```typescript
const results = world.executeQuery(query);
for (const { entity, components } of results) {
  const transform = components.get(Transform);
  // Process entity...
}
```

---

#### System Management

##### `registerSystem(system: System): void`

Registers a system with the world.

**Parameters:**
- `system: System` - System instance to register

**Notes:**
- Systems are sorted by priority after registration
- System `init()` is called during `world.init()`

**Example:**
```typescript
world.registerSystem(new MovementSystem());
world.registerSystem(new TransformSystem());
```

---

##### `unregisterSystem(systemName: string): void`

Removes a system from the world.

**Parameters:**
- `systemName: string` - Name of system to remove

**Notes:**
- Calls system's `cleanup()` method if defined

**Example:**
```typescript
world.unregisterSystem('MovementSystem');
```

---

##### `getSystem<T extends System>(systemName: string): T | undefined`

Retrieves a registered system by name.

**Parameters:**
- `systemName: string` - System name

**Returns:** `T | undefined` - System instance or undefined

**Example:**
```typescript
const transformSystem = world.getSystem<TransformSystem>('TransformSystem');
```

---

#### Lifecycle Methods

##### `init(): void`

Initializes all registered systems. Calls each system's `init()` method in priority order.

**Example:**
```typescript
world.registerSystem(new MovementSystem());
world.init(); // Calls MovementSystem.init(world)
```

---

##### `update(deltaTime: number): void`

Updates all registered systems. Calls each system's `update()` method in priority order.

**Parameters:**
- `deltaTime: number` - Time elapsed since last update (seconds)

**Example:**
```typescript
const lastTime = performance.now();

function gameLoop() {
  const now = performance.now();
  const deltaTime = (now - lastTime) / 1000;
  lastTime = now;

  world.update(deltaTime);

  requestAnimationFrame(gameLoop);
}
```

---

##### `cleanup(): void`

Cleans up all registered systems. Calls each system's `cleanup()` method in priority order.

**Example:**
```typescript
// On game exit
world.cleanup();
```

---

##### `clear(): void`

Clears the entire world: destroys all entities, removes all systems, clears all queries.

**Example:**
```typescript
world.clear(); // Fresh slate
```

---

#### Transform System Convenience API

These methods provide direct access to TransformSystem functionality without needing to retrieve the system.

##### `setPosition(entityId: EntityId, x: number, y: number, z: number): void`

Sets entity position.

**Parameters:**
- `entityId: EntityId` - Entity to modify
- `x, y, z: number` - Position coordinates

**Requires:** TransformSystem must be registered

---

##### `setRotation(entityId: EntityId, x: number, y: number, z: number): void`

Sets entity rotation (Euler angles in radians).

**Parameters:**
- `entityId: EntityId` - Entity to modify
- `x: number` - Rotation around X axis (pitch)
- `y: number` - Rotation around Y axis (yaw)
- `z: number` - Rotation around Z axis (roll)

**Requires:** TransformSystem must be registered

---

##### `setScale(entityId: EntityId, x: number, y: number, z: number): void`

Sets entity scale.

**Parameters:**
- `entityId: EntityId` - Entity to modify
- `x, y, z: number` - Scale factors

**Requires:** TransformSystem must be registered

---

##### `setParent(childId: EntityId, parentId?: EntityId): void`

Establishes parent-child relationship.

**Parameters:**
- `childId: EntityId` - Child entity
- `parentId?: EntityId` - Parent entity (undefined to clear parent)

**Requires:** TransformSystem must be registered

---

##### `getChildren(entityId: EntityId): EntityId[]`

Gets all children of an entity.

**Parameters:**
- `entityId: EntityId` - Parent entity

**Returns:** `EntityId[]` - Array of child entity IDs

**Requires:** TransformSystem must be registered

---

##### `getWorldMatrix(entityId: EntityId): Float32Array | undefined`

Gets world transformation matrix for entity.

**Parameters:**
- `entityId: EntityId` - Entity to query

**Returns:** `Float32Array | undefined` - 4x4 world matrix or undefined

**Requires:** TransformSystem must be registered

---

##### `getLocalMatrix(entityId: EntityId): Float32Array | undefined`

Gets local transformation matrix for entity.

**Parameters:**
- `entityId: EntityId` - Entity to query

**Returns:** `Float32Array | undefined` - 4x4 local matrix or undefined

**Requires:** TransformSystem must be registered

---

#### Debugging

##### `getStats(): WorldStats`

Returns debugging statistics about the world state.

**Returns:**
```typescript
{
  entities: {
    count: number;
    nextId: number;
    recycled: number;
  };
  archetypes: {
    count: number;
    entities: number;
    utilization: number;
  };
  systems: {
    count: number;
    systems: Array<{ name: string; priority: number }>;
  };
}
```

**Example:**
```typescript
const stats = world.getStats();
console.log(`Entities: ${stats.entities.count}`);
console.log(`Archetypes: ${stats.archetypes.count}`);
console.log(`Systems: ${stats.systems.count}`);
```

---

##### `getArchetypeManager(): ArchetypeManager`

Returns the internal ArchetypeManager (for query execution).

**Returns:** `ArchetypeManager`

**Note:** Rarely needed in application code - queries handle this internally.

---

## Query & QueryBuilder

### QueryBuilder

Fluent API for constructing entity queries.

#### `with(...types: ComponentType[]): QueryBuilder`

Requires entities to have specified components.

**Parameters:**
- `types: ComponentType[]` - Component types that must be present

**Returns:** `QueryBuilder` - For method chaining

**Example:**
```typescript
const query = world.query()
  .with(Transform, Velocity)
  .build();
```

---

#### `without(...types: ComponentType[]): QueryBuilder`

Requires entities to NOT have specified components.

**Parameters:**
- `types: ComponentType[]` - Component types that must be absent

**Returns:** `QueryBuilder` - For method chaining

**Example:**
```typescript
const query = world.query()
  .with(Transform)
  .without(Dead)
  .build();
```

---

#### `optional(...types: ComponentType[]): QueryBuilder`

Includes components if present (but doesn't require them).

**Parameters:**
- `types: ComponentType[]` - Component types to include if present

**Returns:** `QueryBuilder` - For method chaining

**Example:**
```typescript
const query = world.query()
  .with(Transform)
  .optional(Health) // Include health if present
  .build();
```

---

#### `build(): Query`

Builds the query.

**Returns:** `Query` - Executable query object

---

### Query

Executes queries over entities matching component criteria.

#### `forEach(archetypeManager: ArchetypeManager, callback: (entity: EntityId, components: Map<ComponentType, any>) => void): void`

Iterates over all matching entities.

**Parameters:**
- `archetypeManager: ArchetypeManager` - From `world.getArchetypeManager()`
- `callback: Function` - Called for each matching entity

**Example:**
```typescript
query.forEach(world.getArchetypeManager(), (entityId, components) => {
  const transform = components.get(Transform);
  const velocity = components.get(Velocity);
  // Update entity...
});
```

---

#### `getEntities(archetypeManager: ArchetypeManager): QueryResult[]`

Returns all matching entities as an array.

**Parameters:**
- `archetypeManager: ArchetypeManager` - From `world.getArchetypeManager()`

**Returns:** `QueryResult[]` - Array of `{entity, components}` objects

**Example:**
```typescript
const results = query.getEntities(world.getArchetypeManager());
```

---

#### `getFirst(archetypeManager: ArchetypeManager): QueryResult | null`

Returns first matching entity.

**Parameters:**
- `archetypeManager: ArchetypeManager` - From `world.getArchetypeManager()`

**Returns:** `QueryResult | null` - First matching entity or null

**Example:**
```typescript
const result = query.getFirst(world.getArchetypeManager());
if (result) {
  const camera = result.components.get(Camera);
}
```

---

#### `count(archetypeManager: ArchetypeManager): number`

Counts matching entities.

**Parameters:**
- `archetypeManager: ArchetypeManager` - From `world.getArchetypeManager()`

**Returns:** `number` - Count of matching entities

---

#### `isEmpty(archetypeManager: ArchetypeManager): boolean`

Checks if any entities match.

**Parameters:**
- `archetypeManager: ArchetypeManager` - From `world.getArchetypeManager()`

**Returns:** `boolean` - True if no entities match

---

#### `invalidateCache(): void`

Invalidates the query cache, forcing recomputation on next execution.

**Note:** Rarely needed - World automatically invalidates queries when archetypes change.

---

## ComponentRegistry

Static registry for component schemas. Components must be registered before use.

### `ComponentRegistry.register<T>(type: ComponentType<T>, fields: FieldDescriptor[]): void`

Registers a component type with field descriptors.

**Parameters:**
- `type: ComponentType<T>` - Component constructor
- `fields: FieldDescriptor[]` - Field definitions for component properties

**Example:**
```typescript
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
```

---

### `ComponentRegistry.autoRegister<T>(type: ComponentType<T>, sampleInstance?: T): void`

Auto-registers a component by inspecting its fields.

**Parameters:**
- `type: ComponentType<T>` - Component constructor
- `sampleInstance?: T` - Optional sample instance (uses default constructor if omitted)

**Notes:**
- Only works for components with numeric fields
- Throws if component has no numeric fields

**Example:**
```typescript
class Position {
  constructor(public x = 0, public y = 0, public z = 0) {}
}

ComponentRegistry.autoRegister(Position);
```

---

### `ComponentRegistry.getFields<T>(type: ComponentType<T>): FieldDescriptor[] | undefined`

Retrieves field descriptors for a registered component.

**Parameters:**
- `type: ComponentType<T>` - Component constructor

**Returns:** `FieldDescriptor[] | undefined` - Field descriptors or undefined if not registered

---

### `ComponentRegistry.isRegistered<T>(type: ComponentType<T>): boolean`

Checks if a component type is registered.

**Parameters:**
- `type: ComponentType<T>` - Component constructor

**Returns:** `boolean` - True if registered

---

### `ComponentRegistry.getAllTypes(): ComponentType[]`

Gets all registered component types.

**Returns:** `ComponentType[]` - Array of registered component constructors

---

### `ComponentRegistry.getStats(): RegistryStats`

Gets statistics about registered components.

**Returns:**
```typescript
{
  totalComponents: number;
  components: Array<{
    name: string;
    fieldCount: number;
    fields: string[];
  }>;
}
```

---

### `ComponentRegistry.clear(): void`

Clears all registrations (for testing).

---

### `@RegisterComponent` Decorator

Decorator for auto-registering components.

**Example:**
```typescript
@RegisterComponent
class Position {
  constructor(public x = 0, public y = 0, public z = 0) {}
}
// Automatically registered
```

---

## ComponentStorage

Structure of Arrays (SoA) storage for component data. Uses typed arrays for cache-efficient iteration.

### Performance Characteristics

From Epic 2.10 benchmarks:
- **4.16x faster** iteration than object arrays on Apple Silicon
- Expected **5-10x faster** on x86 platforms
- **Zero GC pressure** (no object allocations per frame)
- **~12 bytes per component** (vs 48 bytes for objects)

### Constructor

```typescript
constructor(fieldDescriptors: FieldDescriptor[], initialCapacity: number = 256)
```

**Parameters:**
- `fieldDescriptors: FieldDescriptor[]` - Field definitions
- `initialCapacity: number` - Initial array capacity (default: 256)

---

### `get(index: number, fieldName: string): number`

Gets component field value at index.

**Parameters:**
- `index: number` - Component index
- `fieldName: string` - Field name

**Returns:** `number` - Field value

**Throws:** If index out of bounds or field not found

---

### `set(index: number, fieldName: string, value: number): void`

Sets component field value at index.

**Parameters:**
- `index: number` - Component index
- `fieldName: string` - Field name
- `value: number` - Field value

**Throws:** If index out of bounds, field not found, or value is not a finite number

---

### `getArray(fieldName: string): TypedArray | undefined`

Gets direct access to typed array for a field (for high-performance iteration).

**Parameters:**
- `fieldName: string` - Field name

**Returns:** `TypedArray | undefined` - Typed array or undefined

---

### `setComponentData(index: number, component: Partial<T>): void`

Sets component data from object.

**Parameters:**
- `index: number` - Component index
- `component: Partial<T>` - Component data

---

### `getComponent(index: number): Partial<T>`

Gets component as object at index.

**Parameters:**
- `index: number` - Component index

**Returns:** `Partial<T>` - Plain object with component data (NOT a class instance)

**Note:** Returns a snapshot object from typed arrays. To persist changes, use `setComponent()`.

---

### `setComponent(index: number, component: Partial<T>): void`

Sets component from object at index.

**Parameters:**
- `index: number` - Component index
- `component: Partial<T>` - Component data (partial updates supported)

---

### `swap(targetIndex: number, sourceIndex: number): void`

Swaps component data between indices (for swap-and-pop removal).

**Parameters:**
- `targetIndex: number` - Target index
- `sourceIndex: number` - Source index

---

### `growTo(newCapacity: number): void`

Grows storage capacity.

**Parameters:**
- `newCapacity: number` - New capacity (must be > current capacity)

**Throws:** If newCapacity <= current capacity or exceeds 1073741824 (2^30)

---

### `getCapacity(): number`

Returns current capacity.

**Returns:** `number` - Storage capacity

---

### `getMemoryStats(count: number): MemoryStats`

Gets memory usage statistics.

**Parameters:**
- `count: number` - Current entity count

**Returns:**
```typescript
{
  capacity: number;
  count: number;
  utilizationPercent: number;
  bytesPerComponent: number;
  totalBytes: number;
}
```

---

## Types & Interfaces

### `EntityId`

```typescript
type EntityId = number;
```

Unique identifier for entities. Uses generation counter for ID recycling.

---

### `ComponentType<T>`

```typescript
type ComponentType<T extends Component = Component> = new (...args: any[]) => T;
```

Component type constructor.

---

### `Component`

```typescript
interface Component {
  readonly __componentType?: string;
}
```

Base interface for all components.

---

### `System`

```typescript
interface System {
  readonly name: string;
  readonly priority: SystemPriority;
  init?(world: World): void;
  update(world: World, deltaTime: number): void;
  cleanup?(world: World): void;
}
```

System interface for game logic.

**Fields:**
- `name: string` - System name (must be unique)
- `priority: SystemPriority` - Execution order
- `init?(world): void` - Optional initialization hook
- `update(world, deltaTime): void` - Update logic (called every frame)
- `cleanup?(world): void` - Optional cleanup hook

---

### `SystemPriority`

```typescript
enum SystemPriority {
  FIRST = -1000,
  PRE_UPDATE = -100,
  UPDATE = 0,
  POST_UPDATE = 100,
  RENDER = 200,
  LAST = 1000,
}
```

System execution priority. Lower values execute first.

---

### `QueryFilter`

```typescript
interface QueryFilter {
  with?: ComponentType[];
  without?: ComponentType[];
  optional?: ComponentType[];
}
```

Query filter for entity selection.

---

### `QueryResult`

```typescript
interface QueryResult {
  entity: EntityId;
  components: Map<ComponentType, any>;
}
```

Query result containing entity and its components.

---

### `Archetype`

```typescript
interface Archetype {
  id: number;
  types: ComponentType[];
  signature: string;
  entities: Uint32Array;
  count: number;
  capacity: number;
  components: Map<ComponentType, ComponentStorage<any>>;
}
```

Archetype - unique combination of component types. Entities with the same components share an archetype.

---

### `EntityMetadata`

```typescript
interface EntityMetadata {
  id: EntityId;
  generation: number;
  archetype: Archetype | null;
  archetypeIndex: number;
}
```

Internal entity metadata (for advanced use).

---

### `FieldDescriptor`

```typescript
interface FieldDescriptor {
  name: string;
  arrayType: TypedArrayConstructor;
  defaultValue?: number;
}
```

Field descriptor for component properties.

---

### `TypedArrayConstructor`

```typescript
type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor;
```

TypedArray constructor type.

---

### `TypedArray`

```typescript
type TypedArray =
  | Float32Array
  | Float64Array
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array;
```

TypedArray instance types.

---

## Built-in Components

### Transform

Position, rotation, and scale in 3D space with transform hierarchy support.

**Fields:**
```typescript
class Transform {
  x: number;              // Position X
  y: number;              // Position Y
  z: number;              // Position Z
  rotationX: number;      // Rotation around X (radians)
  rotationY: number;      // Rotation around Y (radians)
  rotationZ: number;      // Rotation around Z (radians)
  scaleX: number;         // Scale X
  scaleY: number;         // Scale Y
  scaleZ: number;         // Scale Z
  parentId: number;       // Parent entity ID (-1 for root)
  localMatrixIndex: number;  // Index into MatrixStorage (-1 if not allocated)
  worldMatrixIndex: number;  // Index into MatrixStorage (-1 if not allocated)
  dirty: number;          // 1 if matrices need update, 0 otherwise
}
```

**Constructor:**
```typescript
constructor(x = 0, y = 0, z = 0)
```

**Example:**
```typescript
const transform = new Transform(10, 20, 5);
world.addComponent(entity, Transform, transform);
```

---

### Velocity

Linear velocity in 3D space.

**Fields:**
```typescript
class Velocity {
  x: number;  // Velocity X (units/second)
  y: number;  // Velocity Y (units/second)
  z: number;  // Velocity Z (units/second)
}
```

**Constructor:**
```typescript
constructor(x = 0, y = 0, z = 0)
```

---

### Camera

Camera properties for rendering.

**Fields:**
```typescript
class Camera {
  fov: number;        // Field of view (degrees)
  aspect: number;     // Aspect ratio
  near: number;       // Near clip plane
  far: number;        // Far clip plane
  active: number;     // 1 if active, 0 otherwise
}
```

**Constructor:**
```typescript
constructor(fov = 60, aspect = 16 / 9, near = 0.1, far = 1000)
```

---

### Light

Light source properties.

**Fields:**
```typescript
class Light {
  type: number;       // 0 = directional, 1 = point, 2 = spot
  r: number;          // Red (0-1)
  g: number;          // Green (0-1)
  b: number;          // Blue (0-1)
  intensity: number;  // Light intensity
  range: number;      // Light range (point/spot lights)
  innerAngle: number; // Inner cone angle (spot lights, radians)
  outerAngle: number; // Outer cone angle (spot lights, radians)
}
```

**Constructor:**
```typescript
constructor(
  type = 1,           // Default: point light
  r = 1, g = 1, b = 1,
  intensity = 1,
  range = 10
)
```

---

### FlickeringLight

Flickering light animation component (Epic 3.18).

**Fields:**
```typescript
class FlickeringLight {
  enabled: number;        // 1 if enabled, 0 otherwise
  speed: number;          // Flicker speed (Hz)
  intensityMin: number;   // Minimum intensity
  intensityMax: number;   // Maximum intensity
  phase: number;          // Current phase (radians)
}
```

**Constructor:**
```typescript
constructor(speed = 10, intensityMin = 0.5, intensityMax = 1.5)
```

---

### PulsingLight

Pulsing light animation component (Epic 3.18).

**Fields:**
```typescript
class PulsingLight {
  enabled: number;        // 1 if enabled, 0 otherwise
  speed: number;          // Pulse speed (Hz)
  intensityMin: number;   // Minimum intensity
  intensityMax: number;   // Maximum intensity
  phase: number;          // Current phase (radians)
}
```

**Constructor:**
```typescript
constructor(speed = 2, intensityMin = 0.3, intensityMax = 1.0)
```

---

### OrbitingLight

Orbiting light animation component (Epic 3.18).

**Fields:**
```typescript
class OrbitingLight {
  enabled: number;    // 1 if enabled, 0 otherwise
  radius: number;     // Orbit radius
  speed: number;      // Orbit speed (radians/second)
  centerX: number;    // Orbit center X
  centerY: number;    // Orbit center Y
  centerZ: number;    // Orbit center Z
  phase: number;      // Current phase (radians)
}
```

**Constructor:**
```typescript
constructor(radius = 5, speed = 1, centerX = 0, centerY = 0, centerZ = 0)
```

---

## Built-in Systems

### MovementSystem

Applies velocity to transform.

**Priority:** `SystemPriority.UPDATE`

**Example:**
```typescript
world.registerSystem(new MovementSystem());
```

---

### TransformSystem

Manages transform hierarchies and matrices. Updates local and world matrices for entities with Transform components.

**Priority:** `SystemPriority.UPDATE`

**Features:**
- Transform hierarchy support (parent-child relationships)
- Automatic matrix computation
- Dirty flag optimization (only recomputes changed transforms)
- Matrix pooling for memory efficiency

**API:**

```typescript
class TransformSystem {
  setPosition(entityId: EntityId, x: number, y: number, z: number): void;
  setRotation(entityId: EntityId, x: number, y: number, z: number): void;
  setScale(entityId: EntityId, x: number, y: number, z: number): void;
  setParent(childId: EntityId, parentId?: EntityId): void;
  getChildren(entityId: EntityId): EntityId[];
  getWorldMatrix(entityId: EntityId): Float32Array | undefined;
  getLocalMatrix(entityId: EntityId): Float32Array | undefined;
}
```

**Example:**
```typescript
const transformSystem = new TransformSystem();
world.registerSystem(transformSystem);

// Create parent-child hierarchy
const parent = world.createEntity();
world.addComponent(parent, Transform, new Transform(0, 0, 0));

const child = world.createEntity();
world.addComponent(child, Transform, new Transform(5, 0, 0));

transformSystem.setParent(child, parent);
```

---

## Math Utilities

### Mat4

4x4 matrix operations (column-major order).

**API:**

```typescript
namespace Mat4 {
  // Matrix creation
  function identity(out: Float32Array): Float32Array;
  function create(): Float32Array;

  // Transformations
  function translate(out: Float32Array, a: Float32Array, v: Float32Array): Float32Array;
  function rotate(out: Float32Array, a: Float32Array, rad: number, axis: Float32Array): Float32Array;
  function rotateX(out: Float32Array, a: Float32Array, rad: number): Float32Array;
  function rotateY(out: Float32Array, a: Float32Array, rad: number): Float32Array;
  function rotateZ(out: Float32Array, a: Float32Array, rad: number): Float32Array;
  function scale(out: Float32Array, a: Float32Array, v: Float32Array): Float32Array;

  // Matrix operations
  function multiply(out: Float32Array, a: Float32Array, b: Float32Array): Float32Array;
  function invert(out: Float32Array, a: Float32Array): Float32Array | null;
  function transpose(out: Float32Array, a: Float32Array): Float32Array;

  // Projections
  function perspective(out: Float32Array, fovy: number, aspect: number, near: number, far: number): Float32Array;
  function ortho(out: Float32Array, left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array;
  function lookAt(out: Float32Array, eye: Float32Array, center: Float32Array, up: Float32Array): Float32Array;

  // Utilities
  function fromRotationTranslationScale(out: Float32Array, q: Float32Array, v: Float32Array, s: Float32Array): Float32Array;
}
```

**Example:**
```typescript
import * as Mat4 from '@miskatonic/ecs';

const matrix = Mat4.create();
Mat4.identity(matrix);
Mat4.translate(matrix, matrix, [10, 0, 0]);
Mat4.rotateY(matrix, matrix, Math.PI / 4);
```

---

### MatrixStorage

Pooled storage for 4x4 matrices (used by TransformSystem).

**API:**

```typescript
class MatrixStorage {
  constructor(initialCapacity: number = 256);

  allocate(): number;                                      // Allocate matrix, returns index
  free(index: number): void;                              // Free matrix at index
  get(index: number): Float32Array;                       // Get matrix at index
  set(index: number, matrix: Float32Array): void;        // Set matrix at index
  copy(destIndex: number, srcIndex: number): void;       // Copy matrix
  identity(index: number): void;                         // Set to identity

  getStats(): {
    capacity: number;
    allocated: number;
    free: number;
    utilizationPercent: number;
  };
}
```

**Example:**
```typescript
import { MatrixStorage } from '@miskatonic/ecs';

const storage = new MatrixStorage();
const idx = storage.allocate();
storage.identity(idx);

const matrix = storage.get(idx);
console.log(matrix); // [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]

storage.free(idx);
```

---

## Utility Functions

### `createFieldDescriptor(name: string, defaultValue: number, arrayType?: TypedArrayConstructor): FieldDescriptor`

Creates a field descriptor for component registration.

**Parameters:**
- `name: string` - Field name
- `defaultValue: number` - Default field value
- `arrayType?: TypedArrayConstructor` - Optional typed array type (default: Float32Array)

**Returns:** `FieldDescriptor`

**Example:**
```typescript
import { createFieldDescriptor } from '@miskatonic/ecs';

const fields = [
  createFieldDescriptor('x', 0),
  createFieldDescriptor('y', 0),
  createFieldDescriptor('flags', 0, Uint8Array),
];
```

---

### `inferArrayType(value: any): TypedArrayConstructor`

Infers typed array type from default value.

**Parameters:**
- `value: any` - Default value

**Returns:** `TypedArrayConstructor` - Always returns Float32Array (safe default for game engines)

**Note:** Most game engine values are floats. Integer fields should explicitly specify their array type.

---

## Performance Best Practices

### Query Caching

**CRITICAL:** Store Query objects as instance variables to avoid rebuilding them every frame.

```typescript
// ❌ WRONG: Rebuilds query every frame
class BadSystem implements System {
  update(world: World, deltaTime: number): void {
    const query = world.query().with(Transform).build();
    query.forEach(world.getArchetypeManager(), (entity, components) => {
      // ...
    });
  }
}

// ✅ CORRECT: Store query as instance variable
class GoodSystem implements System {
  private query: Query;

  init(world: World): void {
    this.query = world.query().with(Transform).build();
  }

  update(world: World, deltaTime: number): void {
    this.query.forEach(world.getArchetypeManager(), (entity, components) => {
      // ...
    });
  }
}
```

---

### Component Mutation Pattern

Always use read-modify-write pattern with `setComponent()`:

```typescript
// Read component
const transform = world.getComponent(entity, Transform);

// Modify data
transform.x += velocity.x * deltaTime;
transform.y += velocity.y * deltaTime;

// Write back (REQUIRED!)
world.setComponent(entity, Transform, transform);
```

---

### Avoid Frequent Archetype Transitions

Adding/removing components causes archetype transitions (O(n) operation). Keep components and modify data instead:

```typescript
// ❌ BAD: Archetype transition every frame
update(world, deltaTime) {
  world.addComponent(entity, Boost, new Boost());
  // logic
  world.removeComponent(entity, Boost);
}

// ✅ GOOD: Keep component, modify data
update(world, deltaTime) {
  const boost = world.getComponent(entity, Boost);
  boost.active = 1; // Use number (0/1) for boolean flags
  // logic
  boost.active = 0;
  world.setComponent(entity, Boost, boost);
}
```

---

### System Priority Usage

Order systems by data dependencies:

```typescript
world.registerSystem(new InputSystem());        // PRE_UPDATE: Read input
world.registerSystem(new MovementSystem());     // UPDATE: Apply movement
world.registerSystem(new TransformSystem());    // UPDATE: Update matrices
world.registerSystem(new RenderSystem());       // RENDER: Draw scene
```

---

## License

MIT