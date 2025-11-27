/**
 * Tests for CommandBus
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { CommandBus } from '../../src/commands/CommandBus';
import { CommandRegistry } from '../../src/commands/CommandRegistry';
import { EventBus } from '@miskatonic/events';
import type { CommandDefinition } from '../../src/commands/types';

describe('CommandBus', () => {
  let registry: CommandRegistry;
  let events: EventBus;
  let bus: CommandBus;

  beforeEach(() => {
    events = new EventBus(0);
    registry = new CommandRegistry(events);
    bus = new CommandBus(registry, events);
  });

  describe('execute', () => {
    it('should execute a command successfully', async () => {
      const handler = vi.fn(() => ({
        success: true,
        output: 'test output',
        executionTime: 0,
      }));

      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({ value: z.string() }),
        handler,
      };

      registry.register(command);

      const result = await bus.execute('test', { value: 'hello' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('test output');
      expect(handler).toHaveBeenCalledWith(
        { value: 'hello' },
        expect.objectContaining({ timestamp: expect.any(Number) })
      );
    });

    it('should fail for nonexistent command', async () => {
      const result = await bus.execute('nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe("Command 'nonexistent' not found");
    });

    it('should fail for invalid input', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({ value: z.string() }),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      const result = await bus.execute('test', { value: 123 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle command handler errors', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => {
          throw new Error('Handler error');
        },
      };

      registry.register(command);

      const result = await bus.execute('test', {});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Handler error');
    });

    it('should resolve aliases', async () => {
      const handler = vi.fn(() => ({ success: true, executionTime: 0 }));

      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler,
        aliases: ['t'],
      };

      registry.register(command);

      await bus.execute('t', {});

      expect(handler).toHaveBeenCalled();
    });

    it('should include execution time', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      const result = await bus.execute('test', {});

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should pass context metadata', async () => {
      const handler = vi.fn(() => ({ success: true, executionTime: 0 }));

      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler,
      };

      registry.register(command);

      await bus.execute('test', {}, {
        userId: 'user123',
        metadata: { source: 'console' },
      });

      expect(handler).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          userId: 'user123',
          metadata: { source: 'console' },
        })
      );
    });

    it('should emit command:executed event on success', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      const eventPromise = new Promise(resolve => {
        events.on('command:executed', resolve);
      });

      await bus.execute('test', {});

      const event = await eventPromise;
      expect(event).toMatchObject({
        type: 'command:executed',
        commandName: 'test',
        success: true,
      });
    });

    it('should emit command:failed event on failure', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => {
          throw new Error('Test error');
        },
      };

      registry.register(command);

      const eventPromise = new Promise(resolve => {
        events.on('command:failed', resolve);
      });

      await bus.execute('test', {});

      const event = await eventPromise;
      expect(event).toMatchObject({
        type: 'command:failed',
        commandName: 'test',
        error: 'Test error',
      });
    });

    it('should emit command:validation-failed event on validation error', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({ value: z.string() }),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      const eventPromise = new Promise(resolve => {
        events.on('command:validation-failed', resolve);
      });

      await bus.execute('test', { value: 123 });

      const event = await eventPromise;
      expect(event).toMatchObject({
        type: 'command:validation-failed',
        commandName: 'test',
      });
    });
  });

  describe('queue', () => {
    it('should queue commands for later execution', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, output: 'done', executionTime: 0 }),
      };

      registry.register(command);

      const resultPromise = bus.execute('test', {}, { queued: true });

      expect(bus.getQueueSize()).toBe(1);

      await bus.processQueue();

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.output).toBe('done');
      expect(bus.getQueueSize()).toBe(0);
    });

    it('should process multiple queued commands', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      const promise1 = bus.execute('test', {}, { queued: true });
      const promise2 = bus.execute('test', {}, { queued: true });
      const promise3 = bus.execute('test', {}, { queued: true });

      expect(bus.getQueueSize()).toBe(3);

      const count = await bus.processQueue();

      expect(count).toBe(3);
      expect(bus.getQueueSize()).toBe(0);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
    });
  });

  describe('history', () => {
    it('should track command history', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({ value: z.string() }),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      await bus.execute('test', { value: 'hello' });

      const history = bus.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        command: 'test',
        input: { value: 'hello' },
      });
    });

    it('should return history in reverse order', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({ value: z.number() }),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      await bus.execute('test', { value: 1 });
      await bus.execute('test', { value: 2 });
      await bus.execute('test', { value: 3 });

      const history = bus.getHistory();
      expect(history[0].input).toEqual({ value: 3 });
      expect(history[1].input).toEqual({ value: 2 });
      expect(history[2].input).toEqual({ value: 1 });
    });

    it('should limit history size', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);
      bus.setMaxHistorySize(2);

      await bus.execute('test', {});
      await bus.execute('test', {});
      await bus.execute('test', {});

      const history = bus.getHistory();
      expect(history).toHaveLength(2);
    });

    it('should clear history', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      await bus.execute('test', {});
      bus.clearHistory();

      expect(bus.getHistory()).toHaveLength(0);
    });
  });

  describe('undo', () => {
    it('should undo undoable command', async () => {
      const undoHandler = vi.fn(() => ({ success: true, executionTime: 0 }));

      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({ value: z.string() }),
        handler: () => ({ success: true, executionTime: 0 }),
        undoable: true,
        undo: undoHandler,
      };

      registry.register(command);

      await bus.execute('test', { value: 'hello' });

      const result = await bus.undo();

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(undoHandler).toHaveBeenCalledWith(
        { value: 'hello' },
        expect.objectContaining({ timestamp: expect.any(Number) })
      );
    });

    it('should return null if nothing to undo', async () => {
      const result = await bus.undo();
      expect(result).toBeNull();
    });

    it('should skip non-undoable commands', async () => {
      const command1: CommandDefinition = {
        name: 'test1',
        description: 'Test command 1',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        undoable: false,
      };

      const undoHandler = vi.fn(() => ({ success: true, executionTime: 0 }));

      const command2: CommandDefinition = {
        name: 'test2',
        description: 'Test command 2',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        undoable: true,
        undo: undoHandler,
      };

      registry.register(command1);
      registry.register(command2);

      await bus.execute('test2', {});
      await bus.execute('test1', {});

      const result = await bus.undo();

      expect(result).not.toBeNull();
      expect(undoHandler).toHaveBeenCalled();
    });

    it('should handle undo errors', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        undoable: true,
        undo: () => {
          throw new Error('Undo failed');
        },
      };

      registry.register(command);

      await bus.execute('test', {});

      const result = await bus.undo();

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.error).toBe('Undo failed');
    });
  });
});
