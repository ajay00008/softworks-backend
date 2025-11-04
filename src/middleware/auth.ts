import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import createHttpError from "http-errors";
import { env } from "../config/env";
import type { UserRole } from "../models/User";

export interface AuthPayload {
  sub: string;
  role: UserRole;
  adminId?: string; // Only present for ADMIN and SUPER_ADMIN roles
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return next(new createHttpError.Unauthorized("Missing Authorization header"));
  }
  const token = header.substring(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    (req as any).auth = payload;
    next();
  } catch (error: any) {
    // Log token validation errors for debugging
    if (error.name === 'TokenExpiredError') {
      console.log('[AUTH] ⚠️ Token expired:', {
        expiredAt: error.expiredAt,
        timestamp: new Date().toISOString()
      });
      return next(new createHttpError.Unauthorized("Token expired. Please log in again."));
    } else if (error.name === 'JsonWebTokenError') {
      console.log('[AUTH] ⚠️ Invalid token:', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return next(new createHttpError.Unauthorized("Invalid token. Please log in again."));
    }
    // Generic error fallback
    return next(new createHttpError.Unauthorized("Invalid or expired token"));
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const payload = (req as any).auth as AuthPayload | undefined;
    if (!payload) return next(new createHttpError.Unauthorized());
    if (!roles.includes(payload.role)) {
      return next(new createHttpError.Forbidden("Insufficient role"));
    }
    next();
  };
}

// Flexible auth middleware that accepts token from header or query parameter
// Useful for endpoints called via window.open() which can't send headers
export function requireAuthFlexible(req: Request, _res: Response, next: NextFunction) {
  // Try to get token from Authorization header first
  const header = req.header("Authorization");
  let token: string | undefined;
  
  if (header && header.startsWith("Bearer ")) {
    token = header.substring(7);
  } else {
    // Fallback to query parameter (for window.open() calls)
    token = req.query.token as string | undefined;
  }
  
  if (!token) {
    return next(new createHttpError.Unauthorized("Missing authorization token"));
  }
  
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    (req as any).auth = payload;
    next();
  } catch (error: any) {
    // Log token validation errors for debugging
    if (error.name === 'TokenExpiredError') {
      console.log('[AUTH] ⚠️ Token expired:', {
        expiredAt: error.expiredAt,
        timestamp: new Date().toISOString()
      });
      return next(new createHttpError.Unauthorized("Token expired. Please log in again."));
    } else if (error.name === 'JsonWebTokenError') {
      console.log('[AUTH] ⚠️ Invalid token:', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return next(new createHttpError.Unauthorized("Invalid token. Please log in again."));
    }
    // Generic error fallback
    return next(new createHttpError.Unauthorized("Invalid or expired token"));
  }
}


