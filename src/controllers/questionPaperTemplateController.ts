import type { Request, Response, NextFunction } from 'express';
import createHttpError from 'http-errors';
import * as z from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import multer from 'multer';
import mongoose from 'mongoose';
import QuestionPaperTemplate from '../models/QuestionPaperTemplate';
import { Subject } from '../models/Subject';
import { PDFGenerationService } from '../services/pdfGenerationService';
import { TemplateValidationService } from '../services/templateValidationService';

// Validation schemas
const CreateTemplateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  subjectId: z.string().min(1, 'Subject ID is required'),
  examType: z.enum(['UNIT_TEST', 'MID_TERM', 'FINAL', 'QUIZ', 'ASSIGNMENT', 'PRACTICAL', 'DAILY', 'WEEKLY', 'MONTHLY', 'UNIT_WISE', 'PAGE_WISE', 'TERM_TEST', 'ANNUAL_EXAM', 'CUSTOM_EXAM']),
  aiSettings: z.object({
    useTemplate: z.boolean().optional(),
    followPattern: z.boolean().optional(),
    maintainStructure: z.boolean().optional(),
    customInstructions: z.string().optional()
  }).optional()
});

const UpdateTemplateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  aiSettings: z.object({
    useTemplate: z.boolean().optional(),
    followPattern: z.boolean().optional(),
    maintainStructure: z.boolean().optional(),
    customInstructions: z.string().optional()
  }).optional()
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public', 'question-paper-templates');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `template-${uniqueSuffix}${path.extname(file.originalname)}`);
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

export const uploadTemplate = upload.single('templateFile');

