/**
 * Bootstrap the renderer process
 */

import { ipcService } from './ipc/IPCService';

export async function bootstrap() {
  console.log('Bootstrapping Miskatonic Engine renderer...');

  try {
    // Get system info to verify IPC is working
    const systemInfo = await ipcService.system.getInfo();
    console.log('System info:', systemInfo);

    // Get GPU info
    const gpuInfo = await ipcService.system.getGPUInfo();
    console.log('GPU info:', gpuInfo);

    console.log('Renderer bootstrap complete');
    return true;
  } catch (error) {
    console.error('Failed to bootstrap renderer:', error);
    return false;
  }
}
