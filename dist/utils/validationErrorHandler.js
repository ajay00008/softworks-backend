import { z } from "zod";
/**
 * Handles Zod validation errors and returns user-friendly error messages
 * @param error - The Zod error
 * @param res - Express response object
 * @returns boolean - true if error was handled, false otherwise
 */
export function handleZodValidationError(error, res) {
    if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => err.message);
        const errorMessage = errorMessages.join(", ");
        res.status(400).json({
            success: false,
            error: {
                message: errorMessage
            }
        });
        return true;
    }
    return false;
}
/**
 * Wrapper function to handle Zod validation with custom error messages
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param customMessages - Custom error messages for specific fields
 * @returns validated data or throws ZodError
 */
export function validateWithCustomMessages(schema, data, customMessages) {
    try {
        return schema.parse(data);
    }
    catch (error) {
        if (error instanceof z.ZodError && customMessages) {
            // Override error messages with custom ones
            const updatedErrors = error.errors.map(err => {
                const fieldPath = err.path.join('.');
                const customMessage = customMessages[fieldPath];
                return {
                    ...err,
                    message: customMessage || err.message
                };
            });
            const customError = new z.ZodError(updatedErrors);
            throw customError;
        }
        throw error;
    }
}
//# sourceMappingURL=validationErrorHandler.js.map