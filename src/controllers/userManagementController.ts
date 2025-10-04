import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import createHttpError from "http-errors";
import { User } from "../models/User";
import { Teacher } from "../models/Teacher";
import { Student } from "../models/Student";

const CreateTeacherSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  subjectIds: z.array(z.string()).default([]),
  classIds: z.array(z.string()).default([]),
  phone: z.string().optional(),
  address: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.number().optional(),
});

export async function createTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name, subjectIds, classIds, phone, address, qualification, experience } = CreateTeacherSchema.parse(req.body);
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    
    console.log('🔍 Creating teacher with data:', {
      email,
      name,
      subjectIds,
      classIds,
      phone,
      address,
      qualification,
      experience,
      adminId
    });
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }
    
    // First, check if any classes exist for this admin
    const { Class } = await import("../models/Class");
    const totalClasses = await Class.countDocuments({ adminId, isActive: true });
    if (totalClasses === 0) {
      throw new createHttpError.BadRequest("Cannot create teachers. Please create at least one class first.");
    }
    
    const exists = await User.findOne({ email, role: "TEACHER" });
    if (exists) throw new createHttpError.Conflict("Email already in use");
    
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, name, role: "TEACHER" });
    
    const teacher = await Teacher.create({ 
      userId: user._id, 
      adminId,
      subjectIds,
      classIds,
      phone,
      address,
      qualification,
      experience
    });
    
    console.log('✅ Teacher created with ID:', teacher._id);
    console.log('🔍 Teacher classIds after creation:', teacher.classIds);
    
    res.status(201).json({ success: true, teacher: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('❌ Error creating teacher:', err);
    next(err);
  }
}

const CreateStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  rollNumber: z.string().min(1),
  className: z.string().min(1),
});

export async function createStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name, rollNumber, className } = CreateStudentSchema.parse(req.body);
    const exists = await User.findOne({ email });
    if (exists) throw new createHttpError.Conflict("Email already in use");
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, name, role: "STUDENT" });
    await Student.create({ userId: user._id, rollNumber, className });
    res.status(201).json({ success: true, student: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
}


