import { app } from 'electron';
import log from 'electron-log';
import { CSPConfig } from './CSPConfig';

/**
 * Enforces security policies for the application
 */
export class SecurityPolicy {
  /**
   * Apply all security policies
   * MUST be called before app 'ready' event
   */
  static apply(): void {
    log.info('Applying security policies...');

    // Disable remote module (security best practice)
    app.on('web-contents-created', (_event, contents) => {
      // Disable navigation to prevent XSS
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);

        // Allow localhost in development
        if (process.env.NODE_ENV === 'development') {
          if (parsedUrl.host === 'localhost:5173') {
            return;
          }
        }

        log.warn(`Blocked navigation to: ${navigationUrl}`);
        event.preventDefault();
      });

      // Disable new window creation
      contents.setWindowOpenHandler(() => {
        log.warn('Blocked attempt to open new window');
        return { action: 'deny' };
      });

      // Disable webview
      contents.on('will-attach-webview', (event) => {
        log.warn('Blocked webview attachment');
        event.preventDefault();
      });
    });

    // Set Content Security Policy
    app.whenReady().then(() => {
      const { session } = require('electron');
      session.defaultSession.webRequest.onHeadersReceived(
        (
          details: Electron.OnHeadersReceivedListenerDetails,
          callback: (response: Electron.HeadersReceivedResponse) => void
        ) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': [CSPConfig.getPolicy()],
            },
          });
        }
      );
    });

    log.info('Security policies applied');
  }
}
