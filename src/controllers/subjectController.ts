import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import createHttpError from "http-errors";
import { Subject } from "../models/Subject";

const CreateSubjectSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/, "Subject code must contain only uppercase letters, numbers, and underscores"),
  name: z.string().min(1),
  shortName: z.string().min(1),
  category: z.enum(["SCIENCE", "MATHEMATICS", "LANGUAGES", "SOCIAL_SCIENCES", "COMMERCE", "ARTS", "PHYSICAL_EDUCATION", "COMPUTER_SCIENCE", "OTHER"]),
  level: z.array(z.number().int().min(1).max(12)).min(1),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code").optional(),
});

const UpdateSubjectSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/, "Subject code must contain only uppercase letters, numbers, and underscores").optional(),
  name: z.string().min(1).optional(),
  shortName: z.string().min(1).optional(),
  category: z.enum(["SCIENCE", "MATHEMATICS", "LANGUAGES", "SOCIAL_SCIENCES", "COMMERCE", "ARTS", "PHYSICAL_EDUCATION", "COMPUTER_SCIENCE", "OTHER"]).optional(),
  level: z.array(z.number().int().min(1).max(12)).min(1).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code").optional(),
  isActive: z.boolean().optional(),
});

const GetSubjectsQuerySchema = z.object({
  page: z.string().transform(Number).default(1),
  limit: z.string().transform(Number).default(10),
  search: z.string().optional(),
  category: z.string().optional(),
  level: z.string().transform(Number).optional(),
  isActive: z.string().transform(Boolean).optional(),
});

// Create Subject
export async function createSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectData = CreateSubjectSchema.parse(req.body);
    
    // Check if subject code already exists
    const existing = await Subject.findOne({ 
      code: subjectData.code.toUpperCase()
    });
    if (existing) throw new createHttpError.Conflict("Subject code already exists");
    
    const newSubject = await Subject.create({
      ...subjectData,
      code: subjectData.code.toUpperCase(),
      category: subjectData.category.toUpperCase()
    });
    
    res.status(201).json({ 
      success: true, 
      subject: newSubject
    });
  } catch (err) {
    next(err);
  }
}

// Get All Subjects
export async function getSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, category, level, isActive } = GetSubjectsQuerySchema.parse(req.query);
    
    const query: any = {};
    
    if (category) {
      query.category = category.toUpperCase();
    }
    
    if (level) {
      query.level = level;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive;
    }
    
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { shortName: { $regex: search, $options: "i" } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [subjects, total] = await Promise.all([
      Subject.find(query)
        .sort({ category: 1, name: 1 })
        .skip(skip)
        .limit(limit),
      Subject.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: subjects,
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

// Get Single Subject
export async function getSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const subject = await Subject.findById(id);
    if (!subject) throw new createHttpError.NotFound("Subject not found");
    
    res.json({ success: true, subject });
  } catch (err) {
    next(err);
  }
}

// Update Subject
export async function updateSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = UpdateSubjectSchema.parse(req.body);
    
    const subject = await Subject.findById(id);
    if (!subject) throw new createHttpError.NotFound("Subject not found");
    
    // Check if code already exists (if being changed)
    if (updateData.code && updateData.code !== subject.code) {
      const existing = await Subject.findOne({ 
        code: updateData.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (existing) throw new createHttpError.Conflict("Subject code already exists");
    }
    
    // Update data
    const updatedData = { ...updateData };
    if (updatedData.code) updatedData.code = updatedData.code.toUpperCase();
    if (updatedData.category) updatedData.category = updatedData.category.toUpperCase();
    
    const updatedSubject = await Subject.findByIdAndUpdate(id, updatedData, { 
      new: true, 
      runValidators: true 
    });
    
    res.json({ success: true, subject: updatedSubject });
  } catch (err) {
    next(err);
  }
}

// Delete Subject
export async function deleteSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const subject = await Subject.findById(id);
    if (!subject) throw new createHttpError.NotFound("Subject not found");
    
    await Subject.findByIdAndDelete(id);
    
    res.json({ success: true, message: "Subject deleted successfully" });
  } catch (err) {
    next(err);
  }
}

// Get Subjects by Category
export async function getSubjectsByCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { category } = req.params;
    const { level } = req.query;
    
    const query: any = { category: category.toUpperCase() };
    if (level) {
      query.level = parseInt(level as string);
    }
    
    const subjects = await Subject.find(query)
      .sort({ name: 1 })
      .select('code name shortName category level color isActive');
    
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
}

// Get Subjects by Level
export async function getSubjectsByLevel(req: Request, res: Response, next: NextFunction) {
  try {
    const { level } = req.params;
    
    const subjects = await Subject.find({ 
      level: parseInt(level),
      isActive: true 
    })
      .sort({ category: 1, name: 1 })
      .select('code name shortName category color');
    
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
}
