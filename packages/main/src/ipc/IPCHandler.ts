import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';
import { IPCChannelHandler } from './types';
import { MiskatonicError, ErrorCode } from '@miskatonic/shared';
import { z } from 'zod';

// Import all channel handlers
import { FileReadHandler, FileWriteHandler } from './channels/FileChannel';
import { WindowMinimizeHandler, WindowMaximizeHandler, WindowCloseHandler } from './channels/WindowChannel';
import {
  SystemInfoHandler,
  SystemGPUInfoHandler,
  SystemOpenDevToolsHandler,
} from './channels/SystemChannel';
import {
  OpenFileDialogHandler,
  SaveFileDialogHandler,
  MessageBoxDialogHandler,
} from './channels/DialogChannel';

/**
 * Rate limiter for IPC calls
 */
class RateLimiter {
  private callCounts: Map<string, number[]> = new Map();
  private readonly maxCallsPerWindow = 100; // Max calls per time window
  private readonly windowMs = 1000; // Time window in milliseconds
  private readonly cleanupInterval = 60000; // Cleanup old entries every minute

  constructor() {
    // Periodic cleanup of old entries
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Check if the call should be allowed
   */
  checkLimit(channel: string, windowId: number): boolean {
    const key = `${windowId}:${channel}`;
    const now = Date.now();
    const calls = this.callCounts.get(key) || [];

    // Remove calls outside the time window
    const recentCalls = calls.filter((timestamp) => now - timestamp < this.windowMs);

    if (recentCalls.length >= this.maxCallsPerWindow) {
      log.warn(`Rate limit exceeded for ${key}: ${recentCalls.length} calls in ${this.windowMs}ms`);
      return false;
    }

    // Add current call
    recentCalls.push(now);
    this.callCounts.set(key, recentCalls);
    return true;
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, calls] of this.callCounts.entries()) {
      const recentCalls = calls.filter((timestamp) => now - timestamp < this.windowMs * 2);
      if (recentCalls.length === 0) {
        this.callCounts.delete(key);
      } else {
        this.callCounts.set(key, recentCalls);
      }
    }
  }

  /**
   * Clear rate limits for a specific window
   */
  clearWindow(windowId: number): void {
    for (const key of this.callCounts.keys()) {
      if (key.startsWith(`${windowId}:`)) {
        this.callCounts.delete(key);
      }
    }
  }
}

/**
 * Central IPC handler that routes messages to appropriate handlers
 */
export class IPCHandler {
  private handlers: Map<string, IPCChannelHandler> = new Map();
  private rateLimiter: RateLimiter = new RateLimiter();

  /**
   * Register all IPC handlers for a window
   */
  registerHandlers(_window: BrowserWindow): void {

    // Register all handlers
    const allHandlers: IPCChannelHandler[] = [
      // File handlers
      new FileReadHandler(),
      new FileWriteHandler(),

      // Window handlers
      new WindowMinimizeHandler(),
      new WindowMaximizeHandler(),
      new WindowCloseHandler(),

      // System handlers
      new SystemInfoHandler(),
      new SystemGPUInfoHandler(),
      new SystemOpenDevToolsHandler(),

      // Dialog handlers
      new OpenFileDialogHandler(),
      new SaveFileDialogHandler(),
      new MessageBoxDialogHandler(),
    ];

    for (const handler of allHandlers) {
      this.registerHandler(handler);
    }

    log.info(`Registered ${this.handlers.size} IPC handlers`);
  }

  /**
   * Register a single handler
   */
  private registerHandler(handler: IPCChannelHandler): void {
    if (this.handlers.has(handler.channel)) {
      throw new Error(`Handler already registered for channel: ${handler.channel}`);
    }

    this.handlers.set(handler.channel, handler);

    ipcMain.handle(handler.channel, async (event, request: unknown) => {
      const startTime = Date.now();

      try {
        // Rate limiting check
        const windowId = BrowserWindow.fromWebContents(event.sender)?.id || -1;
        if (!this.rateLimiter.checkLimit(handler.channel, windowId)) {
          throw new MiskatonicError(
            ErrorCode.IPC_RATE_LIMIT_EXCEEDED,
            `Rate limit exceeded for channel: ${handler.channel}`
          );
        }

        // Validate request
        const validatedRequest = handler.requestSchema.parse(request);

        // Handle request
        const response = await handler.handle(event, validatedRequest);

        // Validate response
        const validatedResponse = handler.responseSchema.parse(response);

        const duration = Date.now() - startTime;
        log.debug(`IPC ${handler.channel} completed in ${duration}ms`);

        return validatedResponse;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof z.ZodError) {
          log.error(`IPC ${handler.channel} validation error:`, error.errors);
          throw new MiskatonicError(
            ErrorCode.IPC_VALIDATION_FAILED,
            `Invalid IPC message: ${error.message}`,
            error.errors
          );
        }

        log.error(`IPC ${handler.channel} error after ${duration}ms:`, error);
        throw error;
      }
    });
  }

  /**
   * Unregister all handlers
   */
  unregisterAll(): void {
    for (const channel of this.handlers.keys()) {
      ipcMain.removeHandler(channel);
    }
    this.handlers.clear();
    log.info('Unregistered all IPC handlers');
  }
}
