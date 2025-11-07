import { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { z } from 'zod';

/**
 * Interface for IPC channel handlers
 */
export interface IPCChannelHandler<TRequest = unknown, TResponse = unknown> {
  channel: string;
  requestSchema: z.ZodSchema<TRequest>;
  responseSchema: z.ZodSchema<TResponse>;
  handle(event: IpcMainInvokeEvent, request: TRequest): Promise<TResponse>;
}

/**
 * Base class for channel handlers
 */
export abstract class BaseChannelHandler<TRequest = unknown, TResponse = unknown>
  implements IPCChannelHandler<TRequest, TResponse>
{
  abstract channel: string;
  abstract requestSchema: z.ZodSchema<TRequest>;
  abstract responseSchema: z.ZodSchema<TResponse>;

  abstract handle(event: IpcMainInvokeEvent, request: TRequest): Promise<TResponse>;

  /**
   * Get the window that sent the IPC message
   */
  protected getWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
    return BrowserWindow.fromWebContents(event.sender);
  }
}
