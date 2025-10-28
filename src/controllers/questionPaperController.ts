import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import createHttpError from 'http-errors';
import { QuestionPaper } from '../models/QuestionPaper';
import { Exam } from '../models/Exam';
import { Subject } from '../models/Subject';
import { Class } from '../models/Class';
import { EnhancedAIService } from '../services/enhancedAIService';
import { PDFGenerationService } from '../services/pdfGenerationService';
import path from 'path';
import fs from 'fs';

// Validation schemas
const CreateQuestionPaperSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  examId: z.string().min(1),
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  markDistribution: z.object({
    oneMark: z.number().min(0).max(100),
    twoMark: z.number().min(0).max(100),
    threeMark: z.number().min(0).max(100),
    fiveMark: z.number().min(0).max(100),
    totalQuestions: z.number().min(1).max(100),
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
  }).optional()
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

    // Validate exam exists and belongs to admin
    const exam = await Exam.findOne({ 
      _id: questionPaperData.examId, 
      adminId, 
      isActive: true 
    });
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

    // Validate subject exists and belongs to admin
    const subject = await Subject.findOne({ 
      _id: questionPaperData.subjectId, 
      adminId, 
      isActive: true 
    });
    if (!subject) {
      throw new createHttpError.NotFound("Subject not found or not accessible");
    }

    // Validate class exists and belongs to admin
    const classExists = await Class.findOne({ 
      _id: questionPaperData.classId, 
      adminId, 
      isActive: true 
    });
    if (!classExists) {
      throw new createHttpError.NotFound("Class not found or not accessible");
    }

    // Validate that subject is available for this class
    if (!subject.classIds.includes(questionPaperData.classId as any)) {
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

    // Create question paper
    const questionPaper = await QuestionPaper.create({
      ...questionPaperData,
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
export async function generateQuestionPaper(req: Request, res: Response, next: NextFunction) {
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

    // Get templates for the subject to use as design guidance
    const { default: QuestionPaperTemplate } = await import('../models/QuestionPaperTemplate');
    const templates = await QuestionPaperTemplate.find({
      subjectId: questionPaper.subjectId._id,
      isActive: true
    })
    .select('_id title description templateFile analysis templateSettings version')
    .lean();

    console.log('Templates found for AI generation:', templates.length);

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
      questionTypeDistribution: questionPaper.questionTypeDistribution,
      useSubjectBook: questionPaper.aiSettings?.useSubjectBook || false,
      customInstructions: questionPaper.aiSettings?.customInstructions,
      difficultyLevel: questionPaper.aiSettings?.difficultyLevel || 'MODERATE',
      twistedQuestionsPercentage: questionPaper.aiSettings?.twistedQuestionsPercentage || 0,
      templates: templates, // Add templates for design guidance
    };

    // Generate questions using AI
    const generatedQuestions = await EnhancedAIService.generateQuestionPaper(aiRequest);

    // Generate PDF
    const pdfResult = await PDFGenerationService.generateQuestionPaperPDF(
      questionPaperId,
      generatedQuestions,
      (questionPaper.subjectId as any).name,
      (questionPaper.classId as any).name,
      (questionPaper.examId as any).title,
      questionPaper.markDistribution.totalMarks,
      (questionPaper.examId as any).duration
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

// Download Question Paper PDF
export async function downloadQuestionPaper(req: Request, res: Response, next: NextFunction) {
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