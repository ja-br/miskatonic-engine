import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandHistory } from '../src/CommandHistory';

describe('CommandHistory', () => {
  let history: CommandHistory;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    history = new CommandHistory(5, 'test:history', false); // Disable persistence for tests
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('add', () => {
    it('should add commands to history', () => {
      history.add('command1');
      history.add('command2');
      history.add('command3');

      expect(history.getAll()).toEqual(['command1', 'command2', 'command3']);
    });

    it('should not add empty commands', () => {
      history.add('');
      history.add('   ');

      expect(history.getAll()).toEqual([]);
    });

    it('should not add duplicate consecutive commands', () => {
      history.add('command1');
      history.add('command1');
      history.add('command2');
      history.add('command2');

      expect(history.getAll()).toEqual(['command1', 'command2']);
    });

    it('should maintain max size (circular buffer)', () => {
      history.add('cmd1');
      history.add('cmd2');
      history.add('cmd3');
      history.add('cmd4');
      history.add('cmd5');
      history.add('cmd6'); // Should remove cmd1

      expect(history.getAll()).toEqual(['cmd2', 'cmd3', 'cmd4', 'cmd5', 'cmd6']);
    });

    it('should reset navigation index when adding', () => {
      history.add('cmd1');
      history.add('cmd2');

      // Navigate up
      history.previous('');

      // Add new command should reset
      history.add('cmd3');

      // previous() should start from end again
      const prev = history.previous('');
      expect(prev).toBe('cmd3');
    });
  });

  describe('previous', () => {
    beforeEach(() => {
      history.add('cmd1');
      history.add('cmd2');
      history.add('cmd3');
    });

    it('should return null if history is empty', () => {
      const emptyHistory = new CommandHistory(5, 'test', false);
      expect(emptyHistory.previous('')).toBeNull();
    });

    it('should navigate backwards through history', () => {
      expect(history.previous('')).toBe('cmd3');
      expect(history.previous('')).toBe('cmd2');
      expect(history.previous('')).toBe('cmd1');
    });

    it('should return null when at start of history', () => {
      history.previous('');
      history.previous('');
      history.previous('');
      expect(history.previous('')).toBeNull();
    });

    it('should save current input on first navigation', () => {
      history.previous('my input');

      // Navigate forward should return saved input
      const result = history.next();
      expect(result).toBe('my input');
    });
  });

  describe('next', () => {
    beforeEach(() => {
      history.add('cmd1');
      history.add('cmd2');
      history.add('cmd3');
    });

    it('should return null if not navigating', () => {
      expect(history.next()).toBeNull();
    });

    it('should navigate forwards through history', () => {
      history.previous('');
      history.previous('');
      history.previous('');

      expect(history.next()).toBe('cmd2');
      expect(history.next()).toBe('cmd3');
    });

    it('should return temporary command at end', () => {
      const temp = 'my input';
      history.previous(temp);
      history.previous(temp);

      history.next();
      const result = history.next();

      expect(result).toBe(temp);
    });

    it('should reset navigation after reaching end', () => {
      history.previous('');
      history.next();
      history.next();

      // Should be out of navigation mode
      expect(history.next()).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset navigation state', () => {
      history.add('cmd1');
      history.previous('input');

      history.reset();

      expect(history.next()).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return copy of history', () => {
      history.add('cmd1');
      const all = history.getAll();

      all.push('cmd2');

      expect(history.getAll()).toEqual(['cmd1']);
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      history.add('cmd1');
      history.add('cmd2');

      history.clear();

      expect(history.getAll()).toEqual([]);
    });

    it('should reset navigation state', () => {
      history.add('cmd1');
      history.previous('');

      history.clear();

      expect(history.next()).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      history.add('spawn entity');
      history.add('spawn player');
      history.add('list entities');
      history.add('destroy entity');
    });

    it('should find commands matching prefix', () => {
      const results = history.search('spawn');
      expect(results).toEqual(['spawn entity', 'spawn player']);
    });

    it('should return empty array for no matches', () => {
      const results = history.search('unknown');
      expect(results).toEqual([]);
    });

    it('should return empty array for empty prefix', () => {
      const results = history.search('');
      expect(results).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('should save to localStorage when enabled', () => {
      const persistentHistory = new CommandHistory(5, 'test:persist', true);

      persistentHistory.add('cmd1');
      persistentHistory.add('cmd2');

      const stored = localStorage.getItem('test:persist');
      expect(stored).toBe(JSON.stringify(['cmd1', 'cmd2']));
    });

    it('should load from localStorage when enabled', () => {
      localStorage.setItem('test:load', JSON.stringify(['cmd1', 'cmd2', 'cmd3']));

      const loadedHistory = new CommandHistory(5, 'test:load', true);

      expect(loadedHistory.getAll()).toEqual(['cmd1', 'cmd2', 'cmd3']);
    });

    it('should not save when disabled', () => {
      history.add('cmd1');

      const stored = localStorage.getItem('test:history');
      expect(stored).toBeNull();
    });

    it('should respect max size when loading', () => {
      localStorage.setItem('test:maxsize', JSON.stringify(['cmd1', 'cmd2', 'cmd3', 'cmd4', 'cmd5', 'cmd6']));

      const limitedHistory = new CommandHistory(3, 'test:maxsize', true);

      expect(limitedHistory.getAll()).toEqual(['cmd4', 'cmd5', 'cmd6']);
    });

    it('should handle corrupt localStorage data', () => {
      localStorage.setItem('test:corrupt', 'not json');

      const loadedHistory = new CommandHistory(5, 'test:corrupt', true);

      // Should silently fail and return empty history
      expect(loadedHistory.getAll()).toEqual([]);
    });
  });
});
