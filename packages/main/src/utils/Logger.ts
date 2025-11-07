import log from 'electron-log';
import { app } from 'electron';
import path from 'path';

/**
 * Configure electron-log for the main process
 */
export class Logger {
  static initialize(): void {
    const isDev = process.env.NODE_ENV === 'development';

    // Configure file logging
    log.transports.file.level = 'info';
    log.transports.file.resolvePathFn = () =>
      path.join(app.getPath('logs'), 'miskatonic-main.log');

    // Configure console logging
    log.transports.console.level = isDev ? 'debug' : 'info';

    log.info('Logger initialized');
  }

  static getLogger() {
    return log;
  }
}

export default log;
