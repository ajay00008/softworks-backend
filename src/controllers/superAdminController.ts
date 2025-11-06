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

const UpdateAdminSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});

const GetAdminsQuerySchema = z.object({
  page: z.string().transform(Number).default("1"),
  limit: z.string().transform(Number).default("10"),
  search: z.string().optional(),
  isActive: z.string().transform(Boolean).optional(),
});

// Create Admin
export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = CreateAdminSchema.parse(req.body);
    
    const exists = await User.findOne({ email });
    if (exists) throw new createHttpError.Conflict("Email already in use");
    
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await User.create({ 
      email, 
      passwordHash, 
      name, 
      role: "ADMIN",
      isActive: true 
    });
    
    res.status(201).json({ 
      success: true, 
      admin: { 
        id: admin._id, 
        email: admin.email, 
        name: admin.name, 
        role: admin.role,
        isActive: admin.isActive,
        createdAt: (admin as any).createdAt
      } 
    });
  } catch (err) {
    next(err);
  }
}

// Get All Admins
export async function getAdmins(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, isActive } = GetAdminsQuerySchema.parse(req.query);
    
    const query: any = { role: "ADMIN" };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive;
    }
    
    const skip = (page - 1) * limit;
    
    const [admins, total] = await Promise.all([
      User.find(query)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: admins,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get Single Admin
export async function getAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const admin = await User.findOne({ _id: id, role: "ADMIN" }).select("-passwordHash");
    if (!admin) throw new createHttpError.NotFound("Admin not found");
    
    res.json({ success: true, admin });
  } catch (err) {
    next(err);
  }
}

// Update Admin
export async function updateAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = UpdateAdminSchema.parse(req.body);
    
    const admin = await User.findOne({ _id: id, role: "ADMIN" });
    if (!admin) throw new createHttpError.NotFound("Admin not found");
    
    // Check if email is being changed and if it's already in use
    if (updateData.email && updateData.email !== admin.email) {
      const emailExists = await User.findOne({ email: updateData.email });
      if (emailExists) throw new createHttpError.Conflict("Email already in use");
    }
    
    const updatedAdmin = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select("-passwordHash");
    
    res.json({ success: true, admin: updatedAdmin });
  } catch (err) {
    next(err);
  }
}

// Delete Admin (Soft delete)
export async function deleteAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const admin = await User.findOne({ _id: id, role: "ADMIN" });
    if (!admin) throw new createHttpError.NotFound("Admin not found");
    
    await User.findByIdAndUpdate(id, { isActive: false });
    
    res.json({ success: true, message: "Admin deactivated successfully" });
  } catch (err) {
    next(err);
  }
}

// Activate Admin
export async function activateAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const admin = await User.findOne({ _id: id, role: "ADMIN" });
    if (!admin) throw new createHttpError.NotFound("Admin not found");
    
    await User.findByIdAndUpdate(id, { isActive: true });
    
    res.json({ success: true, message: "Admin activated successfully" });
  } catch (err) {
    next(err);
  }
}