// Create Question Paper Template
export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const templateData = CreateTemplateSchema.parse(req.body);
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
      throw createHttpError(400, "Template file is required");
    }
    
    // Validate subject exists and belongs to the admin
    // For SUPER_ADMIN, allow uploading templates for any subject
    // For ADMIN, only allow uploading for their own subjects
    let subject;
    if (auth?.role === 'SUPER_ADMIN') {
      subject = await Subject.findOne({ _id: templateData.subjectId, isActive: true });
    } else {
      subject = await Subject.findOne({ _id: templateData.subjectId, adminId, isActive: true });
    }
    
    if (!subject) throw createHttpError(404, "Subject not found or not accessible");
    
    // Validate template using AI service
    console.log('Starting template validation for upload:', {
      filePath: req.file.path,
      subjectId: templateData.subjectId,
      examType: templateData.examType
    });
    
    const validationService = new TemplateValidationService();
    const validationResult = await validationService.validateTemplate(
      req.file.path,
      templateData.subjectId,
      templateData.examType
    );
    
    console.log('Template validation result:', {
      isValid: validationResult.isValid,
      confidence: validationResult.confidence,
      hasExtractedPattern: !!validationResult.extractedPattern,
      errors: validationResult.validationErrors
    });
    
    // Create download URL
    const downloadUrl = `/public/question-paper-templates/${req.file.filename}`;
    
    // Use AI-extracted pattern if available, otherwise create basic analysis
    const analysis = validationResult.extractedPattern ? {
      totalQuestions: validationResult.extractedPattern.totalQuestions,
      questionTypes: validationResult.extractedPattern.questionTypes,
      markDistribution: validationResult.extractedPattern.markDistribution,
      difficultyLevels: validationResult.extractedPattern.difficultyLevels,
      bloomsDistribution: validationResult.extractedPattern.bloomsDistribution,
      timeDistribution: {
        totalTime: 0,
        perQuestion: 0
      },
      sections: validationResult.extractedPattern.sections || []
    } : {
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
      sections: []
    };
    
    // For SUPER_ADMIN, use the subject's adminId
    // For ADMIN, use their own adminId
    const templateAdminId = auth?.role === 'SUPER_ADMIN' ? subject.adminId : adminId;
    
    const template = await QuestionPaperTemplate.create({
      title: templateData.title,
      description: templateData.description,
      subjectId: templateData.subjectId,
      examType: templateData.examType,
      adminId: templateAdminId,
      uploadedBy: userId,
      templateFile: {
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        uploadedAt: new Date(),
        downloadUrl
      },
      analysis,
      aiValidation: {
        isValid: validationResult.isValid,
        confidence: validationResult.confidence,
        detectedSubject: validationResult.detectedSubject,
        detectedExamType: validationResult.detectedExamType,
        validationErrors: validationResult.validationErrors,
        suggestions: validationResult.suggestions,
        validatedAt: new Date()
      },
      aiSettings: templateData.aiSettings || {
        useTemplate: true,
        followPattern: true,
        maintainStructure: true
      },
      isActive: true,
      version: "1.0"
    });
    
    const populatedTemplate = await QuestionPaperTemplate.findById(template._id)
      .populate('subjectId', 'code name shortName')
      .populate('uploadedBy', 'name email');
    
    res.status(201).json({
      success: true,
      template: populatedTemplate,
      validation: {
        isValid: validationResult.isValid,
        confidence: validationResult.confidence,
        warnings: validationResult.validationErrors,
        suggestions: validationResult.suggestions
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get All Templates
export async function getTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    const { subjectId, examType } = req.query;
    
    // For SUPER_ADMIN, get templates for all subjects
    // For ADMIN, get templates only for their subjects
    const filter: any = { isActive: true };
    if (auth?.role !== 'SUPER_ADMIN') {
      filter.adminId = adminId;
    }
    if (subjectId) filter.subjectId = subjectId;
    if (examType) filter.examType = examType;
    
    const templates = await QuestionPaperTemplate.find(filter)
      .populate('subjectId', 'code name shortName')
      .populate('uploadedBy', 'name email')
      .sort({ 'patternMetadata.isDefault': -1, createdAt: -1 });
    
    res.json({
      success: true,
      templates
    });
  } catch (err) {
    next(err);
  }
}

// Get Templates for Subject/ExamType
export async function getDefaultTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { subjectId, examType } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    const filter: any = {
      subjectId,
      examType,
      isActive: true
    };
    
    if (auth?.role !== 'SUPER_ADMIN') {
      filter.adminId = adminId;
    }
    
    const template = await QuestionPaperTemplate.findOne(filter)
      .populate('subjectId', 'code name shortName')
      .populate('uploadedBy', 'name email');
    
    if (!template) {
      return res.json({
        success: true,
        template: null,
        message: 'No template found for this combination'
      });
    }
    
    res.json({
      success: true,
      template
    });
  } catch (err) {
    next(err);
  }
}

// Get Templates for Auto-fetch Marks
export async function getTemplatesForAutoFetch(req: Request, res: Response, next: NextFunction) {
  try {
    const { subjectId, examType } = req.query;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    if (!subjectId || !examType) {
      throw createHttpError(400, "Subject ID and Exam Type are required");
    }
    
    const filter: any = {
      subjectId,
      examType,
      'aiValidation.isValid': true,
      'aiValidation.confidence': { $gte: 70 },
      isActive: true
    };
    
    if (auth?.role !== 'SUPER_ADMIN') {
      filter.adminId = adminId;
    }
    
    const templates = await QuestionPaperTemplate.find(filter)
      .populate('subjectId', 'code name shortName')
      .sort({ 'aiValidation.confidence': -1 });
    
    res.json({
      success: true,
      templates: templates.map(template => ({
        _id: template._id,
        title: template.title,
        confidence: template.aiValidation.confidence,
        markDistribution: template.analysis.markDistribution,
        totalQuestions: template.analysis.totalQuestions,
        questionTypes: template.analysis.questionTypes,
        sections: template.analysis.sections || [],
        bloomsDistribution: template.analysis.bloomsDistribution
      }))
    });
  } catch (err) {
    next(err);
  }
}

