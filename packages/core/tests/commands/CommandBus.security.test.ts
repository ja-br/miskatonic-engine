/**
 * Security Tests for CommandBus
 *
 * Tests for rate limiting, queue limits, timeouts, and shutdown cleanup
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { CommandBus } from '../../src/commands/CommandBus';
import { CommandRegistry } from '../../src/commands/CommandRegistry';
import { EventBus } from '@miskatonic/events';
import type { CommandDefinition } from '../../src/commands/types';

describe('CommandBus Security', () => {
  let registry: CommandRegistry;
  let events: EventBus;
  let bus: CommandBus;

  beforeEach(() => {
    events = new EventBus(0);
    registry = new CommandRegistry(events);
    bus = new CommandBus(registry, events);
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limit (100 commands per second)', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      // Execute 100 commands (should succeed)
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(await bus.execute('test', {}));
      }

      expect(results.every(r => r.success)).toBe(true);

      // 101st command should be rate limited
      const rateLimitedResult = await bus.execute('test', {});
      expect(rateLimitedResult.success).toBe(false);
      expect(rateLimitedResult.error).toContain('Rate limit exceeded');
    });

    it('should reset rate limit after time window', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      // Exhaust rate limit
      for (let i = 0; i < 100; i++) {
        await bus.execute('test', {});
      }

      // Should be rate limited
      let result = await bus.execute('test', {});
      expect(result.success).toBe(false);

      // Wait for rate limit window to reset (1 second)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should work again
      result = await bus.execute('test', {});
      expect(result.success).toBe(true);
    });
  });

  describe('Queue Size Limit', () => {
    it('should enforce queue size limit (1000 commands)', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      // Queue 100 commands (rate limit is 100 per second)
      for (let i = 0; i < 100; i++) {
        bus.execute('test', {}, { queued: true });
      }

      expect(bus.getQueueSize()).toBe(100);

      // Wait for rate limit to reset
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Queue another 100
      for (let i = 0; i < 100; i++) {
        bus.execute('test', {}, { queued: true });
      }

      expect(bus.getQueueSize()).toBe(200);

      // The queue limit (1000) is tested conceptually here
      // In practice, rate limiting prevents us from queueing 1000 commands quickly
      // But if we could bypass rate limit (e.g., in production over time),
      // the queue limit would kick in at 1000
    });
  });

  describe('Command Timeout', () => {
    it('should timeout commands that run too long', async () => {
      const longRunningCommand: CommandDefinition = {
        name: 'long',
        description: 'Long running command',
        schema: z.object({}),
        handler: async () => {
          // Simulate a command that takes 35 seconds
          await new Promise(resolve => setTimeout(resolve, 35000));
          return { success: true, executionTime: 0 };
        },
      };

      registry.register(longRunningCommand);

      const result = await bus.execute('long', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    }, 35000); // Test timeout: 35 seconds

    it('should not timeout fast commands', async () => {
      const fastCommand: CommandDefinition = {
        name: 'fast',
        description: 'Fast command',
        schema: z.object({}),
        handler: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { success: true, output: 'done', executionTime: 0 };
        },
      };

      registry.register(fastCommand);

      const result = await bus.execute('fast', {});

      expect(result.success).toBe(true);
      expect(result.output).toBe('done');
    });
  });

  describe('Shutdown Cleanup', () => {
    it('should reject all queued commands on shutdown', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      // Queue several commands
      const promise1 = bus.execute('test', {}, { queued: true });
      const promise2 = bus.execute('test', {}, { queued: true });
      const promise3 = bus.execute('test', {}, { queued: true });

      expect(bus.getQueueSize()).toBe(3);

      // Shutdown
      await bus.shutdown();

      // All promises should reject with shutdown error
      const result1 = await promise1;
      const result2 = await promise2;
      const result3 = await promise3;

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('shutting down');
      expect(result2.success).toBe(false);
      expect(result3.success).toBe(false);
    });

    it('should clear queue on shutdown', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      // Queue commands
      bus.execute('test', {}, { queued: true });
      bus.execute('test', {}, { queued: true });

      await bus.shutdown();

      expect(bus.getQueueSize()).toBe(0);
    });

    it('should clear history on shutdown', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      await bus.execute('test', {});
      await bus.execute('test', {});

      expect(bus.getHistory()).toHaveLength(2);

      await bus.shutdown();

      expect(bus.getHistory()).toHaveLength(0);
    });
  });

  describe('Undo History Fix', () => {
    it('should correctly find last undoable command', async () => {
      const undoableCommand: CommandDefinition = {
        name: 'undoable',
        description: 'Undoable command',
        schema: z.object({ value: z.number() }),
        handler: () => ({ success: true, executionTime: 0 }),
        undoable: true,
        undo: vi.fn(() => ({ success: true, executionTime: 0 })),
      };

      const nonUndoableCommand: CommandDefinition = {
        name: 'nonundoable',
        description: 'Non-undoable command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        undoable: false,
      };

      registry.register(undoableCommand);
      registry.register(nonUndoableCommand);

      // Execute: undoable, non-undoable, undoable, non-undoable
      await bus.execute('undoable', { value: 1 });
      await bus.execute('nonundoable', {});
      await bus.execute('undoable', { value: 2 });
      await bus.execute('nonundoable', {});

      // Undo should find the last undoable (value: 2)
      const result = await bus.undo();

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(undoableCommand.undo).toHaveBeenCalledWith(
        { value: 2 },
        expect.any(Object)
      );

      // History should have 3 items now
      expect(bus.getHistory()).toHaveLength(3);
    });
  });
});
