/**
 * CommandBus - Command execution and history management
 *
 * Handles:
 * - Command execution (sync and queued)
 * - Input validation with Zod
 * - Command history tracking
 * - Event emission for command lifecycle
 * - Undo/redo support
 */

import type { EventBus } from '../../../events/src';
import { CommandRegistry } from './CommandRegistry';
import type {
  CommandContext,
  CommandDefinition,
  CommandExecutionOptions,
  CommandHistoryEntry,
  CommandResult,
} from './types';

/**
 * Command Bus
 *
 * Executes commands with validation, history tracking, and event emission.
 */
export class CommandBus {
  private registry: CommandRegistry;
  private history: CommandHistoryEntry[] = [];
  private queuedCommands: Array<{
    command: string;
    input: unknown;
    options: CommandExecutionOptions;
    resolve: (result: CommandResult) => void;
  }> = [];
  private maxHistorySize = 100;
  private readonly maxQueueSize = 1000; // Prevent memory exhaustion
  private readonly rateLimitWindow = 1000; // 1 second
  private readonly rateLimitMax = 100; // 100 commands per second
  private readonly commandTimeout = 30000; // 30 second timeout per command
  private commandTimestamps: number[] = [];

  constructor(registry: CommandRegistry, private events?: EventBus) {
    this.registry = registry;
  }

  /**
   * Check if rate limit is exceeded
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    // Remove old timestamps outside the window
    this.commandTimestamps = this.commandTimestamps.filter(
      t => now - t < this.rateLimitWindow
    );

    if (this.commandTimestamps.length >= this.rateLimitMax) {
      return false;
    }

    this.commandTimestamps.push(now);
    return true;
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
    options: CommandExecutionOptions = {}
  ): Promise<CommandResult<TOutput>> {
    // Check rate limit
    if (!this.checkRateLimit()) {
      const result: CommandResult = {
        success: false,
        error: 'Rate limit exceeded. Too many commands in short time.',
        executionTime: 0,
      };

      this.events?.emit({
        type: 'command:failed',
        timestamp: Date.now(),
        commandName: command,
        error: result.error!,
      });

      return result;
    }

    // Queue command if requested
    if (options.queued) {
      // Check queue size limit
      if (this.queuedCommands.length >= this.maxQueueSize) {
        const result: CommandResult = {
          success: false,
          error: `Command queue full (${this.maxQueueSize} commands). Cannot queue more.`,
          executionTime: 0,
        };

        this.events?.emit({
          type: 'command:failed',
          timestamp: Date.now(),
          commandName: command,
          error: result.error!,
        });

        return result;
      }

      return new Promise(resolve => {
        this.queuedCommands.push({
          command,
          input,
          options,
          resolve: resolve as (result: CommandResult) => void,
        });
      });
    }

    // Get command definition
    const definition = this.registry.get(command);
    if (!definition) {
      const result: CommandResult = {
        success: false,
        error: `Command '${command}' not found`,
        executionTime: 0,
      };

      this.events?.emit({
        type: 'command:failed',
        timestamp: Date.now(),
        commandName: command,
        error: result.error!,
      });

      return result;
    }

    // Validate input
    const validation = definition.schema.safeParse(input);
    if (!validation.success) {
      const errorMessage = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');

      const result: CommandResult = {
        success: false,
        error: `Validation failed: ${errorMessage}`,
        executionTime: 0,
      };

      this.events?.emit({
        type: 'command:validation-failed',
        timestamp: Date.now(),
        commandName: definition.name,
        error: errorMessage,
      });

      return result;
    }

    // Create context
    const context: CommandContext = {
      timestamp: Date.now(),
      userId: options.userId,
      metadata: options.metadata,
    };

    // Execute command with timeout
    const startTime = performance.now();
    let result: CommandResult<TOutput>;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Command execution timeout')), this.commandTimeout);
      });

      // Race between handler and timeout
      result = await Promise.race([
        definition.handler(validation.data, context),
        timeoutPromise,
      ]) as CommandResult<TOutput>;

      result.executionTime = performance.now() - startTime;
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: performance.now() - startTime,
      };
    }

    // Add to history
    this.addToHistory({
      command: definition.name,
      input: validation.data,
      result,
      context,
    });

    // Emit event
    if (result.success) {
      this.events?.emit({
        type: 'command:executed',
        timestamp: Date.now(),
        commandName: definition.name,
        success: true,
        executionTime: result.executionTime,
      });
    } else {
      this.events?.emit({
        type: 'command:failed',
        timestamp: Date.now(),
        commandName: definition.name,
        error: result.error!,
      });
    }

    return result;
  }

  /**
   * Process queued commands
   *
   * Call this once per frame to execute queued commands.
   *
   * @returns Number of commands processed
   */
  async processQueue(): Promise<number> {
    const commandsToProcess = [...this.queuedCommands];
    this.queuedCommands = [];

    for (const { command, input, options, resolve } of commandsToProcess) {
      const result = await this.execute(command, input, {
        ...options,
        queued: false, // Prevent infinite queueing
      });
      resolve(result);
    }

    return commandsToProcess.length;
  }

  /**
   * Get command history
   *
   * @param limit - Maximum number of entries to return (default: all)
   * @returns Command history entries (most recent first)
   */
  getHistory(limit?: number): readonly CommandHistoryEntry[] {
    const history = [...this.history].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Undo the last command (if undoable)
   *
   * @returns Command result or null if nothing to undo
   */
  async undo(): Promise<CommandResult | null> {
    // Find last undoable command using findLastIndex to avoid iteration issues
    const undoableIndex = this.history.findLastIndex(entry => {
      const definition = this.registry.get(entry.command);
      return definition?.undoable && definition.undo;
    });

    if (undoableIndex === -1) {
      return null;
    }

    const entry = this.history[undoableIndex];
    const definition = this.registry.get(entry.command);

    if (!definition || !definition.undo) {
      return null;
    }

    // Execute undo handler
    const startTime = performance.now();
    let result: CommandResult;

    try {
      result = await definition.undo(entry.input, entry.context);
      result.executionTime = performance.now() - startTime;
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: performance.now() - startTime,
      };
    }

    // Remove from history AFTER execution
    this.history.splice(undoableIndex, 1);

    return result;
  }

  /**
   * Set maximum history size
   *
   * @param size - Maximum number of entries to keep
   */
  setMaxHistorySize(size: number): void {
    if (size < 0) {
      throw new Error('Max history size must be non-negative');
    }
    this.maxHistorySize = size;
    this.trimHistory();
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queuedCommands.length;
  }

  /**
   * Shutdown the command bus
   *
   * Rejects all queued commands and clears all state
   */
  async shutdown(): Promise<void> {
    // Reject all queued commands with shutdown error
    for (const cmd of this.queuedCommands) {
      cmd.resolve({
        success: false,
        error: 'Engine is shutting down',
        executionTime: 0,
      });
    }

    // Clear all state
    this.queuedCommands = [];
    this.history = [];
    this.commandTimestamps = [];
  }

  /**
   * Add entry to history
   */
  private addToHistory(entry: CommandHistoryEntry): void {
    this.history.push(entry);
    this.trimHistory();
  }

  /**
   * Trim history to max size
   */
  private trimHistory(): void {
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }
}
