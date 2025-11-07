import { createFileAPI } from './FileAPI';
import { createWindowAPI } from './WindowAPI';
import { createSystemAPI } from './SystemAPI';

/**
 * Create the complete Electron API exposed to renderer
 */
export function createElectronAPI() {
  return {
    file: createFileAPI(),
    window: createWindowAPI(),
    system: createSystemAPI(),
  };
}

/**
 * Type of the exposed ElectronAPI
 */
export type ElectronAPI = ReturnType<typeof createElectronAPI>;
