/**
 * Autocomplete Engine
 *
 * Provides command and parameter autocomplete suggestions
 * based on registered commands and current input.
 */

import type { AutocompleteSuggestion } from './types';

export class Autocomplete {
  private commands: Map<string, string> = new Map(); // command -> description

  /**
   * Register a command for autocomplete
   */
  registerCommand(name: string, description?: string): void {
    this.commands.set(name, description || '');
  }

  /**
   * Unregister a command from autocomplete
   */
  unregisterCommand(name: string): void {
    this.commands.delete(name);
  }

  /**
   * Get suggestions for the given input
   *
   * @param input - Current input text
   * @returns Array of autocomplete suggestions
   */
  getSuggestions(input: string): AutocompleteSuggestion[] {
    const trimmed = input.trim();

    if (!trimmed) {
      return [];
    }

    // Extract command and arguments
    const parts = trimmed.split(/\s+/);
    const commandPart = parts[0];

    // If only typing command name (no space yet), suggest commands
    if (parts.length === 1) {
      return this.getCommandSuggestions(commandPart);
    }

    // If command + space, could suggest parameters in future
    // For now, just return empty (parameters are command-specific)
    return [];
  }

  /**
   * Get command suggestions matching the prefix
   */
  private getCommandSuggestions(prefix: string): AutocompleteSuggestion[] {
    const suggestions: AutocompleteSuggestion[] = [];

    for (const [command, description] of this.commands.entries()) {
      if (command.startsWith(prefix)) {
        suggestions.push({
          text: command,
          description,
          type: 'command',
        });
      }
    }

    // Sort by length (shorter commands first), then alphabetically
    suggestions.sort((a, b) => {
      const lenDiff = a.text.length - b.text.length;
      if (lenDiff !== 0) return lenDiff;
      return a.text.localeCompare(b.text);
    });

    return suggestions;
  }

  /**
   * Get the best autocomplete match for Tab completion
   *
   * Returns the shortest matching command, or null if no match.
   */
  getTabCompletion(input: string): string | null {
    const trimmed = input.trim();

    if (!trimmed) {
      return null;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      return null; // Only complete command names, not parameters
    }

    const suggestions = this.getCommandSuggestions(parts[0]);

    if (suggestions.length === 0) {
      return null;
    }

    // If there's exactly one match, return it
    if (suggestions.length === 1) {
      return suggestions[0].text;
    }

    // If multiple matches, find common prefix
    const first = suggestions[0].text;
    const last = suggestions[suggestions.length - 1].text;

    let commonLength = 0;
    while (
      commonLength < first.length &&
      commonLength < last.length &&
      first[commonLength] === last[commonLength]
    ) {
      commonLength++;
    }

    const commonPrefix = first.substring(0, commonLength);

    // Only return if common prefix is longer than input
    if (commonPrefix.length > parts[0].length) {
      return commonPrefix;
    }

    return null;
  }

  /**
   * Get all registered commands
   */
  getAllCommands(): string[] {
    return Array.from(this.commands.keys()).sort();
  }

  /**
   * Clear all registered commands
   */
  clear(): void {
    this.commands.clear();
  }
}
