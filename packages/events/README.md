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
const eventBus = new EventBus();

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

## Core Concepts

### Events

All events must extend the `BaseEvent` interface:

```typescript
interface BaseEvent {
  readonly type: string;       // Event type identifier
  readonly timestamp: number;  // When the event was created
  readonly namespace?: string; // Optional namespace for filtering
}
```

Example event definition:

```typescript
interface GameStartEvent extends BaseEvent {
  type: 'game:start';
  difficulty: 'easy' | 'medium' | 'hard';
  playerCount: number;
}
```

### Event Bus

The `EventBus` class is the central hub for all event communication:

```typescript
const eventBus = new EventBus({
  batchDelay: 16, // Batch delay in ms (default: 16ms for ~60fps)
});
```

## Usage Examples

### Basic Subscription

```typescript
// Subscribe to an event
eventBus.on('game:start', (event: GameStartEvent) => {
  console.log(`Game starting with ${event.playerCount} players`);
});

// Dispatch an event
await eventBus.emit({
  type: 'game:start',
  difficulty: 'medium',
  playerCount: 4,
  timestamp: Date.now(),
});
```

### One-Time Subscriptions

```typescript
// Auto-unsubscribe after first trigger
eventBus.once('player:spawn', (event) => {
  console.log('Player spawned for the first time');
});
```

### Priority-Based Ordering

Control the execution order of event handlers:

```typescript
// Critical handler runs first
eventBus.on('entity:damaged', handleCriticalDamage, {
  priority: EventPriority.CRITICAL,
});

// Normal handler runs second
eventBus.on('entity:damaged', updateHealthBar, {
  priority: EventPriority.NORMAL,
});

// Low priority handler runs last
eventBus.on('entity:damaged', playDamageSound, {
  priority: EventPriority.LOW,
});
```

Priority levels:
- `EventPriority.CRITICAL = -1000`
- `EventPriority.HIGH = -100`
- `EventPriority.NORMAL = 0` (default)
- `EventPriority.LOW = 100`
- `EventPriority.LOWEST = 1000`

### Namespace Filtering

Organize events by namespace:

```typescript
// Subscribe to UI events only
eventBus.on('button:click', handleUIClick, {
  namespace: 'ui',
});

// Subscribe to game logic events only
eventBus.on('button:click', handleGameClick, {
  namespace: 'game',
});

// Dispatch with namespace
await eventBus.dispatch({
  type: 'button:click',
  buttonId: 'start-button',
  timestamp: Date.now(),
  namespace: 'ui', // Only UI subscribers will receive this
});
```

### Custom Filters

Apply complex filtering logic:

```typescript
// Only handle events for specific entities
eventBus.on('entity:damaged', (event: DamageEvent) => {
  console.log(`Player took ${event.damage} damage`);
}, {
  filter: (event) => event.entityType === 'player',
});

// Only handle high-damage events
eventBus.on('entity:damaged', (event: DamageEvent) => {
  console.log('Critical damage!');
}, {
  filter: (event) => event.damage > 50,
});
```

### Event Batching

Queue events for optimized batch processing:

```typescript
// Queue events (won't dispatch immediately)
eventBus.queue(particleSpawnEvent1);
eventBus.queue(particleSpawnEvent2);
eventBus.queue(particleSpawnEvent3);

// Events will auto-flush after batchDelay (default: 16ms)
// Or manually flush:
await eventBus.flushBatch();
```

### Async Event Handlers

Full support for async handlers:

```typescript
eventBus.on('save:game', async (event: SaveGameEvent) => {
  await saveToDatabase(event.saveData);
  console.log('Game saved successfully');
});

// dispatch() waits for all async handlers
await eventBus.dispatch(saveGameEvent);
console.log('All handlers completed');
```

### Subscription Management

