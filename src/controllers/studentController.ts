import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import createHttpError from "http-errors";
import { parse } from "csv-parse/sync";
import mongoose from "mongoose";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Class } from "../models/Class";

// Utility function to format date to yyyy-mm-dd
function formatDateToYYYYMMDD(dateString: string): string {
  if (!dateString || dateString.trim() === '') {
    return '';
  }
  
  try {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    // Format as yyyy-mm-dd
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    // If parsing fails, return the original string
    console.warn(`Failed to parse date: ${dateString}`, error);
    return dateString;
  }
}

const CreateStudentSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  rollNumber: z.string().min(1),
  classId: z.string().min(1),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  parentsPhone: z.string().optional(),
  parentsEmail: z.string().email().optional(),
  address: z.string().optional(),
  whatsappNumber: z.string().optional(),
});

const UpdateStudentSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).optional(),
  rollNumber: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  parentsPhone: z.string().optional(),
  parentsEmail: z.string().email().optional(),
  address: z.string().optional(),
  whatsappNumber: z.string().optional(),
  isActive: z.boolean().optional(),
});

const GetStudentsQuerySchema = z.object({
  page: z.string().transform(Number).default(1),
  limit: z.string().transform(Number).default(10),
  search: z.string().optional(),
  classId: z.string().optional(),
  isActive: z.string().transform(Boolean).optional(),
});

// Create Student
export async function createStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const studentData = CreateStudentSchema.parse(req.body);
    const { email, password, name, rollNumber, classId, ...additionalData } = studentData;
    
    const exists = await User.findOne({ email });
    if (exists) throw new createHttpError.Conflict("Email already in use");
    
    // Validate that the class exists and is active
    const classExists = await Class.findById(classId);
    if (!classExists) throw new createHttpError.NotFound("Class not found");
    if (!classExists.isActive) throw new createHttpError.BadRequest("Class is not active");
    
    // Check if roll number already exists in the same class
    const rollExists = await Student.findOne({ rollNumber, classId });
    if (rollExists) throw new createHttpError.Conflict("Roll number already exists in this class");
    
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ 
      email, 
      passwordHash, 
      name, 
      role: "STUDENT",
      isActive: true 
    });
    
    // Format dateOfBirth if provided
    const studentCreateData = { 
      userId: user._id, 
      rollNumber, 
      classId,
      ...additionalData
    };
    
    if (studentCreateData.dateOfBirth) {
      studentCreateData.dateOfBirth = formatDateToYYYYMMDD(studentCreateData.dateOfBirth);
    }
    
    const student = await Student.create(studentCreateData);
    
    // Populate class information for response
    const populatedStudent = await Student.findById(student._id).populate('classId', 'name displayName level section academicYear');
    
    res.status(201).json({ 
      success: true, 
      student: { 
        id: user._id, 
        email: user.email, 
        name: user.name,
        rollNumber: student.rollNumber,
        class: {
          id: (populatedStudent!.classId as any)._id,
          name: (populatedStudent!.classId as any).name,
          displayName: (populatedStudent!.classId as any).displayName,
          level: (populatedStudent!.classId as any).level,
          section: (populatedStudent!.classId as any).section,
          academicYear: (populatedStudent!.classId as any).academicYear
        },
        fatherName: student.fatherName,
        motherName: student.motherName,
        dateOfBirth: student.dateOfBirth,
        parentsPhone: student.parentsPhone,
        parentsEmail: student.parentsEmail,
        address: student.address,
        whatsappNumber: student.whatsappNumber,
        isActive: user.isActive,
        createdAt: (user as any).createdAt
      } 
    });
  } catch (err) {
    next(err);
  }
}

