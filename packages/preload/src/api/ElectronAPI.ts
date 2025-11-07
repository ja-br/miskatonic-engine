import { createFileAPI } from './FileAPI';
import { createWindowAPI } from './WindowAPI';
import { createSystemAPI } from './SystemAPI';
import { createDialogAPI } from './DialogAPI';

/**
 * Create the complete Electron API exposed to renderer
 */
export function createElectronAPI() {
  return {
    file: createFileAPI(),
    window: createWindowAPI(),
    system: createSystemAPI(),
    dialog: createDialogAPI(),
  };
}

/**
 * Type of the exposed ElectronAPI
 */
export type ElectronAPI = ReturnType<typeof createElectronAPI>;
