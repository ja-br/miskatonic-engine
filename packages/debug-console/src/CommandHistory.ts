/**
 * Command History Manager
 *
 * Manages command history with circular buffer and localStorage persistence.
 * Supports up/down arrow navigation like a traditional shell.
 */

export class CommandHistory {
  private history: string[] = [];
  private maxSize: number;
  private currentIndex: number = -1; // -1 means no history navigation active
  private temporaryCommand: string = ''; // Stores current input when navigating history
  private storageKey: string;
  private persistEnabled: boolean;

  constructor(maxSize: number = 100, storageKey: string = 'miskatonic:console:history', persistEnabled: boolean = true) {
    this.maxSize = maxSize;
    this.storageKey = storageKey;
    this.persistEnabled = persistEnabled;

    if (this.persistEnabled) {
      this.loadFromStorage();
    }
  }

  /**
   * Add a command to history
   */
  add(command: string): void {
    // Don't add empty commands or duplicates of the last command
    if (!command.trim() || command === this.history[this.history.length - 1]) {
      return;
    }

    this.history.push(command);

    // Maintain max size (circular buffer behavior)
    if (this.history.length > this.maxSize) {
      this.history.shift();
    }

    // Reset navigation
    this.currentIndex = -1;
    this.temporaryCommand = '';

    if (this.persistEnabled) {
      this.saveToStorage();
    }
  }

  /**
   * Get previous command in history (up arrow)
   *
   * @param currentInput - Current input text (saved when first navigating)
   * @returns Previous command or null if at start
   */
  previous(currentInput: string = ''): string | null {
    if (this.history.length === 0) {
      return null;
    }

    // First time navigating - save current input
    if (this.currentIndex === -1) {
      this.temporaryCommand = currentInput;
      this.currentIndex = this.history.length;
    }

    // Move back in history
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }

    return null; // Already at start of history
  }

  /**
   * Get next command in history (down arrow)
   *
   * @returns Next command, temporary command, or null
   */
  next(): string | null {
    if (this.currentIndex === -1) {
      return null; // Not navigating history
    }

    // Move forward in history
    this.currentIndex++;

    // Reached end - return to temporary command
    if (this.currentIndex >= this.history.length) {
      const temp = this.temporaryCommand;
      this.currentIndex = -1;
      this.temporaryCommand = '';
      return temp;
    }

    return this.history[this.currentIndex];
  }

  /**
   * Reset history navigation
   */
  reset(): void {
    this.currentIndex = -1;
    this.temporaryCommand = '';
  }

  /**
   * Get all history entries
   */
  getAll(): string[] {
    return [...this.history];
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.temporaryCommand = '';

    if (this.persistEnabled) {
      this.saveToStorage();
    }
  }

  /**
   * Search history for commands matching prefix
   */
  search(prefix: string): string[] {
    if (!prefix) {
      return [];
    }

    return this.history.filter(cmd => cmd.startsWith(prefix));
  }

  /**
   * Save history to localStorage
   */
  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') {
      return; // Not in browser environment
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    } catch (error) {
      // Use original console methods to avoid recursion if console is captured
      if (typeof window !== 'undefined' && (window as any).__ORIGINAL_CONSOLE__) {
        (window as any).__ORIGINAL_CONSOLE__.warn('Failed to save command history:', error);
      }
      // Silently fail if we can't save - not critical
    }
  }

  /**
   * Load history from localStorage
   */
  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') {
      return; // Not in browser environment
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.history = parsed.slice(-this.maxSize); // Respect max size
        }
      }
    } catch (error) {
      // Use original console methods to avoid recursion if console is captured
      if (typeof window !== 'undefined' && (window as any).__ORIGINAL_CONSOLE__) {
        (window as any).__ORIGINAL_CONSOLE__.warn('Failed to load command history:', error);
      }
      // Silently fail if we can't load - not critical
    }
  }
}