// Get All Students
export async function getStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, classId, isActive } = GetStudentsQuerySchema.parse(req.query);
    
    const skip = (page - 1) * limit;
    
    // Build aggregation pipeline
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $lookup: {
          from: 'classes',
          localField: 'classId',
          foreignField: '_id',
          as: 'class'
        }
      },
      {
        $unwind: '$class'
      }
    ];

    // Add classId filter
    if (classId) {
      pipeline.push({
        $match: {
          classId: new mongoose.Types.ObjectId(classId)
        }
      });
    }

    // Add search filter
    if (search) {
      pipeline.push({
        $match: {
          'user.name': { $regex: search, $options: 'i' }
        }
      });
    }

    // Add isActive filter
    if (isActive !== undefined) {
      pipeline.push({
        $match: {
          'user.isActive': isActive
        }
      });
    }

    // Add sorting
    pipeline.push({
      $sort: { 
        'class.level': 1, 
        'class.section': 1, 
        rollNumber: 1 
      }
    });

    // Get total count for pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Student.aggregate(countPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Add pagination
    pipeline.push(
      { $skip: skip },
      { $limit: limit }
    );

    const students = await Student.aggregate(pipeline);
    
    // Transform the data to include all form fields
    const transformedStudents = students.map(student => ({
      id: student.user._id,
      email: student.user.email,
      name: student.user.name,
      rollNumber: student.rollNumber,
      class: {
        id: student.class._id,
        name: student.class.name,
        displayName: student.class.displayName,
        level: student.class.level,
        section: student.class.section,
        academicYear: student.class.academicYear
      },
      fatherName: student.fatherName,
      motherName: student.motherName,
      dateOfBirth: student.dateOfBirth,
      parentsPhone: student.parentsPhone,
      parentsEmail: student.parentsEmail,
      address: student.address,
      whatsappNumber: student.whatsappNumber,
      isActive: student.user.isActive,
      createdAt: student.user.createdAt,
      updatedAt: student.updatedAt
    }));
    
    res.json({
      success: true,
      data: transformedStudents,
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

// Get Single Student
export async function getStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const student = await Student.findOne({ userId: id })
      .populate('userId', 'name email isActive createdAt')
      .populate('classId', 'name displayName level section academicYear');
    
    if (!student) throw new createHttpError.NotFound("Student not found");
    
    // Transform the data to include all form fields
    const transformedStudent = {
      id: student.userId._id,
      email: (student.userId as any).email,
      name: (student.userId as any).name,
      rollNumber: student.rollNumber,
      class: {
        id: (student.classId as any)._id,
        name: (student.classId as any).name,
        displayName: (student.classId as any).displayName,
        level: (student.classId as any).level,
        section: (student.classId as any).section,
        academicYear: (student.classId as any).academicYear
      },
      fatherName: student.fatherName,
      motherName: student.motherName,
      dateOfBirth: student.dateOfBirth,
      parentsPhone: student.parentsPhone,
      parentsEmail: student.parentsEmail,
      address: student.address,
      whatsappNumber: student.whatsappNumber,
      isActive: (student.userId as any).isActive,
      createdAt: (student.userId as any).createdAt,
      updatedAt: (student as any).updatedAt
    };
    
    res.json({ success: true, student: transformedStudent });
  } catch (err) {
    next(err);
  }
}

// Update Student
export async function updateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = UpdateStudentSchema.parse(req.body);
    
    const student = await Student.findOne({ userId: id }).populate('userId');
    if (!student) throw new createHttpError.NotFound("Student not found");
    
    // Check if email is being changed and if it's already in use
    if (updateData.email && updateData.email !== (student.userId as any).email) {
      const emailExists = await User.findOne({ email: updateData.email });
      if (emailExists) throw new createHttpError.Conflict("Email already in use");
    }
    
    // Validate class if being changed
    if (updateData.classId) {
      const classExists = await Class.findById(updateData.classId);
      if (!classExists) throw new createHttpError.NotFound("Class not found");
      if (!classExists.isActive) throw new createHttpError.BadRequest("Class is not active");
    }
    
    // Check if roll number is being changed and if it's already in use in the same class
    if (updateData.rollNumber && updateData.rollNumber !== student.rollNumber) {
      const rollExists = await Student.findOne({ 
        rollNumber: updateData.rollNumber, 
        classId: updateData.classId || student.classId,
        _id: { $ne: student._id }
      });
      if (rollExists) throw new createHttpError.Conflict("Roll number already exists in this class");
    }
    
    // Update user data
    const userUpdateData: any = {};
    if (updateData.email) userUpdateData.email = updateData.email;
    if (updateData.name) userUpdateData.name = updateData.name;
    if (updateData.isActive !== undefined) userUpdateData.isActive = updateData.isActive;
    
    if (Object.keys(userUpdateData).length > 0) {
      await User.findByIdAndUpdate(id, userUpdateData, { runValidators: true });
    }
    
    // Update student data
    const studentUpdateData = { ...updateData };
    delete studentUpdateData.email;
    delete studentUpdateData.name;
    delete studentUpdateData.isActive;
    
    // Format dateOfBirth if provided
    if (studentUpdateData.dateOfBirth) {
      studentUpdateData.dateOfBirth = formatDateToYYYYMMDD(studentUpdateData.dateOfBirth);
    }
    
    if (Object.keys(studentUpdateData).length > 0) {
      await Student.findByIdAndUpdate(student._id, studentUpdateData, { runValidators: true });
    }
    
    const updatedStudent = await Student.findOne({ userId: id })
      .populate('userId', 'name email isActive createdAt')
      .populate('classId', 'name displayName level section academicYear');
    
    // Transform the data to include all form fields
    const transformedStudent = {
      id: updatedStudent!.userId._id,
      email: (updatedStudent!.userId as any).email,
      name: (updatedStudent!.userId as any).name,
      rollNumber: updatedStudent!.rollNumber,
      class: {
        id: (updatedStudent!.classId as any)._id,
        name: (updatedStudent!.classId as any).name,
        displayName: (updatedStudent!.classId as any).displayName,
        level: (updatedStudent!.classId as any).level,
        section: (updatedStudent!.classId as any).section,
        academicYear: (updatedStudent!.classId as any).academicYear
      },
      fatherName: updatedStudent!.fatherName,
      motherName: updatedStudent!.motherName,
      dateOfBirth: updatedStudent!.dateOfBirth,
      parentsPhone: updatedStudent!.parentsPhone,
      parentsEmail: updatedStudent!.parentsEmail,
      address: updatedStudent!.address,
      whatsappNumber: updatedStudent!.whatsappNumber,
      isActive: (updatedStudent!.userId as any).isActive,
      createdAt: (updatedStudent!.userId as any).createdAt,
      updatedAt: (updatedStudent as any).updatedAt
    };
    
    res.json({ success: true, student: transformedStudent });
  } catch (err) {
    next(err);
  }
}

