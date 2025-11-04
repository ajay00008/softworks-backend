import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import createHttpError from 'http-errors';
import { QuestionPaper } from '../models/QuestionPaper';
import QuestionPaperTemplate from '../models/QuestionPaperTemplate';
import { Exam } from '../models/Exam';
import { Subject } from '../models/Subject';
import { Class } from '../models/Class';
import { EnhancedAIService } from '../services/enhancedAIService';
import { PDFGenerationService } from '../services/pdfGenerationService';
import { PatternAnalysisService } from '../services/patternAnalysisService';
import { ensurePromiseWithResolvers } from '../utils/promisePolyfill';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Multer configuration for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public', 'question-papers');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `question-paper-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Multer configuration for pattern uploads
const patternStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), 'public', 'question-patterns');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `pattern-${uniqueSuffix}${path.extname(file.originalname)}`);
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
      cb(new Error('Only PDF files are allowed') as any, false);
    }
  }
});

const patternUpload = multer({
  storage: patternStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, PNG, JPG, and JPEG files are allowed') as any, false);
    }
  }
});

export const uploadQuestionPaperPdf = upload.single('questionPaper');
export const uploadPatternFile = patternUpload.single('patternFile');

// Upload pattern file endpoint
export async function uploadPatternFileEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new createHttpError.BadRequest("No pattern file uploaded");
    }

    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Return pattern file information
    res.status(200).json({
      success: true,
      message: "Pattern file uploaded successfully",
      data: {
        patternId: req.file.filename,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error uploading pattern file:', error);
    next(error);
  }
}

// Helper function to flatten question type distribution for AI service
function flattenQuestionTypeDistribution(questionTypeDistribution: any): Array<{
  type: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
  percentage: number;
  marks: number; // Add marks to preserve context
}> {
  const flattened: Array<{
    type: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
    percentage: number;
    marks: number;
  }> = [];
  
  const markCategories = ['oneMark', 'twoMark', 'threeMark', 'fiveMark'] as const;
  const markValues = { oneMark: 1, twoMark: 2, threeMark: 3, fiveMark: 5 };
  
  // Process each mark category separately to maintain the intended distribution
  for (const mark of markCategories) {
    const distributions = questionTypeDistribution[mark];
    if (distributions && distributions.length > 0) {
      // For each mark category, add the distributions with mark context
      distributions.forEach((dist: any) => {
        flattened.push({
          type: dist.type as 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER',
          percentage: dist.percentage,
          marks: markValues[mark] // Preserve the mark value
        });
      });
    }
  }
  
  return flattened;
}

// Validation schemas
const CreateQuestionPaperSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  examId: z.string().min(1),
  subjectId: z.union([z.string(), z.object({
    _id: z.string(),
    code: z.string().optional(),
    name: z.string().optional(),
    shortName: z.string().optional()
  })]).optional(),
  classId: z.union([z.string(), z.object({
    _id: z.string(),
    name: z.string().optional(),
    displayName: z.string().optional(),
    level: z.number().optional(),
    section: z.string().optional()
  })]).optional(),
  markDistribution: z.object({
    oneMark: z.number().min(0).max(100),
    twoMark: z.number().min(0).max(100),
    threeMark: z.number().min(0).max(100),
    fiveMark: z.number().min(0).max(100),
    totalMarks: z.number().min(1).max(1000).optional()
  }),
  bloomsDistribution: z.array(z.object({
    level: z.enum(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE']),
    percentage: z.number().min(0).max(100)
  })),
  questionTypeDistribution: z.object({
    oneMark: z.array(z.object({
      type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
      percentage: z.number().min(0).max(100)
    })).optional(),
    twoMark: z.array(z.object({
      type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
      percentage: z.number().min(0).max(100)
    })).optional(),
    threeMark: z.array(z.object({
      type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
      percentage: z.number().min(0).max(100)
    })).optional(),
    fiveMark: z.array(z.object({
      type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
      percentage: z.number().min(0).max(100)
    })).optional()
  }),
  aiSettings: z.object({
    useSubjectBook: z.boolean().default(false),
    customInstructions: z.string().max(1000).optional(),
    difficultyLevel: z.enum(['EASY', 'MODERATE', 'TOUGHEST']).default('MODERATE'),
    twistedQuestionsPercentage: z.number().min(0).max(50).default(0)
  }).optional(),
  patternId: z.string().optional() // Optional pattern file ID
});

const GenerateQuestionPaperSchema = z.object({
  questionPaperId: z.string().min(1)
});

// Create Question Paper
export async function createQuestionPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const questionPaperData = CreateQuestionPaperSchema.parse(req.body);
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Validate exam exists and belongs to admin, and get subject/class IDs from exam
    const exam = await Exam.findOne({ 
      _id: questionPaperData.examId, 
      isActive: true 
    }).populate([
      { path: 'subjectIds', select: 'name code classIds' },
      { path: 'classId', select: 'name displayName' }
    ]);
    
    if (!exam) {
      throw new createHttpError.NotFound("Exam not found or not accessible");
    }

    // Check if question paper already exists for this exam
    const existingQuestionPaper = await QuestionPaper.findOne({ 
      examId: questionPaperData.examId,
      isActive: true 
    });
    if (existingQuestionPaper) {
      throw new createHttpError.Conflict("A question paper already exists for this exam. Only one question paper per exam is allowed.");
    }

    // Extract subject and class IDs from exam
    if (!exam.subjectIds || exam.subjectIds.length === 0) {
      throw new createHttpError.BadRequest("Exam has no subjects assigned");
    }
    const subjectId = exam.subjectIds[0]?._id?.toString();
    if (!subjectId) {
      throw new createHttpError.BadRequest("Invalid subject data in exam");
    }
    const classId = exam.classId._id.toString();
    
    // Handle case where frontend sends subjectId and classId as objects
    let finalSubjectId: string = subjectId;
    let finalClassId: string = classId;
    
    if (questionPaperData.subjectId && typeof questionPaperData.subjectId === 'object') {
      finalSubjectId = questionPaperData.subjectId._id;
    } else if (questionPaperData.subjectId) {
      finalSubjectId = questionPaperData.subjectId as string;
    }
    
    if (questionPaperData.classId && typeof questionPaperData.classId === 'object') {
      finalClassId = questionPaperData.classId._id;
    } else if (questionPaperData.classId) {
      finalClassId = questionPaperData.classId as string;
    }

    // Validate that subject is available for this class
    if (!(exam.subjectIds[0] as any).classIds.includes(finalClassId)) {
      throw new createHttpError.BadRequest("Subject is not available for this class");
    }

    // Validate percentages add up to 100
    const bloomsTotal = questionPaperData.bloomsDistribution.reduce((sum, dist) => sum + dist.percentage, 0);
    if (Math.abs(bloomsTotal - 100) > 0.01) {
      throw new createHttpError.BadRequest("Blooms taxonomy percentages must add up to 100%");
    }

    // Validate question type distributions for each mark category
    const markCategories = ['oneMark', 'twoMark', 'threeMark', 'fiveMark'] as const;
    for (const mark of markCategories) {
      const distributions = questionPaperData.questionTypeDistribution[mark];
      if (distributions && distributions.length > 0) {
        const typeTotal = distributions.reduce((sum, dist) => sum + dist.percentage, 0);
        if (Math.abs(typeTotal - 100) > 0.01) {
          throw new createHttpError.BadRequest(`Question type percentages for ${mark.replace('Mark', ' Mark')} must add up to 100%. Current total: ${typeTotal}%`);
        }
      }
    }

    // Create question paper with derived subject and class IDs
    const questionPaper = await QuestionPaper.create({
      ...questionPaperData,
      subjectId: finalSubjectId,
      classId: finalClassId,
      adminId,
      createdBy: auth.sub,
      type: 'AI_GENERATED',
      status: 'DRAFT'
    });

    // Update exam with question paper reference
    await Exam.findByIdAndUpdate(questionPaperData.examId, {
      questionPaperId: questionPaper._id
    });

    // Populate references
    await questionPaper.populate([
      { path: 'examId', select: 'title examType scheduledDate' },
      { path: 'subjectId', select: 'name code' },
      { path: 'classId', select: 'name displayName' }
    ]);

    res.status(201).json({
      success: true,
      questionPaper
    });
  } catch (err) {
    next(err);
  }
}

