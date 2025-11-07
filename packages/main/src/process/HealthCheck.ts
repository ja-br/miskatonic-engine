import { BrowserWindow } from 'electron';
import log from 'electron-log';

/**
 * Health check utilities for processes
 */
export class HealthCheck {
  /**
   * Check if a window is healthy
   */
  async checkWindow(window: BrowserWindow): Promise<boolean> {
    if (window.isDestroyed()) {
      return false;
    }

    if (window.webContents.isDestroyed()) {
      return false;
    }

    if (window.webContents.isCrashed()) {
      return false;
    }

    // Ping renderer process
    try {
      const response = await window.webContents.executeJavaScript('true');
      return response === true;
    } catch (error) {
      log.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get process metrics
   */
  getMetrics(): {
    memory: NodeJS.MemoryUsage;
    uptime: number;
  } {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}