// Delete Student (Hard delete)
export async function deleteStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const student = await Student.findOne({ userId: id });
    if (!student) throw new createHttpError.NotFound("Student not found");
    
    // Delete both student record and user record
    await Promise.all([
      Student.findByIdAndDelete(student._id),
      User.findByIdAndDelete(id)
    ]);
    
    res.json({ success: true, message: "Student deleted successfully" });
  } catch (err) {
    next(err);
  }
}

// Activate Student
export async function activateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const student = await Student.findOne({ userId: id });
    if (!student) throw new createHttpError.NotFound("Student not found");
    
    await User.findByIdAndUpdate(id, { isActive: true });
    
    res.json({ success: true, message: "Student activated successfully" });
  } catch (err) {
    next(err);
  }
}

// Get Students by Class
export async function getStudentsByClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    // Validate that the class exists
    const classExists = await Class.findById(classId);
    if (!classExists) throw new createHttpError.NotFound("Class not found");
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [students, total] = await Promise.all([
      Student.find({ classId })
        .populate('userId', 'name email isActive')
        .populate('classId', 'name displayName level section academicYear')
        .sort({ rollNumber: 1 })
        .skip(skip)
        .limit(Number(limit)),
      Student.countDocuments({ classId })
    ]);
    
    // Transform the data to include all form fields
    const transformedStudents = students.map(student => ({
      id: student.userId._id,
      email: (student.userId as any).email,
      name: (student.userId as any).name,
      rollNumber: student.rollNumber,
      class: {
        id: (student.classId as any)._id,
        name: (student.classId as any).name,
        displayName: (student.classId as any).displayName,
        level: (student.classId as any).level,
        section: (student.classId as any).section,
        academicYear: (student.classId as any).academicYear
      },
      fatherName: student.fatherName,
      motherName: student.motherName,
      dateOfBirth: student.dateOfBirth,
      parentsPhone: student.parentsPhone,
      parentsEmail: student.parentsEmail,
      address: student.address,
      whatsappNumber: student.whatsappNumber,
      isActive: (student.userId as any).isActive,
      createdAt: (student.userId as any).createdAt,
      updatedAt: (student as any).updatedAt
    }));
    
    res.json({
      success: true,
      data: transformedStudents,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    next(err);
  }
}

// CSV Row Schema for validation
const CSVStudentRowSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  rollNumber: z.string().min(1, "Roll number is required"),
  className: z.string().min(1, "Class name is required"),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  dateOfBirth: z.string().optional().or(z.literal("")),
  parentsPhone: z.string().optional(),
  parentsEmail: z.string().email("Invalid parent email format").optional().or(z.literal("")),
  address: z.string().optional()
});