// Get All Question Papers
export async function getQuestionPapers(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    const { page = 1, limit = 10, status, examId, subjectId, classId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build filter
    const filter: any = { adminId, isActive: true };
    if (status) filter.status = status;
    if (examId) filter.examId = examId;
    if (subjectId) filter.subjectId = subjectId;
    if (classId) filter.classId = classId;

    const questionPapers = await QuestionPaper.find(filter)
      .populate([
        { path: 'examId', select: 'title examType scheduledDate' },
        { path: 'subjectId', select: 'name code' },
        { path: 'classId', select: 'name displayName' },
        { path: 'createdBy', select: 'name email' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await QuestionPaper.countDocuments(filter);

    res.json({
      success: true,
      questionPapers,
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

// Get Question Paper by ID
export async function getQuestionPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    }).populate([
      { path: 'examId', select: 'title examType scheduledDate duration' },
      { path: 'subjectId', select: 'name code referenceBook' },
      { path: 'classId', select: 'name displayName' },
      { path: 'createdBy', select: 'name email' }
    ]);

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    res.json({
      success: true,
      questionPaper
    });
  } catch (err) {
    next(err);
  }
}

// Generate Question Paper with AI
export async function generateAIQuestionPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { questionPaperId } = GenerateQuestionPaperSchema.parse(req.body);
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Get question paper
    const questionPaper = await QuestionPaper.findOne({ 
      _id: questionPaperId, 
      adminId, 
      isActive: true 
    }).populate([
      { path: 'examId', select: 'title duration' },
      { path: 'subjectId', select: 'name code referenceBook' },
      { path: 'classId', select: 'name displayName' }
    ]);

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    if (questionPaper.status !== 'DRAFT') {
      throw new createHttpError.BadRequest("Question paper has already been generated");
    }

    // Prepare AI request
    const aiRequest = {
      subjectId: questionPaper.subjectId._id.toString(),
      classId: questionPaper.classId._id.toString(),
      subjectName: (questionPaper.subjectId as any).name,
      className: (questionPaper.classId as any).name,
      examTitle: (questionPaper.examId as any).title,
      markDistribution: {
        ...questionPaper.markDistribution,
        totalQuestions: questionPaper.markDistribution.oneMark + questionPaper.markDistribution.twoMark + questionPaper.markDistribution.threeMark + questionPaper.markDistribution.fiveMark
      },
      bloomsDistribution: questionPaper.bloomsDistribution,
      questionTypeDistribution: flattenQuestionTypeDistribution(questionPaper.questionTypeDistribution),
      useSubjectBook: questionPaper.aiSettings?.useSubjectBook || false,
      customInstructions: questionPaper.aiSettings?.customInstructions || '',
      difficultyLevel: questionPaper.aiSettings?.difficultyLevel || 'MODERATE',
      twistedQuestionsPercentage: questionPaper.aiSettings?.twistedQuestionsPercentage || 0,
      language: 'ENGLISH' as const
    };

    // Generate questions using AI
    const generatedQuestions = await EnhancedAIService.generateQuestionPaper(aiRequest);

    // Save questions to database
    const { Question } = await import('../models/Question');
    const savedQuestions = [];
    
    for (const aiQuestion of generatedQuestions) {
      const question = new Question({
        questionText: aiQuestion.questionText,
        questionType: aiQuestion.questionType,
        subjectId: questionPaper.subjectId,
        classId: questionPaper.classId,
        adminId: adminId, // Add the required adminId field
        unit: 'AI Generated',
        bloomsTaxonomyLevel: aiQuestion.bloomsLevel,
        difficulty: aiQuestion.difficulty,
        isTwisted: aiQuestion.isTwisted,
        options: aiQuestion.options || [],
        correctAnswer: aiQuestion.correctAnswer,
        explanation: aiQuestion.explanation || '',
        marks: aiQuestion.marks,
        timeLimit: 1, // Set minimum time limit (1 minute)
        createdBy: adminId,
        isActive: true,
        tags: aiQuestion.tags || [],
        language: 'ENGLISH'
      });
      
      await question.save();
      savedQuestions.push(question);
    }

    // Update question paper with question references
    questionPaper.questions = savedQuestions.map(q => q._id);

    // Debug logging for PDF generation
    console.log('PDF Generation Data:', {
      subjectName: (questionPaper.subjectId as any).name,
      className: (questionPaper.classId as any).name,
      examTitle: (questionPaper.examId as any).title,
      totalMarks: questionPaper.markDistribution.totalMarks,
      duration: (questionPaper.examId as any).duration
    });

    // Generate PDF
    const pdfResult = await PDFGenerationService.generateQuestionPaperPDF(
      questionPaperId,
      generatedQuestions,
      (questionPaper.subjectId as any).name || 'Mathematics',
      (questionPaper.classId as any).name || 'Class 10',
      (questionPaper.examId as any).title || 'Question Paper',
      questionPaper.markDistribution.totalMarks || 100,
      (questionPaper.examId as any).duration || 180
    );

    // Update question paper
    questionPaper.status = 'GENERATED';
    questionPaper.generatedAt = new Date();
    questionPaper.generatedPdf = {
      fileName: pdfResult.fileName,
      filePath: pdfResult.filePath,
      fileSize: fs.statSync(pdfResult.filePath).size,
      generatedAt: new Date(),
      downloadUrl: pdfResult.downloadUrl
    };
    await questionPaper.save();

    res.json({
      success: true,
      message: "Question paper generated successfully",
      questionPaper,
      downloadUrl: pdfResult.downloadUrl
    });
  } catch (err) {
    next(err);
  }
}

// Upload PDF Question Paper
export async function uploadPDFQuestionPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    if (!req.file) {
      throw new createHttpError.BadRequest("No PDF file uploaded");
    }

    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    if (questionPaper.status !== 'DRAFT') {
      throw new createHttpError.BadRequest("Cannot upload PDF to generated question paper");
    }

    // Update question paper with PDF info
    questionPaper.type = 'PDF_UPLOADED';
    questionPaper.status = 'GENERATED';
    questionPaper.generatedAt = new Date();
    questionPaper.generatedPdf = {
      fileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      generatedAt: new Date(),
      downloadUrl: `/public/question-papers/${req.file.filename}`
    };
    await questionPaper.save();

    res.json({
      success: true,
      message: "Question paper PDF uploaded successfully",
      questionPaper,
      downloadUrl: questionPaper.generatedPdf.downloadUrl
    });
  } catch (err) {
    next(err);
  }
}

