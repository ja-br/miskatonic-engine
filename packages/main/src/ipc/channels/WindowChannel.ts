import { IpcMainInvokeEvent } from 'electron';
import { BaseChannelHandler } from '../types';
import { IPC_CHANNELS } from '@miskatonic/shared';
import { z } from 'zod';

/**
 * Handler for window minimize
 */
export class WindowMinimizeHandler extends BaseChannelHandler<void, void> {
  channel = IPC_CHANNELS.WINDOW_MINIMIZE;
  requestSchema = z.void();
  responseSchema = z.void();

  async handle(event: IpcMainInvokeEvent): Promise<void> {
    const window = this.getWindow(event);
    window?.minimize();
  }
}

/**
 * Handler for window maximize/unmaximize
 */
export class WindowMaximizeHandler extends BaseChannelHandler<void, void> {
  channel = IPC_CHANNELS.WINDOW_MAXIMIZE;
  requestSchema = z.void();
  responseSchema = z.void();

  async handle(event: IpcMainInvokeEvent): Promise<void> {
    const window = this.getWindow(event);
    if (window?.isMaximized()) {
      window.unmaximize();
    } else {
      window?.maximize();
    }
  }
}

/**
 * Handler for window close
 */
export class WindowCloseHandler extends BaseChannelHandler<void, void> {
  channel = IPC_CHANNELS.WINDOW_CLOSE;
  requestSchema = z.void();
  responseSchema = z.void();

  async handle(event: IpcMainInvokeEvent): Promise<void> {
    const window = this.getWindow(event);
    window?.close();
  }
}
