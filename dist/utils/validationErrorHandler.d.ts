import { z } from "zod";
import type { Response } from "express";
/**
 * Handles Zod validation errors and returns user-friendly error messages
 * @param error - The Zod error
 * @param res - Express response object
 * @returns boolean - true if error was handled, false otherwise
 */
export declare function handleZodValidationError(error: unknown, res: Response): boolean;
/**
 * Wrapper function to handle Zod validation with custom error messages
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param customMessages - Custom error messages for specific fields
 * @returns validated data or throws ZodError
 */
export declare function validateWithCustomMessages<T>(schema: z.ZodSchema<T>, data: unknown, customMessages?: Record<string, string>): T;
//# sourceMappingURL=validationErrorHandler.d.ts.map