// Download Question Paper PDF
export async function downloadQuestionPaperPDF(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Allow all admins to access any question paper (removed adminId filter)
    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      isActive: true 
    });

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    if (!questionPaper.generatedPdf) {
      throw new createHttpError.BadRequest("Question paper PDF not generated yet");
    }

    const filePath = questionPaper.generatedPdf.filePath;
    
    if (!fs.existsSync(filePath)) {
      throw new createHttpError.NotFound("PDF file not found");
    }

    res.download(filePath, questionPaper.generatedPdf.fileName);
  } catch (err) {
    next(err);
  }
}

// Update Question Paper
export async function updateQuestionPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = CreateQuestionPaperSchema.partial().parse(req.body);
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    if (questionPaper.status !== 'DRAFT') {
      throw new createHttpError.BadRequest("Cannot update generated question paper");
    }

    // Update question paper
    Object.assign(questionPaper, updateData);
    await questionPaper.save();

    await questionPaper.populate([
      { path: 'examId', select: 'title examType scheduledDate' },
      { path: 'subjectId', select: 'name code' },
      { path: 'classId', select: 'name displayName' }
    ]);

    res.json({
      success: true,
      questionPaper
    });
  } catch (err) {
    next(err);
  }
}

// Delete Question Paper
export async function deleteQuestionPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    // Delete associated questions
    if (questionPaper.questions && questionPaper.questions.length > 0) {
      const { Question } = await import('../models/Question');
      await Question.updateMany(
        { _id: { $in: questionPaper.questions } },
        { isActive: false }
      );
    }

    // Delete PDF file if exists
    if (questionPaper.generatedPdf?.fileName) {
      await PDFGenerationService.deleteQuestionPaperPDF(questionPaper.generatedPdf.fileName);
    }

    // Soft delete
    questionPaper.isActive = false;
    await questionPaper.save();

    res.json({
      success: true,
      message: "Question paper deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Publish Question Paper
export async function publishQuestionPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    if (questionPaper.status !== 'GENERATED') {
      throw new createHttpError.BadRequest("Question paper must be generated before publishing");
    }

    questionPaper.status = 'PUBLISHED';
    questionPaper.publishedAt = new Date();
    await questionPaper.save();

    res.json({
      success: true,
      message: "Question paper published successfully",
      questionPaper
    });
  } catch (err) {
    next(err);
  }
}

