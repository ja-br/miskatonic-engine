/**
 * Error codes for the Miskatonic Engine
 */
export declare enum ErrorCode {
    UNKNOWN = "UNKNOWN",
    IPC_TIMEOUT = "IPC_TIMEOUT",
    IPC_VALIDATION_FAILED = "IPC_VALIDATION_FAILED",
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    FILE_ACCESS_DENIED = "FILE_ACCESS_DENIED",
    WINDOW_NOT_FOUND = "WINDOW_NOT_FOUND",
    SYSTEM_ERROR = "SYSTEM_ERROR"
}
/**
 * Base error class for Miskatonic Engine
 */
export declare class MiskatonicError extends Error {
    code: ErrorCode;
    details?: unknown;
    constructor(code: ErrorCode, message: string, details?: unknown);
}
//# sourceMappingURL=errors.d.ts.map