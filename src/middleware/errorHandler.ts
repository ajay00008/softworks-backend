import type { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import logger from "../utils/logger";

// Not found handler
export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new createHttpError.NotFound("Route not found"));
}

// Centralized error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
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


