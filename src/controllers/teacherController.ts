import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import createHttpError from "http-errors";
import { User } from "../models/User";
import { Teacher } from "../models/Teacher";
import { Subject } from "../models/Subject";

const CreateTeacherSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  subjectIds: z.array(z.string()).default([]),
  classIds: z.array(z.string()).default([]),
  phone: z.string().optional(),
  address: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.string().optional(),
});

const UpdateTeacherSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
  subjectIds: z.array(z.string()).optional(),
  classIds: z.array(z.string()).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.number().optional(),
  isActive: z.boolean().optional(),
});

const GetTeachersQuerySchema = z.object({
  page: z.string().transform(Number).default(1),
  limit: z.string().transform(Number).default(10),
  search: z.string().optional(),
  isActive: z.string().transform(Boolean).optional(),
});

// Create Teacher
export async function createTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherData = CreateTeacherSchema.parse(req.body);
    const { email, password, name, subjectIds, classIds, ...additionalData } = teacherData;
    
    const exists = await User.findOne({ email });
    if (exists) throw new createHttpError.Conflict("Email already in use");
    
    // Validate that all subjects exist and are active
    if (subjectIds && subjectIds.length > 0) {
      const subjects = await Subject.find({ 
        _id: { $in: subjectIds }, 
        isActive: true 
      });
      
      if (subjects.length !== subjectIds.length) {
        throw new createHttpError.BadRequest("One or more subjects not found or inactive");
      }
    }
    
    // Validate that all classes exist and are active
    if (classIds && classIds.length > 0) {
      const { Class } = await import("../models/Class");
      const classes = await Class.find({ 
        _id: { $in: classIds }, 
        isActive: true 
      });
      
      if (classes.length !== classIds.length) {
        throw new createHttpError.BadRequest("One or more classes not found or inactive");
      }
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ 
      email, 
      passwordHash, 
      name, 
      role: "TEACHER",
      isActive: true 
    });
    
    const teacher = await Teacher.create({ 
      userId: user._id, 
      subjectIds,
      classIds,
      ...additionalData
    });
    
    // Populate subject and class information for response
    const populatedTeacher = await Teacher.findById(teacher._id)
      .populate('subjectIds', 'code name shortName category level')
      .populate('classIds', 'name displayName level section');
    
    res.status(201).json({ 
      success: true, 
      teacher: { 
        id: user._id, 
        email: user.email, 
        name: user.name,
        subjects: populatedTeacher!.subjectIds ? populatedTeacher!.subjectIds.map((subject: any) => ({
          id: subject._id,
          code: subject.code,
          name: subject.name,
          shortName: subject.shortName,
          category: subject.category,
          level: subject.level
        })) : [],
        classes: populatedTeacher!.classIds ? populatedTeacher!.classIds.map((classItem: any) => ({
          id: classItem._id,
          name: classItem.name,
          displayName: classItem.displayName,
          level: classItem.level,
          section: classItem.section
        })) : [],
        phone: teacher.phone,
        address: teacher.address,
        qualification: teacher.qualification,
        experience: teacher.experience,
        isActive: user.isActive,
        createdAt: (user as any).createdAt
      } 
    });
  } catch (err) {
    next(err);
  }
}

