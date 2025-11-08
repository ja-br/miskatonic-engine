import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DebugConsole } from '../src/DebugConsole';

// Mock CommandSystem
class MockCommandSystem {
  private commands: Map<string, any> = new Map();

  register(def: any) {
    this.commands.set(def.name, def);
  }

  async execute(command: string): Promise<void> {
    const parts = command.trim().split(/\s+/);
    const cmdName = parts[0];
    const cmd = this.commands.get(cmdName);

    if (!cmd) {
      throw new Error(`Unknown command: ${cmdName}`);
    }

    await cmd.execute();
  }

  getAllCommands() {
    return Array.from(this.commands.values());
  }
}

describe('DebugConsole (Simple)', () => {
  let debugConsole: DebugConsole;
  let commandSystem: MockCommandSystem;

  beforeEach(() => {
    commandSystem = new MockCommandSystem();

    // Register some test commands
    commandSystem.register({
      name: 'test',
      description: 'Test command',
      execute: async () => 'Test executed',
    });

    commandSystem.register({
      name: 'error',
      description: 'Error command',
      execute: async () => {
        throw new Error('Test error');
      },
    });

    // Create debug console
    debugConsole = new DebugConsole(commandSystem as any, {
      initiallyVisible: false,
      captureConsole: false,
      persistHistory: false,
    });
  });

  afterEach(() => {
    if (debugConsole) {
      debugConsole.shutdown();
    }
  });

  describe('initialization', () => {
    it('should create console', () => {
      expect(debugConsole).toBeDefined();
    });

    it('should initialize and create UI', () => {
      debugConsole.initialize();

      const consoleElement = document.getElementById('miskatonic-debug-console');
      expect(consoleElement).not.toBeNull();
    });

    it('should not be visible initially', () => {
      debugConsole.initialize();
      expect(debugConsole.isVisible()).toBe(false);
    });

    it('should log initialization message', () => {
      debugConsole.initialize();

      const logs = debugConsole.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].message).toContain('Debug console initialized');
    });
  });

  describe('show/hide/toggle', () => {
    beforeEach(() => {
      debugConsole.initialize();
    });

    it('should show console', () => {
      debugConsole.show();
      expect(debugConsole.isVisible()).toBe(true);
    });

    it('should hide console', () => {
      debugConsole.show();
      debugConsole.hide();
      expect(debugConsole.isVisible()).toBe(false);
    });

    it('should toggle visibility', () => {
      expect(debugConsole.isVisible()).toBe(false);

      debugConsole.toggle();
      expect(debugConsole.isVisible()).toBe(true);

      debugConsole.toggle();
      expect(debugConsole.isVisible()).toBe(false);
    });
  });

  describe('logging', () => {
    beforeEach(() => {
      debugConsole.initialize();
    });

    it('should log messages', () => {
      debugConsole.log('Test message', 'info');

      const logs = debugConsole.getLogs();
      const testLog = logs.find(l => l.message === 'Test message');

      expect(testLog).toBeDefined();
      expect(testLog?.level).toBe('info');
    });

    it('should default to info level', () => {
      debugConsole.log('Default level');

      const logs = debugConsole.getLogs();
      const testLog = logs.find(l => l.message === 'Default level');

      expect(testLog?.level).toBe('info');
    });

    it('should support all log levels', () => {
      debugConsole.log('Debug', 'debug');
      debugConsole.log('Info', 'info');
      debugConsole.log('Warn', 'warn');
      debugConsole.log('Error', 'error');

      const logs = debugConsole.getLogs();
      expect(logs.some(l => l.level === 'debug')).toBe(true);
      expect(logs.some(l => l.level === 'info')).toBe(true);
      expect(logs.some(l => l.level === 'warn')).toBe(true);
      expect(logs.some(l => l.level === 'error')).toBe(true);
    });

    it('should include timestamps', () => {
      const before = Date.now();
      debugConsole.log('Test');
      const after = Date.now();

      const logs = debugConsole.getLogs();
      const testLog = logs.find(l => l.message === 'Test');

      expect(testLog?.timestamp).toBeGreaterThanOrEqual(before);
      expect(testLog?.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      debugConsole.initialize();
    });

    it('should clear all logs', () => {
      debugConsole.log('Message 1');
      debugConsole.log('Message 2');

      debugConsole.clear();

      expect(debugConsole.getLogs()).toEqual([]);
    });
  });

  describe('executeCommand', () => {
    beforeEach(() => {
      debugConsole.initialize();
    });

    it('should execute registered command', async () => {
      await debugConsole.executeCommand('test');

      const logs = debugConsole.getLogs();
      expect(logs.some(l => l.message.includes('> test'))).toBe(true);
    });

    it('should add command to history', async () => {
      await debugConsole.executeCommand('test');

      const history = debugConsole.getHistory();
      expect(history).toContain('test');
    });

    it('should log errors from commands', async () => {
      await debugConsole.executeCommand('error');

      const logs = debugConsole.getLogs();
      const errorLog = logs.find(l => l.level === 'error');

      expect(errorLog).toBeDefined();
      expect(errorLog?.message).toContain('Test error');
    });

    it('should ignore empty commands', async () => {
      const logsBefore = debugConsole.getLogs().length;

      await debugConsole.executeCommand('');
      await debugConsole.executeCommand('   ');

      const logsAfter = debugConsole.getLogs().length;
      expect(logsAfter).toBe(logsBefore);
    });
  });

  describe('autocomplete', () => {
    beforeEach(() => {
      debugConsole.initialize();
    });

    it('should get suggestions for commands', () => {
      const suggestions = debugConsole.getSuggestions('te');
      expect(suggestions).toContain('test');
    });
  });
});
