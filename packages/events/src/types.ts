/**
 * Core event system type definitions
 */

/**
 * Base event interface - all events must extend this
 */
export interface BaseEvent {
  /** Event type identifier */
  readonly type: string;

  /** Timestamp when event was created */
  readonly timestamp: number;

  /** Optional namespace for event filtering */
  readonly namespace?: string;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => void | Promise<void>;

/**
 * Event subscription handle
 */
export interface EventSubscription {
  /** Unsubscribe from the event */
  unsubscribe(): void;

  /** Check if subscription is still active */
  isActive(): boolean;
}

/**
 * Event priority for ordering
 */
export enum EventPriority {
  /** Critical events processed first */
  CRITICAL = -1000,

  /** High priority events */
  HIGH = -100,

  /** Normal priority (default) */
  NORMAL = 0,

  /** Low priority events */
  LOW = 100,

  /** Lowest priority, processed last */
  LOWEST = 1000,
}

/**
 * Event listener configuration
 */
export interface EventListenerOptions {
  /** Priority for event processing order */
  priority?: EventPriority;

  /** Only trigger once then auto-unsubscribe */
  once?: boolean;

  /** Filter function - return false to skip this listener */
  filter?: (event: BaseEvent) => boolean;

  /** Namespace filter - only receive events from this namespace */
  namespace?: string;
}

/**
 * Internal event listener metadata
 */
export interface EventListener<T extends BaseEvent = BaseEvent> {
  handler: EventHandler<T>;
  options: Required<EventListenerOptions>;
  id: number;
  active: boolean;
}

/**
 * Event batch for performance optimization
 */
export interface EventBatch {
  events: BaseEvent[];
  timestamp: number;
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
  /** Total events dispatched */
  totalDispatched: number;

  /** Total listeners registered */
  totalListeners: number;

  /** Events dispatched by type */
  byType: Map<string, number>;

  /** Average dispatch time in ms */
  avgDispatchTime: number;
}
