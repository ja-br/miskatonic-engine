import * as electron from 'electron';
const { app, BrowserWindow, dialog } = electron;
import { Logger } from './utils/Logger';
import { ErrorHandler } from './utils/ErrorHandler';
import { AppLifecycle } from './app/AppLifecycle';
import { WindowManager } from './window/WindowManager';
import { IPCHandler } from './ipc/IPCHandler';
import { ProcessMonitor } from './process/ProcessMonitor';
import { SecurityPolicy } from './security/SecurityPolicy';
import { PermissionHandler } from './security/PermissionHandler';
import log from 'electron-log';

/**
 * Main application class
 */
class MiskatonicApp {
  private lifecycle: AppLifecycle;
  private windowManager: WindowManager;
  private ipcHandler: IPCHandler;
  private processMonitor: ProcessMonitor;

  constructor() {
    log.info('Initializing Miskatonic Engine...');

    // Initialize logger first
    Logger.initialize();

    // Apply security policies BEFORE anything else
    SecurityPolicy.apply();

    // Setup error handlers
    ErrorHandler.setup();

    // Initialize subsystems
    this.lifecycle = new AppLifecycle();
    this.windowManager = new WindowManager();
    this.ipcHandler = new IPCHandler();
    this.processMonitor = new ProcessMonitor();

    this.setupEventHandlers();
  }

  /**
   * Setup application event handlers
   */
  private setupEventHandlers(): void {
    // App lifecycle events
    app.on('ready', () => this.onReady());
    app.on('window-all-closed', () => this.onWindowsAllClosed());
    app.on('activate', () => this.onActivate());
    app.on('before-quit', () => this.onBeforeQuit());
  }

  /**
   * Handle app ready event
   */
  private async onReady(): Promise<void> {
    log.info('App ready, creating main window...');

    try {
      // Setup permission handler
      PermissionHandler.setup();

      // Create main window
      const mainWindow = await this.windowManager.createMainWindow();

      // Register IPC handlers
      this.ipcHandler.registerHandlers(mainWindow);

      // Start process monitoring
      this.processMonitor.start();

      log.info('Application initialized successfully');
      log.info(`Uptime: ${this.lifecycle.getUptime()}ms`);
    } catch (error) {
      log.error('Failed to initialize application:', error);

      // Show error dialog to user before quitting
      dialog.showErrorBox(
        'Application Error',
        'Miskatonic Engine failed to initialize. Please check the logs for details.\n\n' +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );

      app.quit();
    }
  }

  /**
   * Handle all windows closed
   */
  private onWindowsAllClosed(): void {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }

  /**
   * Handle activate (macOS)
   */
  private onActivate(): void {
    // On macOS, recreate window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      this.windowManager.createMainWindow();
    }
  }

  /**
   * Handle before quit
   */
  private onBeforeQuit(): void {
    log.info('Application shutting down...');
    log.info(`Total uptime: ${this.lifecycle.getUptime()}ms`);
    this.processMonitor.stop();
  }
}

// Initialize application after ensuring single instance
function initializeApp() {
  // Single instance lock
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    log.warn('Another instance is already running');
    app.quit();
  } else {
    app.on('second-instance', () => {
      // Focus existing window if user tries to launch again
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        const mainWindow = windows[0];
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    // Create application
    new MiskatonicApp();
  }
}

// Run initialization
initializeApp();
