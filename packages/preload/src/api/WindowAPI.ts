import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@miskatonic/shared';

/**
 * Window API exposed to renderer
 */
export function createWindowAPI() {
  return {
    /**
     * Minimize the window
     */
    minimize: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE);
    },

    /**
     * Maximize or unmaximize the window
     */
    maximize: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE);
    },

    /**
     * Close the window
     */
    close: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE);
    },

    /**
     * Toggle fullscreen
     */
    fullscreen: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_FULLSCREEN);
    },

    /**
     * Listen for window state changes
     */
    onStateChanged: (callback: (state: unknown) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: unknown) => {
        callback(state);
      };
      ipcRenderer.on(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener);

      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_STATE_CHANGED, listener);
      };
    },
  };
}

export type WindowAPI = ReturnType<typeof createWindowAPI>;
