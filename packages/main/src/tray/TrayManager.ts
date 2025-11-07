import { app, Tray, Menu, BrowserWindow, nativeImage, NativeImage } from 'electron';
import path from 'path';
import log from 'electron-log';

/**
 * Manages system tray integration
 */
export class TrayManager {
  private tray: Tray | null = null;
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  /**
   * Create and setup the system tray
   */
  create(): void {
    const icon = this.getTrayIcon();

    if (!icon) {
      log.warn('Tray icon not found, skipping tray creation');
      return;
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('Miskatonic Engine');

    // Build context menu
    const contextMenu = this.buildContextMenu();
    this.tray.setContextMenu(contextMenu);

    // Handle tray icon click
    this.tray.on('click', () => {
      this.toggleWindowVisibility();
    });

    log.info('System tray created');
  }

  /**
   * Get the tray icon based on platform
   */
  private getTrayIcon(): NativeImage | null {
    try {
      // Determine icon path based on platform
      const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
      const iconPath = path.join(app.getAppPath(), 'assets', 'icons', iconName);

      // Create icon with appropriate size for platform
      const icon = nativeImage.createFromPath(iconPath);

      if (icon.isEmpty()) {
        log.warn(`Tray icon is empty at path: ${iconPath}`);
        return null;
      }

      // Resize for tray on macOS
      if (process.platform === 'darwin') {
        return icon.resize({ width: 16, height: 16 });
      }

      return icon;
    } catch (error) {
      log.error('Failed to load tray icon:', error);
      return null;
    }
  }

  /**
   * Build the tray context menu
   */
  private buildContextMenu(): Menu {
    return Menu.buildFromTemplate([
      {
        label: 'Show Window',
        click: () => {
          this.showWindow();
        },
      },
      {
        label: 'Hide Window',
        click: () => {
          this.hideWindow();
        },
      },
      { type: 'separator' },
      {
        label: 'New Game',
        click: () => {
          this.showWindow();
          // TODO: Trigger new game action
          log.info('New Game from tray');
        },
      },
      { type: 'separator' },
      {
        label: `Miskatonic Engine v${app.getVersion()}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);
  }

  /**
   * Toggle window visibility
   */
  private toggleWindowVisibility(): void {
    if (this.window.isVisible()) {
      this.hideWindow();
    } else {
      this.showWindow();
    }
  }

  /**
   * Show the window
   */
  private showWindow(): void {
    this.window.show();
    this.window.focus();

    // On macOS, also show the app in the dock
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show();
    }
  }

  /**
   * Hide the window
   */
  private hideWindow(): void {
    this.window.hide();

    // On macOS, optionally hide from dock when minimized to tray
    // Commented out by default - uncomment if you want dock hiding
    // if (process.platform === 'darwin' && app.dock) {
    //   app.dock.hide();
    // }
  }

  /**
   * Update tray icon (e.g., for notifications)
   */
  updateIcon(iconPath: string): void {
    if (!this.tray) return;

    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (process.platform === 'darwin') {
        this.tray.setImage(icon.resize({ width: 16, height: 16 }));
      } else {
        this.tray.setImage(icon);
      }
    } catch (error) {
      log.error('Failed to update tray icon:', error);
    }
  }

  /**
   * Update tray tooltip
   */
  updateTooltip(tooltip: string): void {
    if (this.tray) {
      this.tray.setToolTip(tooltip);
    }
  }

  /**
   * Display a balloon notification (Windows only)
   */
  displayBalloon(title: string, content: string): void {
    if (process.platform === 'win32' && this.tray) {
      this.tray.displayBalloon({
        title,
        content,
      });
    }
  }

  /**
   * Destroy the tray icon
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      log.info('System tray destroyed');
    }
  }

  /**
   * Check if tray is created
   */
  isCreated(): boolean {
    return this.tray !== null;
  }
}