// Get All Teachers
export async function getTeachers(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, isActive } = GetTeachersQuerySchema.parse(req.query);
    
    const query: any = {};
    
    if (search) {
      query.$or = [
        { qualification: { $regex: search, $options: "i" } },
        { experience: { $regex: search, $options: "i" } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [teachers, total] = await Promise.all([
      Teacher.find(query)
        .populate('userId', 'name email isActive createdAt')
        .populate('subjectIds', 'code name shortName category level')
        .populate('classIds', 'name displayName level section')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Teacher.countDocuments(query)
    ]);
    
    // Transform the data to include all form fields
    const transformedTeachers = teachers.map(teacher => ({
      id: teacher.userId._id,
      email: (teacher.userId as any).email,
      name: (teacher.userId as any).name,
      subjects: teacher.subjectIds ? teacher.subjectIds.map((subject: any) => ({
        id: subject._id,
        code: subject.code,
        name: subject.name,
        shortName: subject.shortName,
        category: subject.category,
        level: subject.level
      })) : [],
      classes: teacher.classIds ? teacher.classIds.map((classItem: any) => ({
        id: classItem._id,
        name: classItem.name,
        displayName: classItem.displayName,
        level: classItem.level,
        section: classItem.section
      })) : [],
      phone: teacher.phone,
      address: teacher.address,
      qualification: teacher.qualification,
      experience: teacher.experience,
      department: teacher.department,
      isActive: (teacher.userId as any).isActive,
      createdAt: (teacher.userId as any).createdAt,
      updatedAt: (teacher as any).updatedAt
    }));
    
    res.json({
      success: true,
      data: transformedTeachers,
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

// Get Single Teacher
export async function getTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const teacher = await Teacher.findOne({ userId: id })
      .populate('userId', 'name email isActive createdAt')
      .populate('subjectIds', 'code name shortName category level')
      .populate('classIds', 'name displayName level section');
    
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    // Transform the data to include all form fields
    const transformedTeacher = {
      id: teacher.userId._id,
      email: (teacher.userId as any).email,
      name: (teacher.userId as any).name,
      subjects: teacher.subjectIds ? teacher.subjectIds.map((subject: any) => ({
        id: subject._id,
        code: subject.code,
        name: subject.name,
        shortName: subject.shortName,
        category: subject.category,
        level: subject.level
      })) : [],
      classes: teacher.classIds ? teacher.classIds.map((classItem: any) => ({
        id: classItem._id,
        name: classItem.name,
        displayName: classItem.displayName,
        level: classItem.level,
        section: classItem.section
      })) : [],
      phone: teacher.phone,
      address: teacher.address,
      qualification: teacher.qualification,
      experience: teacher.experience,
      department: teacher.department,
      isActive: (teacher.userId as any).isActive,
      createdAt: (teacher.userId as any).createdAt,
      updatedAt: (teacher as any).updatedAt
    };
    
    res.json({ success: true, teacher: transformedTeacher });
  } catch (err) {
    next(err);
  }
}

// Update Teacher
export async function updateTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = UpdateTeacherSchema.parse(req.body);
    console.log(updateData,"updateData")
    
    const teacher = await Teacher.findOne({ userId: id }).populate('userId');
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    // Check if email is being changed and if it's already in use
    if (updateData.email && updateData.email !== (teacher.userId as any).email) {
      const emailExists = await User.findOne({ email: updateData.email });
      if (emailExists) throw new createHttpError.Conflict("Email already in use");
    }
    
    // Validate subjects if being updated
    if (updateData.subjectIds && updateData.subjectIds.length > 0) {
      const subjects = await Subject.find({ 
        _id: { $in: updateData.subjectIds }, 
        isActive: true 
      });
      
      if (subjects.length !== updateData.subjectIds.length) {
        throw new createHttpError.BadRequest("One or more subjects not found or inactive");
      }
    }
    
    // Validate classes if being updated
    if (updateData.classIds && updateData.classIds.length > 0) {
      const { Class } = await import("../models/Class");
      const classes = await Class.find({ 
        _id: { $in: updateData.classIds }, 
        isActive: true 
      });
      
      if (classes.length !== updateData.classIds.length) {
        throw new createHttpError.BadRequest("One or more classes not found or inactive");
      }
    }
    
    // Update user data
    const userUpdateData: any = {};
    if (updateData.email) userUpdateData.email = updateData.email;
    if (updateData.name) userUpdateData.name = updateData.name;
    if (updateData.isActive !== undefined) userUpdateData.isActive = updateData.isActive;
    
    if (Object.keys(userUpdateData).length > 0) {
      await User.findByIdAndUpdate(id, userUpdateData, { runValidators: true });
    }
    
    // Update teacher data
    const teacherUpdateData = { ...updateData };
    delete teacherUpdateData.email;
    delete teacherUpdateData.name;
    delete teacherUpdateData.isActive;
    
    if (Object.keys(teacherUpdateData).length > 0) {
      await Teacher.findByIdAndUpdate(teacher._id, teacherUpdateData, { runValidators: true });
    }
    
    const updatedTeacher = await Teacher.findOne({ userId: id })
      .populate('userId', 'name email isActive createdAt')
      .populate('subjectIds', 'code name shortName category level')
      .populate('classIds', 'name displayName level section');
    
    // Transform the data to include all form fields
    const transformedTeacher = {
      id: updatedTeacher!.userId._id,
      email: (updatedTeacher!.userId as any).email,
      name: (updatedTeacher!.userId as any).name,
      subjects: updatedTeacher!.subjectIds ? updatedTeacher!.subjectIds.map((subject: any) => ({
        id: subject._id,
        code: subject.code,
        name: subject.name,
        shortName: subject.shortName,
        category: subject.category,
        level: subject.level
      })) : [],
      classes: updatedTeacher!.classIds ? updatedTeacher!.classIds.map((classItem: any) => ({
        id: classItem._id,
        name: classItem.name,
        displayName: classItem.displayName,
        level: classItem.level,
        section: classItem.section
      })) : [],
      phone: updatedTeacher!.phone,
      address: updatedTeacher!.address,
      qualification: updatedTeacher!.qualification,
      experience: updatedTeacher!.experience,
      department: updatedTeacher!.department,
      isActive: (updatedTeacher!.userId as any).isActive,
      createdAt: (updatedTeacher!.userId as any).createdAt,
      updatedAt: (updatedTeacher as any).updatedAt
    };
    
    res.json({ success: true, teacher: transformedTeacher });
  } catch (err) {
    next(err);
  }
}

// Delete Teacher (Hard delete)
export async function deleteTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const teacher = await Teacher.findOne({ userId: id });
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    // Delete both teacher record and user record
    await Promise.all([
      Teacher.findByIdAndDelete(teacher._id),
      User.findByIdAndDelete(id)
    ]);
    
    res.json({ success: true, message: "Teacher deleted successfully" });
  } catch (err) {
    next(err);
  }
}

