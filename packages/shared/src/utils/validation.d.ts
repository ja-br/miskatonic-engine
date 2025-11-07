import { z } from 'zod';
/**
 * Validates data against a Zod schema
 * @throws {MiskatonicError} If validation fails
 */
export declare function validate<T>(schema: z.ZodSchema<T>, data: unknown): T;
/**
 * Safely validates data, returning null on failure
 */
export declare function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): T | null;
//# sourceMappingURL=validation.d.ts.map