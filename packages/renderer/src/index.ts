/**
 * Renderer process entry point
 */

import { bootstrap } from './bootstrap';
import { ipcService } from './ipc/IPCService';

// Extend Window interface for type-safe debugging
declare global {
  interface Window {
    __MISKATONIC_DEBUG__?: {
      ipcService: typeof ipcService;
    };
  }
}

// Bootstrap the application
bootstrap().then((success) => {
  if (success) {
    console.log('Miskatonic Engine renderer ready');
    // Future: Initialize game engine here (Epic 2.1)
  } else {
    console.error('Failed to initialize renderer');
  }
});

// Make IPC service available globally for debugging in a type-safe way
if (process.env.NODE_ENV === 'development') {
  window.__MISKATONIC_DEBUG__ = {
    ipcService,
  };
}

// Display welcome message
console.log('%cMiskatonic Engine', 'font-size: 24px; font-weight: bold; color: #4CAF50');
console.log('Version: 0.1.0');
console.log('Environment:', process.env.NODE_ENV);
