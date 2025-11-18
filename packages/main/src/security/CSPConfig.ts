/**
 * Content Security Policy configuration
 */
export class CSPConfig {
  /**
   * Validates if we're truly in development mode
   * Uses multiple checks to prevent misconfiguration
   */
  private static isActuallyDevelopment(): boolean {
    const nodeEnv = process.env.NODE_ENV === 'development';
    const electronEnv = process.env.ELECTRON_IS_DEV === '1';
    const notPackaged = !require('electron').app.isPackaged;

    // All conditions must be true for development mode
    return nodeEnv && (electronEnv || notPackaged);
  }

  /**
   * Get the Content Security Policy string
   */
  static getPolicy(): string {
    const isDev = this.isActuallyDevelopment();

    const directives = [
      "default-src 'self'",
      "script-src 'self'" + (isDev ? " 'unsafe-eval'" : ''), // unsafe-eval needed for Vite HMR
      "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for some UI frameworks
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' file:" + (isDev ? ' ws://localhost:5173' : ''), // Vite WebSocket + local files
      "media-src 'self' blob:",
      "object-src 'none'",
      "frame-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
      'upgrade-insecure-requests',
    ];

    return directives.join('; ');
  }
}