// Activate Teacher
export async function activateTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const teacher = await Teacher.findOne({ userId: id });
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    await User.findByIdAndUpdate(id, { isActive: true });
    
    res.json({ success: true, message: "Teacher activated successfully" });
  } catch (err) {
    next(err);
  }
}


// Assign Subjects to Teacher
export async function assignSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { subjectIds } = z.object({ subjectIds: z.array(z.string()) }).parse(req.body);
    
    const teacher = await Teacher.findOne({ userId: id });
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    // Validate that all subjects exist and are active
    if (subjectIds && subjectIds.length > 0) {
      const subjects = await Subject.find({ 
        _id: { $in: subjectIds }, 
        isActive: true 
      });
      
      if (subjects.length !== subjectIds.length) {
        throw new createHttpError.BadRequest("One or more subjects not found or inactive");
      }
    }
    
    await Teacher.findByIdAndUpdate(teacher._id, { subjectIds });
    
    const updatedTeacher = await Teacher.findOne({ userId: id })
      .populate('userId', 'name email isActive')
      .populate('subjectIds', 'code name shortName category level')
      .populate('classIds', 'name displayName level section');
    
    // Transform the data to include all form fields
    const transformedTeacher = {
      id: updatedTeacher!.userId._id,
      email: (updatedTeacher!.userId as any).email,
      name: (updatedTeacher!.userId as any).name,
      subjects: updatedTeacher!.subjectIds ? updatedTeacher!.subjectIds.map((subject: any) => ({
        id: subject._id,
        code: subject.code,
        name: subject.name,
        shortName: subject.shortName,
        category: subject.category,
        level: subject.level
      })) : [],
      classes: updatedTeacher!.classIds ? updatedTeacher!.classIds.map((classItem: any) => ({
        id: classItem._id,
        name: classItem.name,
        displayName: classItem.displayName,
        level: classItem.level,
        section: classItem.section
      })) : [],
      phone: updatedTeacher!.phone,
      address: updatedTeacher!.address,
      qualification: updatedTeacher!.qualification,
      experience: updatedTeacher!.experience,
      department: updatedTeacher!.department,
      isActive: (updatedTeacher!.userId as any).isActive,
      createdAt: (updatedTeacher!.userId as any).createdAt,
      updatedAt: (updatedTeacher as any).updatedAt
    };
    
    res.json({ success: true, teacher: transformedTeacher });
  } catch (err) {
    next(err);
  }
}

// Assign Classes to Teacher
export async function assignClasses(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { classIds } = z.object({ classIds: z.array(z.string()) }).parse(req.body);
    
    const teacher = await Teacher.findOne({ userId: id });
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    // Validate that all classes exist and are active
    if (classIds && classIds.length > 0) {
      const { Class } = await import("../models/Class");
      const classes = await Class.find({ 
        _id: { $in: classIds }, 
        isActive: true 
      });
      
      if (classes.length !== classIds.length) {
        throw new createHttpError.BadRequest("One or more classes not found or inactive");
      }
    }
    
    await Teacher.findByIdAndUpdate(teacher._id, { classIds });
    
    const updatedTeacher = await Teacher.findOne({ userId: id })
      .populate('userId', 'name email isActive')
      .populate('subjectIds', 'code name shortName category level')
      .populate('classIds', 'name displayName level section');
    
    // Transform the data to include all form fields
    const transformedTeacher = {
      id: updatedTeacher!.userId._id,
      email: (updatedTeacher!.userId as any).email,
      name: (updatedTeacher!.userId as any).name,
      subjects: updatedTeacher!.subjectIds ? updatedTeacher!.subjectIds.map((subject: any) => ({
        id: subject._id,
        code: subject.code,
        name: subject.name,
        shortName: subject.shortName,
        category: subject.category,
        level: subject.level
      })) : [],
      classes: updatedTeacher!.classIds ? updatedTeacher!.classIds.map((classItem: any) => ({
        id: classItem._id,
        name: classItem.name,
        displayName: classItem.displayName,
        level: classItem.level,
        section: classItem.section
      })) : [],
      phone: updatedTeacher!.phone,
      address: updatedTeacher!.address,
      qualification: updatedTeacher!.qualification,
      experience: updatedTeacher!.experience,
      department: updatedTeacher!.department,
      isActive: (updatedTeacher!.userId as any).isActive,
      createdAt: (updatedTeacher!.userId as any).createdAt,
      updatedAt: (updatedTeacher as any).updatedAt
    };
    
    res.json({ success: true, teacher: transformedTeacher });
  } catch (err) {
    next(err);
  }
}

