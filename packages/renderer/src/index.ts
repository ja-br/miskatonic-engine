/**
 * Renderer process entry point
 *
 * NOTE: Demo code removed during Epic 3.14 refactoring
 * The old Demo class used RenderQueue which was deleted
 * A new demo using the Epic 3.14 DrawCommand API will be created
 */

import { ipcService } from './ipc/IPCService';

// Extend Window interface for type-safe debugging
declare global {
  interface Window {
    __MISKATONIC_DEBUG__?: {
      ipcService: typeof ipcService;
    };
  }
}

// Display welcome message
console.log('%cMiskatonic Engine', 'font-size: 24px; font-weight: bold; color: #4CAF50');
console.log('Version: 0.1.0');
console.log('Environment:', process.env.NODE_ENV);
console.log('Note: Demo temporarily disabled during Epic 3.14 refactoring');

// Make IPC service available for debugging
if (process.env.NODE_ENV === 'development') {
  window.__MISKATONIC_DEBUG__ = {
    ipcService,
  };
}
