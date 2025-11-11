# @miskatonic/events

High-performance, type-safe event system for the Miskatonic Engine.

## Features

- **Type-safe**: Full TypeScript support with strongly typed events
- **Priority-based ordering**: Control execution order with event priorities
- **Namespace filtering**: Organize events by namespace for better separation
- **Custom filters**: Apply complex filtering logic to event listeners
- **Event batching**: Queue events for optimized batch processing
- **Performance tracking**: Built-in statistics and performance monitoring
- **Async support**: Full support for async event handlers
- **Subscription management**: Easy-to-use subscription handles with lifecycle control

## Installation

```bash
npm install @miskatonic/events
```

## Quick Start

```typescript
import { EventBus, BaseEvent, EventPriority } from '@miskatonic/events';

// Define your event types
interface PlayerMovedEvent extends BaseEvent {
  type: 'player:moved';
  playerId: string;
  x: number;
  y: number;
}

// Create event bus
const eventBus = new EventBus({
  batchDelay: 16, // Optional: batch delay in ms (default: 16ms for ~60fps)
});

// Subscribe to events
const subscription = eventBus.on<PlayerMovedEvent>('player:moved', (event) => {
  console.log(`Player ${event.playerId} moved to (${event.x}, ${event.y})`);
});

// Dispatch events
await eventBus.dispatch({
  type: 'player:moved',
  playerId: 'player1',
  x: 100,
  y: 200,
  timestamp: Date.now(),
});

// Unsubscribe when done
subscription.unsubscribe();
```

### Event Definition

All events must extend the `BaseEvent` interface:

```typescript
interface BaseEvent {
  readonly type: string;       // Event type identifier
  readonly timestamp: number;  // When the event was created
  readonly namespace?: string; // Optional namespace for filtering
}

// Example custom event
interface GameStartEvent extends BaseEvent {
  type: 'game:start';
  difficulty: 'easy' | 'medium' | 'hard';
  playerCount: number;
}
```

## Usage

### One-Time Subscriptions

```typescript
// Auto-unsubscribe after first trigger
eventBus.once('player:spawn', (event) => {
  console.log('Player spawned for the first time');
});
```

### Priority-Based Ordering

Control handler execution order with priorities:

```typescript
eventBus.on('entity:damaged', handleCriticalDamage, {
  priority: EventPriority.CRITICAL, // -1000 (runs first)
});

eventBus.on('entity:damaged', updateHealthBar, {
  priority: EventPriority.NORMAL, // 0 (default)
});

eventBus.on('entity:damaged', playDamageSound, {
  priority: EventPriority.LOW, // 100 (runs last)
});
```

Available priorities: `CRITICAL` (-1000), `HIGH` (-100), `NORMAL` (0), `LOW` (100), `LOWEST` (1000)

### Namespace Filtering

Organize events by namespace for better separation:

```typescript
// Subscribe to specific namespace
eventBus.on('button:click', handleUIClick, { namespace: 'ui' });
eventBus.on('button:click', handleGameClick, { namespace: 'game' });

// Dispatch with namespace - only matching subscribers receive it
await eventBus.dispatch({
  type: 'button:click',
  buttonId: 'start-button',
  timestamp: Date.now(),
  namespace: 'ui',
});
```

### Custom Filters

Apply complex filtering logic:

```typescript
// Only handle events matching specific criteria
eventBus.on('entity:damaged', (event: DamageEvent) => {
  console.log(`Player took ${event.damage} damage`);
}, {
  filter: (event) => event.entityType === 'player' && event.damage > 50,
});
```

### Event Batching

Queue high-frequency events for optimized batch processing:

```typescript
// Queue events (won't dispatch immediately)
eventBus.queue(particleSpawnEvent1);
eventBus.queue(particleSpawnEvent2);
eventBus.queue(particleSpawnEvent3);

// Events auto-flush after batchDelay, or manually:
await eventBus.flushBatch();
```

### Async Event Handlers

