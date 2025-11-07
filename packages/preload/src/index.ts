import { contextBridge } from 'electron';
import { createElectronAPI } from './api/ElectronAPI';

/**
 * Preload script - runs in isolated context
 * This is the security boundary between main and renderer processes
 */

try {
  // Create the API
  const electronAPI = createElectronAPI();

  // Expose API to renderer via contextBridge
  // This is the ONLY way renderer should access Electron/Node.js functionality
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);

  console.log('Preload script initialized successfully');
} catch (error) {
  console.error('Failed to initialize preload script:', error);
  throw error;
}

// Log environment for debugging
console.log('Preload environment:', {
  nodeVersion: process.versions.node,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
});
