import { app, globalShortcut, BrowserWindow } from 'electron';
import log from 'electron-log';

/**
 * Keyboard accelerator type
 */
export type Accelerator = string;

/**
 * Shortcut handler function
 */
export type ShortcutHandler = () => void;

/**
 * Shortcut registration
 */
interface ShortcutRegistration {
  accelerator: Accelerator;
  handler: ShortcutHandler;
  description?: string;
}

/**
 * Manages global keyboard shortcuts
 */
export class ShortcutManager {
  private shortcuts: Map<string, ShortcutRegistration> = new Map();
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;

    // Cleanup shortcuts when app quits
    app.on('will-quit', () => {
      this.unregisterAll();
    });
  }

  /**
   * Register a global shortcut
   */
  register(
    id: string,
    accelerator: Accelerator,
    handler: ShortcutHandler,
    description?: string
  ): boolean {
    try {
      // Check if already registered
      if (this.shortcuts.has(id)) {
        log.warn(`Shortcut ${id} is already registered, unregistering first`);
        this.unregister(id);
      }

      // Register the shortcut
      const success = globalShortcut.register(accelerator, handler);

      if (success) {
        this.shortcuts.set(id, { accelerator, handler, description });
        log.info(`Registered global shortcut: ${id} (${accelerator})`);
        return true;
      } else {
        log.error(`Failed to register shortcut: ${id} (${accelerator})`);
        return false;
      }
    } catch (error) {
      log.error(`Error registering shortcut ${id}:`, error);
      return false;
    }
  }

  /**
   * Unregister a global shortcut
   */
  unregister(id: string): void {
    const registration = this.shortcuts.get(id);
    if (registration) {
      globalShortcut.unregister(registration.accelerator);
      this.shortcuts.delete(id);
      log.info(`Unregistered global shortcut: ${id}`);
    }
  }

  /**
   * Unregister all shortcuts
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this.shortcuts.clear();
    log.info('Unregistered all global shortcuts');
  }

  /**
   * Check if a shortcut is registered
   */
  isRegistered(id: string): boolean {
    return this.shortcuts.has(id);
  }

  /**
   * Check if an accelerator is currently registered
   */
  isAcceleratorRegistered(accelerator: Accelerator): boolean {
    return globalShortcut.isRegistered(accelerator);
  }

  /**
   * Get all registered shortcuts
   */
  getAll(): Array<{ id: string; accelerator: Accelerator; description?: string }> {
    const result: Array<{ id: string; accelerator: Accelerator; description?: string }> = [];
    for (const [id, registration] of this.shortcuts.entries()) {
      result.push({
        id,
        accelerator: registration.accelerator,
        description: registration.description,
      });
    }
    return result;
  }

  /**
   * Register default application shortcuts
   * NOTE: These are GLOBAL shortcuts and will override system shortcuts.
   * Use sparingly and consider using menu accelerators instead for common actions.
   */
  registerDefaults(): void {
    // Toggle DevTools (development only)
    if (process.env.NODE_ENV === 'development') {
      this.register(
        'toggle-devtools',
        'CommandOrControl+Shift+I',
        () => {
          try {
            if (this.window && !this.window.isDestroyed()) {
              this.window.webContents.toggleDevTools();
            }
          } catch (error) {
            log.error('Failed to toggle DevTools:', error);
          }
        },
        'Toggle Developer Tools'
      );
    }

    // Show/Hide Window (non-standard shortcut to avoid conflicts)
    this.register(
      'toggle-window',
      'CommandOrControl+Shift+H',
      () => {
        try {
          if (this.window && !this.window.isDestroyed()) {
            if (this.window.isVisible()) {
              this.window.hide();
            } else {
              this.window.show();
              this.window.focus();
            }
          }
        } catch (error) {
          log.error('Failed to toggle window:', error);
        }
      },
      'Toggle Window Visibility'
    );

    // NOTE: Ctrl+R and Ctrl+Q are handled by menu accelerators, not global shortcuts
    // Global shortcuts would hijack system functionality

    log.info(`Registered ${this.shortcuts.size} global shortcuts`);
  }

  /**
   * Update a shortcut's accelerator
   */
  update(id: string, newAccelerator: Accelerator): boolean {
    const registration = this.shortcuts.get(id);
    if (!registration) {
      log.warn(`Cannot update non-existent shortcut: ${id}`);
      return false;
    }

    // Unregister old shortcut
    this.unregister(id);

    // Register with new accelerator
    return this.register(id, newAccelerator, registration.handler, registration.description);
  }
}
