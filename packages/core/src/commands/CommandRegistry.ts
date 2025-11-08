/**
 * CommandRegistry - Central command registration and lookup
 *
 * Manages command definitions with:
 * - Name-based lookup
 * - Alias resolution
 * - Category grouping
 * - Command introspection
 */

import type { EventBus } from '../../../events/src';
import type {
  CommandDefinition,
  CommandInfo,
} from './types';

/**
 * Command Registry
 *
 * Central registry for all commands in the system.
 * Supports aliases, categories, and introspection.
 */
export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private aliases = new Map<string, string>(); // alias -> command name
  private categories = new Map<string, Set<string>>(); // category -> command names

  constructor(private events?: EventBus) {}

  /**
   * Register a command
   *
   * @param definition - Command definition
   * @throws Error if command name already registered
   */
  register(definition: CommandDefinition): void {
    // Check for duplicate
    if (this.commands.has(definition.name)) {
      throw new Error(`Command '${definition.name}' is already registered`);
    }

    // Check for alias conflicts
    const aliases = definition.aliases || [];
    for (const alias of aliases) {
      if (this.commands.has(alias) || this.aliases.has(alias)) {
        throw new Error(`Alias '${alias}' conflicts with existing command or alias`);
      }
    }

    // Register command
    this.commands.set(definition.name, definition);

    // Register aliases
    for (const alias of aliases) {
      this.aliases.set(alias, definition.name);
    }

    // Register category
    if (definition.category) {
      if (!this.categories.has(definition.category)) {
        this.categories.set(definition.category, new Set());
      }
      this.categories.get(definition.category)!.add(definition.name);
    }

    // Emit event
    this.events?.emit({
      type: 'command:registered',
      timestamp: Date.now(),
      commandName: definition.name,
    });
  }

  /**
   * Unregister a command
   *
   * @param name - Command name
   * @returns true if command was unregistered, false if not found
   */
  unregister(name: string): boolean {
    const definition = this.commands.get(name);
    if (!definition) {
      return false;
    }

    // Remove command
    this.commands.delete(name);

    // Remove aliases
    const aliases = definition.aliases || [];
    for (const alias of aliases) {
      this.aliases.delete(alias);
    }

    // Remove from category
    if (definition.category) {
      const categoryCommands = this.categories.get(definition.category);
      if (categoryCommands) {
        categoryCommands.delete(name);
        // Clean up empty categories
        if (categoryCommands.size === 0) {
          this.categories.delete(definition.category);
        }
      }
    }

    // Emit event
    this.events?.emit({
      type: 'command:unregistered',
      timestamp: Date.now(),
      commandName: name,
    });

    return true;
  }

  /**
   * Get a command definition by name or alias
   *
   * @param nameOrAlias - Command name or alias
   * @returns Command definition or undefined if not found
   */
  get(nameOrAlias: string): CommandDefinition | undefined {
    // Try direct lookup
    const direct = this.commands.get(nameOrAlias);
    if (direct) {
      return direct;
    }

    // Try alias lookup
    const resolvedName = this.aliases.get(nameOrAlias);
    if (resolvedName) {
      return this.commands.get(resolvedName);
    }

    return undefined;
  }

  /**
   * Check if a command is registered
   *
   * @param nameOrAlias - Command name or alias
   */
  has(nameOrAlias: string): boolean {
    return this.commands.has(nameOrAlias) || this.aliases.has(nameOrAlias);
  }

  /**
   * Get all registered commands
   *
   * @returns Array of command names
   */
  listCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * Get all commands in a category
   *
   * @param category - Category name
   * @returns Array of command names in the category
   */
  getCommandsByCategory(category: string): string[] {
    const commandNames = this.categories.get(category);
    return commandNames ? Array.from(commandNames) : [];
  }

  /**
   * Get all categories
   *
   * @returns Array of category names
   */
  listCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get command info for introspection
   *
   * @param nameOrAlias - Command name or alias
   * @returns Command info or undefined if not found
   */
  getInfo(nameOrAlias: string): CommandInfo | undefined {
    const definition = this.get(nameOrAlias);
    if (!definition) {
      return undefined;
    }

    return {
      name: definition.name,
      description: definition.description,
      category: definition.category,
      aliases: definition.aliases || [],
      undoable: definition.undoable || false,
    };
  }

  /**
   * Get all command info
   *
   * @returns Array of command info for all registered commands
   */
  getAllInfo(): CommandInfo[] {
    return Array.from(this.commands.values()).map(def => ({
      name: def.name,
      description: def.description,
      category: def.category,
      aliases: def.aliases || [],
      undoable: def.undoable || false,
    }));
  }

  /**
   * Clear all registered commands
   */
  clear(): void {
    this.commands.clear();
    this.aliases.clear();
    this.categories.clear();
  }
}
