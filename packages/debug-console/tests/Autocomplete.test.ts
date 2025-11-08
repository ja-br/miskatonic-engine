import { describe, it, expect, beforeEach } from 'vitest';
import { Autocomplete } from '../src/Autocomplete';

describe('Autocomplete', () => {
  let autocomplete: Autocomplete;

  beforeEach(() => {
    autocomplete = new Autocomplete();

    // Register some test commands
    autocomplete.registerCommand('spawn', 'Spawn an entity');
    autocomplete.registerCommand('destroy', 'Destroy an entity');
    autocomplete.registerCommand('list', 'List entities');
    autocomplete.registerCommand('help', 'Show help');
    autocomplete.registerCommand('clear', 'Clear console');
    autocomplete.registerCommand('spawner', 'Spawner system');
  });

  describe('registerCommand', () => {
    it('should register a command', () => {
      autocomplete.registerCommand('test', 'Test command');
      const all = autocomplete.getAllCommands();
      expect(all).toContain('test');
    });

    it('should register without description', () => {
      autocomplete.registerCommand('test');
      const all = autocomplete.getAllCommands();
      expect(all).toContain('test');
    });
  });

  describe('unregisterCommand', () => {
    it('should remove a registered command', () => {
      autocomplete.unregisterCommand('help');
      const all = autocomplete.getAllCommands();
      expect(all).not.toContain('help');
    });

    it('should handle unregistering non-existent command', () => {
      expect(() => {
        autocomplete.unregisterCommand('nonexistent');
      }).not.toThrow();
    });
  });

  describe('getSuggestions', () => {
    it('should return empty array for empty input', () => {
      const suggestions = autocomplete.getSuggestions('');
      expect(suggestions).toEqual([]);
    });

    it('should return matching commands for prefix', () => {
      const suggestions = autocomplete.getSuggestions('sp');
      expect(suggestions).toHaveLength(2);
      expect(suggestions.map(s => s.text)).toContain('spawn');
      expect(suggestions.map(s => s.text)).toContain('spawner');
    });

    it('should return all matching commands', () => {
      const suggestions = autocomplete.getSuggestions('s');
      expect(suggestions.map(s => s.text)).toContain('spawn');
      expect(suggestions.map(s => s.text)).toContain('spawner');
    });

    it('should return empty for no matches', () => {
      const suggestions = autocomplete.getSuggestions('xyz');
      expect(suggestions).toEqual([]);
    });

    it('should sort by length then alphabetically', () => {
      const suggestions = autocomplete.getSuggestions('sp');
      expect(suggestions[0].text).toBe('spawn'); // Shorter comes first
      expect(suggestions[1].text).toBe('spawner');
    });

    it('should include descriptions in suggestions', () => {
      const suggestions = autocomplete.getSuggestions('help');
      expect(suggestions[0].description).toBe('Show help');
    });

    it('should only suggest command names, not parameters', () => {
      const suggestions = autocomplete.getSuggestions('spawn entity');
      expect(suggestions).toEqual([]); // No parameter suggestions yet
    });

    it('should be case-sensitive', () => {
      const suggestions = autocomplete.getSuggestions('Spawn');
      expect(suggestions).toEqual([]);
    });
  });

  describe('getTabCompletion', () => {
    it('should return null for empty input', () => {
      const completion = autocomplete.getTabCompletion('');
      expect(completion).toBeNull();
    });

    it('should complete exact match', () => {
      const completion = autocomplete.getTabCompletion('hel');
      expect(completion).toBe('help');
    });

    it('should return common prefix for multiple matches', () => {
      const completion = autocomplete.getTabCompletion('sp');
      expect(completion).toBe('spawn'); // Common prefix of spawn/spawner
    });

    it('should return null if no longer prefix available', () => {
      const completion = autocomplete.getTabCompletion('spawn');
      expect(completion).toBeNull(); // Already at 'spawn', can't extend further
    });

    it('should return null for no matches', () => {
      const completion = autocomplete.getTabCompletion('xyz');
      expect(completion).toBeNull();
    });

    it('should not complete with parameters present', () => {
      const completion = autocomplete.getTabCompletion('spawn entity');
      expect(completion).toBeNull();
    });

    it('should return single match', () => {
      const completion = autocomplete.getTabCompletion('li');
      expect(completion).toBe('list');
    });
  });

  describe('getAllCommands', () => {
    it('should return all registered commands sorted', () => {
      const all = autocomplete.getAllCommands();
      expect(all).toEqual(['clear', 'destroy', 'help', 'list', 'spawn', 'spawner']);
    });

    it('should return empty array when no commands registered', () => {
      const empty = new Autocomplete();
      expect(empty.getAllCommands()).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all commands', () => {
      autocomplete.clear();
      expect(autocomplete.getAllCommands()).toEqual([]);
    });

    it('should allow re-registering after clear', () => {
      autocomplete.clear();
      autocomplete.registerCommand('test');
      expect(autocomplete.getAllCommands()).toEqual(['test']);
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace in input', () => {
      const suggestions = autocomplete.getSuggestions('  spawn  ');
      expect(suggestions.map(s => s.text)).toContain('spawn');
    });

    it('should handle multiple spaces between command and args', () => {
      const suggestions = autocomplete.getSuggestions('spawn    entity');
      expect(suggestions).toEqual([]);
    });

    it('should handle single character commands', () => {
      autocomplete.registerCommand('a');
      const suggestions = autocomplete.getSuggestions('a');
      expect(suggestions[0].text).toBe('a');
    });

    it('should handle long command names', () => {
      const longName = 'a'.repeat(100);
      autocomplete.registerCommand(longName);
      const suggestions = autocomplete.getSuggestions('a');
      expect(suggestions.map(s => s.text)).toContain(longName);
    });
  });
});
