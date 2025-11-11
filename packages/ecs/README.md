# @miskatonic/ecs

Archetype-based Entity Component System (ECS) for the Miskatonic Engine.

## Overview

High-performance, cache-efficient ECS implementation using the archetype pattern. Entities with the same set of components are stored together in contiguous memory, enabling fast iteration and efficient cache utilization.

## Key Features

- **Archetype-based storage**: Cache-efficient component storage
- **Entity ID recycling**: Prevents memory fragmentation with generation counters
- **Query caching**: Computed queries are cached and reused
- **System priority ordering**: Deterministic execution order
- **Type-safe**: Full TypeScript support with strict typing
- **Zero dependencies**: Lightweight and focused

## Installation

```bash
npm install @miskatonic/ecs
```

## Quick Start

```typescript
import { World, Transform, Velocity, MovementSystem } from '@miskatonic/ecs';

// Create a world
const world = new World();

// Register systems
world.registerSystem(new MovementSystem());

// Initialize systems
world.init();

// Create an entity with components
const player = world.createEntity();
world.addComponent(player, Transform, new Transform(0, 0, 0));
world.addComponent(player, Velocity, new Velocity(1, 0, 0));

// Game loop
function update(deltaTime: number) {
  world.update(deltaTime);
}

// Cleanup
world.cleanup();
```

## Core Concepts

### World

The `World` is the central container that owns all entities, components, and systems. It provides the main API for managing the ECS lifecycle and querying entities.

### Components

Components are pure data containers with no logic.

```typescript
import type { Component } from '@miskatonic/ecs';

export class Health implements Component {
  readonly __componentType = 'Health';

  constructor(
    public current: number = 100,
    public max: number = 100
  ) {}
}
```

### Systems

Systems contain the logic that operates on entities with specific components.

```typescript
import { System, SystemPriority, World } from '@miskatonic/ecs';

export class HealthRegenerationSystem implements System {
  readonly name = 'HealthRegenerationSystem';
  readonly priority = SystemPriority.UPDATE;
  private query: Query;

  init(world: World): void {
    // Build query once during initialization
    this.query = world.query().with(Health).build();
  }

  update(world: World, deltaTime: number): void {
    // Reuse the cached query every frame
    this.query.forEach(world.getArchetypeManager(), (entityId, components) => {
      const health = components.get(Health) as Health;
      if (health.current < health.max) {
        health.current = Math.min(health.max, health.current + 10 * deltaTime);
      }
    });
  }
}
```

### Queries

Queries allow you to iterate over entities that match specific component requirements.

```typescript
// Build a query
const query = world
  .query()
  .with(Transform)      // Must have Transform
  .with(Velocity)       // Must have Velocity
  .without(Dead)        // Must not have Dead
  .optional(Health)     // May have Health
  .build();

// Iterate over matching entities
query.forEach(world.getArchetypeManager(), (entityId, components) => {
  const transform = components.get(Transform) as Transform;
  const velocity = components.get(Velocity) as Velocity;
  // Update entity...
});

// Or get all matching entities at once
const results = query.getEntities(world.getArchetypeManager());
for (const { entity, components } of results) {
  // Process entity...
}
```

## Performance Best Practices

### Query Caching

**CRITICAL:** Store Query objects as instance variables to avoid rebuilding them every frame. This is the most common ECS performance mistake.

```typescript
// ❌ WRONG: Rebuilds query every frame (wasteful!)
class BadSystem implements System {
  update(world: World, deltaTime: number): void {
    const query = world.query().with(Transform).with(Velocity).build();
    query.forEach(world.getArchetypeManager(), (entity, components) => {
      // ...
    });
  }
}

// ✅ CORRECT: Store Query object as instance variable
class GoodSystem implements System {
  private movableEntities: Query;

  init(world: World): void {
    // Build query once during initialization
    this.movableEntities = world.query()
      .with(Transform)
      .with(Velocity)
      .build();
  }

  update(world: World, deltaTime: number): void {
    // Reuse the cached query object every frame
    this.movableEntities.forEach(world.getArchetypeManager(), (entity, components) => {
      // Update logic...
    });
  }
}
```

**Why this matters:**
- Query objects internally cache which archetypes match
- Rebuilding queries every frame wastes 0.5-2ms per query
- At 60 FPS with multiple queries, this wastes 60-120ms per second
- Store queries in `init()` or as class properties

### Avoid Frequent Archetype Transitions

Adding or removing components causes an entity to move to a different archetype (O(n) operation). Avoid doing this every frame.

```typescript
// ❌ BAD: Adding/removing components every frame
update(world, deltaTime) {
  world.addComponent(entity, Boost, new Boost());
  // ... logic
  world.removeComponent(entity, Boost);
}

// ✅ GOOD: Keep component, modify data
update(world, deltaTime) {
  const boost = world.getComponent(entity, Boost);
  if (boost) {
    boost.active = true;
    // ... logic
    boost.active = false;
  }
}
```

### Memory Efficiency

- Each entity costs ~48 bytes of metadata
- Components are stored in dense arrays per archetype
- Destroyed entities are recycled to prevent ID exhaustion

## System Priorities

Systems execute in priority order (lowest to highest):

```typescript
export enum SystemPriority {
  FIRST = -1000,      // Guaranteed first
  PRE_UPDATE = -100,  // Before main update
  UPDATE = 0,         // Main update (default)
  POST_UPDATE = 100,  // After main update
  LAST = 1000,        // Guaranteed last
}
```

## API Reference

### World

**Entity Management:**
- `createEntity(): EntityId`
- `destroyEntity(entityId: EntityId): void`
- `hasEntity(entityId: EntityId): boolean`

**Component Management:**
- `addComponent<T>(entityId, type, component): void`
- `removeComponent<T>(entityId, type): void`
- `getComponent<T>(entityId, type): T | undefined`
- `hasComponent<T>(entityId, type): boolean`

**System Management:**
- `registerSystem(system): void`
- `unregisterSystem(name): void`

**Lifecycle:**
- `init(): void` - Initialize all systems
- `update(deltaTime): void` - Update all systems
- `cleanup(): void` - Cleanup all systems
- `clear(): void` - Clear the entire world

**Queries:**
- `query(): QueryBuilder` - Create a new query builder
- `getStats()` - Get debugging statistics

### QueryBuilder

- `with(type): QueryBuilder` - Require component
- `without(type): QueryBuilder` - Exclude component
- `optional(type): QueryBuilder` - Optional component
- `build(): Query` - Build the query

### Query

- `forEach(archetypeManager, callback): void` - Iterate over matching entities
- `getEntities(archetypeManager): Array<{entity, components}>` - Get all matching entities
- `invalidateCache(): void` - Force cache rebuild (rarely needed)

For detailed API documentation, see TypeScript definitions or generated TypeDoc.

## License

MIT
