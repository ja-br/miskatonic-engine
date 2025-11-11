# Command System

Comprehensive command system for debugging, scripting, automation, and UI action handling with built-in undo/redo support.

## Features

- Type-safe command definitions with Zod schema validation
- Built-in commands (help, echo, stats, pause/resume, etc.)
- Command aliases and categories
- Undo/redo support for reversible operations
- Command queuing for deferred execution
- Command history tracking
- Event emission for monitoring
- Introspection and discovery

## Basic Usage

### Executing Commands

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

## Registering Custom Commands

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

## Command Queue

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

This is useful for:
- Deferring expensive operations to the next frame
- Ensuring commands run during a specific game loop phase
- Batching multiple commands together

## Command History

```typescript
// Get command history
const history = engine.commands.getHistory(10); // Last 10 commands

for (const entry of history) {
  console.log(`${entry.command}: ${entry.result.success ? 'OK' : 'FAIL'}`);
  console.log(`  Executed at: ${entry.timestamp}`);
  console.log(`  Duration: ${entry.result.executionTime}ms`);
}

// Clear history
engine.commands.clearHistory();
```

History tracking is useful for:
- Debugging command execution
- Building in-game command consoles
- Auditing user actions
- Implementing replay systems

## Command Introspection

```typescript
// List all commands
const commands = engine.commands.listCommands();
console.log('Available commands:', commands);

// Get commands by category
const entityCommands = engine.commands.getCommandsByCategory('entity');
const debugCommands = engine.commands.getCommandsByCategory('debug');

// Get detailed command info
const info = engine.commands.getCommandInfo('entity.spawn');
console.log(info.name);        // 'entity.spawn'
console.log(info.description); // 'Spawn a new entity at position'
console.log(info.aliases);     // ['spawn']
console.log(info.category);    // 'entity'

// Check if command exists
if (engine.commands.has('entity.spawn')) {
  // Execute it
  await engine.commands.execute('entity.spawn', { /* ... */ });
}
```

Introspection enables:
- Building dynamic command UIs
- Auto-generating help documentation
- Command discovery and exploration
- IDE-like autocomplete features

## Command Events

The command system emits events for monitoring and debugging:

```typescript
// Command executed successfully
engine.events.on('command:executed', (event) => {
  console.log(`Command ${event.commandName} executed in ${event.executionTime}ms`);
  console.log(`Input:`, event.input);
  console.log(`Output:`, event.output);
});

// Command failed during execution
engine.events.on('command:failed', (event) => {
  console.error(`Command ${event.commandName} failed: ${event.error}`);
  console.error(`Stack:`, event.stack);
});

// Command validation failed (invalid input)
engine.events.on('command:validation-failed', (event) => {
  console.warn(`Invalid input for ${event.commandName}`);
  console.warn(`Error:`, event.error);
  console.warn(`Input:`, event.input);
});
```

Use events for:
- Logging command execution
- Building command analytics
- Debugging command issues
- Displaying feedback to users

## Built-in Commands

### help
List all available commands with descriptions.

```typescript
await engine.commands.execute('help', {});
```

### echo (alias: print)
Echo a message back.

```typescript
await engine.commands.execute('echo', { message: 'Hello World' });
```

### stats
Get current engine statistics.

```typescript
const result = await engine.commands.execute('stats', {});
console.log(result.output); // { fps, frameTime, entityCount, ... }
```

### state
Get current engine state.

```typescript
const result = await engine.commands.execute('state', {});
console.log(result.output); // { state: 'RUNNING' }
```

### pause
Pause the engine (undoable).

```typescript
await engine.commands.execute('pause', {});
```

### resume
Resume the engine (undoable).

```typescript
await engine.commands.execute('resume', {});
```

## Best Practices

### Use Categories
Organize commands into logical categories:
- `entity` - Entity management commands
- `debug` - Debugging and diagnostic commands
- `game` - Gameplay-related commands
- `system` - System control commands

### Provide Aliases
Add short aliases for frequently used commands:
```typescript
{
  name: 'entity.spawn',
  aliases: ['spawn', 'create'],
  // ...
}
```

### Validate Input
Always use Zod schemas to validate command input:
```typescript
{
  schema: z.object({
    count: z.number().positive().int(),
    type: z.enum(['player', 'enemy', 'item']),
  }),
  // ...
}
```

### Make Expensive Commands Undoable
Commands that modify game state should implement undo:
```typescript
{
  undoable: true,
  handler: async (input) => {
    // Store state needed for undo
    const previousState = captureState();
    performAction(input);
    return { 
      success: true,
      executionTime: 0,
      undoData: previousState 
    };
  },
  undo: async (input, context, undoData) => {
    restoreState(undoData);
    return { success: true, executionTime: 0 };
  },
}
```

### Queue Long-Running Commands
For expensive operations, queue them to avoid blocking:
```typescript
await engine.commands.execute('expensive.operation', {}, { queued: true });
```

## Advanced Patterns

### Command Macros
Create commands that execute multiple commands:

```typescript
const setupSceneCommand: CommandDefinition = {
  name: 'scene.setup',
  description: 'Setup a complete scene',
  schema: z.object({
    sceneName: z.string(),
  }),
  handler: async (input, context) => {
    await engine.commands.execute('scene.clear', {});
    await engine.commands.execute('entity.spawn', { type: 'player', x: 0, y: 0, z: 0 });
    await engine.commands.execute('entity.spawn', { type: 'enemy', x: 10, y: 0, z: 0 });
    await engine.commands.execute('light.create', { type: 'directional' });
    
    return { success: true, executionTime: 0 };
  },
};
```

### Conditional Commands
Validate game state before executing:

```typescript
const startGameCommand: CommandDefinition = {
  name: 'game.start',
  description: 'Start the game',
  schema: z.object({}),
  handler: async (input, context) => {
    if (engine.state !== EngineState.READY) {
      return {
        success: false,
        error: 'Cannot start game: engine not ready',
        executionTime: 0,
      };
    }
    
    // Start game logic
    return { success: true, executionTime: 0 };
  },
};
```

### Command Chaining
Chain commands together with error handling:

```typescript
async function executeSequence(commands: Array<{ name: string; input: any }>) {
  for (const cmd of commands) {
    const result = await engine.commands.execute(cmd.name, cmd.input);
    if (!result.success) {
      console.error(`Command ${cmd.name} failed, aborting sequence`);
      return false;
    }
  }
  return true;
}

await executeSequence([
  { name: 'scene.load', input: { name: 'level1' } },
  { name: 'player.spawn', input: { x: 0, y: 0, z: 0 } },
  { name: 'game.start', input: {} },
]);
```

## Integration with Debug Console

Commands integrate seamlessly with the debug console (see `@miskatonic/debug-console`):

```typescript
import { DebugConsole } from '@miskatonic/debug-console';

const debugConsole = new DebugConsole(engine);

// Console automatically discovers all registered commands
// Users can execute them via the console UI
// Tab-completion and help are built-in
```

## License

MIT