// Check if templates exist for exam (for showing/hiding auto-fetch button)
export async function checkTemplatesExist(req: Request, res: Response, next: NextFunction) {
  try {
    const { examId } = req.query;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    if (!examId) {
      throw createHttpError(400, "Exam ID is required");
    }
    
    // Get Exam model to get exam details
    const ExamModule = await import('../models/Exam');
    const exam = await ExamModule.Exam.findById(examId).lean();
    
    if (!exam) {
      return res.json({
        success: true,
        hasTemplates: false,
        message: 'Exam not found'
      });
    }
    
    // Ensure subjectIds are ObjectIds (in case they're populated or strings)
    const subjectIds = exam.subjectIds.map((id: any) => {
      if (typeof id === 'string') {
        return new mongoose.Types.ObjectId(id);
      } else if (id?._id) {
        // If populated, extract _id
        return id._id;
      }
      return id;
    });
    
    // Build filter - make AI validation optional for now (can be strict later)
    // First, try with strict AI validation (isValid=true and confidence>=70)
    // Note: Allow templates with undefined/null examType for backwards compatibility
    // (templates created before examType field was added)
    const strictFilter: any = {
      subjectId: { $in: subjectIds },
      $or: [
        { examType: exam.examType },
        { examType: { $exists: false } }, // Templates without examType (old templates)
        { examType: null } // Templates with null examType
      ],
      isActive: true,
      'aiValidation.isValid': true,
      'aiValidation.confidence': { $gte: 0 }
    };
    
    // Also check for templates without strict validation requirements functionally
    // Remove AI validation requirement completely for loose filter
    const looseFilter: any = {
      subjectId: { $in: subjectIds },
      $or: [
        { examType: exam.examType },
        { examType: { $exists: false } }, // Templates without examType (old templates)
        { examType: null } // Templates with null examType
      ],
      isActive: true
    };
    
    if (auth?.role !== 'SUPER_ADMIN') {
      strictFilter.adminId = new mongoose.Types.ObjectId(adminId);
      looseFilter.adminId = new mongoose.Types.ObjectId(adminId);
    }
    
    // Try strict filter first, fall back to loose filter if no results
    let count = await QuestionPaperTemplate.countDocuments(strictFilter);
    let filter = strictFilter;
    
    if (count === 0) {
      count = await QuestionPaperTemplate.countDocuments(looseFilter);
      filter = looseFilter;
    }
    
    res.json({
      success: true,
      hasTemplates: count > 0,
      templateCount: count
    });
  } catch (err) {
    next(err);
  }
}

// Get Template by ID
export async function getTemplateById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    // Validate that id is a valid ObjectId before querying
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw createHttpError(400, "Invalid template ID");
    }
    
    const template = await QuestionPaperTemplate.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    })
      .populate('subjectId', 'code name shortName')
      .populate('uploadedBy', 'name email');
    
    if (!template) {
      throw createHttpError(404, "Template not found");
    }
    
    res.json({
      success: true,
      template
    });
  } catch (err) {
    next(err);
  }
}

// Update Template
export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = UpdateTemplateSchema.parse(req.body);
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    const template = await QuestionPaperTemplate.findOneAndUpdate(
      { _id: id, adminId, isActive: true },
      updateData,
      { new: true }
    )
      .populate('subjectId', 'code name shortName')
      .populate('uploadedBy', 'name email');
    
    if (!template) {
      throw createHttpError(404, "Template not found");
    }
    
    res.json({
      success: true,
      template
    });
  } catch (err) {
    next(err);
  }
}

