/**
 * CommandSystem - Main command system manager
 *
 * Integrates CommandRegistry and CommandBus with the engine.
 * Provides a unified API for command registration and execution.
 */

import type { EventBus } from '@miskatonic/events';
import { CommandBus } from './CommandBus';
import { CommandRegistry } from './CommandRegistry';
import type {
  CommandDefinition,
  CommandExecutionOptions,
  CommandHistoryEntry,
  CommandInfo,
  CommandResult,
} from './types';

/**
 * Command System
 *
 * Main entry point for the command system.
 * Coordinates registry and bus, provides unified API.
 */
export class CommandSystem {
  private registry: CommandRegistry;
  private bus: CommandBus;

  constructor(events?: EventBus) {
    this.registry = new CommandRegistry(events);
    this.bus = new CommandBus(this.registry, events);
  }

  /**
   * Register a command
   *
   * @param definition - Command definition
   * @throws Error if command name already registered
   */
  register(definition: CommandDefinition): void {
    this.registry.register(definition);
  }

  /**
   * Register multiple commands
   *
   * @param definitions - Array of command definitions
   */
  registerMany(definitions: CommandDefinition[]): void {
    for (const definition of definitions) {
      this.registry.register(definition);
    }
  }

  /**
   * Unregister a command
   *
   * @param name - Command name
   * @returns true if command was unregistered, false if not found
   */
  unregister(name: string): boolean {
    return this.registry.unregister(name);
  }

  /**
   * Execute a command
   *
   * @param command - Command name or alias
   * @param input - Command input (will be validated)
   * @param options - Execution options
   * @returns Command result
   */
  async execute<TInput = unknown, TOutput = unknown>(
    command: string,
    input: TInput,
    options?: CommandExecutionOptions
  ): Promise<CommandResult<TOutput>> {
    return this.bus.execute<TInput, TOutput>(command, input, options);
  }

  /**
   * Process queued commands
   *
   * Call this once per frame to execute queued commands.
   *
   * @returns Number of commands processed
   */
  async processQueue(): Promise<number> {
    return this.bus.processQueue();
  }

  /**
   * Check if a command is registered
   *
   * @param nameOrAlias - Command name or alias
   */
  has(nameOrAlias: string): boolean {
    return this.registry.has(nameOrAlias);
  }

  /**
   * Get command info for introspection
   *
   * @param nameOrAlias - Command name or alias
   * @returns Command info or undefined if not found
   */
  getCommandInfo(nameOrAlias: string): CommandInfo | undefined {
    return this.registry.getInfo(nameOrAlias);
  }

  /**
   * Get all command info
   *
   * @returns Array of command info for all registered commands
   */
  getAllCommandInfo(): CommandInfo[] {
    return this.registry.getAllInfo();
  }

  /**
   * List all registered commands
   *
   * @returns Array of command names
   */
  listCommands(): string[] {
    return this.registry.listCommands();
  }

  /**
   * Get all commands in a category
   *
   * @param category - Category name
   * @returns Array of command names in the category
   */
  getCommandsByCategory(category: string): string[] {
    return this.registry.getCommandsByCategory(category);
  }

  /**
   * Get all categories
   *
   * @returns Array of category names
   */
  listCategories(): string[] {
    return this.registry.listCategories();
  }

  /**
   * Get command history
   *
   * @param limit - Maximum number of entries to return (default: all)
   * @returns Command history entries (most recent first)
   */
  getHistory(limit?: number): readonly CommandHistoryEntry[] {
    return this.bus.getHistory(limit);
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.bus.clearHistory();
  }

  /**
   * Undo the last command (if undoable)
   *
   * @returns Command result or null if nothing to undo
   */
  async undo(): Promise<CommandResult | null> {
    return this.bus.undo();
  }

  /**
   * Set maximum history size
   *
   * @param size - Maximum number of entries to keep
   */
  setMaxHistorySize(size: number): void {
    this.bus.setMaxHistorySize(size);
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.bus.getQueueSize();
  }

  /**
   * Clear all registered commands
   */
  clear(): void {
    this.registry.clear();
  }

  /**
   * Shutdown the command system
   *
   * Cleans up all resources and rejects queued commands
   */
  async shutdown(): Promise<void> {
    await this.bus.shutdown();
    this.registry.clear();
  }
}
