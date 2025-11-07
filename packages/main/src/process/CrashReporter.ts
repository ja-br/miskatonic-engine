import { crashReporter, app } from 'electron';
import log from 'electron-log';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Handles crash reporting and logging
 */
export class CrashReporter {
  private crashPath: string;

  constructor() {
    this.crashPath = path.join(app.getPath('userData'), 'crashes');
    this.initializeCrashReporter();
  }

  /**
   * Initialize Electron's crash reporter
   */
  private initializeCrashReporter(): void {
    crashReporter.start({
      productName: 'Miskatonic Engine',
      companyName: 'Miskatonic',
      submitURL: '', // Will be configured in Epic 1.3
      uploadToServer: false, // Disable for now
      compress: true,
    });

    log.info('Crash reporter initialized');
  }

  /**
   * Report a crash with detailed information
   */
  async report(error: Error): Promise<void> {
    const crashData = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      platform: process.platform,
      version: app.getVersion(),
      electronVersion: process.versions.electron,
    };

    // Log to file
    log.error('CRASH REPORT:', crashData);

    // Write crash dump
    try {
      await fs.mkdir(this.crashPath, { recursive: true });
      const crashFile = path.join(this.crashPath, `crash-${Date.now()}.json`);
      await fs.writeFile(crashFile, JSON.stringify(crashData, null, 2));
      log.info(`Crash report written to: ${crashFile}`);
    } catch (writeError) {
      log.error('Failed to write crash report:', writeError);
    }
  }
}