// Delete Template
export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    const role = auth?.role;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    // For SUPER_ADMIN, allow deletion of any template
    // For regular ADMIN, only allow deletion of their own templates
    const query: any = { 
      _id: id, 
      isActive: true 
    };
    
    if (role !== 'SUPER_ADMIN') {
      query.adminId = adminId;
    }
    
    const template = await QuestionPaperTemplate.findOne(query);
    
    if (!template) {
      throw createHttpError(404, "Template not found");
    }
    
    // Delete the file
    if (template.templateFile?.filePath) {
      try {
        if (fs.existsSync(template.templateFile.filePath)) {
          fs.unlinkSync(template.templateFile.filePath);
        }
      } catch (error) {
        console.warn('Could not delete template file:', error);
      }
    }
    
    // Soft delete - use updateOne to avoid validation issues with missing examType
    await QuestionPaperTemplate.updateOne(
      { _id: id },
      { isActive: false },
      { runValidators: false }
    );
    
    res.json({
      success: true,
      message: "Template deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Download Template
export async function downloadTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    const role = auth?.role;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    // For SUPER_ADMIN, allow download of any template
    // For regular ADMIN, only allow download of their own templates
    const query: any = { 
      _id: id, 
      isActive: true 
    };
    
    if (role !== 'SUPER_ADMIN') {
      query.adminId = adminId;
    }
    
    const template = await QuestionPaperTemplate.findOne(query);
    
    if (!template) {
      throw createHttpError(404, "Template not found");
    }
    
    const filePath = template.templateFile?.filePath;
    if (!filePath || !fs.existsSync(filePath)) {
      throw createHttpError(404, "Template file not found");
    }
    
    res.download(filePath, template.templateFile.fileName);
  } catch (err) {
    next(err);
  }
}

// Analyze Template (extract pattern from PDF)
export async function analyzeTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw createHttpError(401, "Admin ID not found in token");
    }
    
    // For SUPER_ADMIN, allow analyzing templates for any admin
    // For ADMIN, only allow analyzing their own templates
    const query: any = { 
      _id: id, 
      isActive: true 
    };
    
    if (auth?.role !== 'SUPER_ADMIN') {
      query.adminId = adminId;
    }
    
    const template = await QuestionPaperTemplate.findOne(query);
    
    if (!template) {
      throw createHttpError(404, "Template not found");
    }
    
    // Validate and analyze template using AI service
    const validationService = new TemplateValidationService();
    
    if (!template.templateFile?.filePath || !fs.existsSync(template.templateFile.filePath)) {
      throw createHttpError(404, "Template file not found");
    }
    
    console.log('Analyzing template:', {
      templateId: template._id,
      filePath: template.templateFile.filePath,
      subjectId: template.subjectId.toString(),
      examType: template.examType || 'UNIT_TEST'
    });
    
    const validationResult = await validationService.validateTemplate(
      template.templateFile.filePath,
      template.subjectId.toString(),
      template.examType || 'UNIT_TEST' // Use existing examType or default
    );
    
    console.log('Validation result:', {
      isValid: validationResult.isValid,
      confidence: validationResult.confidence,
      hasExtractedPattern: !!validationResult.extractedPattern,
      errors: validationResult.validationErrors
    });
    
    // Use AI-extracted pattern if available, otherwise use existing or defaults
    const analysis = validationResult.extractedPattern ? {
      totalQuestions: validationResult.extractedPattern.totalQuestions,
      questionTypes: validationResult.extractedPattern.questionTypes,
      markDistribution: validationResult.extractedPattern.markDistribution,
      difficultyLevels: validationResult.extractedPattern.difficultyLevels || [],
      bloomsDistribution: validationResult.extractedPattern.bloomsDistribution || {
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
      sections: validationResult.extractedPattern.sections || []
    } : template.analysis || {
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
      sections: []
    };
    
    // Update template with analysis and validation
    template.analysis = analysis;
    template.aiValidation = {
      isValid: validationResult.isValid,
      confidence: validationResult.confidence,
      ...(validationResult.detectedSubject && { detectedSubject: validationResult.detectedSubject }),
      ...(validationResult.detectedExamType && { detectedExamType: validationResult.detectedExamType }),
      validationErrors: validationResult.validationErrors,
      suggestions: validationResult.suggestions,
      validatedAt: new Date()
    };
    
    await template.save();
    
    res.json({
      success: true,
      analysis
    });
  } catch (err) {
    next(err);
  }
}
