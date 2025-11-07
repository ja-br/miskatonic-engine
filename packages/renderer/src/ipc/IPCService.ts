/**
 * IPC Service - wrapper around window.electronAPI
 * Provides a clean API for renderer to communicate with main process
 */
export class IPCService {
  private api: ElectronAPI;

  constructor() {
    if (!window.electronAPI) {
      throw new Error('ElectronAPI not available. Ensure preload script loaded correctly.');
    }
    this.api = window.electronAPI;
  }

  // File operations
  get file() {
    return this.api.file;
  }

  // Window operations
  get window() {
    return this.api.window;
  }

  // System operations
  get system() {
    return this.api.system;
  }
}

// Export singleton instance
export const ipcService = new IPCService();
