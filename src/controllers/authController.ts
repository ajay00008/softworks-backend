import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { env } from "../config/env";
import createHttpError from "http-errors";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const user = await User.findOne({ email });
    if (!user) throw new createHttpError.Unauthorized("Invalid credentials");
    
    // Verify password first (security best practice)
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new createHttpError.Unauthorized("Invalid credentials");
    
    // Check if account is deactivated after password verification
    if (!user.isActive) {
      throw new createHttpError.Unauthorized("Your account is deactivated");
    }

    const payload: any = { sub: (user._id as any).toString(), role: user.role };
    
    // Include adminId for ADMIN and SUPER_ADMIN roles
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
      payload.adminId = (user._id as any).toString();
    }
    
    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
    res.json({ success: true, token, user: { id: user._id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    next(err);
  }
}


