import { logger } from '../utils/logger';
/**
 * Validation middleware for AI answer checking endpoints
 */
export const validateAIRequest = (req, res, next) => {
    try {
        const { answerSheetId } = req.params;
        const { answerSheetIds } = req.body;
        // Validate single answer sheet ID
        if (answerSheetId && !isValidObjectId(answerSheetId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid answer sheet ID format'
            });
        }
        // Validate batch request
        if (answerSheetIds) {
            if (!Array.isArray(answerSheetIds)) {
                return res.status(400).json({
                    success: false,
                    error: 'answerSheetIds must be an array'
                });
            }
            if (answerSheetIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'answerSheetIds array cannot be empty'
                });
            }
            if (answerSheetIds.length > 50) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 50 answer sheets can be processed at once'
                });
            }
            // Validate each ID
            for (const id of answerSheetIds) {
                if (!isValidObjectId(id)) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid answer sheet ID format: ${id}`
                    });
                }
            }
        }
        next();
    }
    catch (error) {
        logger.error('AI validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Validation error'
        });
    }
};
/**
 * Validate manual override request
 */
export const validateOverrideRequest = (req, res, next) => {
    try {
        const { questionId, correctedAnswer, correctedMarks, reason } = req.body;
        if (!questionId || !isValidObjectId(questionId)) {
            return res.status(400).json({
                success: false,
                error: 'Valid questionId is required'
            });
        }
        if (!correctedAnswer || typeof correctedAnswer !== 'string' || correctedAnswer.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid correctedAnswer is required'
            });
        }
        if (correctedMarks === undefined || correctedMarks === null || typeof correctedMarks !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'Valid correctedMarks is required'
            });
        }
        if (correctedMarks < 0) {
            return res.status(400).json({
                success: false,
                error: 'correctedMarks cannot be negative'
            });
        }
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid reason is required'
            });
        }
        if (reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                error: 'Reason must be at least 10 characters long'
            });
        }
        next();
    }
    catch (error) {
        logger.error('Override validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Validation error'
        });
    }
};
/**
 * Validate pagination parameters
 */
export const validatePagination = (req, res, next) => {
    try {
        const { page, limit, status } = req.query;
        // Validate page
        if (page) {
            const pageNum = parseInt(page);
            if (isNaN(pageNum) || pageNum < 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Page must be a positive integer'
                });
            }
        }
        // Validate limit
        if (limit) {
            const limitNum = parseInt(limit);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Limit must be between 1 and 100'
                });
            }
        }
        // Validate status
        if (status) {
            const validStatuses = ['UPLOADED', 'PROCESSING', 'AI_CORRECTED', 'MANUALLY_REVIEWED', 'COMPLETED', 'MISSING', 'ABSENT'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
                });
            }
        }
        next();
    }
    catch (error) {
        logger.error('Pagination validation error:', error);
        res.status(500).json({
            success: false,
            error: 'Validation error'
        });
    }
};
/**
 * Rate limiting for AI processing
 */
export const rateLimitAI = (req, res, next) => {
    try {
        const userId = req.auth?.sub;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }
        // Simple in-memory rate limiting (in production, use Redis)
        const rateLimitKey = `ai_rate_limit_${userId}`;
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        const maxRequests = 10; // 10 requests per minute
        // This is a simplified rate limiting - in production, use proper rate limiting middleware
        // For now, we'll just pass through
        next();
    }
    catch (error) {
        logger.error('Rate limiting error:', error);
        res.status(500).json({
            success: false,
            error: 'Rate limiting error'
        });
    }
};
/**
 * Validate file upload for answer sheets
 */
export const validateAnswerSheetUpload = (req, res, next) => {
    try {
        const files = req.files;
        const { examId } = req.params;
        if (!examId || !isValidObjectId(examId)) {
            return res.status(400).json({
                success: false,
                error: 'Valid examId is required'
            });
        }
        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No files uploaded'
            });
        }
        if (files.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 files can be uploaded at once'
            });
        }
        // Validate each file
        for (const file of files) {
            if (!file.originalname) {
                return res.status(400).json({
                    success: false,
                    error: 'File must have a name'
                });
            }
            if (file.size > 10 * 1024 * 1024) { // 10MB
                return res.status(400).json({
                    success: false,
                    error: `File ${file.originalname} is too large. Maximum size is 10MB`
                });
            }
            if (file.size === 0) {
                return res.status(400).json({
                    success: false,
                    error: `File ${file.originalname} is empty`
                });
            }
            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    success: false,
                    error: `File ${file.originalname} has invalid type. Only PDF and image files are allowed`
                });
            }
        }
        next();
    }
    catch (error) {
        logger.error('File upload validation error:', error);
        res.status(500).json({
            success: false,
            error: 'File validation error'
        });
    }
};
/**
 * Helper function to validate MongoDB ObjectId
 */
function isValidObjectId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id);
}
/**
 * Error handling middleware for AI operations
 */
export const handleAIError = (error, req, res, next) => {
    logger.error('AI operation error:', error);
    // Handle specific error types
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation error',
            details: error.message
        });
    }
    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: 'Invalid ID format'
        });
    }
    if (error.code === 11000) {
        return res.status(409).json({
            success: false,
            error: 'Duplicate entry'
        });
    }
    if (error.name === 'MongoError' && error.code === 11000) {
        return res.status(409).json({
            success: false,
            error: 'Duplicate entry'
        });
    }
    // Handle timeout errors
    if (error.code === 'TIMEOUT') {
        return res.status(408).json({
            success: false,
            error: 'Request timeout',
            details: 'AI processing took too long'
        });
    }
    // Handle rate limiting errors
    if (error.code === 'RATE_LIMIT') {
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            details: 'Too many requests. Please try again later.'
        });
    }
    // Default error response
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
};
//# sourceMappingURL=aiValidation.js.map