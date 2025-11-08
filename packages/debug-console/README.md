# @miskatonic/debug-console

In-game developer console for Miskatonic Engine with command execution, logging, history, and autocomplete.

## Features

- **~ Key Toggle**: Quick access with configurable key binding
- **Command Execution**: Execute registered commands via CommandSystem
- **History Navigation**: Up/down arrows to navigate command history (persistent)
- **Tab Autocomplete**: Prefix matching with suggestions dropdown
- **Console Capture**: Automatically captures console.log/warn/error
- **localStorage Persistence**: Command history survives page reloads
- **Keyboard Shortcuts**:
  - `~` - Toggle console
  - `↑` / `↓` - Navigate command history
  - `Tab` - Autocomplete command
  - `Enter` - Execute command
  - `Esc` - Hide console

## Installation

```bash
npm install @miskatonic/debug-console
```

## Usage

### Basic Setup

```typescript
import { MiskatonicEngine } from '@miskatonic/core';
import { DebugConsole } from '@miskatonic/debug-console';

// Create engine
const engine = await MiskatonicEngine.create();
await engine.initialize();

// Create debug console
const debugConsole = new DebugConsole(engine.commands, {
  toggleKey: 'Backquote', // ~ key
  captureConsole: true,   // Capture console.log
  persistHistory: true,   // Save history to localStorage
});

debugConsole.initialize();

// Start engine
engine.start();
```

### Configuration Options

```typescript
interface ConsoleConfig {
  toggleKey?: string;           // Default: 'Backquote' (~ key)
  maxLogEntries?: number;       // Default: 1000
  maxHistoryEntries?: number;   // Default: 100
  captureConsole?: boolean;     // Default: true
  persistHistory?: boolean;     // Default: true
  historyStorageKey?: string;   // Default: 'miskatonic:console:history'
  showTimestamps?: boolean;     // Default: true
  initiallyVisible?: boolean;   // Default: false
}
```

### API

```typescript
// Show/hide
debugConsole.show();
debugConsole.hide();
debugConsole.toggle();
console.isVisible(); // boolean

// Logging
debugConsole.log('Message', 'info');  // Levels: debug, info, warn, error
debugConsole.clear();

// Command execution
await debugConsole.executeCommand('help');
await debugConsole.executeCommand('spawn entity 10 20 30');

// History
debugConsole.getHistory();     // string[]
debugConsole.clearHistory();

// Autocomplete
debugConsole.getSuggestions('sp');  // ['spawn', 'spawner']
debugConsole.refreshAutocomplete(); // Sync with CommandSystem

// Cleanup
debugConsole.shutdown();
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Architecture

The debug console consists of three main components:

1. **CommandHistory** - Circular buffer for command history with localStorage persistence
2. **Autocomplete** - Prefix matching engine for command suggestions
3. **DebugConsole** - Main UI component with keyboard handling and console capture

### CommandHistory

Manages command history with up/down arrow navigation:

```typescript
const history = new CommandHistory(100, 'my-app:history', true);

history.add('command1');
history.add('command2');

const prev = history.previous('current input'); // Navigate back
const next = history.next();                     // Navigate forward
```

### Autocomplete

Provides command suggestions:

```typescript
const autocomplete = new Autocomplete();

autocomplete.registerCommand('spawn', 'Spawn an entity');
autocomplete.registerCommand('destroy', 'Destroy an entity');

const suggestions = autocomplete.getSuggestions('sp'); // ['spawn']
const completion = autocomplete.getTabCompletion('sp'); // 'spawn'
```

## Built-in Commands

The debug console works with any commands registered via the CommandSystem. Common built-in commands include:

- `help` - Show available commands
- `clear` - Clear console output
- `spawn <type> <x> <y> <z>` - Spawn entity
- `destroy <id>` - Destroy entity
- `list entities` - List all entities
- `list systems` - List all systems

See `@miskatonic/core` for built-in command definitions.

## Styling

The console UI is created programmatically with inline styles. To customize:

```typescript
// After initialization, modify the container element
const container = document.getElementById('miskatonic-debug-console');
if (container) {
  container.style.height = '60%';           // Adjust height
  container.style.backgroundColor = '#000'; // Change background
}
```

## License

MIT
