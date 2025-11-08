/**
 * Debug Console Types
 */

/**
 * Log level for console messages
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Console log entry
 */
export interface LogEntry {
  id: number;
  timestamp: number;
  level: LogLevel;
  message: string;
  stackTrace?: string;
}

/**
 * Console configuration options
 */
export interface ConsoleConfig {
  /**
   * Key code to toggle console (default: 'Backquote' for ~ key)
   */
  toggleKey?: string;

  /**
   * Maximum number of log entries to keep in memory
   * @default 1000
   */
  maxLogEntries?: number;

  /**
   * Maximum number of history entries to persist
   * @default 100
   */
  maxHistoryEntries?: number;

  /**
   * Whether to capture console.log/warn/error
   * @default true
   */
  captureConsole?: boolean;

  /**
   * Whether to persist history to localStorage
   * @default true
   */
  persistHistory?: boolean;

  /**
   * localStorage key for history persistence
   * @default 'miskatonic:console:history'
   */
  historyStorageKey?: string;

  /**
   * Whether to show timestamps in log output
   * @default true
   */
  showTimestamps?: boolean;

  /**
   * Initial visibility state
   * @default false
   */
  initiallyVisible?: boolean;
}

/**
 * Default console configuration
 */
export const DEFAULT_CONSOLE_CONFIG: Required<ConsoleConfig> = {
  toggleKey: 'Backquote',
  maxLogEntries: 1000,
  maxHistoryEntries: 100,
  captureConsole: true,
  persistHistory: true,
  historyStorageKey: 'miskatonic:console:history',
  showTimestamps: true,
  initiallyVisible: false,
};

/**
 * Autocomplete suggestion
 */
export interface AutocompleteSuggestion {
  text: string;
  description?: string;
  type: 'command' | 'parameter';
}
