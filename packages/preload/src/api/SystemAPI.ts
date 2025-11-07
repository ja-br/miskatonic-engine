import { ipcRenderer } from 'electron';
import { IPC_CHANNELS, SystemInfo, GPUInfo } from '@miskatonic/shared';

/**
 * System API exposed to renderer
 */
export function createSystemAPI() {
  return {
    /**
     * Get system information
     */
    getInfo: (): Promise<SystemInfo> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_INFO);
    },

    /**
     * Get GPU/graphics information
     */
    getGPUInfo: (): Promise<GPUInfo> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GPU_INFO);
    },

    /**
     * Open DevTools
     */
    openDevTools: (): Promise<void> => {
      return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_DEV_TOOLS);
    },
  };
}

export type SystemAPI = ReturnType<typeof createSystemAPI>;
