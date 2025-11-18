/**
 * Global type declarations for renderer process
 */

// Import the ElectronAPI type from preload
// Note: In a real setup, you'd import this from a shared types package
// For now, we define it inline
interface ElectronAPI {
  file: {
    read: (path: string, encoding?: 'utf-8' | 'binary') => Promise<{
      success: boolean;
      data?: string;
      error?: string;
    }>;
    write: (path: string, data: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    readArbitrary: (path: string, encoding?: 'utf-8' | 'base64') => Promise<{
      success: boolean;
      data?: string;
      error?: string;
    }>;
  };
  dialog: {
    openFile: (options?: {
      title?: string;
      defaultPath?: string;
      buttonLabel?: string;
      filters?: { name: string; extensions: string[] }[];
      multiSelect?: boolean;
    }) => Promise<{
      canceled: boolean;
      filePaths: string[];
    }>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    fullscreen: () => Promise<void>;
    onStateChanged: (callback: (state: unknown) => void) => () => void;
  };
  system: {
    getInfo: () => Promise<{
      platform: string;
      arch: string;
      version: string;
      memory: {
        total: number;
        free: number;
      };
    }>;
    getGPUInfo: () => Promise<{
      vendor: string;
      renderer: string;
      webglVersion: string;
      extensions: string[];
    }>;
    openDevTools: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
