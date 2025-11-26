/**
 * Built-in Commands
 *
 * Standard commands for debugging and engine management:
 * - help: List available commands
 * - echo: Echo input back
 * - stats: Get engine statistics
 * - clear: Clear command history
 */

import { z } from 'zod';
import type { MiskatonicEngine } from '../MiskatonicEngine';
import type { CommandDefinition } from './types';

/**
 * Create built-in commands
 *
 * @param engine - Engine instance for command access
 * @returns Array of built-in command definitions
 */
export function createBuiltinCommands(engine: MiskatonicEngine): CommandDefinition<any, any>[] {
  return [
    // help - List all commands
    {
      name: 'help',
      description: 'List all available commands or get help for a specific command',
      category: 'system',
      schema: z.object({
        command: z.string().optional(),
      }),
      handler: (input: { command?: string }) => {
        const commands = engine.commands;
        if (!commands) {
          return {
            success: false,
            error: 'Command system not initialized',
            executionTime: 0,
          };
        }

        if (input.command) {
          // Get info for specific command
          const info = commands.getCommandInfo(input.command);
          if (!info) {
            return {
              success: false,
              error: `Command '${input.command}' not found`,
              executionTime: 0,
            };
          }

          return {
            success: true,
            output: {
              name: info.name,
              description: info.description,
              category: info.category || 'uncategorized',
              aliases: info.aliases,
              undoable: info.undoable,
            },
            executionTime: 0,
          };
        }

        // List all commands
        const allCommands = commands.getAllCommandInfo();
        const byCategory = new Map<string, typeof allCommands>();

        for (const cmd of allCommands) {
          const category = cmd.category || 'uncategorized';
          if (!byCategory.has(category)) {
            byCategory.set(category, []);
          }
          byCategory.get(category)!.push(cmd);
        }

        return {
          success: true,
          output: {
            categories: Array.from(byCategory.entries()).map(([category, cmds]) => ({
              category,
              commands: cmds.map(c => ({
                name: c.name,
                description: c.description,
                aliases: c.aliases,
              })),
            })),
          },
          executionTime: 0,
        };
      },
    },

    // echo - Echo input back (useful for testing)
    {
      name: 'echo',
      description: 'Echo the input message back',
      category: 'system',
      aliases: ['print'],
      schema: z.object({
        message: z.string(),
      }),
      handler: (input: { message: string }) => {
        return {
          success: true,
          output: input.message,
          executionTime: 0,
        };
      },
    },

    // stats - Get engine statistics
    {
      name: 'stats',
      description: 'Get current engine performance statistics',
      category: 'debug',
      schema: z.object({
        format: z.enum(['json', 'text']).optional().default('json'),
      }),
      handler: (input: { format?: 'json' | 'text' }) => {
        try {
          const stats = engine.getStats();

          // Validate stats object exists and has expected properties
          if (!stats || typeof stats !== 'object') {
            return {
              success: false,
              error: 'Failed to retrieve engine statistics',
              executionTime: 0,
            };
          }

          if (input.format === 'text') {
            const text = [
              `FPS: ${stats.fps?.toFixed(2) ?? 'N/A'}`,
              `Frame Time: ${stats.frameTime?.toFixed(2) ?? 'N/A'}ms`,
              `Avg Frame Time: ${stats.averageFrameTime?.toFixed(2) ?? 'N/A'}ms`,
              `Total Frames: ${stats.totalFrames ?? 0}`,
              `Total Time: ${stats.totalTime?.toFixed(2) ?? 'N/A'}s`,
              `Entity Count: ${stats.entityCount ?? 0}`,
              `Memory: ${stats.memoryUsage ?? 0}MB`,
            ].join('\n');

            return {
              success: true,
              output: text,
              executionTime: 0,
            };
          }

          return {
            success: true,
            output: stats,
            executionTime: 0,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get stats',
            executionTime: 0,
          };
        }
      },
    },

    // clear - Clear command history
    {
      name: 'clear',
      description: 'Clear command history',
      category: 'system',
      schema: z.object({}),
      handler: () => {
        const commands = engine.commands;
        if (!commands) {
          return {
            success: false,
            error: 'Command system not initialized',
            executionTime: 0,
          };
        }

        commands.clearHistory();

        return {
          success: true,
          output: 'Command history cleared',
          executionTime: 0,
        };
      },
    },

    // state - Get engine state
    {
      name: 'state',
      description: 'Get current engine state',
      category: 'debug',
      schema: z.object({}),
      handler: () => {
        return {
          success: true,
          output: {
            state: engine.state,
          },
          executionTime: 0,
        };
      },
    },

    // config - Get engine configuration
    {
      name: 'config',
      description: 'Get engine configuration',
      category: 'debug',
      schema: z.object({
        section: z.enum(['physics', 'rendering', 'network', 'debug', 'performance']).optional(),
      }),
      handler: (input: { section?: 'physics' | 'rendering' | 'network' | 'debug' | 'performance' }) => {
        try {
          const config = engine.getConfig();

          if (!config || typeof config !== 'object') {
            return {
              success: false,
              error: 'Failed to retrieve engine configuration',
              executionTime: 0,
            };
          }

          if (input.section) {
            // Runtime validation that section exists in config
            if (!(input.section in config)) {
              return {
                success: false,
                error: `Unknown config section: ${input.section}`,
                executionTime: 0,
              };
            }

            // Type-safe config section access after validation
            const section = input.section as keyof typeof config;
            const sectionConfig = config[section];

            return {
              success: true,
              output: sectionConfig,
              executionTime: 0,
            };
          }

          return {
            success: true,
            output: config,
            executionTime: 0,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get config',
            executionTime: 0,
          };
        }
      },
    },

    // pause - Pause the engine
    {
      name: 'pause',
      description: 'Pause the engine',
      category: 'system',
      schema: z.object({}),
      handler: () => {
        try {
          engine.pause();
          return {
            success: true,
            output: 'Engine paused',
            executionTime: 0,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            executionTime: 0,
          };
        }
      },
      undoable: true,
      undo: () => {
        try {
          engine.resume();
          return {
            success: true,
            executionTime: 0,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            executionTime: 0,
          };
        }
      },
    },

    // resume - Resume the engine
    {
      name: 'resume',
      description: 'Resume the paused engine',
      category: 'system',
      schema: z.object({}),
      handler: () => {
        try {
          engine.resume();
          return {
            success: true,
            output: 'Engine resumed',
            executionTime: 0,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            executionTime: 0,
          };
        }
      },
    },
  ];
}
