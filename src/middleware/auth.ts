import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import createHttpError from "http-errors";
import { env } from "../config/env";
import type { UserRole } from "../models/User";

export interface AuthPayload {
  sub: string;
  role: UserRole;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return next(new createHttpError.Unauthorized("Missing Authorization header"));
  }
  const token = header.substring(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    (req as any).user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return next(new createHttpError.Unauthorized("Invalid or expired token"));
  }
}

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user as { id: string; role: UserRole } | undefined;
    if (!user) return next(new createHttpError.Unauthorized());
    if (!roles.includes(user.role)) {
      return next(new createHttpError.Forbidden("Insufficient role"));
    }
    next();
  };
}


