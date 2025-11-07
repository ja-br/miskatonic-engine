import log from 'electron-log';
import { MiskatonicError, ErrorCode } from '@miskatonic/shared';

/**
 * Global error handler for the main process
 */
export class ErrorHandler {
  static setup(): void {
    process.on('uncaughtException', (error: Error) => {
      log.error('Uncaught exception:', error);
      ErrorHandler.handleCriticalError(error);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      log.error('Unhandled rejection:', reason);
      ErrorHandler.handleCriticalError(reason);
    });
  }

  static handleCriticalError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));

    // Log detailed error information
    log.error('Critical error:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    // Could show error dialog to user here
    // For now, just log it
  }

  static wrapError(error: unknown): MiskatonicError {
    if (error instanceof MiskatonicError) {
      return error;
    }

    if (error instanceof Error) {
      return new MiskatonicError(ErrorCode.UNKNOWN, error.message, {
        originalError: error,
      });
    }

    return new MiskatonicError(ErrorCode.UNKNOWN, String(error));
  }
}
