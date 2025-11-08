/**
 * Tests for CommandRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { CommandRegistry } from '../../src/commands/CommandRegistry';
import type { CommandDefinition } from '../../src/commands/types';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('register', () => {
    it('should register a command', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')).toBe(command);
    });

    it('should register a command with aliases', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        aliases: ['t', 'tst'],
      };

      registry.register(command);

      expect(registry.has('test')).toBe(true);
      expect(registry.has('t')).toBe(true);
      expect(registry.has('tst')).toBe(true);
      expect(registry.get('t')).toBe(command);
      expect(registry.get('tst')).toBe(command);
    });

    it('should register a command with category', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        category: 'debug',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      expect(registry.getCommandsByCategory('debug')).toContain('test');
      expect(registry.listCategories()).toContain('debug');
    });

    it('should throw error if command name already registered', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      expect(() => registry.register(command)).toThrow(
        "Command 'test' is already registered"
      );
    });

    it('should throw error if alias conflicts with command name', () => {
      const command1: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      const command2: CommandDefinition = {
        name: 'other',
        description: 'Other command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        aliases: ['test'],
      };

      registry.register(command1);

      expect(() => registry.register(command2)).toThrow(
        "Alias 'test' conflicts with existing command or alias"
      );
    });

    it('should throw error if alias conflicts with another alias', () => {
      const command1: CommandDefinition = {
        name: 'test1',
        description: 'Test command 1',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        aliases: ['t'],
      };

      const command2: CommandDefinition = {
        name: 'test2',
        description: 'Test command 2',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        aliases: ['t'],
      };

      registry.register(command1);

      expect(() => registry.register(command2)).toThrow(
        "Alias 't' conflicts with existing command or alias"
      );
    });
  });

  describe('unregister', () => {
    it('should unregister a command', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);
      const result = registry.unregister('test');

      expect(result).toBe(true);
      expect(registry.has('test')).toBe(false);
    });

    it('should unregister a command with aliases', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        aliases: ['t', 'tst'],
      };

      registry.register(command);
      registry.unregister('test');

      expect(registry.has('test')).toBe(false);
      expect(registry.has('t')).toBe(false);
      expect(registry.has('tst')).toBe(false);
    });

    it('should unregister a command from category', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        category: 'debug',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);
      registry.unregister('test');

      expect(registry.getCommandsByCategory('debug')).not.toContain('test');
      expect(registry.listCategories()).not.toContain('debug');
    });

    it('should return false if command not found', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should get command by name', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      expect(registry.get('test')).toBe(command);
    });

    it('should get command by alias', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
        aliases: ['t'],
      };

      registry.register(command);

      expect(registry.get('t')).toBe(command);
    });

    it('should return undefined if command not found', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('listCommands', () => {
    it('should list all registered commands', () => {
      const command1: CommandDefinition = {
        name: 'test1',
        description: 'Test command 1',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      const command2: CommandDefinition = {
        name: 'test2',
        description: 'Test command 2',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command1);
      registry.register(command2);

      const commands = registry.listCommands();
      expect(commands).toContain('test1');
      expect(commands).toContain('test2');
    });
  });

  describe('getCommandsByCategory', () => {
    it('should get commands in category', () => {
      const command1: CommandDefinition = {
        name: 'test1',
        description: 'Test command 1',
        category: 'debug',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      const command2: CommandDefinition = {
        name: 'test2',
        description: 'Test command 2',
        category: 'debug',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      const command3: CommandDefinition = {
        name: 'test3',
        description: 'Test command 3',
        category: 'system',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command1);
      registry.register(command2);
      registry.register(command3);

      const debugCommands = registry.getCommandsByCategory('debug');
      expect(debugCommands).toContain('test1');
      expect(debugCommands).toContain('test2');
      expect(debugCommands).not.toContain('test3');
    });

    it('should return empty array for nonexistent category', () => {
      expect(registry.getCommandsByCategory('nonexistent')).toEqual([]);
    });
  });

  describe('getInfo', () => {
    it('should get command info', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        category: 'debug',
        aliases: ['t'],
        undoable: true,
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);

      const info = registry.getInfo('test');
      expect(info).toEqual({
        name: 'test',
        description: 'Test command',
        category: 'debug',
        aliases: ['t'],
        undoable: true,
      });
    });

    it('should return undefined for nonexistent command', () => {
      expect(registry.getInfo('nonexistent')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all commands', () => {
      const command: CommandDefinition = {
        name: 'test',
        description: 'Test command',
        schema: z.object({}),
        handler: () => ({ success: true, executionTime: 0 }),
      };

      registry.register(command);
      registry.clear();

      expect(registry.listCommands()).toEqual([]);
      expect(registry.has('test')).toBe(false);
    });
  });
});
