import { BrowserWindow, screen } from 'electron';
import log from 'electron-log';
import { DEFAULT_WINDOW_CONFIG, ElectronWindowConfig } from './WindowConfig';
import { WindowState } from './WindowState';
import { PathResolver } from '../utils/PathResolver';
import { MenuBuilder } from '../menu/MenuBuilder';
import { TrayManager } from '../tray/TrayManager';
import { ShortcutManager } from '../shortcuts/ShortcutManager';
import { NotificationManager } from '../notifications/NotificationManager';

/**
 * Manages BrowserWindow instances
 */
export class WindowManager {
  private windows: Map<number, BrowserWindow> = new Map();
  private windowStates: Map<number, WindowState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private trayManager: TrayManager | null = null;
  private shortcutManager: ShortcutManager | null = null;
  private notificationManager: NotificationManager | null = null;

  constructor() {
    // Periodic cleanup of destroyed windows to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.cleanupDestroyedWindows();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Create the main application window
   */
  async createMainWindow(
    config?: Partial<ElectronWindowConfig>
  ): Promise<BrowserWindow> {
    const finalConfig: ElectronWindowConfig = {
      ...DEFAULT_WINDOW_CONFIG,
      ...config,
      webPreferences: {
        ...DEFAULT_WINDOW_CONFIG.webPreferences,
        ...config?.webPreferences,
        preload: PathResolver.getPreloadPath(),
      },
    };

    // Center window on primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const displaySize = primaryDisplay.workAreaSize;
    const x = Math.floor((displaySize.width - finalConfig.width) / 2);
    const y = Math.floor((displaySize.height - finalConfig.height) / 2);

    const window = new BrowserWindow({
      ...finalConfig,
      x,
      y,
      show: false, // Show only when ready to prevent flashing
    });

    // Store window
    this.windows.set(window.id, window);
    this.windowStates.set(window.id, new WindowState(window));

    // Set up event handlers
    this.setupWindowEventHandlers(window);

    // Load renderer
    await this.loadRenderer(window);

    // Build application menu
    const menuBuilder = new MenuBuilder(window);
    menuBuilder.buildMenu();

    // Create system tray (optional - won't fail if icons missing)
    if (!this.trayManager) {
      this.trayManager = new TrayManager(window);
      this.trayManager.create();
    }

    // Register global keyboard shortcuts
    if (!this.shortcutManager) {
      this.shortcutManager = new ShortcutManager(window);
      this.shortcutManager.registerDefaults();
    }

    // Initialize notification manager
    if (!this.notificationManager) {
      this.notificationManager = new NotificationManager(window);
      if (this.notificationManager.isSupported()) {
        log.info('Native notifications are supported');
      } else {
        log.warn('Native notifications are not supported on this platform');
      }
    }

    // Show when ready
    window.once('ready-to-show', () => {
      window.show();
      if (process.env.NODE_ENV === 'development') {
        window.webContents.openDevTools();
      }
    });

    log.info(`Created window ${window.id}`);
    return window;
  }

  /**
   * Setup event handlers for a window
   */
  private setupWindowEventHandlers(window: BrowserWindow): void {
    window.on('closed', () => {
      this.windows.delete(window.id);
      this.windowStates.delete(window.id);
      log.info(`Window ${window.id} closed`);
    });

    window.on('maximize', () => {
      this.windowStates.get(window.id)?.update();
    });

    window.on('unmaximize', () => {
      this.windowStates.get(window.id)?.update();
    });

    window.on('enter-full-screen', () => {
      this.windowStates.get(window.id)?.update();
    });

    window.on('leave-full-screen', () => {
      this.windowStates.get(window.id)?.update();
    });

    // Error handling
    window.webContents.on('crashed', () => {
      log.error(`Window ${window.id} crashed`);
    });

    window.webContents.on('unresponsive', () => {
      log.warn(`Window ${window.id} became unresponsive`);
    });

    window.webContents.on('responsive', () => {
      log.info(`Window ${window.id} became responsive again`);
    });
  }

  /**
   * Load the renderer process
   */
  private async loadRenderer(window: BrowserWindow): Promise<void> {
    const rendererPath = PathResolver.getRendererPath();

    if (process.env.NODE_ENV === 'development') {
      // Load from Vite dev server
      await window.loadURL(rendererPath);
    } else {
      // Load from built files
      await window.loadFile(rendererPath);
    }
  }

  /**
   * Get a window by ID
   */
  getWindow(id: number): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  /**
   * Get window state by ID
   */
  getWindowState(id: number): WindowState | undefined {
    return this.windowStates.get(id);
  }

  /**
   * Get all windows
   */
  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }

  /**
   * Close all windows
   */
  closeAll(): void {
    this.windows.forEach((window) => window.close());
  }

  /**
   * Cleanup destroyed windows to prevent memory leaks
   */
  private cleanupDestroyedWindows(): void {
    const destroyedWindows: number[] = [];

    for (const [id, window] of this.windows.entries()) {
      if (window.isDestroyed()) {
        destroyedWindows.push(id);
      }
    }

    for (const id of destroyedWindows) {
      this.windows.delete(id);
      this.windowStates.delete(id);
      log.warn(`Cleaned up destroyed window ${id} that didn't trigger 'closed' event`);
    }
  }

  /**
   * Destroy the window manager and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.trayManager) {
      this.trayManager.destroy();
      this.trayManager = null;
    }
    if (this.shortcutManager) {
      this.shortcutManager.unregisterAll();
      this.shortcutManager = null;
    }
    if (this.notificationManager) {
      this.notificationManager.closeAll();
      this.notificationManager = null;
    }
    this.windows.clear();
    this.windowStates.clear();
  }

  /**
   * Get the tray manager instance
   */
  getTrayManager(): TrayManager | null {
    return this.trayManager;
  }

  /**
   * Get the shortcut manager instance
   */
  getShortcutManager(): ShortcutManager | null {
    return this.shortcutManager;
  }

  /**
   * Get the notification manager instance
   */
  getNotificationManager(): NotificationManager | null {
    return this.notificationManager;
  }
}
