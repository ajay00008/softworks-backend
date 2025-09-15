import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import createHttpError from "http-errors";
import { User } from "../models/User";

const CreateAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
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
    next(err);
  }
}


