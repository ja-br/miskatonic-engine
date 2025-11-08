/**
 * Tests for CommandSystem integration with MiskatonicEngine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { MiskatonicEngine } from '../../src/MiskatonicEngine';
import type { CommandDefinition } from '../../src/commands/types';

describe('CommandSystem (Integration)', () => {
  let engine: MiskatonicEngine;

  beforeEach(async () => {
    engine = await MiskatonicEngine.create({
      physics: null, // Disable physics for faster tests
    });
    await engine.initialize();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  describe('Built-in Commands', () => {
    it('should register built-in commands', () => {
      const commands = engine.commands.listCommands();

      expect(commands).toContain('help');
      expect(commands).toContain('echo');
      expect(commands).toContain('stats');
      expect(commands).toContain('clear');
      expect(commands).toContain('state');
      expect(commands).toContain('config');
      expect(commands).toContain('pause');
      expect(commands).toContain('resume');
    });

    it('should execute help command', async () => {
      const result = await engine.commands.execute('help', {});

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('categories');
    });

    it('should execute help for specific command', async () => {
      const result = await engine.commands.execute('help', { command: 'echo' });

      expect(result.success).toBe(true);
      expect(result.output).toMatchObject({
        name: 'echo',
        description: expect.any(String),
      });
    });

    it('should execute echo command', async () => {
      const result = await engine.commands.execute('echo', { message: 'Hello, World!' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello, World!');
    });

    it('should execute stats command', async () => {
      const result = await engine.commands.execute('stats', {});

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('fps');
      expect(result.output).toHaveProperty('frameTime');
    });

    it('should execute stats command with text format', async () => {
      const result = await engine.commands.execute('stats', { format: 'text' });

      expect(result.success).toBe(true);
      expect(typeof result.output).toBe('string');
      expect(result.output).toContain('FPS:');
    });

    it('should execute state command', async () => {
      const result = await engine.commands.execute('state', {});

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('state');
      expect(result.output.state).toBe('ready');
    });

    it('should execute config command', async () => {
      const result = await engine.commands.execute('config', {});

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('physics');
      expect(result.output).toHaveProperty('rendering');
      expect(result.output).toHaveProperty('network');
    });

    it('should execute config command for specific section', async () => {
      const result = await engine.commands.execute('config', { section: 'performance' });

      expect(result.success).toBe(true);
      expect(result.output).toHaveProperty('targetFPS');
    });

    it('should execute pause/resume commands', async () => {
      engine.start();

      const pauseResult = await engine.commands.execute('pause', {});
      expect(pauseResult.success).toBe(true);
      expect(engine.state).toBe('paused');

      const resumeResult = await engine.commands.execute('resume', {});
      expect(resumeResult.success).toBe(true);
      expect(engine.state).toBe('running');

      engine.stop();
    });

    it('should undo pause command', async () => {
      engine.start();

      await engine.commands.execute('pause', {});
      expect(engine.state).toBe('paused');

      const undoResult = await engine.commands.undo();
      expect(undoResult).not.toBeNull();
      expect(undoResult!.success).toBe(true);
      expect(engine.state).toBe('running');

      engine.stop();
    });

    it('should resolve echo alias', async () => {
      const result = await engine.commands.execute('print', { message: 'test' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('test');
    });
  });

  describe('Custom Commands', () => {
    it('should register custom command', () => {
      const command: CommandDefinition = {
        name: 'custom',
        description: 'Custom command',
        schema: z.object({ value: z.string() }),
        handler: (input) => ({
          success: true,
          output: `Processed: ${input.value}`,
          executionTime: 0,
        }),
      };

      engine.commands.register(command);

      expect(engine.commands.has('custom')).toBe(true);
    });

    it('should execute custom command', async () => {
      const command: CommandDefinition = {
        name: 'custom',
        description: 'Custom command',
        schema: z.object({ value: z.string() }),
        handler: (input) => ({
          success: true,
          output: `Processed: ${input.value}`,
          executionTime: 0,
        }),
      };

      engine.commands.register(command);

      const result = await engine.commands.execute('custom', { value: 'test' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Processed: test');
    });

    it('should unregister custom command', () => {
      const command: CommandDefinition = {
        name: 'custom',
        description: 'Custom command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      engine.commands.register(command);
      expect(engine.commands.has('custom')).toBe(true);

      engine.commands.unregister('custom');
      expect(engine.commands.has('custom')).toBe(false);
    });
  });

  describe('Command Events', () => {
    it('should emit command:registered event', async () => {
      const events: any[] = [];
      engine.events.on('command:registered', (event) => events.push(event));

      const command: CommandDefinition = {
        name: 'custom',
        description: 'Custom command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      engine.commands.register(command);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(events.length).toBeGreaterThan(0);
      const event = events.find(e => e.commandName === 'custom');
      expect(event).toBeDefined();
      expect(event.type).toBe('command:registered');
    });

    it('should emit command:executed event', async () => {
      const events: any[] = [];
      engine.events.on('command:executed', (event) => events.push(event));

      await engine.commands.execute('echo', { message: 'test' });

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toMatchObject({
        type: 'command:executed',
        commandName: 'echo',
        success: true,
      });
    });

    it('should emit command:validation-failed event', async () => {
      const events: any[] = [];
      engine.events.on('command:validation-failed', (event) => events.push(event));

      await engine.commands.execute('echo', { message: 123 }); // Invalid: number instead of string

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toMatchObject({
        type: 'command:validation-failed',
        commandName: 'echo',
      });
    });
  });

  describe('Command Queue', () => {
    it('should queue commands during game loop', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({ value: z.string() }),
        handler: (input) => ({
          success: true,
          output: input.value,
          executionTime: 0,
        }),
      };

      engine.commands.register(command);

      // Queue command
      const resultPromise = engine.commands.execute('test', { value: 'queued' }, { queued: true });

      expect(engine.commands.getQueueSize()).toBe(1);

      // Process queue manually (normally done by game loop)
      await engine.commands.processQueue();

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.output).toBe('queued');
    });

    it('should process queue automatically when engine running', async () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({
          success: true,
          output: 'executed',
          executionTime: 0,
        }),
      };

      engine.commands.register(command);

      // Start engine (this will process queue every frame)
      engine.start();

      // Queue command
      const resultPromise = engine.commands.execute('test', {}, { queued: true });

      // Wait for next frame to process queue
      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.output).toBe('executed');

      engine.stop();
    });
  });

  describe('History', () => {
    it('should track command history', async () => {
      await engine.commands.execute('echo', { message: 'first' });
      await engine.commands.execute('echo', { message: 'second' });

      const history = engine.commands.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);

      // Most recent first
      expect(history[0].input).toEqual({ message: 'second' });
      expect(history[1].input).toEqual({ message: 'first' });
    });

    it('should clear history with clear command', async () => {
      await engine.commands.execute('echo', { message: 'test' });

      const result = await engine.commands.execute('clear', {});
      expect(result.success).toBe(true);

      const history = engine.commands.getHistory();
      // History will contain only the 'clear' command itself
      expect(history.length).toBe(1);
      expect(history[0].command).toBe('clear');
    });
  });

  describe('Command Introspection', () => {
    it('should list all commands', () => {
      const commands = engine.commands.listCommands();
      expect(commands.length).toBeGreaterThan(0);
      expect(commands).toContain('help');
    });

    it('should list categories', () => {
      const categories = engine.commands.listCategories();
      expect(categories).toContain('system');
      expect(categories).toContain('debug');
    });

    it('should get commands by category', () => {
      const systemCommands = engine.commands.getCommandsByCategory('system');
      expect(systemCommands).toContain('help');
      expect(systemCommands).toContain('echo');
    });

    it('should get command info', () => {
      const info = engine.commands.getCommandInfo('help');
      expect(info).toBeDefined();
      expect(info!.name).toBe('help');
      expect(info!.category).toBe('system');
    });

    it('should get all command info', () => {
      const allInfo = engine.commands.getAllCommandInfo();
      expect(allInfo.length).toBeGreaterThan(0);
      expect(allInfo.every(info => info.name && info.description)).toBe(true);
    });
  });
});
