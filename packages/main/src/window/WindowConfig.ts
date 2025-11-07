import { WindowConfig as IWindowConfig } from '@miskatonic/shared';
import { BrowserWindowConstructorOptions } from 'electron';
import { PathResolver } from '../utils/PathResolver';

export interface ElectronWindowConfig extends IWindowConfig {
  webPreferences: BrowserWindowConstructorOptions['webPreferences'];
}

/**
 * Default window configuration with security-first settings
 */
export const DEFAULT_WINDOW_CONFIG: ElectronWindowConfig = {
  width: 1280,
  height: 720,
  minWidth: 800,
  minHeight: 600,
  frame: true,
  title: 'Miskatonic Engine',
  backgroundColor: '#000000',
  webPreferences: {
    preload: PathResolver.getPreloadPath(),
    nodeIntegration: false, // CRITICAL: Must be false
    contextIsolation: true, // CRITICAL: Must be true
    sandbox: true, // CRITICAL: Must be true
    webSecurity: true, // CRITICAL: Must be true
    // @ts-expect-error - enableWebGL not in types but exists
    enableWebGL: true,
  },
};
