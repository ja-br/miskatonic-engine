import { app } from 'electron';
import path from 'path';

/**
 * Utility for resolving application paths
 */
export class PathResolver {
  static getPreloadPath(): string {
    if (process.env.NODE_ENV === 'development') {
      // In dev, main is at dist/main/, preload is at dist/preload/
      return path.join(__dirname, '../preload/index.js');
    }
    return path.join(__dirname, '../preload/index.js');
  }

  static getRendererPath(): string {
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:5173';
    }
    return path.join(__dirname, '../renderer/index.html');
  }

  static getUserDataPath(): string {
    return app.getPath('userData');
  }

  static getLogsPath(): string {
    return app.getPath('logs');
  }
}
