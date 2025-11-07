import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, BaseEvent, EventPriority } from '../src';

// Test event types
interface TestEvent extends BaseEvent {
  type: 'test';
  data: string;
}

interface NumberEvent extends BaseEvent {
  type: 'number';
  value: number;
}

interface NamespacedEvent extends BaseEvent {
  type: 'namespaced';
  message: string;
  namespace: string;
}

// Helper to create test events
function createTestEvent(data: string, namespace?: string): TestEvent {
  return {
    type: 'test',
    data,
    timestamp: Date.now(),
    namespace,
  };
}

function createNumberEvent(value: number): NumberEvent {
  return {
    type: 'number',
    value,
    timestamp: Date.now(),
  };
}

function createNamespacedEvent(message: string, namespace: string): NamespacedEvent {
  return {
    type: 'namespaced',
    message,
    namespace,
    timestamp: Date.now(),
  };
}

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('subscription', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn();
      const subscription = eventBus.on('test', handler);

      expect(subscription.isActive()).toBe(true);
      expect(eventBus.hasListeners('test')).toBe(true);
      expect(eventBus.listenerCount('test')).toBe(1);
    });

    it('should handle multiple subscriptions', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      eventBus.on('test', handler3);

      expect(eventBus.listenerCount('test')).toBe(3);
    });

    it('should unsubscribe correctly', () => {
      const handler = vi.fn();
      const subscription = eventBus.on('test', handler);

      expect(eventBus.listenerCount('test')).toBe(1);

      subscription.unsubscribe();

      expect(subscription.isActive()).toBe(false);
      expect(eventBus.listenerCount('test')).toBe(0);
    });

    it('should unsubscribe all listeners for event type', () => {
      eventBus.on('test', vi.fn());
      eventBus.on('test', vi.fn());
      eventBus.on('test', vi.fn());

      expect(eventBus.listenerCount('test')).toBe(3);

      eventBus.off('test');

      expect(eventBus.listenerCount('test')).toBe(0);
    });
  });

  describe('event dispatch', () => {
    it('should dispatch events to subscribers', async () => {
      const handler = vi.fn();
      eventBus.on('test', handler);

      const event = createTestEvent('hello');
      await eventBus.dispatch(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should dispatch to multiple subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.on('test', handler1);
      eventBus.on('test', handler2);
      eventBus.on('test', handler3);

      const event = createTestEvent('broadcast');
      await eventBus.dispatch(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
      expect(handler3).toHaveBeenCalledWith(event);
    });

    it('should not dispatch to unsubscribed handlers', async () => {
      const handler = vi.fn();
      const subscription = eventBus.on('test', handler);

      subscription.unsubscribe();

      await eventBus.dispatch(createTestEvent('ignored'));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors in handlers gracefully', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      eventBus.on('test', errorHandler);
      eventBus.on('test', normalHandler);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await eventBus.dispatch(createTestEvent('error test'));

      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should use emit as alias for dispatch', async () => {
      const handler = vi.fn();
      eventBus.on('test', handler);

      await eventBus.emit(createTestEvent('emit test'));

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('once subscription', () => {
    it('should auto-unsubscribe after first dispatch', async () => {
      const handler = vi.fn();
      eventBus.once('test', handler);

      expect(eventBus.listenerCount('test')).toBe(1);

      await eventBus.dispatch(createTestEvent('first'));
      expect(handler).toHaveBeenCalledTimes(1);

      await eventBus.dispatch(createTestEvent('second'));
      expect(handler).toHaveBeenCalledTimes(1); // Not called again

      expect(eventBus.listenerCount('test')).toBe(0);
    });

    it('should work with once option', async () => {
      const handler = vi.fn();
      eventBus.on('test', handler, { once: true });

      await eventBus.dispatch(createTestEvent('first'));
      await eventBus.dispatch(createTestEvent('second'));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('priority ordering', () => {
    it('should execute handlers in priority order', async () => {
      const callOrder: string[] = [];

      eventBus.on('test', () => callOrder.push('normal'), { priority: EventPriority.NORMAL });
      eventBus.on('test', () => callOrder.push('low'), { priority: EventPriority.LOW });
      eventBus.on('test', () => callOrder.push('high'), { priority: EventPriority.HIGH });
      eventBus.on('test', () => callOrder.push('critical'), { priority: EventPriority.CRITICAL });
      eventBus.on('test', () => callOrder.push('lowest'), { priority: EventPriority.LOWEST });

      await eventBus.dispatch(createTestEvent('priority test'));

      expect(callOrder).toEqual(['critical', 'high', 'normal', 'low', 'lowest']);
    });

    it('should maintain priority order when adding listeners dynamically', async () => {
      const callOrder: string[] = [];

      eventBus.on('test', () => callOrder.push('low'), { priority: EventPriority.LOW });
      eventBus.on('test', () => callOrder.push('high'), { priority: EventPriority.HIGH });
      eventBus.on('test', () => callOrder.push('normal'), { priority: EventPriority.NORMAL });

      await eventBus.dispatch(createTestEvent('dynamic'));

      expect(callOrder).toEqual(['high', 'normal', 'low']);
    });
  });

  describe('namespace filtering', () => {
    it('should filter by namespace', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.on('namespaced', handler1, { namespace: 'game' });
      eventBus.on('namespaced', handler2, { namespace: 'ui' });
      eventBus.on('namespaced', handler3); // No namespace filter

      await eventBus.dispatch(createNamespacedEvent('test', 'game'));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled(); // Gets all events
    });

    it('should handle multiple namespaces', async () => {
      const gameHandler = vi.fn();
      const uiHandler = vi.fn();

      eventBus.on('namespaced', gameHandler, { namespace: 'game' });
      eventBus.on('namespaced', uiHandler, { namespace: 'ui' });

      await eventBus.dispatch(createNamespacedEvent('game event', 'game'));
      await eventBus.dispatch(createNamespacedEvent('ui event', 'ui'));

      expect(gameHandler).toHaveBeenCalledTimes(1);
      expect(uiHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom filters', () => {
    it('should apply custom filter function', async () => {
      const handler = vi.fn();

      eventBus.on<NumberEvent>('number', handler, {
        filter: (event) => (event as NumberEvent).value > 10,
      });

      await eventBus.dispatch(createNumberEvent(5));
      expect(handler).not.toHaveBeenCalled();

      await eventBus.dispatch(createNumberEvent(15));
      expect(handler).toHaveBeenCalled();
    });

    it('should combine filters with priority', async () => {
      const callOrder: number[] = [];

      eventBus.on<NumberEvent>(
        'number',
        (e) => callOrder.push(e.value),
        {
          priority: EventPriority.HIGH,
          filter: (e) => (e as NumberEvent).value % 2 === 0, // Even numbers only
        }
      );

      eventBus.on<NumberEvent>(
        'number',
        (e) => callOrder.push(e.value),
        {
          priority: EventPriority.LOW,
          filter: (e) => (e as NumberEvent).value % 2 === 0,
        }
      );

      await eventBus.dispatch(createNumberEvent(1)); // Odd, filtered out
      await eventBus.dispatch(createNumberEvent(2)); // Even, both called
      await eventBus.dispatch(createNumberEvent(3)); // Odd, filtered out
      await eventBus.dispatch(createNumberEvent(4)); // Even, both called

      expect(callOrder).toEqual([2, 2, 4, 4]); // HIGH then LOW for each even number
    });
  });

  describe('event batching', () => {
    it('should queue events for batched dispatch', async () => {
      const handler = vi.fn();
      eventBus.on('test', handler);

      eventBus.queue(createTestEvent('batch1'));
      eventBus.queue(createTestEvent('batch2'));
      eventBus.queue(createTestEvent('batch3'));

      expect(handler).not.toHaveBeenCalled();

      await eventBus.flushBatch();

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should auto-flush batch after delay', async () => {
      const eventBus = new EventBus({ batchDelay: 10 });
      const handler = vi.fn();
      eventBus.on('test', handler);

      eventBus.queue(createTestEvent('auto-batch'));

      expect(handler).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should track dispatch count', async () => {
      eventBus.on('test', vi.fn());

      await eventBus.dispatch(createTestEvent('1'));
      await eventBus.dispatch(createTestEvent('2'));
      await eventBus.dispatch(createTestEvent('3'));

      const stats = eventBus.getStats();
      expect(stats.totalDispatched).toBe(3);
    });

    it('should track listener count', () => {
      eventBus.on('test', vi.fn());
      eventBus.on('test', vi.fn());
      eventBus.on('number', vi.fn());

      const stats = eventBus.getStats();
      expect(stats.totalListeners).toBe(3);
    });

    it('should track events by type', async () => {
      eventBus.on('test', vi.fn());
      eventBus.on('number', vi.fn());

      await eventBus.dispatch(createTestEvent('1'));
      await eventBus.dispatch(createTestEvent('2'));
      await eventBus.dispatch(createNumberEvent(42));

      const stats = eventBus.getStats();
      expect(stats.byType.get('test')).toBe(2);
      expect(stats.byType.get('number')).toBe(1);
    });

    it('should track average dispatch time', async () => {
      eventBus.on('test', vi.fn());

      await eventBus.dispatch(createTestEvent('timing'));

      const stats = eventBus.getStats();
      expect(stats.avgDispatchTime).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      eventBus.on('test', vi.fn());
      eventBus.on('number', vi.fn());
      eventBus.on('test', vi.fn());

      expect(eventBus.getStats().totalListeners).toBe(3);

      eventBus.clear();

      expect(eventBus.getStats().totalListeners).toBe(0);
      expect(eventBus.hasListeners('test')).toBe(false);
      expect(eventBus.hasListeners('number')).toBe(false);
    });
  });

  describe('async handlers', () => {
    it('should handle async event handlers', async () => {
      const results: string[] = [];

      eventBus.on('test', async (event: TestEvent) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(event.data);
      });

      await eventBus.dispatch(createTestEvent('async'));

      expect(results).toEqual(['async']);
    });

    it('should wait for all async handlers', async () => {
      const results: number[] = [];

      eventBus.on('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        results.push(1);
      });

      eventBus.on('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(2);
      });

      await eventBus.dispatch(createTestEvent('wait'));

      expect(results).toHaveLength(2);
      expect(results).toContain(1);
      expect(results).toContain(2);
    });
  });
});
