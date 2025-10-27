import type { Request, Response, NextFunction } from 'express';
import createHttpError from 'http-errors';
import * as z from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import multer from 'multer';
import SamplePaper from '../models/SamplePaper';
import { Subject } from '../models/Subject';

// Validation schemas
const CreateSamplePaperSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  subjectId: z.string().min(1, 'Subject ID is required')
});

const UpdateSamplePaperSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  templateSettings: z.object({
    useAsTemplate: z.boolean().optional(),
    followDesign: z.boolean().optional(),
    maintainStructure: z.boolean().optional(),
    customInstructions: z.string().optional()
  }).optional()
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public', 'sample-papers');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `sample-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export const uploadSamplePaper = upload.single('sampleFile');

// Create Sample Paper
export async function createSamplePaper(req: Request, res: Response, next: NextFunction) {
  try {
    const sampleData = CreateSamplePaperSchema.parse(req.body);
    const auth = (req as any).auth;
    const userId = auth?.sub;
    const adminId = auth?.adminId;
    
    if (!userId) {
      throw createHttpError(401, "User not authenticated");
    }
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    if (!req.file) {
      throw createHttpError(400, "Sample paper file is required");
    }
    
    // Validate subject exists and belongs to the admin
    const subject = await Subject.findOne({ _id: sampleData.subjectId, adminId, isActive: true });
    
    if (!subject) throw createHttpError(404, "Subject not found or not accessible");
    
    // Create download URL
    const downloadUrl = `/public/sample-papers/${req.file.filename}`;
    
    // TODO: Analyze the PDF to extract sample paper information
    // For now, we'll create a basic analysis
    const analysis = {
      totalQuestions: 0,
      questionTypes: [],
      markDistribution: {
        oneMark: 0,
        twoMark: 0,
        threeMark: 0,
        fiveMark: 0,
        totalMarks: 0
      },
      difficultyLevels: [],
      bloomsDistribution: {
        remember: 0,
        understand: 0,
        apply: 0,
        analyze: 0,
        evaluate: 0,
        create: 0
      },
      timeDistribution: {
        totalTime: 0,
        perQuestion: 0
      },
      sections: [],
      designPattern: {
        layout: 'standard',
        formatting: 'standard',
        questionNumbering: 'sequential',
        sectionHeaders: []
      }
    };
    
    const samplePaper = await SamplePaper.create({
      ...sampleData,
      adminId,
      uploadedBy: userId,
      sampleFile: {
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        uploadedAt: new Date(),
        downloadUrl: downloadUrl
      },
      analysis: analysis
    });
    
    const populatedSamplePaper = await SamplePaper.findById(samplePaper._id)
      .populate('subjectId', 'code name shortName')
      .populate('uploadedBy', 'name email');
    
    res.status(201).json({
      success: true,
      samplePaper: populatedSamplePaper
    });
  } catch (err) {
    next(err);
  }
}

// Get All Sample Papers
export async function getSamplePapers(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    const { subjectId } = req.query;
    
    const filter: any = { adminId, isActive: true };
    if (subjectId) filter.subjectId = subjectId;
    
    const samplePapers = await SamplePaper.find(filter)
      .populate('subjectId', 'code name shortName')
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      samplePapers
    });
  } catch (err) {
    next(err);
  }
}

// Get Sample Paper by ID
export async function getSamplePaperById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    const samplePaper = await SamplePaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    })
      .populate('subjectId', 'code name shortName')
      .populate('uploadedBy', 'name email');
    
    if (!samplePaper) {
      throw createHttpError(404, "Sample paper not found");
    }
    
    res.json({
      success: true,
      samplePaper
    });
  } catch (err) {
    next(err);
  }
}

// Update Sample Paper
export async function updateSamplePaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = UpdateSamplePaperSchema.parse(req.body);
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    const samplePaper = await SamplePaper.findOneAndUpdate(
      { _id: id, adminId, isActive: true },
      updateData,
      { new: true }
    )
      .populate('subjectId', 'code name shortName')
      .populate('uploadedBy', 'name email');
    
    if (!samplePaper) {
      throw createHttpError(404, "Sample paper not found");
    }
    
    res.json({
      success: true,
      samplePaper
    });
  } catch (err) {
    next(err);
  }
}

// Delete Sample Paper
export async function deleteSamplePaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    const samplePaper = await SamplePaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });
    
    if (!samplePaper) {
      throw createHttpError(404, "Sample paper not found");
    }
    
    // Delete the file
    if (samplePaper.sampleFile?.filePath) {
      try {
        if (fs.existsSync(samplePaper.sampleFile.filePath)) {
          fs.unlinkSync(samplePaper.sampleFile.filePath);
        }
      } catch (error) {
        console.warn('Could not delete sample paper file:', error);
      }
    }
    
    // Soft delete
    samplePaper.isActive = false;
    await samplePaper.save();
    
    res.json({
      success: true,
      message: "Sample paper deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Download Sample Paper
export async function downloadSamplePaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    const samplePaper = await SamplePaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });
    
    if (!samplePaper) {
      throw createHttpError(404, "Sample paper not found");
    }
    
    const filePath = samplePaper.sampleFile?.filePath;
    if (!filePath || !fs.existsSync(filePath)) {
      throw createHttpError(404, "Sample paper file not found");
    }
    
    res.download(filePath, samplePaper.sampleFile.fileName);
  } catch (err) {
    next(err);
  }
}

// Analyze Sample Paper (extract pattern from PDF)
export async function analyzeSamplePaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    const samplePaper = await SamplePaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });
    
    if (!samplePaper) {
      throw createHttpError(404, "Sample paper not found");
    }
    
    // TODO: Implement PDF analysis to extract:
    // - Question types and distribution
    // - Mark distribution
    // - Difficulty levels
    // - Bloom's taxonomy distribution
    // - Time allocation
    // - Section structure
    // - Design patterns (layout, formatting, etc.)
    
    // For now, return a placeholder analysis
    const analysis = {
      totalQuestions: 25,
      questionTypes: ['CHOOSE_BEST_ANSWER', 'SHORT_ANSWER', 'LONG_ANSWER'],
      markDistribution: {
        oneMark: 10,
        twoMark: 8,
        threeMark: 5,
        fiveMark: 2,
        totalMarks: 50
      },
      difficultyLevels: ['EASY', 'MODERATE', 'TOUGHEST'],
      bloomsDistribution: {
        remember: 20,
        understand: 30,
        apply: 25,
        analyze: 15,
        evaluate: 7,
        create: 3
      },
      timeDistribution: {
        totalTime: 180,
        perQuestion: 7.2
      },
      sections: [
        { name: 'Section A', questions: 10, marks: 10 },
        { name: 'Section B', questions: 8, marks: 16 },
        { name: 'Section C', questions: 5, marks: 15 },
        { name: 'Section D', questions: 2, marks: 10 }
      ],
      designPattern: {
        layout: 'standard',
        formatting: 'standard',
        questionNumbering: 'sequential',
        sectionHeaders: ['Section A', 'Section B', 'Section C', 'Section D']
      }
    };
    
    // Update sample paper with analysis
    samplePaper.analysis = analysis;
    await samplePaper.save();
    
    res.json({
      success: true,
      analysis
    });
  } catch (err) {
    next(err);
  }
}
