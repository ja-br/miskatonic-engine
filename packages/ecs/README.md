# @miskatonic/ecs

Archetype-based Entity Component System (ECS) for the Miskatonic Engine.

## Overview

This package provides a high-performance, cache-efficient ECS implementation using the archetype pattern. Entities with the same set of components are stored together in contiguous memory, enabling fast iteration and efficient cache utilization.

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

The `World` is the central container that owns all entities, components, and systems. It provides the main API for interacting with the ECS.

```typescript
const world = new World();

// Entity management
const entity = world.createEntity();
world.destroyEntity(entity);
world.hasEntity(entity);

// Component management
world.addComponent(entity, Transform, new Transform());
world.removeComponent(entity, Transform);
world.getComponent(entity, Transform);
world.hasComponent(entity, Transform);

// System management
world.registerSystem(new MovementSystem());
world.unregisterSystem('MovementSystem');

// Lifecycle
world.init();
world.update(deltaTime);
world.cleanup();
```

### Components

Components are pure data containers. They should not contain logic.

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

  update(world: World, deltaTime: number): void {
    const query = world.query().with(Health).build();

    query.forEach(world.getArchetypeManager(), (entityId, components) => {
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
// Query for entities with specific components
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

## Performance Considerations

### Archetype Transitions

Adding or removing components causes an entity to move to a different archetype. This is an O(n) operation where n is the number of components on the entity. Avoid frequent component additions/removals during gameplay.

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

### Query Caching

Queries are automatically cached and invalidated when entity composition changes. Reuse query objects when possible.

```typescript
// ✅ GOOD: Reuse query
class MySystem implements System {
  private query = world.query().with(Transform).with(Velocity).build();

  update(world: World, deltaTime: number): void {
    this.query.forEach(/* ... */);
  }
}
```

### Memory Usage

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

## Example: Complete Game Loop

```typescript
import {
  World,
  Transform,
  Velocity,
  MovementSystem,
  SystemPriority,
} from '@miskatonic/ecs';

// Custom components
class Sprite {
  readonly __componentType = 'Sprite';
  constructor(public texture: string) {}
}

class Player {
  readonly __componentType = 'Player';
}

// Custom system
class RenderSystem {
  readonly name = 'RenderSystem';
  readonly priority = SystemPriority.POST_UPDATE;

  update(world: World, deltaTime: number): void {
    const query = world.query().with(Transform).with(Sprite).build();

    query.forEach(world.getArchetypeManager(), (entityId, components) => {
      const transform = components.get(Transform);
      const sprite = components.get(Sprite);
      // Render sprite at transform position...
    });
  }
}

// Setup
const world = new World();
world.registerSystem(new MovementSystem());
world.registerSystem(new RenderSystem());
world.init();

// Create player
const player = world.createEntity();
world.addComponent(player, Player, new Player());
world.addComponent(player, Transform, new Transform(0, 0, 0));
world.addComponent(player, Velocity, new Velocity(5, 0, 0));
world.addComponent(player, Sprite, new Sprite('player.png'));

// Game loop
let lastTime = performance.now();
function gameLoop() {
  const now = performance.now();
  const deltaTime = (now - lastTime) / 1000; // Convert to seconds
  lastTime = now;

  world.update(deltaTime);

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## API Reference

### World

- `createEntity(): EntityId` - Create a new entity
- `destroyEntity(entityId: EntityId): void` - Destroy an entity
- `hasEntity(entityId: EntityId): boolean` - Check if entity exists
- `addComponent<T>(entityId, type, component): void` - Add component to entity
- `removeComponent<T>(entityId, type): void` - Remove component from entity
- `getComponent<T>(entityId, type): T | undefined` - Get component from entity
- `hasComponent<T>(entityId, type): boolean` - Check if entity has component
- `query(): QueryBuilder` - Create a new query builder
- `registerSystem(system): void` - Register a system
- `unregisterSystem(name): void` - Unregister a system
- `init(): void` - Initialize all systems
- `update(deltaTime): void` - Update all systems
- `cleanup(): void` - Cleanup all systems
- `clear(): void` - Clear the entire world
- `getStats()` - Get debugging statistics

### QueryBuilder

- `with(type): QueryBuilder` - Require component
- `without(type): QueryBuilder` - Exclude component
- `optional(type): QueryBuilder` - Optional component
- `build(): Query` - Build the query

### Query

- `forEach(archetypeManager, callback): void` - Iterate over matching entities
- `getEntities(archetypeManager): Array<{entity, components}>` - Get all matching entities
- `invalidateCache(): void` - Force cache rebuild

## License

MIT
