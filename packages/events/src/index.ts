/**
 * @miskatonic/events - Type-safe event system
 *
 * High-performance event bus with:
 * - Type-safe event dispatch and subscription
 * - Priority-based event ordering
 * - Namespace filtering
 * - Event batching for performance
 * - Subscription management
 */

export { EventBus } from './EventBus';

export type {
  BaseEvent,
  EventHandler,
  EventSubscription,
  EventListener,
  EventListenerOptions,
  EventBatch,
  EventBusStats,
} from './types';

export { EventPriority } from './types';
