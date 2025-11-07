import { z } from 'zod';
import { MiskatonicError, ErrorCode } from '../types/errors';

/**
 * Validates data against a Zod schema
 * @throws {MiskatonicError} If validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MiskatonicError(
        ErrorCode.IPC_VALIDATION_FAILED,
        `Validation failed: ${error.message}`,
        error.errors
      );
    }
    throw error;
  }
}

/**
 * Safely validates data, returning null on failure
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
