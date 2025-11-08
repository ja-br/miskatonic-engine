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
  // Physics configuration
  physics: {
    gravity: [0, -9.81, 0],
    fixedTimestep: 1 / 60,
    backend: 'rapier', // or 'cannon' or 'box2d'
  },

  // Rendering configuration
  rendering: {
    backend: 'webgpu', // or 'webgl2'
    targetFPS: 60,
    vsync: true,
  },

  // Network configuration
  network: {
    enabled: true,
    tickRate: 60,
    useDeltaCompression: true,
  },

  // Debug configuration
  debug: {
    enabled: true,
    showStats: true,
    showPhysics: false,
  },

  // Performance budgets
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
// Create engine
const engine = await MiskatonicEngine.create(config);

// Initialize systems
await engine.initialize();

// Start running
engine.start();

// Pause execution
engine.pause();

// Resume after pause
engine.resume();

// Clean shutdown
await engine.shutdown();
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

engine.events.emit({
  type: 'game:event',
  timestamp: Date.now(),
});

// Resource Manager
const texture = await engine.resources.load('texture', 'player.png');

// Physics World (if initialized)
if (engine.physics) {
  const bodyId = engine.physics.createRigidBody({
    type: 'dynamic',
    position: { x: 0, y: 10, z: 0 },
  });
}

// Network (if enabled)
if (engine.network) {
  engine.network.registerEntity(entity);
  const batch = engine.network.createStateBatch(observerId);
}
```

### Custom Systems

```typescript
// Register a custom system
engine.registerSystem({
  name: 'movement-system',
  priority: 10, // Lower runs first
  initialize: async () => {
    console.log('Movement system initialized');
  },
  update: (deltaTime) => {
    // Update logic runs every frame
  },
  shutdown: async () => {
    console.log('Movement system shutdown');
  },
});

// Unregister a system
engine.unregisterSystem('movement-system');
```

### Engine State

```typescript
import { EngineState } from '@miskatonic/core';

console.log(engine.state);
// EngineState.INITIALIZING
// EngineState.READY
// EngineState.RUNNING
// EngineState.PAUSED
// EngineState.STOPPING
// EngineState.STOPPED
// EngineState.ERROR
```

### Statistics

```typescript
const stats = engine.getStats();

console.log(stats.fps); // Current FPS
console.log(stats.frameTime); // Frame time in ms
console.log(stats.averageFrameTime); // Average frame time
console.log(stats.totalFrames); // Total frames rendered
console.log(stats.entityCount); // Number of entities
console.log(stats.memoryUsage); // Memory usage in MB
```

## Design Philosophy

The engine follows the "batteries included, swappable preferred" philosophy:

- **Batteries Included**: Works out of the box with sensible defaults
- **Swappable Preferred**: Every system can be replaced with custom implementation
- **Progressive Enhancement**: Minimal config works, deep customization available
- **Fail-Safe**: Validates configuration, graceful degradation

## Command System

The engine includes a comprehensive command system for:
- Debug console commands
- Scripting and automation
- UI action handling
- Command history and undo/redo

### Using Built-in Commands

```typescript
const engine = await MiskatonicEngine.create();
await engine.initialize();

// Execute commands
await engine.commands.execute('help', {}); // List all commands
await engine.commands.execute('echo', { message: 'Hello!' }); // Echo a message
await engine.commands.execute('stats', {}); // Get engine stats
await engine.commands.execute('state', {}); // Get engine state

// Commands with aliases
await engine.commands.execute('print', { message: 'test' }); // 'print' is alias for 'echo'

// Pause/resume engine
await engine.commands.execute('pause', {});
await engine.commands.execute('resume', {});

// Undo undoable commands
await engine.commands.undo(); // Undo last pause/resume
```

### Registering Custom Commands

```typescript
import { z } from 'zod';
import type { CommandDefinition } from '@miskatonic/core';

