import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import createHttpError from "http-errors";
import mongoose from "mongoose";
import { Subject } from "../models/Subject";
import QuestionPaperTemplate from "../models/QuestionPaperTemplate";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CreateSubjectSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/, "Subject code must contain only uppercase letters, numbers, and underscores"),
  name: z.string().min(1),
  shortName: z.string().min(1),
  category: z.enum(["SCIENCE", "MATHEMATICS", "LANGUAGES", "SOCIAL_SCIENCES", "COMMERCE", "ARTS", "PHYSICAL_EDUCATION", "COMPUTER_SCIENCE", "OTHER"]),
  classIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid class ID")).min(1, "At least one class must be selected"),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code").optional(),
});

const UpdateSubjectSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/, "Subject code must contain only uppercase letters, numbers, and underscores").optional(),
  name: z.string().min(1).optional(),
  shortName: z.string().min(1).optional(),
  category: z.enum(["SCIENCE", "MATHEMATICS", "LANGUAGES", "SOCIAL_SCIENCES", "COMMERCE", "ARTS", "PHYSICAL_EDUCATION", "COMPUTER_SCIENCE", "OTHER"]).optional(),
  classIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid class ID")).min(1, "At least one class must be selected").optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code").optional(),
  isActive: z.boolean().optional(),
});

const GetSubjectsQuerySchema = z.object({
  page: z.union([z.string(), z.number()]).transform(Number).default(1),
  limit: z.union([z.string(), z.number()]).transform(Number).default(10),
  search: z.string().optional(),
  category: z.string().optional(),
  level: z.string().transform(Number).optional(),
  isActive: z.string().transform(Boolean).optional(),
});

// Multer configuration for reference book uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/reference-books');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `reference-book-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for reference books
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for reference books'));
    }
  }
});

export const uploadReferenceBook = (req: Request, res: Response, next: NextFunction) => {
  console.log('Multer middleware - Request headers:', req.headers);
  console.log('Multer middleware - Content-Type:', req.headers['content-type']);
  
  upload.single('referenceBook')(req, res, (err) => {
    console.log('Multer callback - Error:', err);
    console.log('Multer callback - File:', req.file);
    console.log('Multer callback - Body:', req.body);
    
    if (err) {
      console.log('Multer error details:', {
        code: err.code,
        message: err.message,
        field: err.field
      });
      
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new createHttpError.BadRequest('File too large. Maximum size is 50MB.'));
      }
      if (err.message.includes('Only PDF files are allowed')) {
        return next(new createHttpError.BadRequest('Only PDF files are allowed for reference books.'));
      }
      return next(new createHttpError.BadRequest(err.message));
    }
    next();
  });
};

