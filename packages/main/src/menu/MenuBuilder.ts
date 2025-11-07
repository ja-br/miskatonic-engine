import { app, Menu, BrowserWindow, MenuItemConstructorOptions, shell } from 'electron';
import log from 'electron-log';

/**
 * Builds and manages application menus
 */
export class MenuBuilder {
  private window: BrowserWindow;

  constructor(window: BrowserWindow) {
    this.window = window;
  }

  /**
   * Build and set the application menu
   */
  buildMenu(): Menu {
    const template = this.buildTemplate();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    log.info('Application menu built and set');
    return menu;
  }

  /**
   * Build the menu template based on platform
   */
  private buildTemplate(): MenuItemConstructorOptions[] {
    const isMac = process.platform === 'darwin';

    const template: MenuItemConstructorOptions[] = [];

    // macOS app menu
    if (isMac) {
      template.push(this.buildAppMenu());
    }

    // File menu
    template.push(this.buildFileMenu());

    // Edit menu
    template.push(this.buildEditMenu());

    // View menu
    template.push(this.buildViewMenu());

    // Window menu
    template.push(this.buildWindowMenu());

    // Help menu
    template.push(this.buildHelpMenu());

    return template;
  }

  /**
   * Build the App menu (macOS only)
   */
  private buildAppMenu(): MenuItemConstructorOptions {
    return {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            log.info('Preferences menu clicked');
            // TODO: Open preferences window
          },
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    };
  }

  /**
   * Build the File menu
   */
  private buildFileMenu(): MenuItemConstructorOptions {
    const isMac = process.platform === 'darwin';

    return {
      label: 'File',
      submenu: [
        {
          label: 'New Game',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            log.info('New Game menu clicked');
            // TODO: Implement new game logic
          },
        },
        {
          label: 'Open Game...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            log.info('Open Game menu clicked');
            // TODO: Open file dialog for loading game
          },
        },
        { type: 'separator' },
        {
          label: 'Save Game',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            log.info('Save Game menu clicked');
            // TODO: Save current game
          },
        },
        {
          label: 'Save Game As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: async () => {
            log.info('Save Game As menu clicked');
            // TODO: Open file dialog for saving game
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    };
  }

  /**
   * Build the Edit menu
   */
  private buildEditMenu(): MenuItemConstructorOptions {
    return {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(process.platform === 'darwin'
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
              { type: 'separator' as const },
              {
                label: 'Speech',
                submenu: [{ role: 'startSpeaking' as const }, { role: 'stopSpeaking' as const }],
              },
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }]),
      ],
    };
  }

  /**
   * Build the View menu
   */
  private buildViewMenu(): MenuItemConstructorOptions {
    const isDev = process.env.NODE_ENV === 'development';

    return {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    };
  }

  /**
   * Build the Window menu
   */
  private buildWindowMenu(): MenuItemConstructorOptions {
    const isMac = process.platform === 'darwin';

    return {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    };
  }

  /**
   * Build the Help menu
   */
  private buildHelpMenu(): MenuItemConstructorOptions {
    // Whitelist of allowed external URLs
    const allowedDomains = ['github.com'];

    const openExternalUrl = async (url: string, label: string) => {
      try {
        const urlObj = new URL(url);
        if (!allowedDomains.includes(urlObj.hostname)) {
          log.error(`Blocked attempt to open non-whitelisted URL: ${url}`);
          return;
        }
        await shell.openExternal(url);
        log.info(`${label} link opened: ${url}`);
      } catch (error) {
        log.error(`Failed to open external URL ${url}:`, error);
      }
    };

    return {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await openExternalUrl('https://github.com/miskatonic/engine/docs', 'Documentation');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await openExternalUrl('https://github.com/miskatonic/engine/issues', 'Report Issue');
          },
        },
        { type: 'separator' },
        {
          label: 'Learn More',
          click: async () => {
            await openExternalUrl('https://github.com/miskatonic/engine', 'Learn More');
          },
        },
      ],
    };
  }

  /**
   * Build a context menu for the window
   */
  static buildContextMenu(): Menu {
    return Menu.buildFromTemplate([
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' },
    ]);
  }
}