// Define a custom command
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
    // Add components based on input.type
    // Set position to (input.x, input.y, input.z)

    return {
      success: true,
      output: { entityId: entity },
      executionTime: 0,
    };
  },
  undoable: true,
  undo: async (input, context) => {
    // Remove the spawned entity
    return { success: true, executionTime: 0 };
  },
};

// Register the command
engine.commands.register(spawnCommand);

// Execute it
const result = await engine.commands.execute('entity.spawn', {
  type: 'player',
  x: 0,
  y: 10,
  z: 0,
});

if (result.success) {
  console.log('Entity spawned:', result.output.entityId);
}
```

### Command Queue

Commands can be queued for execution on the next frame:

```typescript
// Queue command (won't execute immediately)
const promise = engine.commands.execute('entity.spawn', {
  type: 'enemy',
  x: 10,
  y: 0,
  z: 5,
}, { queued: true });

// Command will be processed during PRE_UPDATE phase
// when engine is running

engine.start();

// Wait for result
const result = await promise;
```

### Command History

```typescript
// Get command history
const history = engine.commands.getHistory(10); // Last 10 commands

for (const entry of history) {
  console.log(`${entry.command}: ${entry.result.success ? 'OK' : 'FAIL'}`);
}

// Clear history
engine.commands.clearHistory();
```

### Command Introspection

```typescript
// List all commands
const commands = engine.commands.listCommands();

// Get commands by category
const entityCommands = engine.commands.getCommandsByCategory('entity');

// Get command info
const info = engine.commands.getCommandInfo('entity.spawn');
console.log(info.name, info.description, info.aliases);

// Check if command exists
if (engine.commands.has('entity.spawn')) {
  // Execute it
}
```

### Command Events

The command system emits events for monitoring:

```typescript
engine.events.on('command:executed', (event) => {
  console.log(`Command ${event.commandName} executed in ${event.executionTime}ms`);
});

engine.events.on('command:failed', (event) => {
  console.error(`Command ${event.commandName} failed: ${event.error}`);
});

engine.events.on('command:validation-failed', (event) => {
  console.warn(`Invalid input for ${event.commandName}: ${event.error}`);
});
```

## Examples

### Basic Game Loop (Epic 2.8)

```typescript
const engine = await MiskatonicEngine.create({
  physics: { gravity: [0, -9.81, 0] },
});

await engine.initialize();
engine.start();

// Game loop is now running with phase-based execution:
// PRE_UPDATE → UPDATE → POST_UPDATE → PHYSICS → RENDER
```

### With Physics

```typescript
const engine = await MiskatonicEngine.create({
  physics: {
    gravity: [0, -9.81, 0],
    fixedTimestep: 1 / 60,
  },
});

await engine.initialize();

// Create a falling sphere
const bodyId = engine.physics!.createRigidBody({
  type: 'dynamic',
  position: { x: 0, y: 10, z: 0 },
});

engine.physics!.addCollider(bodyId, {
  type: 'sphere',
  radius: 1.0,
});

// Physics updates happen during engine loop
engine.start();
```

### With Networking

```typescript
const engine = await MiskatonicEngine.create({
  network: {
    enabled: true,
    tickRate: 60,
    useDeltaCompression: true,
    useInterestManagement: true,
  },
});

await engine.initialize();

const entity = engine.world.createEntity();
engine.network!.registerEntity(entity);

// Server: Create and send state batches
const batch = engine.network!.createStateBatch(observerId);
// Send batch over network...

// Client: Apply received batch
engine.network!.applyStateBatch(receivedBatch);
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
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

Current test coverage: **128/128 tests passing** (100%)

Test breakdown:
- MiskatonicEngine: 44 tests
- GameLoop: 18 tests
- CommandRegistry: 19 tests
- CommandBus: 20 tests
- CommandSystem Integration: 27 tests

## Roadmap

- ✅ Epic 2.7: Main Engine Class (COMPLETE)
- ✅ Epic 2.8: Game Loop Architecture (COMPLETE)
- ✅ Epic 2.9: Command System (COMPLETE)
- ⏭️ Epic 2.10-2.11: Cache-Efficient ECS Refactoring (Next)

## License

MIT
