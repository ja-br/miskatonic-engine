/**
 * Debug Console
 *
 * In-game developer console with command execution, logging, history, and autocomplete.
 * Toggles with ~ key (configurable), captures console.log, and integrates with CommandSystem.
 */

import { CommandSystem } from '@miskatonic/core';
import { CommandHistory } from './CommandHistory';
import { Autocomplete } from './Autocomplete';
import type { ConsoleConfig, LogEntry } from './types';
import { DEFAULT_CONSOLE_CONFIG, LogLevel } from './types';

export class DebugConsole {
  private config: Required<ConsoleConfig>;
  private commandSystem: CommandSystem;
  private history: CommandHistory;
  private autocomplete: Autocomplete;

  // State
  private visible: boolean = false;
  private logs: LogEntry[] = [];
  private logWriteIndex: number = 0; // Circular buffer write position
  private logCount: number = 0;      // Actual number of logs (up to maxLogEntries)
  private nextLogId: number = 0;

  // Console capture
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
  } | null = null;

  // UI elements (will be created dynamically)
  private container: HTMLElement | null = null;
  private outputElement: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private suggestionsElement: HTMLElement | null = null;

  // Keyboard handler
  private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(commandSystem: CommandSystem, config: Partial<ConsoleConfig> = {}) {
    this.config = { ...DEFAULT_CONSOLE_CONFIG, ...config };
    this.commandSystem = commandSystem;
    this.history = new CommandHistory(
      this.config.maxHistoryEntries,
      this.config.historyStorageKey,
      this.config.persistHistory
    );
    this.autocomplete = new Autocomplete();

    // Sync autocomplete with registered commands
    this.syncAutocomplete();

    // Set initial visibility
    this.visible = this.config.initiallyVisible;
  }

  /**
   * Initialize the console (attach to DOM, capture console.log, etc.)
   *
   * Must be called before using the console.
   */
  initialize(): void {
    // Create UI
    this.createUI();

    // Setup keyboard handler
    this.setupKeyboardHandler();

    // Capture console.log if enabled
    if (this.config.captureConsole) {
      this.captureConsoleOutput();
    }

    // Show/hide based on initial visibility
    if (this.visible) {
      this.show();
    } else {
      this.hide();
    }

    this.log('Debug console initialized. Press ~ to toggle.', LogLevel.INFO);
  }

  /**
   * Shutdown the console (cleanup, restore console.log, etc.)
   */
  shutdown(): void {
    // Restore console
    if (this.originalConsole) {
      console.log = this.originalConsole.log;
      console.warn = this.originalConsole.warn;
      console.error = this.originalConsole.error;
      console.debug = this.originalConsole.debug;
      this.originalConsole = null;
    }

    // Remove keyboard handler
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }

    // Remove UI
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
      this.outputElement = null;
      this.inputElement = null;
      this.suggestionsElement = null;
    }
  }

  /**
   * Show the console
   */
  show(): void {
    if (this.visible || !this.container) {
      return;
    }

    this.visible = true;
    this.container.style.display = 'flex';

    // Focus input
    if (this.inputElement) {
      this.inputElement.focus();
    }
  }

  /**
   * Hide the console
   */
  hide(): void {
    if (!this.visible || !this.container) {
      return;
    }

    this.visible = false;
    this.container.style.display = 'none';

    // Blur input
    if (this.inputElement) {
      this.inputElement.blur();
    }
  }

  /**
   * Toggle console visibility
   */
  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if console is visible
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Log a message to the console
   */
  log(message: string, level: LogLevel = LogLevel.INFO): void {
    const entry: LogEntry = {
      id: this.nextLogId++,
      timestamp: Date.now(),
      level,
      message,
    };

    // Real circular buffer: O(1) operation
    this.logs[this.logWriteIndex] = entry;
    this.logWriteIndex = (this.logWriteIndex + 1) % this.config.maxLogEntries;

    if (this.logCount < this.config.maxLogEntries) {
      this.logCount++;
    }

    // Update UI
    this.appendLogToUI(entry);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    this.logWriteIndex = 0;
    this.logCount = 0;
    if (this.outputElement) {
      // Use textContent instead of innerHTML to avoid XSS
      this.outputElement.textContent = '';
    }
  }

  /**
   * Execute a command
   */
  async executeCommand(command: string): Promise<void> {
    if (!command.trim()) {
      return;
    }

    // Log the command
    this.log(`> ${command}`, LogLevel.INFO);

    // Add to history
    this.history.add(command);

    try {
      // Execute via command system
      await this.commandSystem.execute(command, {});
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Error: ${errorMsg}`, LogLevel.ERROR);
    }
  }

  /**
   * Get all log entries
   */
  getLogs(): readonly LogEntry[] {
    // Return logs in chronological order (accounting for circular buffer wrap)
    if (this.logCount < this.config.maxLogEntries) {
      return this.logs.slice(0, this.logCount);
    }

    // Buffer is full, return in order from oldest to newest
    const older = this.logs.slice(this.logWriteIndex);
    const newer = this.logs.slice(0, this.logWriteIndex);
    return [...older, ...newer];
  }

  /**
   * Get command history
   */
  getHistory(): string[] {
    return this.history.getAll();
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.history.clear();
  }

  /**
   * Get autocomplete suggestions for input
   */
  getSuggestions(input: string): string[] {
    return this.autocomplete.getSuggestions(input).map(s => s.text);
  }

  /**
   * Create the console UI
   */
  private createUI(): void {
    // Create container
    const container = document.createElement('div');
    container.id = 'miskatonic-debug-console';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 50%;
      background: rgba(0, 0, 0, 0.9);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      z-index: 999999;
      display: none;
      flex-direction: column;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
    `;

    // Create output area
    const output = document.createElement('div');
    output.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      white-space: pre-wrap;
      word-wrap: break-word;
    `;

    // Create suggestions area
    const suggestions = document.createElement('div');
    suggestions.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      padding: 5px 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      max-height: 100px;
      overflow-y: auto;
      display: none;
    `;

    // Create input area
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      display: flex;
      align-items: center;
      padding: 10px;
      border-top: 2px solid #00ff00;
      background: rgba(0, 0, 0, 0.95);
    `;

    const prompt = document.createElement('span');
    prompt.textContent = '> ';
    prompt.style.color = '#00ff00';

    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = `
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #00ff00;
      font-family: inherit;
      font-size: inherit;
    `;
    input.placeholder = 'Enter command...';

    inputContainer.appendChild(prompt);
    inputContainer.appendChild(input);

    container.appendChild(output);
    container.appendChild(suggestions);
    container.appendChild(inputContainer);

    document.body.appendChild(container);

    this.container = container;
    this.outputElement = output;
    this.inputElement = input;
    this.suggestionsElement = suggestions;

    // Setup input handlers
    this.setupInputHandlers();
  }

  /**
   * Setup keyboard handler for toggling console
   */
  private setupKeyboardHandler(): void {
    this.keyboardHandler = (e: KeyboardEvent) => {
      // Toggle console
      if (e.code === this.config.toggleKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Don't toggle if typing in console input
        if (this.inputElement && document.activeElement === this.inputElement) {
          return;
        }

        e.preventDefault();
        this.toggle();
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * Setup input field event handlers
   */
  private setupInputHandlers(): void {
    if (!this.inputElement) {
      return;
    }

    this.inputElement.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          const command = this.inputElement!.value.trim();
          if (command) {
            this.executeCommand(command);
            this.inputElement!.value = '';
            this.history.reset();
            this.hideSuggestions();
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          const prev = this.history.previous(this.inputElement!.value);
          if (prev !== null) {
            this.inputElement!.value = prev;
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          const next = this.history.next();
          if (next !== null) {
            this.inputElement!.value = next;
          }
          break;

        case 'Tab':
          e.preventDefault();
          const completion = this.autocomplete.getTabCompletion(this.inputElement!.value);
          if (completion) {
            this.inputElement!.value = completion + ' ';
          }
          break;

        case 'Escape':
          e.preventDefault();
          this.hide();
          break;
      }
    });

    // Show suggestions on input
    this.inputElement.addEventListener('input', () => {
      const value = this.inputElement!.value;
      if (value.trim()) {
        this.showSuggestions(value);
      } else {
        this.hideSuggestions();
      }
    });
  }

  /**
   * Append a log entry to the UI
   */
  private appendLogToUI(entry: LogEntry): void {
    if (!this.outputElement) {
      return;
    }

    const line = document.createElement('div');
    line.style.marginBottom = '2px';

    // Color by log level
    switch (entry.level) {
      case 'debug':
        line.style.color = '#888';
        break;
      case 'info':
        line.style.color = '#00ff00';
        break;
      case 'warn':
        line.style.color = '#ffaa00';
        break;
      case 'error':
        line.style.color = '#ff0000';
        break;
    }

    // Format message
    let text = '';
    if (this.config.showTimestamps) {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      text += `[${time}] `;
    }
    text += entry.message;

    line.textContent = text;
    this.outputElement.appendChild(line);

    // Auto-scroll to bottom
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  }

  /**
   * Show autocomplete suggestions
   */
  private showSuggestions(input: string): void {
    if (!this.suggestionsElement) {
      return;
    }

    const suggestions = this.autocomplete.getSuggestions(input);

    if (suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    // Clear using textContent to avoid XSS
    this.suggestionsElement.textContent = '';
    this.suggestionsElement.style.display = 'block';

    suggestions.slice(0, 10).forEach(suggestion => {
      const item = document.createElement('div');
      item.style.cssText = `
        padding: 2px 5px;
        cursor: pointer;
      `;
      // Use textContent instead of innerHTML to prevent XSS
      item.textContent = `${suggestion.text}${suggestion.description ? ' - ' + suggestion.description : ''}`;

      item.addEventListener('click', () => {
        if (this.inputElement) {
          this.inputElement.value = suggestion.text + ' ';
          this.inputElement.focus();
          this.hideSuggestions();
        }
      });

      this.suggestionsElement!.appendChild(item);
    });
  }

  /**
   * Hide autocomplete suggestions
   */
  private hideSuggestions(): void {
    if (this.suggestionsElement) {
      this.suggestionsElement.style.display = 'none';
      this.suggestionsElement.textContent = '';
    }
  }

  /**
   * Capture console.log/warn/error output
   */
  private captureConsoleOutput(): void {
    if (this.originalConsole) {
      return; // Already captured
    }

    // Save originals
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    // Helper to format arguments properly
    const formatArgs = (args: any[]): string => {
      return args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;

        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          // Circular reference or other stringify error
          return String(arg);
        }
      }).join(' ');
    };

    // Override console methods
    console.log = (...args: any[]) => {
      this.originalConsole!.log(...args);
      this.log(formatArgs(args), LogLevel.INFO);
    };

    console.warn = (...args: any[]) => {
      this.originalConsole!.warn(...args);
      this.log(formatArgs(args), LogLevel.WARN);
    };

    console.error = (...args: any[]) => {
      this.originalConsole!.error(...args);
      this.log(formatArgs(args), LogLevel.ERROR);
    };

    console.debug = (...args: any[]) => {
      this.originalConsole!.debug(...args);
      this.log(formatArgs(args), LogLevel.DEBUG);
    };
  }

  /**
   * Sync autocomplete with registered commands
   */
  private syncAutocomplete(): void {
    // Get all registered commands from command system
    const commands = this.commandSystem.getAllCommandInfo();

    this.autocomplete.clear();
    for (const cmd of commands) {
      this.autocomplete.registerCommand(cmd.name, cmd.description);
    }
  }

  /**
   * Refresh autocomplete (call when commands are registered/unregistered)
   */
  refreshAutocomplete(): void {
    this.syncAutocomplete();
  }
}
