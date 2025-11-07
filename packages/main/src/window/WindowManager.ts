import { BrowserWindow, screen } from 'electron';
import log from 'electron-log';
import { DEFAULT_WINDOW_CONFIG, ElectronWindowConfig } from './WindowConfig';
import { WindowState } from './WindowState';
import { PathResolver } from '../utils/PathResolver';

/**
 * Manages BrowserWindow instances
 */
export class WindowManager {
  private windows: Map<number, BrowserWindow> = new Map();
  private windowStates: Map<number, WindowState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

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
    this.windows.clear();
    this.windowStates.clear();
  }
}