```typescript
const subscription = eventBus.on('game:update', handleUpdate);

// Check if subscription is active
if (subscription.isActive()) {
  console.log('Still subscribed');
}

// Unsubscribe
subscription.unsubscribe();

// Unsubscribe all listeners for an event type
eventBus.off('game:update');

// Clear all listeners
eventBus.clear();
```

### Statistics and Monitoring

Track event bus performance:

```typescript
const stats = eventBus.getStats();

console.log(`Total events dispatched: ${stats.totalDispatched}`);
console.log(`Active listeners: ${stats.totalListeners}`);
console.log(`Average dispatch time: ${stats.avgDispatchTime}ms`);

// Events by type
stats.byType.forEach((count, type) => {
  console.log(`${type}: ${count} dispatches`);
});

// Check listener count for specific event
const listenerCount = eventBus.listenerCount('player:moved');
console.log(`${listenerCount} listeners for player:moved`);
```

## Best Practices

### 1. Define Strong Event Types

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

### 2. Use Namespaces for Organization

```typescript
// ✅ GOOD: Organize by namespace
await eventBus.dispatch({
  type: 'click',
  namespace: 'ui',
  ...
});

await eventBus.dispatch({
  type: 'click',
  namespace: 'game',
  ...
});
```

### 3. Avoid Memory Leaks

```typescript
class GameScene {
  private subscription: EventSubscription;

  init() {
    // Subscribe on init
    this.subscription = eventBus.on('game:update', this.handleUpdate);
  }

  cleanup() {
    // IMPORTANT: Unsubscribe on cleanup
    this.subscription?.unsubscribe();
  }

  handleUpdate = (event) => {
    // ...
  }
}
```

### 4. Use Priorities Wisely

```typescript
// Critical: Must run first (e.g., validation)
eventBus.on('transaction:process', validateTransaction, {
  priority: EventPriority.CRITICAL,
});

// Normal: Main logic
eventBus.on('transaction:process', processTransaction, {
  priority: EventPriority.NORMAL,
});

// Low: Side effects (e.g., notifications)
eventBus.on('transaction:process', notifyUser, {
  priority: EventPriority.LOW,
});
```

### 5. Batch High-Frequency Events

```typescript
// For events that fire many times per frame
function onParticleSpawn(position: Vector3) {
  eventBus.queue({
    type: 'particle:spawn',
    position,
    timestamp: Date.now(),
  });
}

// Batched events will flush automatically at 60fps
```

## Performance Considerations

- **Event batching**: Use `queue()` for high-frequency events to reduce overhead
- **Listener cleanup**: Inactive listeners are automatically removed during dispatch
- **Filter performance**: Complex filters are only evaluated for matching event types
- **Async handlers**: `dispatch()` waits for all async handlers; use `queue()` for fire-and-forget
- **Statistics overhead**: Minimal (<1% performance impact)

## API Reference

### EventBus

#### Constructor
```typescript
constructor(options?: { batchDelay?: number })
```

#### Methods

- `on<T>(eventType, handler, options?): EventSubscription` - Subscribe to events
- `once<T>(eventType, handler, options?): EventSubscription` - Subscribe once
- `off(eventType): void` - Unsubscribe all listeners for type
- `dispatch<T>(event): Promise<void>` - Dispatch event immediately
- `emit<T>(event): Promise<void>` - Alias for dispatch
- `queue<T>(event): void` - Queue event for batch dispatch
- `flushBatch(): Promise<void>` - Flush all queued events
- `clear(): void` - Remove all listeners
- `getStats(): EventBusStats` - Get statistics
- `listenerCount(eventType): number` - Count listeners for type
- `hasListeners(eventType): boolean` - Check if type has listeners

### EventListenerOptions

```typescript
interface EventListenerOptions {
  priority?: EventPriority;           // Execution priority
  once?: boolean;                     // Auto-unsubscribe after first trigger
  filter?: (event: BaseEvent) => boolean;  // Custom filter function
  namespace?: string;                 // Namespace filter
}
```

## License

MIT
