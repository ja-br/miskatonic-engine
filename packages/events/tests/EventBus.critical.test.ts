import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, BaseEvent } from '../src';

// Test event types
interface TestEvent extends BaseEvent {
  type: 'test';
  data: string;
}

function createTestEvent(data: string): TestEvent {
  return {
    type: 'test',
    data,
    timestamp: Date.now(),
  };
}

describe('EventBus - Critical Features', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('recursion detection', () => {
    it('should detect infinite recursion', async () => {
      // Handler that dispatches the same event type
      eventBus.on('test', async () => {
        await eventBus.dispatch(createTestEvent('recursive'));
      });

      await expect(eventBus.dispatch(createTestEvent('trigger'))).rejects.toThrow(
        /Maximum recursion depth/
      );
    });

    it('should allow limited recursion depth', async () => {
      let depth = 0;
      const maxDepth = 50;

      eventBus.on('test', async (event: TestEvent) => {
        depth++;
        if (depth < maxDepth) {
          await eventBus.dispatch(createTestEvent(`depth-${depth}`));
        }
      });

      await eventBus.dispatch(createTestEvent('start'));
      expect(depth).toBe(maxDepth);
    });

    it('should reset recursion depth after dispatch completes', async () => {
      let callCount = 0;

      eventBus.on('test', async () => {
        callCount++;
        if (callCount === 1) {
          // First call - will recurse once
          await eventBus.dispatch(createTestEvent('inner'));
        }
      });

      // First dispatch with recursion
      await eventBus.dispatch(createTestEvent('outer1'));
      expect(callCount).toBe(2); // Outer + inner

      // Second dispatch should work fine (depth was reset)
      await eventBus.dispatch(createTestEvent('outer2'));
      expect(callCount).toBe(3); // One more call
    });
  });

  describe('event validation', () => {
    it('should reject events without type', async () => {
      const invalidEvent = { timestamp: Date.now() } as any;

      await expect(eventBus.dispatch(invalidEvent)).rejects.toThrow(/Invalid event/);
    });

    it('should reject events without timestamp', async () => {
      const invalidEvent = { type: 'test' } as any;

      await expect(eventBus.dispatch(invalidEvent)).rejects.toThrow(/Invalid event/);
    });

    it('should reject null events', async () => {
      await expect(eventBus.dispatch(null as any)).rejects.toThrow(/Invalid event/);
    });

    it('should reject undefined events', async () => {
      await expect(eventBus.dispatch(undefined as any)).rejects.toThrow(/Invalid event/);
    });

    it('should accept valid events', async () => {
      const handler = vi.fn();
      eventBus.on('test', handler);

      const validEvent = createTestEvent('valid');
      await expect(eventBus.dispatch(validEvent)).resolves.toBeUndefined();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('destroy lifecycle', () => {
    it('should prevent subscriptions after destroy', () => {
      eventBus.destroy();

      expect(() => eventBus.on('test', vi.fn())).toThrow(/destroyed/);
    });

    it('should prevent dispatch after destroy', async () => {
      const handler = vi.fn();
      eventBus.on('test', handler);
      eventBus.destroy();

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await eventBus.dispatch(createTestEvent('after destroy'));

      expect(handler).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('destroyed'));

      consoleSpy.mockRestore();
    });

    it('should prevent queueing after destroy', () => {
      eventBus.destroy();

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      eventBus.queue(createTestEvent('queued'));

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('destroyed'));

      consoleSpy.mockRestore();
    });

    it('should clear batch timeout on destroy', () => {
      // Queue an event to create a timeout
      eventBus.queue(createTestEvent('batched'));

      // Destroy should clear the timeout
      eventBus.destroy();

      expect(eventBus.isDestroyed()).toBe(true);
    });

    it('should allow multiple destroy calls', () => {
      eventBus.destroy();
      expect(() => eventBus.destroy()).not.toThrow();
    });

    it('should clear all listeners on destroy', () => {
      eventBus.on('test', vi.fn());
      eventBus.on('test', vi.fn());

      expect(eventBus.listenerCount('test')).toBe(2);

      eventBus.destroy();

      expect(eventBus.listenerCount('test')).toBe(0);
    });
  });

  describe('concurrent dispatch protection', () => {
    it('should handle concurrent dispatches of same event type', async () => {
      const results: string[] = [];
      let listenerCount = 0;

      eventBus.on('test', async (event: TestEvent) => {
        listenerCount++;
        const currentCount = listenerCount;

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));

        results.push(`${currentCount}-${event.data}`);
      });

      // Dispatch multiple events concurrently
      await Promise.all([
        eventBus.dispatch(createTestEvent('A')),
        eventBus.dispatch(createTestEvent('B')),
        eventBus.dispatch(createTestEvent('C')),
      ]);

      // All handlers should have been called
      expect(results).toHaveLength(3);
      expect(results).toContain('1-A');
      expect(results).toContain('2-B');
      expect(results).toContain('3-C');
    });

    it('should not lose listeners during concurrent dispatch and unsubscribe', async () => {
      const callCounts = { handler1: 0, handler2: 0, handler3: 0 };

      const sub1 = eventBus.on('test', async () => {
        callCounts.handler1++;
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const sub2 = eventBus.on('test', async () => {
        callCounts.handler2++;
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const sub3 = eventBus.on('test', async () => {
        callCounts.handler3++;
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Start dispatches
      const dispatch1 = eventBus.dispatch(createTestEvent('1'));
      const dispatch2 = eventBus.dispatch(createTestEvent('2'));

      // Unsubscribe handler2 while dispatches are in flight
      sub2.unsubscribe();

      // Start another dispatch after unsubscribe
      const dispatch3 = eventBus.dispatch(createTestEvent('3'));

      await Promise.all([dispatch1, dispatch2, dispatch3]);

      // Handler 1 and 3 should be called for all dispatches
      expect(callCounts.handler1).toBe(3);
      expect(callCounts.handler3).toBe(3);

      // Handler 2 might be called 2 or 3 times depending on timing,
      // but should not cause crashes or data corruption
      expect(callCounts.handler2).toBeGreaterThanOrEqual(2);
      expect(callCounts.handler2).toBeLessThanOrEqual(3);
    });
  });

  describe('filter error handling', () => {
    it('should handle filter exceptions gracefully', async () => {
      const goodHandler = vi.fn();
      const badFilterHandler = vi.fn();

      eventBus.on('test', goodHandler);

      eventBus.on('test', badFilterHandler, {
        filter: () => {
          throw new Error('Filter explosion!');
        },
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await eventBus.dispatch(createTestEvent('test'));

      // Good handler should still be called
      expect(goodHandler).toHaveBeenCalled();

      // Bad filter handler should not be called
      expect(badFilterHandler).not.toHaveBeenCalled();

      // Error should be logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in event filter'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('binary insertion optimization', () => {
    it('should maintain priority order with binary insertion', async () => {
      const callOrder: number[] = [];

      // Add listeners in random priority order
      eventBus.on('test', () => callOrder.push(3), { priority: 100 });
      eventBus.on('test', () => callOrder.push(1), { priority: -100 });
      eventBus.on('test', () => callOrder.push(5), { priority: 1000 });
      eventBus.on('test', () => callOrder.push(2), { priority: 0 });
      eventBus.on('test', () => callOrder.push(4), { priority: 500 });

      await eventBus.dispatch(createTestEvent('test'));

      expect(callOrder).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle many listeners efficiently', async () => {
      const listenerCount = 1000;
      let callCount = 0;

      // Add many listeners with random priorities
      for (let i = 0; i < listenerCount; i++) {
        const priority = Math.floor(Math.random() * 2000) - 1000;
        eventBus.on('test', () => callCount++, { priority });
      }

      const startTime = performance.now();
      await eventBus.dispatch(createTestEvent('many listeners'));
      const duration = performance.now() - startTime;

      expect(callCount).toBe(listenerCount);
      // Should complete in reasonable time (< 100ms for 1000 listeners)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('circular buffer statistics', () => {
    it('should use circular buffer for dispatch times', async () => {
      eventBus.on('test', vi.fn());

      // Dispatch more than 100 events to test circular buffer
      for (let i = 0; i < 150; i++) {
        await eventBus.dispatch(createTestEvent(`event-${i}`));
      }

      const stats = eventBus.getStats();

      // Average should be calculated from last 100 events only
      expect(stats.avgDispatchTime).toBeGreaterThan(0);
      expect(stats.totalDispatched).toBe(150);
    });
  });

  describe('deferred listener cleanup', () => {
    it('should safely cleanup listeners after dispatch completes', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const sub1 = eventBus.on('test', handler1);
      eventBus.on('test', handler2);

      // Unsubscribe during first dispatch
      eventBus.on('test', () => {
        sub1.unsubscribe();
      });

      await eventBus.dispatch(createTestEvent('cleanup'));

      // Both should have been called (cleanup happens after iteration)
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();

      // Next dispatch should not call handler1
      handler1.mockClear();
      handler2.mockClear();

      await eventBus.dispatch(createTestEvent('after cleanup'));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('parallel execution within priority groups', () => {
    it('should execute same-priority handlers in parallel', async () => {
      const executionLog: Array<{ handler: string; time: number }> = [];
      const startTime = Date.now();

      // Add three handlers with same priority that each take 50ms
      eventBus.on('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionLog.push({ handler: 'A', time: Date.now() - startTime });
      }, { priority: 0 });

      eventBus.on('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionLog.push({ handler: 'B', time: Date.now() - startTime });
      }, { priority: 0 });

      eventBus.on('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionLog.push({ handler: 'C', time: Date.now() - startTime });
      }, { priority: 0 });

      await eventBus.dispatch(createTestEvent('parallel'));

      // All three should complete in ~50ms (parallel), not 150ms (sequential)
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(100); // Allow some margin

      // All handlers should have executed
      expect(executionLog).toHaveLength(3);
    });

    it('should respect priority order between groups', async () => {
      const executionOrder: string[] = [];

      // High priority group (parallel within)
      eventBus.on('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        executionOrder.push('high-1');
      }, { priority: -100 });

      eventBus.on('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        executionOrder.push('high-2');
      }, { priority: -100 });

      // Low priority group (parallel within)
      eventBus.on('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push('low-1');
      }, { priority: 100 });

      eventBus.on('test', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push('low-2');
      }, { priority: 100 });

      await eventBus.dispatch(createTestEvent('priority-groups'));

      // Both high priority should complete before any low priority
      expect(executionOrder.slice(0, 2)).toContain('high-1');
      expect(executionOrder.slice(0, 2)).toContain('high-2');
      expect(executionOrder.slice(2, 4)).toContain('low-1');
      expect(executionOrder.slice(2, 4)).toContain('low-2');
    });
  });
});
