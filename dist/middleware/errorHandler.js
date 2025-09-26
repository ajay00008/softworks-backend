import createHttpError from "http-errors";
import logger from "../utils/logger";
// Not found handler
export function notFoundHandler(_req, _res, next) {
    next(new createHttpError.NotFound("Route not found"));
}
// Centralized error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err, _req, res, _next) {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    logger.error(message, { status, stack: err.stack, name: err.name, code: err.code });
    res.status(status).json({
        success: false,
        error: {
            message,
            ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
        },
    });
}
//# sourceMappingURL=errorHandler.js.map