// Bulk Create Students from CSV
export async function bulkCreateStudents(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if file is uploaded
    if (!req.file) {
      throw new createHttpError.BadRequest("CSV file is required");
    }

    // Parse CSV file
    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true, // Use first row as headers
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      throw new createHttpError.BadRequest("CSV file is empty or invalid");
    }

    // Validate CSV headers
    const requiredHeaders = ['email', 'password', 'name', 'rollNumber', 'className'];
    const csvHeaders = Object.keys(records[0] as Record<string, unknown>);
    const missingHeaders = requiredHeaders.filter(header => !csvHeaders.includes(header));
    
    if (missingHeaders.length > 0) {
      throw new createHttpError.BadRequest(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Get all classes to map class names to IDs
    const classes = await Class.find({ isActive: true });
    const classNameToIdMap = new Map();
    classes.forEach(cls => {
      classNameToIdMap.set(cls.name, (cls._id as any).toString());
      classNameToIdMap.set(cls.displayName, (cls._id as any).toString());
    });

    // Validate and process each row
    const validationErrors: Array<{ row: number; errors: string[] }> = [];
    const processedStudents: any[] = [];
    const existingEmails = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 2; // +2 because CSV is 1-indexed and we skip header

      try {
        // Validate row data
        const validatedData = CSVStudentRowSchema.parse(row);

        // Check if class exists
        const classId = classNameToIdMap.get(validatedData.className);
        if (!classId) {
          validationErrors.push({
            row: rowNumber,
            errors: [`Class '${validatedData.className}' not found`]
          });
          continue;
        }

        // Check for duplicate emails in the same batch
        if (existingEmails.has(validatedData.email)) {
          validationErrors.push({
            row: rowNumber,
            errors: [`Duplicate email '${validatedData.email}' in the same batch`]
          });
          continue;
        }

        // Check if email already exists in database
        const existingUser = await User.findOne({ email: validatedData.email });
        if (existingUser) {
          validationErrors.push({
            row: rowNumber,
            errors: [`Email '${validatedData.email}' already exists in database`]
          });
          continue;
        }

        existingEmails.add(validatedData.email);
        processedStudents.push({
          ...validatedData,
          classId,
          rowNumber
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`);
          validationErrors.push({
            row: rowNumber,
            errors
          });
        } else {
          validationErrors.push({
            row: rowNumber,
            errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
          });
        }
      }
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation errors found in CSV file",
        errors: validationErrors,
        totalRows: records.length,
        errorRows: validationErrors.length,
        validRows: processedStudents.length
      });
    }

    // Create students in batch using transactions
    const createdStudents: any[] = [];
    const creationErrors: Array<{ row: number; email: string; error: string }> = [];

    for (const studentData of processedStudents) {
      const session = await mongoose.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Hash password
          const passwordHash = await bcrypt.hash(studentData.password, 12);

          // Create user within transaction
          const user = await User.create([{
            email: studentData.email,
            passwordHash,
            name: studentData.name,
            role: "STUDENT",
            isActive: studentData.isActive !== undefined ? studentData.isActive : true
          }], { session });

          if (!user || user.length === 0) {
            throw new Error('Failed to create user');
          }

          // Create student profile within transaction
          const studentDataToCreate: any = {
            userId: user[0]!._id,
            rollNumber: studentData.rollNumber,
            classId: studentData.classId,
            fatherName: studentData.fatherName,
            motherName: studentData.motherName,
            parentsPhone: studentData.parentsPhone,
            parentsEmail: studentData.parentsEmail,
            address: studentData.address
          };

          // Only include dateOfBirth if it's not empty and format it
          if (studentData.dateOfBirth && studentData.dateOfBirth.trim() !== '') {
            studentDataToCreate.dateOfBirth = formatDateToYYYYMMDD(studentData.dateOfBirth);
          }

          const student = await Student.create([studentDataToCreate], { session });

          if (!student || student.length === 0) {
            throw new Error('Failed to create student profile');
          }

          // Get class info for response
          const classInfo = classes.find(cls => String(cls._id) === studentData.classId);

          createdStudents.push({
            id: user[0]!._id,
            email: user[0]!.email,
            name: user[0]!.name,
            rollNumber: student[0]!.rollNumber,
            className: classInfo?.name || studentData.className,
            classDisplayName: classInfo?.displayName,
            isActive: user[0]!.isActive,
            rowNumber: studentData.rowNumber
          });
        });
      } catch (error) {
        creationErrors.push({
          row: studentData.rowNumber,
          email: studentData.email,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        await session.endSession();
      }
    }

    // Return results
    res.status(201).json({
      success: true,
      message: `Successfully processed ${records.length} students`,
      data: {
        totalRows: records.length,
        created: createdStudents.length,
        errors: creationErrors.length,
        students: createdStudents,
        creationErrors: creationErrors.length > 0 ? creationErrors : undefined
      }
    });

  } catch (err) {
    next(err);
  }
}
