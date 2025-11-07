import { app } from 'electron';
import log from 'electron-log';

/**
 * Manages the application lifecycle
 */
export class AppLifecycle {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.configureApp();
  }

  private configureApp(): void {
    // Set app name
    app.setName('Miskatonic Engine');

    // Enable WebGL2 compute context for advanced graphics
    app.commandLine.appendSwitch('enable-webgl2-compute-context');

    // WebGPU is enabled by default in modern Electron versions
    // No need for unsafe flags - use feature detection and fallback to WebGL2

    // Enable hardware acceleration by default
    // Can be disabled later if needed
    // app.disableHardwareAcceleration();

    log.info('App configured with name:', app.getName());
    log.info('App version:', app.getVersion());
    log.info('Electron version:', process.versions.electron);
    log.info('Chrome version:', process.versions.chrome);
    log.info('Node version:', process.versions.node);
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  getVersion(): string {
    return app.getVersion();
  }
}