```typescript
eventBus.on('save:game', async (event: SaveGameEvent) => {
  await saveToDatabase(event.saveData);
  console.log('Game saved successfully');
});

// dispatch() waits for all async handlers
await eventBus.dispatch(saveGameEvent);
```

### Subscription Management

```typescript
const subscription = eventBus.on('game:update', handleUpdate);

subscription.unsubscribe();              // Unsubscribe this listener
eventBus.off('game:update');             // Unsubscribe all for this type
eventBus.clear();                        // Clear all listeners
```

### Statistics and Monitoring

```typescript
const stats = eventBus.getStats();

console.log(stats.totalDispatched);      // Total events dispatched
console.log(stats.totalListeners);       // Active listeners
console.log(stats.avgDispatchTime);      // Average dispatch time (ms)

// Per-event-type statistics
stats.byType.forEach((count, type) => {
  console.log(`${type}: ${count} dispatches`);
});

// Check listener count
const count = eventBus.listenerCount('player:moved');
```

## Best Practices

### Define Strong Event Types

Use specific, well-typed events instead of generic ones:

```typescript
// ❌ BAD: Weak typing
interface GenericEvent extends BaseEvent {
  type: string;
  data: any;
}

// ✅ GOOD: Strong typing
interface PlayerDamagedEvent extends BaseEvent {
  type: 'player:damaged';
  playerId: string;
  damage: number;
  damageType: 'physical' | 'magic' | 'fire';
}
```

### Prevent Memory Leaks

Always unsubscribe when cleaning up:

```typescript
class GameScene {
  private subscription: EventSubscription;

  init() {
    this.subscription = eventBus.on('game:update', this.handleUpdate);
  }

  cleanup() {
    // CRITICAL: Unsubscribe to prevent memory leaks
    this.subscription?.unsubscribe();
  }

  handleUpdate = (event) => {
    // ...
  }
}
```

### Use Priorities for Control Flow

- **CRITICAL**: Must run first (validation, safety checks)
- **NORMAL**: Main logic (default)
- **LOW**: Side effects (notifications, logging, analytics)

### Batch High-Frequency Events

For events that fire many times per frame (particles, input, physics updates), use `queue()` to reduce dispatch overhead.

### Organize with Namespaces

Use namespaces to separate concerns (`ui`, `game`, `physics`, `network`) and avoid handler collisions.

## Performance Tips

- **Event batching**: Use `queue()` for high-frequency events to reduce overhead
- **Listener cleanup**: Inactive listeners are automatically removed during dispatch
- **Filter performance**: Complex filters are only evaluated for matching event types
- **Async vs sync**: `dispatch()` waits for all async handlers; use `queue()` for fire-and-forget
- **Statistics overhead**: Minimal (<1% performance impact)

## API Reference

### EventBus Methods

- `on<T>(eventType, handler, options?): EventSubscription` - Subscribe to events
- `once<T>(eventType, handler, options?): EventSubscription` - Subscribe once, auto-unsubscribe
- `off(eventType): void` - Unsubscribe all listeners for event type
- `dispatch<T>(event): Promise<void>` - Dispatch event immediately (waits for async)
- `emit<T>(event): Promise<void>` - Alias for dispatch
- `queue<T>(event): void` - Queue event for batch dispatch
- `flushBatch(): Promise<void>` - Flush all queued events
- `clear(): void` - Remove all listeners
- `getStats(): EventBusStats` - Get performance statistics
- `listenerCount(eventType): number` - Count listeners for event type
- `hasListeners(eventType): boolean` - Check if event type has listeners

### EventListenerOptions

```typescript
interface EventListenerOptions {
  priority?: EventPriority;                    // Execution priority
  once?: boolean;                              // Auto-unsubscribe after first trigger
  filter?: (event: BaseEvent) => boolean;      // Custom filter function
  namespace?: string;                          // Namespace filter
}
```

For detailed API documentation, see TypeDoc output or TypeScript definitions.

## License

MIT