// Assign Permissions to Teacher (Comprehensive Assignment)
export async function assignPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { subjectIds, classIds, permissions } = z.object({ 
      subjectIds: z.array(z.string()).optional(),
      classIds: z.array(z.string()).optional(),
      permissions: z.object({
        createQuestions: z.boolean().optional(),
        viewResults: z.boolean().optional(),
        manageStudents: z.boolean().optional(),
        accessAnalytics: z.boolean().optional()
      }).optional()
    }).parse(req.body);
    
    const teacher = await Teacher.findOne({ userId: id });
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    // Validate subjects if provided
    if (subjectIds && subjectIds.length > 0) {
      const subjects = await Subject.find({ 
        _id: { $in: subjectIds }, 
        isActive: true 
      });
      
      if (subjects.length !== subjectIds.length) {
        throw new createHttpError.BadRequest("One or more subjects not found or inactive");
      }
    }
    
    // Validate classes if provided
    if (classIds && classIds.length > 0) {
      const { Class } = await import("../models/Class");
      const classes = await Class.find({ 
        _id: { $in: classIds }, 
        isActive: true 
      });
      
      if (classes.length !== classIds.length) {
        throw new createHttpError.BadRequest("One or more classes not found or inactive");
      }
    }
    
    // Update teacher permissions
    const updateData: any = {};
    if (subjectIds !== undefined) updateData.subjectIds = subjectIds;
    if (classIds !== undefined) updateData.classIds = classIds;
    if (permissions !== undefined) updateData.permissions = permissions;
    
    await Teacher.findByIdAndUpdate(teacher._id, updateData);
    
    const updatedTeacher = await Teacher.findOne({ userId: id })
      .populate('userId', 'name email isActive')
      .populate('subjectIds', 'code name shortName category level')
      .populate('classIds', 'name displayName level section');
    
    // Transform the data to include all form fields
    const transformedTeacher = {
      id: updatedTeacher!.userId._id,
      email: (updatedTeacher!.userId as any).email,
      name: (updatedTeacher!.userId as any).name,
      subjects: updatedTeacher!.subjectIds ? updatedTeacher!.subjectIds.map((subject: any) => ({
        id: subject._id,
        code: subject.code,
        name: subject.name,
        shortName: subject.shortName,
        category: subject.category,
        level: subject.level
      })) : [],
      classes: updatedTeacher!.classIds ? updatedTeacher!.classIds.map((classItem: any) => ({
        id: classItem._id,
        name: classItem.name,
        displayName: classItem.displayName,
        level: classItem.level,
        section: classItem.section
      })) : [],
      permissions: updatedTeacher!.permissions || {
        createQuestions: false,
        viewResults: false,
        manageStudents: false,
        accessAnalytics: false
      },
      phone: updatedTeacher!.phone,
      address: updatedTeacher!.address,
      qualification: updatedTeacher!.qualification,
      experience: updatedTeacher!.experience,
      department: updatedTeacher!.department,
      isActive: (updatedTeacher!.userId as any).isActive,
      createdAt: (updatedTeacher!.userId as any).createdAt,
      updatedAt: (updatedTeacher as any).updatedAt
    };
    
    res.json({ 
      success: true, 
      message: "Teacher permissions updated successfully",
      teacher: transformedTeacher 
    });
  } catch (err) {
    next(err);
  }
}

// Get Teacher's Assigned Data (for teachers to see their permissions)
export async function getTeacherPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const teacher = await Teacher.findOne({ userId: id })
      .populate('userId', 'name email isActive')
      .populate('subjectIds', 'code name shortName category level')
      .populate('classIds', 'name displayName level section');
    
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    const permissions = {
      id: teacher.userId._id,
      email: (teacher.userId as any).email,
      name: (teacher.userId as any).name,
      subjects: teacher.subjectIds ? teacher.subjectIds.map((subject: any) => ({
        id: subject._id,
        code: subject.code,
        name: subject.name,
        shortName: subject.shortName,
        category: subject.category,
        level: subject.level
      })) : [],
      classes: teacher.classIds ? teacher.classIds.map((classItem: any) => ({
        id: classItem._id,
        name: classItem.name,
        displayName: classItem.displayName,
        level: classItem.level,
        section: classItem.section
      })) : [],
      permissions: teacher.permissions || {
        createQuestions: false,
        viewResults: false,
        manageStudents: false,
        accessAnalytics: false
      },
      isActive: (teacher.userId as any).isActive
    };
    
    res.json({ success: true, permissions });
  } catch (err) {
    next(err);
  }
}