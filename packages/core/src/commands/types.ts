/**
 * Command System Types
 *
 * Provides a type-safe command system for:
 * - Debug console commands
 * - Scripting and automation
 * - UI action handling
 * - Command history and replay
 *
 * Design:
 * - Commands are strongly typed with Zod schemas
 * - Synchronous and queued execution modes
 * - Event emission for command lifecycle
 * - Undo/redo support (optional)
 */

import type { z } from 'zod';

/**
 * Command context provided to handlers
 *
 * Contains execution context and engine access
 */
export interface CommandContext {
  /** Timestamp when command was invoked */
  timestamp: number;
  /** Optional user/session ID for multiplayer commands */
  userId?: string;
  /** Optional metadata (e.g., source: 'console', 'script', 'ui') */
  metadata?: Record<string, unknown>;
}

/**
 * Command execution result
 */
export interface CommandResult<TOutput = unknown> {
  /** Whether command succeeded */
  success: boolean;
  /** Output data (if successful) */
  output?: TOutput;
  /** Error message (if failed) */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Command handler function
 *
 * Receives validated input and context, returns result
 */
export type CommandHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: CommandContext
) => Promise<CommandResult<TOutput>> | CommandResult<TOutput>;

/**
 * Command definition
 *
 * Defines a command with schema validation and handler
 */
export interface CommandDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique command name (e.g., 'entity.spawn', 'debug.inspect') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Zod schema for input validation */
  schema: z.ZodType<TInput>;
  /** Command handler */
  handler: CommandHandler<TInput, TOutput>;
  /** Whether this command can be undone */
  undoable?: boolean;
  /** Optional undo handler */
  undo?: CommandHandler<TInput, void>;
  /** Optional category for grouping (e.g., 'entity', 'debug', 'system') */
  category?: string;
  /** Optional aliases */
  aliases?: string[];
}

/**
 * Command registration info (for introspection)
 */
export interface CommandInfo {
  name: string;
  description: string;
  category?: string;
  aliases: string[];
  undoable: boolean;
}

/**
 * Command execution options
 */
export interface CommandExecutionOptions {
  /** Whether to queue command for next frame (default: false) */
  queued?: boolean;
  /** Custom context metadata */
  metadata?: Record<string, unknown>;
  /** User/session ID */
  userId?: string;
}

/**
 * Command history entry
 */
export interface CommandHistoryEntry<TInput = unknown, TOutput = unknown> {
  /** Command name */
  command: string;
  /** Command input */
  input: TInput;
  /** Command result */
  result: CommandResult<TOutput>;
  /** Execution context */
  context: CommandContext;
}

/**
 * Command events emitted by the system
 */
export type CommandEvent =
  | {
      type: 'command:registered';
      timestamp: number;
      commandName: string;
    }
  | {
      type: 'command:unregistered';
      timestamp: number;
      commandName: string;
    }
  | {
      type: 'command:executed';
      timestamp: number;
      commandName: string;
      success: boolean;
      executionTime: number;
    }
  | {
      type: 'command:failed';
      timestamp: number;
      commandName: string;
      error: string;
    }
  | {
      type: 'command:validation-failed';
      timestamp: number;
      commandName: string;
      error: string;
    };
