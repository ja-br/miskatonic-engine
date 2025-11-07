/**
 * Error codes for the Miskatonic Engine
 */
export enum ErrorCode {
  UNKNOWN = 'UNKNOWN',
  IPC_TIMEOUT = 'IPC_TIMEOUT',
  IPC_VALIDATION_FAILED = 'IPC_VALIDATION_FAILED',
  IPC_RATE_LIMIT_EXCEEDED = 'IPC_RATE_LIMIT_EXCEEDED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  WINDOW_NOT_FOUND = 'WINDOW_NOT_FOUND',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

/**
 * Base error class for Miskatonic Engine
 */
export class MiskatonicError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MiskatonicError';
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MiskatonicError);
    }
  }
}
