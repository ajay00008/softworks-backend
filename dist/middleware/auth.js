import jwt from "jsonwebtoken";
import createHttpError from "http-errors";
import { env } from "../config/env";
export function requireAuth(req, _res, next) {
    const header = req.header("Authorization");
    if (!header || !header.startsWith("Bearer ")) {
        return next(new createHttpError.Unauthorized("Missing Authorization header"));
    }
    const token = header.substring(7);
    try {
        const payload = jwt.verify(token, env.JWT_SECRET);
        req.auth = payload;
        next();
    }
    catch {
        return next(new createHttpError.Unauthorized("Invalid or expired token"));
    }
}
export function requireRoles(...roles) {
    return (req, _res, next) => {
        const payload = req.auth;
        if (!payload)
            return next(new createHttpError.Unauthorized());
        if (!roles.includes(payload.role)) {
            return next(new createHttpError.Forbidden("Insufficient role"));
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map