import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import createHttpError from "http-errors";
import { User } from "../models/User";
import { handleZodValidationError } from "../utils/validationErrorHandler";

const CreateAdminSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  name: z.string().min(2, "Name must be at least 2 characters long"),
});

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = CreateAdminSchema.parse(req.body);
    const exists = await User.findOne({ email });
    if (exists) throw new createHttpError.Conflict("Email already in use");
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await User.create({ email, passwordHash, name, role: "ADMIN" });
    res.status(201).json({ success: true, admin: { id: admin._id, email: admin.email, name: admin.name, role: admin.role } });
  } catch (err) {
    // Handle Zod validation errors with user-friendly messages
    if (handleZodValidationError(err, res)) {
      return;
    }
    next(err);
  }
}


