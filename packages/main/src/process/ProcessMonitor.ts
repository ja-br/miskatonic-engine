import { BrowserWindow } from 'electron';
import log from 'electron-log';
import { CrashReporter } from './CrashReporter';

/**
 * Monitors process health and handles crashes
 */
export class ProcessMonitor {
  private crashReporter: CrashReporter;
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs = 5000; // Check every 5 seconds

  constructor() {
    this.crashReporter = new CrashReporter();
  }

  /**
   * Start monitoring
   */
  start(): void {
    log.info('Starting process monitor...');

    // Monitor renderer processes periodically
    this.monitorInterval = setInterval(() => {
      this.checkRendererHealth();
    }, this.checkIntervalMs);

    log.info('Process monitor started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    log.info('Process monitor stopped');
  }

  /**
   * Report a crash
   */
  reportCrash(error: Error): void {
    this.crashReporter.report(error);
  }

  /**
   * Check health of all renderer processes
   */
  private checkRendererHealth(): void {
    const windows = BrowserWindow.getAllWindows();

    for (const window of windows) {
      if (window.webContents.isDestroyed()) {
        log.warn(`Window ${window.id} webContents destroyed`);
        continue;
      }

      if (window.webContents.isCrashed()) {
        log.error(`Window ${window.id} has crashed!`);
        this.handleRendererCrash(window);
      }
    }
  }

  /**
   * Attempt to recover from renderer crash
   */
  private handleRendererCrash(window: BrowserWindow): void {
    log.error('Attempting to recover from renderer crash...');

    try {
      window.webContents.reload();
      log.info('Renderer process reloaded successfully');
    } catch (error) {
      log.error('Failed to reload renderer:', error);
      // Could implement more aggressive recovery strategies here
    }
  }
}