// Generate Complete Question Paper with AI (Direct Generation)
export async function generateCompleteAIQuestionPaper(req: Request, res: Response, next: NextFunction) {
  try {
    // Log raw request body BEFORE Zod validation
    console.log('\n' + '='.repeat(80));
    console.log('📦 RAW REQUEST BODY (before Zod validation):');
    console.log('='.repeat(80));
    console.log('req.body keys:', Object.keys(req.body || {}));
    console.log('req.body.patternId:', (req.body as any)?.patternId);
    console.log('='.repeat(80) + '\n');
    
    const questionPaperData = CreateQuestionPaperSchema.parse(req.body);
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Validate exam exists and belongs to admin, and get subject/class IDs from exam
    const exam = await Exam.findOne({ 
      _id: questionPaperData.examId, 
      isActive: true 
    }).populate([
      { path: 'subjectIds', select: 'name code classIds' },
      { path: 'classId', select: 'name displayName' }
    ]);
    
    if (!exam) {
      throw new createHttpError.NotFound("Exam not found or not accessible");
    }
    
    // Extract subject and class IDs from exam
    if (!exam.subjectIds || exam.subjectIds.length === 0) {
      throw new createHttpError.BadRequest("Exam has no subjects assigned");
    }
    const subjectId = exam.subjectIds[0]?._id?.toString();
    if (!subjectId) {
      throw new createHttpError.BadRequest("Invalid subject data in exam");
    }
    const classId = exam.classId._id.toString();
    
    // Handle case where frontend sends subjectId and classId as objects
    let finalSubjectId: string = subjectId;
    let finalClassId: string = classId;
    
    if (questionPaperData.subjectId && typeof questionPaperData.subjectId === 'object') {
      finalSubjectId = questionPaperData.subjectId._id;
    } else if (questionPaperData.subjectId) {
      finalSubjectId = questionPaperData.subjectId as string;
    }
    
    if (questionPaperData.classId && typeof questionPaperData.classId === 'object') {
      finalClassId = questionPaperData.classId._id;
    } else if (questionPaperData.classId) {
      finalClassId = questionPaperData.classId as string;
    }
    
    // Validate that subject is available for this class
    if (!(exam.subjectIds[0] as any).classIds.includes(finalClassId)) {
      throw new createHttpError.BadRequest("Subject is not available for this class");
    }

    // Create question paper with derived subject and class IDs
    const questionPaper = await QuestionPaper.create({
      ...questionPaperData,
      subjectId: finalSubjectId, // Now derived
      classId: finalClassId,   // Now derived
      adminId,
      createdBy: auth.sub,
      type: 'AI_GENERATED',
      status: 'DRAFT'
    });

    // Populate the question paper with subject, class, and exam details
    await questionPaper.populate([
      { path: 'subjectId', select: 'name code referenceBook' },
      { path: 'classId', select: 'name displayName' },
      { path: 'examId', select: 'title duration' }
    ]);

    // Get reference book content for AI generation
    let referenceBookContent = '';
    const subject = questionPaper.subjectId as any;
    if (subject.referenceBook && subject.referenceBook.filePath) {
      try {
        // Read the reference book file content
        const referenceBookPath = subject.referenceBook.filePath;
        if (fs.existsSync(referenceBookPath)) {
          // For PDF files, we would need a PDF parser, but for now we'll use the file path
          // In a real implementation, you'd extract text from the PDF
          referenceBookContent = `Reference book available: ${subject.referenceBook.originalName} (${subject.referenceBook.fileSize} bytes)`;
          console.log('Reference book found for AI generation:', {
            fileName: subject.referenceBook.fileName,
            originalName: subject.referenceBook.originalName,
            fileSize: subject.referenceBook.fileSize
          });
        }
      } catch (error) {
        console.warn('Could not read reference book content:', error);
      }
    }

    // Get sample papers for the subject
    const { default: SamplePaper } = await import('../models/SamplePaper');
    const samplePapers = await SamplePaper.find({
      subjectId: finalSubjectId,
      isActive: true
    })
    .select('_id title description sampleFile analysis templateSettings version')
    .lean();

    console.log('Sample papers found for AI generation:', samplePapers.length);

    // Handle pattern file if provided
    // IMPORTANT: Get patternId from request body (it may not be saved in the model)
    let patternFilePath = null;
    let patternDiagramInfo = null;
    let diagramAnalysis = null; // Store analysis to access diagram images
    
    // Get patternId from request body directly (before validation might strip it)
    const patternId = (req.body as any).patternId || questionPaperData.patternId;
    
    console.log('\n' + '='.repeat(80));
    console.log('🔍 CHECKING PATTERN FILE:');
    console.log('='.repeat(80));
    console.log('patternId from req.body (raw):', (req.body as any).patternId);
    console.log('patternId from questionPaperData (parsed):', questionPaperData.patternId);
    console.log('Using patternId:', patternId);
    
    if (patternId) {
      // Try to find pattern file in multiple locations:
      // 1. question-patterns folder (uploaded patterns)
      // 2. question-paper-templates folder (template files)
      const patternPath1 = path.join(process.cwd(), 'public', 'question-patterns', patternId);
      const patternPath2 = path.join(process.cwd(), 'public', 'question-paper-templates', patternId);
      
      console.log('Checking pattern file locations:');
      console.log('  Location 1 (question-patterns):', patternPath1);
      console.log('  Location 2 (question-paper-templates):', patternPath2);
      
      // Try question-patterns first (uploaded patterns)
      if (fs.existsSync(patternPath1)) {
        patternFilePath = patternPath1;
        console.log('✅ Pattern file found in question-patterns folder');
      } 
      // If not found, try question-paper-templates (template files)
      else if (fs.existsSync(patternPath2)) {
        patternFilePath = patternPath2;
        console.log('✅ Pattern file found in question-paper-templates folder');
      }
      // If still not found, error
      else {
        console.error('❌ Pattern file not found in either location');
        console.error('  Checked:', patternPath1);
        console.error('  Checked:', patternPath2);
        throw new createHttpError.NotFound(`Pattern file not found. Checked locations: question-patterns/${patternId} and question-paper-templates/${patternId}`);
      }
      
      console.log('✅ Pattern file exists');

      // Analyze pattern file for diagrams and graphs
      try {
        console.log('🔄 Starting pattern analysis for diagrams...');
        diagramAnalysis = await PatternAnalysisService.analyzePatternForDiagrams(patternFilePath);
        
        console.log('Pattern analysis result:', {
          hasDiagrams: diagramAnalysis.hasDiagrams,
          diagramCount: diagramAnalysis.diagramCount,
          analysisComplete: diagramAnalysis.analysisComplete
        });
        
        if (diagramAnalysis.hasDiagrams && diagramAnalysis.analysisComplete) {
          console.log(`✅ Found ${diagramAnalysis.diagramCount} diagram(s) in pattern file`);
          patternDiagramInfo = PatternAnalysisService.formatDiagramsForPrompt(diagramAnalysis);
          console.log('✅ Pattern diagram info formatted and ready to send to AI');
          console.log('Diagram info snippet:', patternDiagramInfo.substring(0, 300));
        } else {
          console.log('❌ No diagrams found in pattern file or analysis incomplete');
          if (!diagramAnalysis.hasDiagrams) {
            console.log('   Reason: hasDiagrams = false');
          }
          if (!diagramAnalysis.analysisComplete) {
            console.log('   Reason: analysisComplete = false');
          }
        }
      } catch (error) {
        console.error('❌ Error analyzing pattern for diagrams:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        // Continue without diagram info - not a critical error
      }
    } else {
      console.log('❌ NO patternId provided in questionPaperData');
      console.log('questionPaperData keys:', Object.keys(questionPaperData));
    }
    console.log('='.repeat(80) + '\n');

    // Prepare AI request with reference book and template data
    const aiRequest = {
      subjectId: finalSubjectId,
      classId: finalClassId,
      subjectName: (questionPaper.subjectId as any).name,
      className: (questionPaper.classId as any).name,
      examTitle: (questionPaper.examId as any).title,
      markDistribution: {
        ...questionPaper.markDistribution,
        totalQuestions: questionPaper.markDistribution.oneMark + questionPaper.markDistribution.twoMark + questionPaper.markDistribution.threeMark + questionPaper.markDistribution.fiveMark
      },
      bloomsDistribution: questionPaper.bloomsDistribution,
      questionTypeDistribution: flattenQuestionTypeDistribution(questionPaper.questionTypeDistribution),
      useSubjectBook: questionPaper.aiSettings?.useSubjectBook || false,
      customInstructions: questionPaper.aiSettings?.customInstructions || '',
      difficultyLevel: questionPaper.aiSettings?.difficultyLevel || 'MODERATE',
      twistedQuestionsPercentage: questionPaper.aiSettings?.twistedQuestionsPercentage || 0,
      referenceBookContent: referenceBookContent,
      samplePapers: samplePapers,
      ...(patternFilePath && { patternFilePath }), // Add pattern file path to AI request only if it exists
      ...(patternDiagramInfo && { patternDiagramInfo }) // Add diagram information if available
    };

    // Generate questions using AI
    const generatedQuestions = await EnhancedAIService.generateQuestionPaper(aiRequest);

    // Process pending diagrams from AI response
    // The AI returns diagram objects with status: 'pending' that need to be generated
    const { DiagramGenerationService } = await import('../services/diagramGenerationService');
    
    // Helper function to convert PDF diagram to PNG if needed
    const convertPDFDiagramToPNG = async (diagramPath: string): Promise<{ imagePath: string; imageBuffer: Buffer } | null> => {
      if (!diagramPath.endsWith('.pdf')) {
        return null; // Not a PDF, no conversion needed
      }
      
      try {
        // CRITICAL: Import canvas FIRST to ensure Path2D is available before pdfjs-dist
        // @napi-rs/canvas provides Path2D natively, which pdfjs-dist needs
        const canvasModule = await import('@napi-rs/canvas');
        const { createCanvas } = canvasModule;
        const Path2D = (canvasModule as any).Path2D;
        
        // Make Path2D globally available BEFORE importing pdfjs-dist
        // pdfjs-dist checks for Path2D during module initialization
        if (Path2D && typeof (globalThis as any).Path2D === 'undefined') {
          (globalThis as any).Path2D = Path2D;
          console.log('✅ Path2D from @napi-rs/canvas is now globally available');
        } else if (Path2D) {
          console.log('✅ Path2D already available globally');
        } else {
          console.warn('⚠️ Path2D not found in @napi-rs/canvas - using polyfill may cause issues');
        }
        
        // Ensure Promise.withResolvers polyfill (for Node.js < 22)
        ensurePromiseWithResolvers();
        
        // DEBUGGER BREAKPOINT: Before importing pdfjs-dist
        debugger; // Breakpoint: PDF diagram conversion - before import
        
        // Now import pdfjs-dist - Path2D should be available
        const pdfjsModule = await import('pdfjs-dist/build/pdf.mjs');
        const pdfjsLib = pdfjsModule.default || pdfjsModule;
        const fs = await import('fs');
        const path = await import('path');
        
        const pdfBuffer = fs.readFileSync(diagramPath);
        
        // DEBUGGER BREAKPOINT: Before calling getDocument (where Promise.withResolvers error occurs)
        debugger; // Breakpoint: About to call pdfjsLib.getDocument in convertPDFDiagramToPNG
        
        const loadingTask = pdfjsLib.getDocument({ 
          data: new Uint8Array(pdfBuffer),
          useSystemFonts: true,
          verbosity: 0,
          disableWorker: true
        });
        
        // DEBUGGER BREAKPOINT: After getDocument call
        debugger; // Breakpoint: After getDocument call, before awaiting promise
        
        const pdfDocument = await loadingTask.promise;
        const page = await pdfDocument.getPage(1); // Get first page
        const scale = 2.0;
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        const imageBuffer = canvas.toBuffer('image/png');
        const pngPath = diagramPath.replace(/\.pdf$/i, '.png');
        fs.writeFileSync(pngPath, imageBuffer);
        
        return { imagePath: pngPath, imageBuffer };
      } catch (error) {
        console.warn(`Failed to convert PDF diagram to PNG: ${diagramPath}`, error);
        return null;
      }
    };
    
    // First, check if pattern has diagrams (these take priority)
    // We should assign pattern diagrams to ALL questions that need diagrams, not just pending ones
    if (diagramAnalysis && diagramAnalysis.hasDiagrams && diagramAnalysis.diagrams.length > 0) {
      // Find ALL questions that need diagrams:
      // 1. Questions with diagram objects (pending or ready)
      // 2. Questions of type DRAWING_DIAGRAM or MARKING_PARTS
      // 3. Questions with visualAids mentioning graphs/diagrams
      // 4. Questions that mention graph/diagram/draw/plot in the question text
      const allDiagramQuestions = generatedQuestions.map((q, idx) => {
        const questionTextLower = (q.questionText || '').toLowerCase();
        const needsDiagram = 
          q.diagram !== undefined || // Has diagram object
          q.questionType === 'DRAWING_DIAGRAM' || 
          q.questionType === 'MARKING_PARTS' ||
          (q.visualAids && q.visualAids.length > 0) ||
          questionTextLower.includes('graph') || 
          questionTextLower.includes('diagram') ||
          questionTextLower.includes('draw') ||
          questionTextLower.includes('plot') ||
          questionTextLower.includes('sketch') ||
          questionTextLower.includes('figure');
        return needsDiagram ? { question: q, index: idx } : null;
      }).filter((item): item is { question: typeof generatedQuestions[0]; index: number } => item !== null);
      
      console.log(`📊 Found ${allDiagramQuestions.length} questions needing diagrams and ${diagramAnalysis.diagrams.length} diagram images from pattern`);
      
      // Convert pattern PDF diagrams to PNG if needed (should already be PNG from patternAnalysisService, but double-check)
      console.log('🔄 Checking pattern diagrams for PDF to PNG conversion...');
      for (let i = 0; i < diagramAnalysis.diagrams.length; i++) {
        const patternDiagram = diagramAnalysis.diagrams[i];
        if (!patternDiagram) continue;
        
        console.log(`  Diagram ${i + 1}: path=${patternDiagram.imagePath}, hasBuffer=${!!patternDiagram.imageBuffer}, isPDF=${patternDiagram.imagePath?.endsWith('.pdf')}`);
        
        if (patternDiagram.imagePath && patternDiagram.imagePath.endsWith('.pdf')) {
          console.log(`⚠️ WARNING: Found PDF diagram at ${patternDiagram.imagePath} - should have been converted already!`);
          console.log(`🔄 Attempting to convert PDF diagram ${i + 1} to PNG: ${patternDiagram.imagePath}`);
          
          const converted = await convertPDFDiagramToPNG(patternDiagram.imagePath);
          if (converted) {
            patternDiagram.imagePath = converted.imagePath;
            patternDiagram.imageBuffer = converted.imageBuffer;
            console.log(`✅ Successfully converted PDF diagram to PNG: ${converted.imagePath}`);
          } else {
            console.error(`❌ FAILED to convert PDF diagram ${i + 1} to PNG - diagram may not appear in final PDF`);
            // Remove the PDF path so it doesn't get assigned - set to empty string instead of undefined
            delete patternDiagram.imagePath;
          }
        } else if (patternDiagram.imagePath && patternDiagram.imagePath.endsWith('.png')) {
          console.log(`✅ Diagram ${i + 1} is already PNG: ${patternDiagram.imagePath}`);
        }
      }
      
      // Filter out diagrams without valid image paths (failed conversions)
      const validDiagrams = diagramAnalysis.diagrams.filter(d => d.imagePath && !d.imagePath.endsWith('.pdf'));
      console.log(`📊 Valid diagrams available for assignment: ${validDiagrams.length} out of ${diagramAnalysis.diagrams.length}`);
      
      if (validDiagrams.length === 0) {
        console.error('❌ WARNING: No valid diagram images available after conversion! Diagrams will not be assigned.');
      } else {
        // Assign pattern diagrams to all questions that need them
        allDiagramQuestions.forEach((item, questionIdx) => {
          const question = item.question;
          const diagramIndex = questionIdx % validDiagrams.length; // Cycle through valid pattern diagrams
          const patternDiagram = validDiagrams[diagramIndex];
          
          if (patternDiagram && patternDiagram.imagePath) {
            // Verify file exists
            if (!fs.existsSync(patternDiagram.imagePath)) {
              console.error(`❌ Diagram file not found: ${patternDiagram.imagePath} - skipping assignment`);
              return;
            }
            
            // Ensure question has a diagram object
            if (!question.diagram) {
              question.diagram = {
                description: patternDiagram.description || 'Diagram from pattern',
                type: patternDiagram.type as 'graph' | 'geometry' | 'circuit' | 'chart' | 'diagram' | 'figure' | 'other',
                status: 'ready',
                altText: patternDiagram.description || undefined
              };
            }
            
            // Assign pattern diagram
            question.diagram.imagePath = patternDiagram.imagePath;
            if (patternDiagram.imageBuffer) {
              question.diagram.imageBuffer = patternDiagram.imageBuffer;
            }
            question.diagram.status = 'ready';
            console.log(`✅ Assigned pattern diagram ${diagramIndex + 1} (${patternDiagram.type}, ${patternDiagram.imagePath}) to question ${item.index + 1} (${question.questionType})`);
            console.log(`   Diagram file exists: ${fs.existsSync(patternDiagram.imagePath)}, hasBuffer: ${!!patternDiagram.imageBuffer}`);
          } else {
            console.warn(`⚠️ Skipping question ${item.index + 1} - no valid diagram available`);
          }
        });
      }
    }
    
    // Generate diagrams for questions that still have status: 'pending'
    const pendingDiagramQuestions = generatedQuestions.filter(
      q => q.diagram && q.diagram.status === 'pending'
    );
    
    if (pendingDiagramQuestions.length > 0) {
      console.log(`🔄 Generating ${pendingDiagramQuestions.length} diagram(s) for pending questions...`);
      
      for (let i = 0; i < pendingDiagramQuestions.length; i++) {
        const question = pendingDiagramQuestions[i];
        if (!question.diagram) continue;
        
        try {
          // Generate diagram based on description and type
          const generatedDiagram = await DiagramGenerationService.generateDiagram({
            description: question.diagram.description,
            type: question.diagram.type as 'graph' | 'chart' | 'diagram' | 'figure' | 'illustration',
            context: question.questionText,
            relatedContent: question.diagram.altText
          }, question.questionText);
          
          if (generatedDiagram) {
            question.diagram.imagePath = generatedDiagram.imagePath;
            question.diagram.imageBuffer = generatedDiagram.imageBuffer;
            question.diagram.status = 'ready';
            question.diagram.url = generatedDiagram.source;
            console.log(`✅ Generated diagram for question ${generatedQuestions.indexOf(question) + 1}: ${generatedDiagram.altText}`);
          } else {
            console.warn(`⚠️ Failed to generate diagram for question ${generatedQuestions.indexOf(question) + 1}`);
          }
        } catch (error) {
          console.warn(`⚠️ Error generating diagram for question ${generatedQuestions.indexOf(question) + 1}:`, error);
          // Keep status as 'pending' - PDF generation will handle gracefully
        }
      }
    }
    
    // Also generate diagrams for questions that need them but don't have diagram objects yet
    const questionsNeedingDiagrams = generatedQuestions.filter(
      q => !q.diagram && (q.questionType === 'DRAWING_DIAGRAM' || q.questionType === 'MARKING_PARTS' || (q.visualAids && q.visualAids.length > 0))
    );
    
    if (questionsNeedingDiagrams.length > 0) {
      console.log(`🔄 Generating ${questionsNeedingDiagrams.length} additional diagram(s) for questions without diagram objects...`);
      
      for (const question of questionsNeedingDiagrams) {
        const description = question.visualAids?.[0] || `Diagram for: ${question.questionText.substring(0, 100)}`;
        const diagramType = description.toLowerCase().includes('graph') ? 'graph' : 
                           description.toLowerCase().includes('chart') ? 'chart' : 'diagram';
        
        try {
          const generatedDiagram = await DiagramGenerationService.generateDiagram({
            description: description,
            type: diagramType,
            context: question.questionText
          }, question.questionText);
          
          if (generatedDiagram) {
            // Create diagram object
            question.diagram = {
              description: description,
              type: diagramType,
              status: 'ready',
              altText: generatedDiagram.altText,
              imagePath: generatedDiagram.imagePath,
              imageBuffer: generatedDiagram.imageBuffer,
              url: generatedDiagram.source
            };
            console.log(`✅ Generated and attached diagram to question ${generatedQuestions.indexOf(question) + 1}`);
          }
        } catch (error) {
          console.warn(`⚠️ Error generating diagram for question ${generatedQuestions.indexOf(question) + 1}:`, error);
        }
      }
    }

    // Save questions to database
    const { Question } = await import('../models/Question');
    const savedQuestions = [];
    
    for (const aiQuestion of generatedQuestions) {
      const question = new Question({
        questionText: aiQuestion.questionText,
        questionType: aiQuestion.questionType,
        subjectId: questionPaper.subjectId,
        classId: questionPaper.classId,
        adminId: adminId, // Add the required adminId field
        unit: 'AI Generated',
        bloomsTaxonomyLevel: aiQuestion.bloomsLevel,
        difficulty: aiQuestion.difficulty,
        isTwisted: aiQuestion.isTwisted,
        options: aiQuestion.options || [],
        correctAnswer: aiQuestion.correctAnswer,
        explanation: aiQuestion.explanation || '',
        marks: aiQuestion.marks,
        timeLimit: 1, // Set minimum time limit (1 minute)
        createdBy: adminId,
        isActive: true,
        tags: aiQuestion.tags || [],
        language: 'ENGLISH'
      });
      
      await question.save();
      savedQuestions.push(question);
    }

    // Update question paper with question references
    questionPaper.questions = savedQuestions.map(q => q._id);

    // Before PDF generation, ensure all diagram PDFs are converted to PNG
    // This ensures PDFKit can embed them properly
    console.log('\n' + '='.repeat(80));
    console.log('🔄 PRE-PDF GENERATION: Checking and converting diagram PDFs to PNG...');
    console.log('='.repeat(80));
    
    let diagramsToConvert = 0;
    let diagramsConverted = 0;
    let diagramsFailed = 0;
    
    for (let i = 0; i < generatedQuestions.length; i++) {
      const question = generatedQuestions[i];
      
      // Check new diagram format
      if (question.diagram && question.diagram.status === 'ready') {
        if (question.diagram.imagePath) {
          console.log(`  Question ${i + 1}: diagram.path=${question.diagram.imagePath}, hasBuffer=${!!question.diagram.imageBuffer}`);
          
          if (question.diagram.imagePath.endsWith('.pdf')) {
            diagramsToConvert++;
            console.log(`  ⚠️ Question ${i + 1} has PDF diagram - converting to PNG...`);
            const converted = await convertPDFDiagramToPNG(question.diagram.imagePath);
            if (converted) {
              question.diagram.imagePath = converted.imagePath;
              question.diagram.imageBuffer = converted.imageBuffer;
              diagramsConverted++;
              console.log(`  ✅ Question ${i + 1}: Converted to PNG: ${converted.imagePath}`);
            } else {
              diagramsFailed++;
              console.error(`  ❌ Question ${i + 1}: FAILED to convert PDF diagram - diagram will not appear in PDF`);
              // Clear invalid diagram
              question.diagram.status = 'pending';
              question.diagram.imagePath = undefined;
            }
          } else if (question.diagram.imagePath.endsWith('.png')) {
            // Verify PNG file exists
            if (!fs.existsSync(question.diagram.imagePath)) {
              console.error(`  ❌ Question ${i + 1}: PNG diagram file not found: ${question.diagram.imagePath}`);
              question.diagram.status = 'pending';
            } else {
              console.log(`  ✅ Question ${i + 1}: Has valid PNG diagram`);
            }
          }
        } else if (!question.diagram.imageBuffer) {
          console.log(`  ⚠️ Question ${i + 1}: Has diagram object but no imagePath or imageBuffer`);
        }
      }
      
      // Check legacy format
      if (question.diagramImagePath && question.diagramImagePath.endsWith('.pdf')) {
        diagramsToConvert++;
        console.log(`  ⚠️ Question ${i + 1} has legacy PDF diagram - converting to PNG...`);
        const converted = await convertPDFDiagramToPNG(question.diagramImagePath);
        if (converted) {
          question.diagramImagePath = converted.imagePath;
          question.diagramImageBuffer = converted.imageBuffer;
          diagramsConverted++;
          console.log(`  ✅ Question ${i + 1}: Converted legacy to PNG: ${converted.imagePath}`);
        } else {
          diagramsFailed++;
          console.error(`  ❌ Question ${i + 1}: FAILED to convert legacy PDF diagram`);
          question.diagramImagePath = undefined;
        }
      }
    }
    
    console.log('='.repeat(80));
    console.log(`📊 Diagram Conversion Summary:`);
    console.log(`   Total questions checked: ${generatedQuestions.length}`);
    console.log(`   PDFs to convert: ${diagramsToConvert}`);
    console.log(`   Successfully converted: ${diagramsConverted}`);
    console.log(`   Failed conversions: ${diagramsFailed}`);
    console.log('='.repeat(80) + '\n');

    // Debug logging for PDF generation
    console.log('PDF Generation Data (Complete):', {
      subjectName: (questionPaper.subjectId as any).name,
      className: (questionPaper.classId as any).name,
      examTitle: (questionPaper.examId as any).title,
      totalMarks: questionPaper.markDistribution.totalMarks,
      duration: (questionPaper.examId as any).duration
    });

    // Generate PDF
    const pdfResult = await PDFGenerationService.generateQuestionPaperPDF(
      (questionPaper._id as any).toString(),
      generatedQuestions,
      (questionPaper.subjectId as any).name || 'Mathematics',
      (questionPaper.classId as any).name || 'Class 10',
      (questionPaper.examId as any).title || 'Question Paper',
      questionPaper.markDistribution.totalMarks || 100,
      (questionPaper.examId as any).duration || 180
    );

    // Update question paper
    questionPaper.status = 'GENERATED';
    questionPaper.generatedAt = new Date();
    questionPaper.generatedPdf = {
      fileName: pdfResult.fileName,
      filePath: pdfResult.filePath,
      fileSize: fs.statSync(pdfResult.filePath).size,
      generatedAt: new Date(),
      downloadUrl: pdfResult.downloadUrl
    };
    await questionPaper.save();

    // Update exam with question paper reference
    await Exam.findByIdAndUpdate(questionPaperData.examId, {
      questionPaperId: questionPaper._id
    });

    res.json({
      success: true,
      message: "Question paper generated successfully with AI",
      questionPaper,
      downloadUrl: pdfResult.downloadUrl
    });
  } catch (err) {
    next(err);
  }
}

// Get all questions for a question paper
export async function getQuestionPaperQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Get question paper
    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    // Get questions from the question paper's questions array
    const { Question } = await import('../models/Question');
    const questions = await Question.find({ 
      _id: { $in: questionPaper.questions },
      isActive: true 
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      questions
    });
  } catch (err) {
    next(err);
  }
}

