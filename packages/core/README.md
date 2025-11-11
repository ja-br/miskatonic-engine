# @miskatonic/core

Main engine class and integration layer for Miskatonic Engine.

## Overview

The `@miskatonic/core` package provides the `MiskatonicEngine` class, which coordinates all engine subsystems (ECS, Events, Resources, Physics, Network) into a unified API.

## Installation

```bash
npm install @miskatonic/core
```

## Quick Start

```typescript
import { MiskatonicEngine } from '@miskatonic/core';

// Create engine with default configuration
const engine = await MiskatonicEngine.create();

// Initialize all systems
await engine.initialize();

// Start the engine
engine.start();

// Create entities
const entity = engine.world.createEntity();

// Emit events
engine.events.emit({
  type: 'game:start',
  timestamp: Date.now(),
});

// Later: shutdown cleanly
await engine.shutdown();
```

## Configuration

```typescript
const engine = await MiskatonicEngine.create({
  physics: {
    gravity: [0, -9.81, 0],
    fixedTimestep: 1 / 60,
    backend: 'rapier', // or 'cannon' or 'box2d'
  },
  rendering: {
    backend: 'webgpu', // or 'webgl2'
    targetFPS: 60,
    vsync: true,
  },
  network: {
    enabled: true,
    tickRate: 60,
    useDeltaCompression: true,
  },
  debug: {
    enabled: true,
    showStats: true,
  },
  performance: {
    targetFPS: 60,
    maxDeltaTime: 0.1,
    memoryBudgetMB: 500,
  },
});
```

## API

### Engine Lifecycle

```typescript
const engine = await MiskatonicEngine.create(config);
await engine.initialize();

engine.start();   // Start running
engine.pause();   // Pause execution
engine.resume();  // Resume after pause

await engine.shutdown(); // Clean shutdown
```

### System Access

```typescript
// ECS World
const entity = engine.world.createEntity();
engine.world.addComponent(entity, Position, { x: 0, y: 0, z: 0 });

// Event Bus
engine.events.on('game:event', (event) => {
  console.log('Event received:', event);
});

// Resource Manager
const texture = await engine.resources.load('texture', 'player.png');

// Physics (if initialized)
if (engine.physics) {
  const bodyId = engine.physics.createRigidBody({
    type: 'dynamic',
    position: { x: 0, y: 10, z: 0 },
  });
}
```

### Custom Systems

```typescript
engine.registerSystem({
  name: 'movement-system',
  priority: 10, // Lower runs first
  update: (deltaTime) => {
    // Update logic runs every frame
  },
});

engine.unregisterSystem('movement-system');
```

### Engine State & Statistics

```typescript
import { EngineState } from '@miskatonic/core';

// Check current state
console.log(engine.state); // INITIALIZING, READY, RUNNING, PAUSED, etc.

// Get performance stats
const stats = engine.getStats();
console.log(stats.fps, stats.frameTime, stats.entityCount);
```

## Command System

Execute commands for debugging, scripting, and automation. See [COMMANDS.md](./COMMANDS.md) for full documentation.

### Basic Usage

```typescript
// Execute built-in commands
await engine.commands.execute('help', {});
await engine.commands.execute('stats', {});
await engine.commands.execute('pause', {});

// Undo undoable commands
await engine.commands.undo();
```

### Custom Commands

```typescript
import { z } from 'zod';
import type { CommandDefinition } from '@miskatonic/core';

const spawnCommand: CommandDefinition = {
  name: 'entity.spawn',
  description: 'Spawn a new entity at position',
  category: 'entity',
  schema: z.object({
    type: z.string(),
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  handler: async (input, context) => {
    const entity = engine.world.createEntity();
    // Add components and set position
    return {
      success: true,
      output: { entityId: entity },
      executionTime: 0,
    };
  },
};

engine.commands.register(spawnCommand);

const result = await engine.commands.execute('entity.spawn', {
  type: 'player',
  x: 0,
  y: 10,
  z: 0,
});
```

See [COMMANDS.md](./COMMANDS.md) for command queuing, history, introspection, and events.

## Advanced Usage

### With Physics and Networking

```typescript
const engine = await MiskatonicEngine.create({
  physics: {
    gravity: [0, -9.81, 0],
    fixedTimestep: 1 / 60,
  },
  network: {
    enabled: true,
    tickRate: 60,
    useDeltaCompression: true,
  },
});

await engine.initialize();

// Create physics body
const bodyId = engine.physics!.createRigidBody({
  type: 'dynamic',
  position: { x: 0, y: 10, z: 0 },
});

engine.physics!.addCollider(bodyId, {
  type: 'sphere',
  radius: 1.0,
});

// Register for network replication
const entity = engine.world.createEntity();
engine.network!.registerEntity(entity);

// Server: Create and send state batches
const batch = engine.network!.createStateBatch(observerId);

// Client: Apply received batch
engine.network!.applyStateBatch(receivedBatch);

engine.start();
```

## Architecture

The MiskatonicEngine coordinates these subsystems:

- **ECS World** (`@miskatonic/ecs`): Entity-component-system for game logic
- **Event Bus** (`@miskatonic/events`): Type-safe pub/sub for communication
- **Resource Manager** (`@miskatonic/resources`): Asset loading with hot-reload
- **Physics World** (`@miskatonic/physics`): Deterministic physics simulation
- **Network State** (`@miskatonic/network`): Delta compression and replication

## Testing

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

Current test coverage: **128/128 tests passing** (100%)

## License

MIT
