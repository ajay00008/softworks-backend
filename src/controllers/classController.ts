import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import createHttpError from "http-errors";
import { Class } from "../models/Class";

const CreateClassSchema = z.object({
  name: z.string(),
  displayName: z.string().min(1),
  level: z.number().int().min(1).max(12),
  section: z.string(),
  description: z.string().optional(),
});

const UpdateClassSchema = z.object({
  name: z.string(),
  displayName: z.string().min(1).optional(),
  level: z.number().int().min(1).max(12).optional(),
  section: z.string(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const GetClassesQuerySchema = z.object({
  page: z.union([z.string(), z.number()]).transform(Number).default(1),
  limit: z.union([z.string(), z.number()]).transform(Number).default(10),
  search: z.string().optional(),
  level: z.string().transform(Number).optional(),
  isActive: z.string().transform(Boolean).optional(),
});

// Create Class
export async function createClass(req: Request, res: Response, next: NextFunction) {
  try {
    const classData = CreateClassSchema.parse(req.body);
    
    // Check if class already exists
    const existing = await Class.findOne({ 
      name: classData.name.toUpperCase(), 
    });
    if (existing) throw new createHttpError.Conflict("Class already exists for this academic year");
    
    const newClass = await Class.create({
      ...classData,
      name: classData.name.toUpperCase(),
      section: classData.section.toUpperCase()
    });
    
    res.status(201).json({ 
      success: true, 
      class: newClass
    });
  } catch (err) {
    next(err);
  }
}

// Get All Classes
export async function getClasses(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, level, isActive } = GetClassesQuerySchema.parse(req.query);
    
    const query: any = {};
    
    if (level) {
      query.level = level;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { displayName: { $regex: search, $options: "i" } },
        { section: { $regex: search, $options: "i" } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [classes, total] = await Promise.all([
      Class.find(query)
        .sort({ level: 1, section: 1 })
        .skip(skip)
        .limit(limit),
      Class.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: classes,
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

// Get Single Class
export async function getClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const classData = await Class.findById(id);
    if (!classData) throw new createHttpError.NotFound("Class not found");
    
    res.json({ success: true, class: classData });
  } catch (err) {
    next(err);
  }
}

// Update Class
export async function updateClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = UpdateClassSchema.parse(req.body);
    
    const classData = await Class.findById(id);
    if (!classData) throw new createHttpError.NotFound("Class not found");
    
    // Check if name and academic year combination already exists (if being changed)
    if (updateData.name) {
      const name = updateData.name?.toUpperCase() || classData.name;
      
      const existing = await Class.findOne({ 
        name, 
        _id: { $ne: id }
      });
      if (existing) throw new createHttpError.Conflict("Class already exists for this academic year");
    }
    
    // Update data
    const updatedData = { ...updateData };
    if (updatedData.name) updatedData.name = updatedData.name.toUpperCase();
    if (updatedData.section) updatedData.section = updatedData.section.toUpperCase();
    
    const updatedClass = await Class.findByIdAndUpdate(id, updatedData, { 
      new: true, 
      runValidators: true 
    });
    
    res.json({ success: true, class: updatedClass });
  } catch (err) {
    next(err);
  }
}

// Delete Class
export async function deleteClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const classData = await Class.findById(id);
    if (!classData) throw new createHttpError.NotFound("Class not found");
    
    await Class.findByIdAndDelete(id);
    
    res.json({ success: true, message: "Class deleted successfully" });
  } catch (err) {
    next(err);
  }
}

// Get Classes by Level
export async function getClassesByLevel(req: Request, res: Response, next: NextFunction) {
  try {
    const { level } = req.params;
    
    const query: any = { level: parseInt(level) };
    
    const classes = await Class.find(query)
      .sort({ section: 1 })
      .select('name displayName section isActive');
    
    res.json({ success: true, data: classes });
  } catch (err) {
    next(err);
  }
}