// Add a question to a question paper
export async function addQuestionToPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Get question paper
    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    }).populate(['subjectId', 'classId']);

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    // Create new question
    const { Question } = await import('../models/Question');
    const question = new Question({
      questionText: req.body.questionText,
      questionType: req.body.questionType,
      subjectId: questionPaper.subjectId,
      classId: questionPaper.classId,
      unit: req.body.unit || 'General',
      bloomsTaxonomyLevel: req.body.bloomsTaxonomyLevel,
      difficulty: req.body.difficulty,
      isTwisted: req.body.isTwisted || false,
      options: req.body.options || [],
      correctAnswer: req.body.correctAnswer,
      explanation: req.body.explanation || '',
      marks: req.body.marks,
      timeLimit: req.body.timeLimit || 0,
      createdBy: adminId,
      isActive: true,
      tags: req.body.tags || [],
      language: req.body.language || 'en'
    });

    await question.save();

    // Add question to question paper
    questionPaper.questions.push(question._id);
    await questionPaper.save();

    res.status(201).json({
      success: true,
      message: "Question added successfully",
      question
    });
  } catch (err) {
    next(err);
  }
}

// Update a question in a question paper
export async function updateQuestionInPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, questionId } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Get question paper
    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    // Check if question belongs to this question paper
    if (!questionPaper.questions.includes(questionId as any)) {
      throw new createHttpError.NotFound("Question not found in this question paper");
    }

    // Update question
    const { Question } = await import('../models/Question');
    const question = await Question.findOneAndUpdate(
      { _id: questionId, isActive: true },
      {
        questionText: req.body.questionText,
        questionType: req.body.questionType,
        bloomsTaxonomyLevel: req.body.bloomsTaxonomyLevel,
        difficulty: req.body.difficulty,
        isTwisted: req.body.isTwisted,
        options: req.body.options,
        correctAnswer: req.body.correctAnswer,
        explanation: req.body.explanation,
        marks: req.body.marks,
        timeLimit: req.body.timeLimit,
        tags: req.body.tags,
        language: req.body.language
      },
      { new: true, runValidators: true }
    );

    if (!question) {
      throw new createHttpError.NotFound("Question not found");
    }

    res.json({
      success: true,
      message: "Question updated successfully",
      question
    });
  } catch (err) {
    next(err);
  }
}

