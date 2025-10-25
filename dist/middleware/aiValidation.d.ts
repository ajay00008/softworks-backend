import type { Request, Response, NextFunction } from 'express';
/**
 * Validation middleware for AI answer checking endpoints
 */
export declare const validateAIRequest: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Validate manual override request
 */
export declare const validateOverrideRequest: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Validate pagination parameters
 */
export declare const validatePagination: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Rate limiting for AI processing
 */
export declare const rateLimitAI: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Validate file upload for answer sheets
 */
export declare const validateAnswerSheetUpload: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Error handling middleware for AI operations
 */
export declare const handleAIError: (error: any, req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=aiValidation.d.ts.map