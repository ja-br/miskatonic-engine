import { IpcMainInvokeEvent } from 'electron';
import os from 'os';
import { BaseChannelHandler } from '../types';
import { IPC_CHANNELS, SystemInfo, SystemInfoSchema, GPUInfo, GPUInfoSchema } from '@miskatonic/shared';
import { z } from 'zod';

/**
 * Handler for system info requests
 */
export class SystemInfoHandler extends BaseChannelHandler<void, SystemInfo> {
  channel = IPC_CHANNELS.SYSTEM_INFO;
  requestSchema = z.void();
  responseSchema = SystemInfoSchema;

  async handle(_event: IpcMainInvokeEvent): Promise<SystemInfo> {
    return {
      platform: process.platform as 'win32' | 'darwin' | 'linux',
      arch: os.arch(),
      version: os.release(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
      },
    };
  }
}

/**
 * Handler for GPU info requests
 */
export class SystemGPUInfoHandler extends BaseChannelHandler<void, GPUInfo> {
  channel = IPC_CHANNELS.SYSTEM_GPU_INFO;
  requestSchema = z.void();
  responseSchema = GPUInfoSchema;

  async handle(event: IpcMainInvokeEvent): Promise<GPUInfo> {
    const window = this.getWindow(event);
    if (!window) {
      throw new Error('Window not found');
    }

    // Execute in renderer to get WebGL info
    const gpuInfo = await window.webContents.executeJavaScript(`
      (function() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return null;

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown',
          renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown',
          webglVersion: gl instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL1',
          extensions: gl.getSupportedExtensions() || []
        };
      })()
    `);

    return gpuInfo;
  }
}

/**
 * Handler for opening DevTools
 */
export class SystemOpenDevToolsHandler extends BaseChannelHandler<void, void> {
  channel = IPC_CHANNELS.SYSTEM_OPEN_DEV_TOOLS;
  requestSchema = z.void();
  responseSchema = z.void();

  async handle(event: IpcMainInvokeEvent): Promise<void> {
    const window = this.getWindow(event);
    window?.webContents.openDevTools();
  }
}