// Delete a question from a question paper
export async function deleteQuestionFromPaper(req: Request, res: Response, next: NextFunction) {
  try {
    const { id, questionId } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Get question paper
    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    // Check if question belongs to this question paper
    if (!questionPaper.questions.includes(questionId as any)) {
      throw new createHttpError.NotFound("Question not found in this question paper");
    }

    // Remove question from question paper
    questionPaper.questions = questionPaper.questions.filter(
      (qId: any) => qId.toString() !== questionId
    );
    await questionPaper.save();

    // Soft delete the question
    const { Question } = await import('../models/Question');
    await Question.findOneAndUpdate(
      { _id: questionId },
      { isActive: false }
    );

    res.json({
      success: true,
      message: "Question deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Upload new PDF for a question paper
export async function uploadQuestionPaperPDF(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    if (!req.file) {
      throw new createHttpError.BadRequest("No PDF file uploaded");
    }

    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      adminId, 
      isActive: true 
    });

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    // Delete old PDF if exists
    if (questionPaper.generatedPdf?.fileName) {
      await PDFGenerationService.deleteQuestionPaperPDF(questionPaper.generatedPdf.fileName);
    }

    // Update question paper with new PDF info
    questionPaper.generatedPdf = {
      fileName: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      generatedAt: new Date(),
      downloadUrl: `/public/question-papers/${req.file.filename}`
    };

    await questionPaper.save();

    res.json({
      success: true,
      message: "PDF uploaded successfully",
      questionPaper
    });
  } catch (err) {
    next(err);
  }
}

// Regenerate PDF for a question paper
export async function regenerateQuestionPaperPDF(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    const adminId = auth?.adminId;
    
    if (!adminId) {
      throw new createHttpError.Unauthorized("Admin ID not found in token");
    }

    // Get question paper with questions (allow all admins to access any question paper)
    const questionPaper = await QuestionPaper.findOne({ 
      _id: id, 
      isActive: true 
    }).populate([
      { path: 'examId', select: 'title duration' },
      { path: 'subjectId', select: 'name code' },
      { path: 'classId', select: 'name displayName' },
      { path: 'questions', populate: { path: 'subjectId classId' } }
    ]);

    if (!questionPaper) {
      throw new createHttpError.NotFound("Question paper not found");
    }

    if (!questionPaper.questions || questionPaper.questions.length === 0) {
      throw new createHttpError.BadRequest("No questions found in question paper");
    }

    // Convert questions to the format expected by PDF generation
    const { Question } = await import('../models/Question');
    const questions = await Question.find({ 
      _id: { $in: questionPaper.questions },
      isActive: true 
    });

    const generatedQuestions = questions.map(q => ({
      questionText: q.questionText,
      questionType: q.questionType,
      marks: q.marks,
      bloomsLevel: q.bloomsTaxonomyLevel,
      difficulty: q.difficulty,
      isTwisted: q.isTwisted,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      tags: q.tags || []
    }));

    // Delete old PDF if exists
    if (questionPaper.generatedPdf?.fileName) {
      try {
        const oldFilePath = path.join(process.cwd(), 'public', 'question-papers', questionPaper.generatedPdf.fileName);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (error) {
        console.warn('Could not delete old PDF file:', error);
      }
    }

    // Debug logging for PDF generation
    console.log('PDF Generation Data (Regenerate):', {
      subjectName: (questionPaper.subjectId as any).name,
      className: (questionPaper.classId as any).name,
      examTitle: (questionPaper.examId as any).title,
      totalMarks: questionPaper.markDistribution.totalMarks,
      duration: (questionPaper.examId as any).duration
    });

    // Generate new PDF
    const pdfResult = await PDFGenerationService.generateQuestionPaperPDF(
      (questionPaper._id as any).toString(),
      generatedQuestions,
      (questionPaper.subjectId as any).name || 'Mathematics',
      (questionPaper.classId as any).name || 'Class 10',
      (questionPaper.examId as any).title || 'Question Paper',
      questionPaper.markDistribution.totalMarks || 100,
      (questionPaper.examId as any).duration || 180
    );

    // Update question paper with new PDF info
    questionPaper.generatedPdf = {
      fileName: pdfResult.fileName,
      filePath: pdfResult.filePath,
      fileSize: fs.statSync(pdfResult.filePath).size,
      generatedAt: new Date(),
      downloadUrl: pdfResult.downloadUrl
    };
    await questionPaper.save();

    res.json({
      success: true,
      message: "PDF regenerated successfully",
      questionPaper,
      downloadUrl: pdfResult.downloadUrl
    });
  } catch (err) {
    next(err);
  }
}