// Create Subject
export async function createSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const subjectData = CreateSubjectSchema.parse(req.body);
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    
    // Check if subject code already exists for this admin
    const existing = await Subject.findOne({ 
      code: subjectData.code.toUpperCase(),
      adminId
    });
    if (existing) throw new createHttpError.Conflict("Subject code already exists");
    
    const newSubject = await Subject.create({
      ...subjectData,
      adminId,
      code: subjectData.code.toUpperCase(),
      category: subjectData.category.toUpperCase(),
      classIds: subjectData.classIds
    });
    
    // Get subject with class details using aggregation
    const subjects = await Subject.aggregate([
      { $match: { _id: newSubject._id } },
      {
        $addFields: {
          classIds: {
            $map: {
              input: '$classIds',
              as: 'id',
              in: { $toObjectId: '$$id' }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'classes',
          localField: 'classIds',
          foreignField: '_id',
          as: 'classes'
        }
      },
      {
        $project: {
          _id: 1,
          code: 1,
          name: 1,
          shortName: 1,
          category: 1,
          classIds: 1,
          classes: {
            _id: 1,
            name: 1,
            displayName: 1,
            level: 1,
            section: 1,
            academicYear: 1,
            isActive: 1
          },
          description: 1,
          color: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);
    
    res.status(201).json({ 
      success: true, 
      subject: subjects[0]
    });
  } catch (err) {
    next(err);
  }
}

// Get All Subjects
export async function getSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const { page, limit, search, category, level, isActive } = GetSubjectsQuerySchema.parse(req.query);
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    
    
    const query: any = { adminId };
    
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
        .select('_id code name shortName category classIds description color isActive referenceBook createdAt updatedAt')
        .sort({ category: 1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subject.countDocuments(query)
    ]);

    // Get templates for each subject
    const subjectIds = subjects.map(subject => subject._id);
    const templates = await QuestionPaperTemplate.find({
      subjectId: { $in: subjectIds },
      isActive: true
    })
    .select('_id title description subjectId classId templateFile analysis language version createdAt')
    .lean();

    // Group templates by subjectId
    const templatesBySubject = templates.reduce((acc, template) => {
      const subjectId = template.subjectId.toString();
      if (!acc[subjectId]) {
        acc[subjectId] = [];
      }
      acc[subjectId].push(template);
      return acc;
    }, {} as Record<string, any[]>);

    // Add templates to each subject
    const subjectsWithTemplates = subjects.map(subject => ({
      ...subject,
      templates: templatesBySubject[subject._id.toString()] || []
    }));
    
    res.json({
      success: true,
      data: subjectsWithTemplates,
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
    
    const subjects = await Subject.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $addFields: {
          classIds: {
            $map: {
              input: '$classIds',
              as: 'id',
              in: { $toObjectId: '$$id' }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'classes',
          localField: 'classIds',
          foreignField: '_id',
          as: 'classes'
        }
      },
      {
        $project: {
          _id: 1,
          code: 1,
          name: 1,
          shortName: 1,
          category: 1,
          classIds: 1,
          classes: {
            _id: 1,
            name: 1,
            displayName: 1,
            level: 1,
            section: 1,
            academicYear: 1,
            isActive: 1
          },
          description: 1,
          color: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);
    
    if (subjects.length === 0) throw new createHttpError.NotFound("Subject not found");
    
    res.json({ success: true, subject: subjects[0] });
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
    if (updatedData.category) updatedData.category = updatedData.category.toUpperCase() as any;
    
    const updatedSubject = await Subject.findByIdAndUpdate(id, updatedData, { 
      new: true, 
      runValidators: true 
    });
    
    // Get updated subject with class details using aggregation
    const subjects = await Subject.aggregate([
      { $match: { _id: updatedSubject!._id } },
      {
        $addFields: {
          classIds: {
            $map: {
              input: '$classIds',
              as: 'id',
              in: { $toObjectId: '$$id' }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'classes',
          localField: 'classIds',
          foreignField: '_id',
          as: 'classes'
        }
      },
      {
        $project: {
          _id: 1,
          code: 1,
          name: 1,
          shortName: 1,
          category: 1,
          classIds: 1,
          classes: {
            _id: 1,
            name: 1,
            displayName: 1,
            level: 1,
            section: 1,
            academicYear: 1,
            isActive: 1
          },
          description: 1,
          color: 1,
          isActive: 1,
          createdAt: 1,
          updatedAt: 1
        }
      }
    ]);
    
    res.json({ success: true, subject: subjects[0] });
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
    
    const query: any = { category: category?.toUpperCase() };
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
      level: parseInt(level as string),
      isActive: true 
    })
      .sort({ category: 1, name: 1 })
      .select('code name shortName category color');
    
    res.json({ success: true, data: subjects });
  } catch (err) {
    next(err);
  }
}

// Upload Reference Book (Base64)
export async function uploadReferenceBookBase64(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    const userId = auth.sub;
    
    const { fileName, fileSize, fileType, fileData } = req.body;
    
    console.log('Base64 upload request received:', {
      subjectId: id,
      adminId,
      userId,
      fileName,
      fileSize,
      fileType,
      dataLength: fileData ? fileData.length : 0
    });
    
    if (!fileData) {
      throw new createHttpError.BadRequest("No file data provided");
    }
    
    if (fileType !== 'application/pdf') {
      throw new createHttpError.BadRequest("Only PDF files are allowed for reference books");
    }
    
    if (fileSize > 50 * 1024 * 1024) { // 50MB limit
      throw new createHttpError.BadRequest("File too large. Maximum size is 50MB");
    }
    
    const subject = await Subject.findOne({ _id: id, adminId });
    if (!subject) {
      throw new createHttpError.NotFound("Subject not found");
    }
    
    // Convert base64 to buffer
    const fileBuffer = Buffer.from(fileData, 'base64');
    
    // Create unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `reference-book-${uniqueSuffix}${fileExtension}`;
    
    // Create upload directory if it doesn't exist
    const uploadPath = path.join(__dirname, '../../uploads/reference-books');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    const filePath = path.join(uploadPath, uniqueFileName);
    
    // Delete existing reference book if it exists
    if (subject.referenceBook && fs.existsSync(subject.referenceBook.filePath)) {
      fs.unlinkSync(subject.referenceBook.filePath);
    }
    
    // Write file to disk
    fs.writeFileSync(filePath, fileBuffer);
    
    // Update subject with new reference book information
    subject.referenceBook = {
      fileName: uniqueFileName,
      originalName: fileName,
      filePath: filePath,
      fileSize: fileSize,
      uploadedAt: new Date(),
      uploadedBy: userId
    };
    
    await subject.save();
    
    console.log('Base64 upload successful:', {
      fileName: subject.referenceBook.fileName,
      originalName: subject.referenceBook.originalName,
      fileSize: subject.referenceBook.fileSize
    });
    
    res.json({
      success: true,
      subject: subject
    });
  } catch (err) {
    console.error('Base64 upload error:', err);
    next(err);
  }
}

// Upload Reference Book (Original FormData method)
export async function uploadReferenceBookToSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    const userId = auth.sub;
    
    console.log('Upload request received:', {
      subjectId: id,
      adminId,
      userId,
      hasFile: !!req.file,
      fileInfo: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename
      } : null,
      body: req.body
    });
    
    if (!req.file) {
      throw new createHttpError.BadRequest("No PDF file uploaded");
    }
    
    const subject = await Subject.findOne({ _id: id, adminId });
    if (!subject) {
      throw new createHttpError.NotFound("Subject not found");
    }
    
    // Delete existing reference book if it exists
    if (subject.referenceBook && fs.existsSync(subject.referenceBook.filePath)) {
      fs.unlinkSync(subject.referenceBook.filePath);
    }
    
    // Update subject with new reference book information
    subject.referenceBook = {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      uploadedAt: new Date(),
      uploadedBy: userId
    };
    
    await subject.save();
    
    res.json({
      success: true,
      message: "Reference book uploaded successfully",
      referenceBook: {
        fileName: subject.referenceBook.fileName,
        originalName: subject.referenceBook.originalName,
        fileSize: subject.referenceBook.fileSize,
        uploadedAt: subject.referenceBook.uploadedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

// Check Reference Book File Exists
export async function checkReferenceBookExists(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    
    const subject = await Subject.findOne({ _id: id, adminId });
    if (!subject) {
      throw new createHttpError.NotFound("Subject not found");
    }
    
    if (!subject.referenceBook) {
      return res.json({
        success: true,
        exists: false,
        message: "No reference book uploaded for this subject",
        version: "v2.1.0-route-fix-deployed"
      });
    }
    
    const filePath = subject.referenceBook.filePath;
    const fileExists = fs.existsSync(filePath);
    
    res.json({
      success: true,
      exists: fileExists,
      message: fileExists ? "Reference book file exists" : "Reference book file not found on server",
      version: "v2.1.0-route-fix-deployed"
    });
  } catch (err) {
    next(err);
  }
}

// Download Reference Book
export async function downloadReferenceBook(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    
    const subject = await Subject.findOne({ _id: id, adminId });
    if (!subject) {
      throw new createHttpError.NotFound("Subject not found");
    }
    
    if (!subject.referenceBook) {
      throw new createHttpError.NotFound("No reference book uploaded for this subject");
    }
    
    const filePath = subject.referenceBook.filePath;
    
    if (!fs.existsSync(filePath)) {
      throw new createHttpError.NotFound("Reference book file not found");
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${subject.referenceBook.originalName}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    next(err);
  }
}

// Delete Reference Book
export async function deleteReferenceBook(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    
    const subject = await Subject.findOne({ _id: id, adminId });
    if (!subject) {
      throw new createHttpError.NotFound("Subject not found");
    }
    
    if (!subject.referenceBook) {
      throw new createHttpError.NotFound("No reference book to delete");
    }
    
    // Delete the file from filesystem
    if (fs.existsSync(subject.referenceBook.filePath)) {
      fs.unlinkSync(subject.referenceBook.filePath);
    }
    
    // Remove reference book information from subject
    delete subject.referenceBook;
    await subject.save();
    
    res.json({
      success: true,
      message: "Reference book deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}
