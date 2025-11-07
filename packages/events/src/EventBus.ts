import type {
  BaseEvent,
  EventHandler,
  EventSubscription,
  EventListener,
  EventListenerOptions,
  EventBusStats,
} from './types';
import { EventPriority } from './types';

/**
 * Type-safe event bus with priority ordering, filtering, and batching
 *
 * Features:
 * - Type-safe event dispatch and subscription
 * - Priority-based event ordering
 * - Namespace filtering
 * - One-time subscriptions
 * - Custom event filters
 * - Event batching for performance
 * - Subscription management
 * - Recursion detection
 * - Concurrent dispatch protection
 */
export class EventBus {
  private listeners: Map<string, EventListener[]> = new Map();
  private nextListenerId = 1;
  private stats: EventBusStats = {
    totalDispatched: 0,
    totalListeners: 0,
    byType: new Map(),
    avgDispatchTime: 0,
  };

  // Use circular buffer for dispatch times
  private dispatchTimes: number[] = new Array(100);
  private dispatchTimeIndex = 0;
  private dispatchTimeCount = 0;

  private batchedEvents: BaseEvent[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly batchDelay: number;

  // Recursion detection
  private dispatchDepth = 0;
  private readonly maxRecursionDepth = 50;

  // Track listeners pending removal (defer cleanup to avoid iterator invalidation)
  private listenersToRemove: Set<number> = new Set();

  // Destroyed flag to prevent use-after-destroy
  private destroyed = false;

  constructor(options?: { batchDelay?: number }) {
    this.batchDelay = options?.batchDelay ?? 16; // Default to ~60fps
  }

  /**
   * Subscribe to an event type
   */
  on<T extends BaseEvent>(
    eventType: string,
    handler: EventHandler<T>,
    options: EventListenerOptions = {}
  ): EventSubscription {
    if (this.destroyed) {
      throw new Error('Cannot subscribe to destroyed EventBus');
    }

    const listener: EventListener<T> = {
      handler: handler as EventHandler,
      options: {
        priority: options.priority ?? EventPriority.NORMAL,
        once: options.once ?? false,
        filter: options.filter ?? (() => true),
        namespace: options.namespace ?? '',
      },
      id: this.nextListenerId++,
      active: true,
    };

    // Get or create listener array for this event type
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const listenersForType = this.listeners.get(eventType)!;

    // Binary insertion to maintain sorted order - O(log n) instead of O(n log n)
    const insertIndex = this.findInsertionIndex(listenersForType, listener.options.priority);
    listenersForType.splice(insertIndex, 0, listener);

    this.stats.totalListeners++;

    // Return subscription handle
    const subscriptionId = listener.id;
    return {
      unsubscribe: () => {
        listener.active = false;
        this.listenersToRemove.add(subscriptionId);
        this.stats.totalListeners--;
      },
      isActive: () => listener.active,
    };
  }

  /**
   * Binary search to find insertion index for priority
   */
  private findInsertionIndex(listeners: EventListener[], priority: number): number {
    let low = 0;
    let high = listeners.length;

    while (low < high) {
      const mid = (low + high) >>> 1; // Unsigned right shift for integer division
      if (listeners[mid].options.priority < priority) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  /**
   * Subscribe to an event, auto-unsubscribe after first trigger
   */
  once<T extends BaseEvent>(
    eventType: string,
    handler: EventHandler<T>,
    options: Omit<EventListenerOptions, 'once'> = {}
  ): EventSubscription {
    return this.on(eventType, handler, { ...options, once: true });
  }

  /**
   * Unsubscribe all listeners for an event type
   */
  off(eventType: string): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      const activeCount = listeners.filter((l) => l.active).length;
      this.stats.totalListeners -= activeCount;

      // Mark all as inactive and schedule for removal
      listeners.forEach((l) => {
        l.active = false;
        this.listenersToRemove.add(l.id);
      });
    }
  }

  /**
   * Dispatch an event immediately (synchronous)
   */
  async dispatch<T extends BaseEvent>(event: T): Promise<void> {
    if (this.destroyed) {
      console.warn('Cannot dispatch event on destroyed EventBus');
      return;
    }

    // Validate event structure
    if (!event || typeof event.type !== 'string' || typeof event.timestamp !== 'number') {
      throw new Error('Invalid event: must have type (string) and timestamp (number) properties');
    }

    // Recursion detection
    this.dispatchDepth++;
    if (this.dispatchDepth > this.maxRecursionDepth) {
      this.dispatchDepth--;
      throw new Error(
        `Maximum recursion depth (${this.maxRecursionDepth}) exceeded for event type: ${event.type}`
      );
    }

    const startTime = performance.now();

    try {
      const listeners = this.listeners.get(event.type);
      if (!listeners || listeners.length === 0) {
        return;
      }

      // Create snapshot of active listeners to avoid iterator invalidation
      const activeListeners = listeners.filter((l) => l.active);

      // Group listeners by priority for parallel execution within priority levels
      const priorityGroups = new Map<number, EventListener[]>();
      for (const listener of activeListeners) {
        // Apply namespace filter
        if (listener.options.namespace && event.namespace !== listener.options.namespace) {
          continue;
        }

        // Apply custom filter
        try {
          if (!listener.options.filter(event)) {
            continue;
          }
        } catch (filterError) {
          console.error(`Error in event filter for ${event.type}:`, filterError);
          continue;
        }

        const priority = listener.options.priority;
        if (!priorityGroups.has(priority)) {
          priorityGroups.set(priority, []);
        }
        priorityGroups.get(priority)!.push(listener);
      }

      // Execute listeners by priority group (parallel within group, sequential between groups)
      const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) => a - b);

      for (const priority of sortedPriorities) {
        const group = priorityGroups.get(priority)!;

        // Execute all handlers in this priority group in parallel
        await Promise.all(
          group.map(async (listener) => {
            try {
              await listener.handler(event);

              // Auto-unsubscribe if once
              if (listener.options.once) {
                listener.active = false;
                this.listenersToRemove.add(listener.id);
                this.stats.totalListeners--;
              }
            } catch (error) {
              // Re-throw recursion errors to propagate them up
              if (error instanceof Error && error.message.includes('Maximum recursion depth')) {
                throw error;
              }
              console.error(`Error in event handler for ${event.type}:`, error);
            }
          })
        );
      }

      // Deferred cleanup of inactive listeners (safe after iteration)
      if (this.listenersToRemove.size > 0) {
        this.cleanupInactiveListeners();
      }

      // Update statistics
      this.stats.totalDispatched++;
      const eventCount = this.stats.byType.get(event.type) || 0;
      this.stats.byType.set(event.type, eventCount + 1);

      const dispatchTime = performance.now() - startTime;

      // Circular buffer for dispatch times
      this.dispatchTimes[this.dispatchTimeIndex] = dispatchTime;
      this.dispatchTimeIndex = (this.dispatchTimeIndex + 1) % this.dispatchTimes.length;
      this.dispatchTimeCount = Math.min(this.dispatchTimeCount + 1, this.dispatchTimes.length);

      // Calculate average from circular buffer
      let sum = 0;
      for (let i = 0; i < this.dispatchTimeCount; i++) {
        sum += this.dispatchTimes[i];
      }
      this.stats.avgDispatchTime = sum / this.dispatchTimeCount;
    } finally {
      this.dispatchDepth--;
    }
  }

  /**
   * Cleanup inactive listeners (deferred to avoid iterator invalidation)
   */
  private cleanupInactiveListeners(): void {
    if (this.listenersToRemove.size === 0) return;

    for (const [eventType, listeners] of this.listeners.entries()) {
      const cleaned = listeners.filter((l) => !this.listenersToRemove.has(l.id));
      if (cleaned.length === 0) {
        this.listeners.delete(eventType);
      } else if (cleaned.length !== listeners.length) {
        this.listeners.set(eventType, cleaned);
      }
    }

    this.listenersToRemove.clear();
  }

  /**
   * Emit an event (alias for dispatch)
   */
  emit<T extends BaseEvent>(event: T): Promise<void> {
    return this.dispatch(event);
  }

  /**
   * Queue event for batched dispatch
   */
  queue<T extends BaseEvent>(event: T): void {
    if (this.destroyed) {
      console.warn('Cannot queue event on destroyed EventBus');
      return;
    }

    this.batchedEvents.push(event);

    // Schedule batch dispatch if not already scheduled
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushBatch().catch((error) => {
          console.error('Error flushing batch:', error);
        });
      }, this.batchDelay);
    }
  }

  /**
   * Flush all batched events immediately
   */
  async flushBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchedEvents.length === 0) {
      return;
    }

    const events = [...this.batchedEvents];
    this.batchedEvents = [];

    // Dispatch all batched events
    for (const event of events) {
      await this.dispatch(event);
    }
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.listenersToRemove.clear();
    this.stats.totalListeners = 0;
  }

  /**
   * Destroy the event bus and cleanup all resources
   */
  destroy(): void {
    if (this.destroyed) return;

    // Clear batch timeout to prevent memory leak
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Clear all listeners
    this.clear();

    // Clear batched events
    this.batchedEvents = [];

    this.destroyed = true;
  }

  /**
   * Get event bus statistics
   */
  getStats(): Readonly<EventBusStats> {
    return {
      ...this.stats,
      byType: new Map(this.stats.byType),
    };
  }

  /**
   * Get count of active listeners for an event type
   */
  listenerCount(eventType: string): number {
    const listeners = this.listeners.get(eventType);
    return listeners ? listeners.filter((l) => l.active).length : 0;
  }

  /**
   * Check if there are any listeners for an event type
   */
  hasListeners(eventType: string): boolean {
    return this.listenerCount(eventType) > 0;
  }

  /**
   * Check if the event bus has been destroyed
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }
}
