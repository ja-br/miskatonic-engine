/**
 * Miskatonic Engine Debug Console
 *
 * In-game developer console with command execution, logging, history, and autocomplete.
 *
 * @packageDocumentation
 */

export { DebugConsole } from './DebugConsole';
export { CommandHistory } from './CommandHistory';
export { Autocomplete } from './Autocomplete';
export type {
  ConsoleConfig,
  LogLevel,
  LogEntry,
  AutocompleteSuggestion,
} from './types';
export { DEFAULT_CONSOLE_CONFIG } from './types';
