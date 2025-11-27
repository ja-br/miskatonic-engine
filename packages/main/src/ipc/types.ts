import { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { z } from 'zod';

/**
 * Interface for IPC channel handlers
 */
export interface IPCChannelHandler<TRequest = unknown, TResponse = unknown> {
  channel: string;
  requestSchema: z.ZodType<TRequest, any, any>;
  responseSchema: z.ZodType<TResponse, any, any>;
  handle(event: IpcMainInvokeEvent, request: TRequest): Promise<TResponse>;
}

/**
 * Base class for channel handlers
 */
export abstract class BaseChannelHandler<TRequest = unknown, TResponse = unknown>
  implements IPCChannelHandler<TRequest, TResponse>
{
  abstract channel: string;
  abstract requestSchema: z.ZodType<TRequest, any, any>;
  abstract responseSchema: z.ZodType<TResponse, any, any>;

  abstract handle(event: IpcMainInvokeEvent, request: TRequest): Promise<TResponse>;

  /**
   * Get the window that sent the IPC message
   */
  protected getWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
    return BrowserWindow.fromWebContents(event.sender);
  }
}
