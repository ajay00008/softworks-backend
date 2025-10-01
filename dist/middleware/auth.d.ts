import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../models/User";
export interface AuthPayload {
    sub: string;
    role: UserRole;
    adminId?: string;
}
export declare function requireAuth(req: Request, _res: Response, next: NextFunction): void;
export declare function requireRoles(...roles: UserRole[]): (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map