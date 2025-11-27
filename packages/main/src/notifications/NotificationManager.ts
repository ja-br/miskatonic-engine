import { Notification, BrowserWindow, NativeImage, nativeImage } from 'electron';
import log from 'electron-log';
import path from 'path';

/**
 * Notification options
 */
export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string | NativeImage;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
  timeoutType?: 'default' | 'never';
  actions?: Array<{ type: 'button'; text: string }>;
}

/**
 * Manages native OS notifications
 */
export class NotificationManager {
  private window: BrowserWindow;
  private activeNotifications: Map<string, Notification> = new Map();

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  /**
   * Show a notification
   */
  show(id: string, options: NotificationOptions): boolean {
    try {
      // Close existing notification with same ID
      if (this.activeNotifications.has(id)) {
        this.close(id);
      }

      const notification = new Notification({
        title: options.title,
        body: options.body,
        icon: this.prepareIcon(options.icon),
        silent: options.silent ?? false,
        urgency: options.urgency,
        timeoutType: options.timeoutType,
        actions: options.actions,
      });

      // Handle notification events
      notification.on('click', () => {
        log.info(`Notification clicked: ${id}`);
        this.showWindow();
      });

      notification.on('close', () => {
        log.debug(`Notification closed: ${id}`);
        this.activeNotifications.delete(id);
      });

      notification.on('action', (_event, index) => {
        log.info(`Notification action clicked: ${id}, action: ${index}`);
        // TODO: Emit event to renderer process
      });

      // Show the notification
      notification.show();

      // Store reference
      this.activeNotifications.set(id, notification);

      log.info(`Notification shown: ${id}`);
      return true;
    } catch (error) {
      log.error(`Failed to show notification ${id}:`, error);
      return false;
    }
  }

  /**
   * Close a specific notification
   */
  close(id: string): void {
    const notification = this.activeNotifications.get(id);
    if (notification) {
      notification.close();
      this.activeNotifications.delete(id);
      log.debug(`Notification closed: ${id}`);
    }
  }

  /**
   * Close all active notifications
   */
  closeAll(): void {
    for (const [id, notification] of this.activeNotifications.entries()) {
      notification.close();
      log.debug(`Notification closed: ${id}`);
    }
    this.activeNotifications.clear();
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return Notification.isSupported();
  }

  /**
   * Prepare notification icon
   */
  private prepareIcon(icon?: string | NativeImage): NativeImage | undefined {
    if (!icon) {
      return undefined;
    }

    if (typeof icon === 'string') {
      try {
        return nativeImage.createFromPath(path.resolve(icon));
      } catch (error) {
        log.error('Failed to load notification icon:', error);
        return undefined;
      }
    }

    return icon;
  }

  /**
   * Show the application window
   */
  private showWindow(): void {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) {
        this.window.restore();
      }
      this.window.show();
      this.window.focus();
    }
  }

  /**
   * Show a simple info notification
   */
  showInfo(title: string, body: string): boolean {
    return this.show(`info-${Date.now()}`, {
      title,
      body,
      urgency: 'normal',
    });
  }

  /**
   * Show a warning notification
   */
  showWarning(title: string, body: string): boolean {
    return this.show(`warning-${Date.now()}`, {
      title,
      body,
      urgency: 'normal',
    });
  }

  /**
   * Show an error notification
   */
  showError(title: string, body: string): boolean {
    return this.show(`error-${Date.now()}`, {
      title,
      body,
      urgency: 'critical',
    });
  }

  /**
   * Show a success notification
   */
  showSuccess(title: string, body: string): boolean {
    return this.show(`success-${Date.now()}`, {
      title,
      body,
      urgency: 'low',
    });
  }
}
