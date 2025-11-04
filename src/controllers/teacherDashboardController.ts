import type { Request, Response } from "express";
import { z } from "zod";
import { Teacher } from "../models/Teacher";
import { StaffAccess } from "../models/StaffAccess";
import { Class } from "../models/Class";
import { Subject } from "../models/Subject";
import { QuestionPaper } from "../models/QuestionPaper";
import { Exam } from "../models/Exam";
import { Student } from "../models/Student";
import { Result } from "../models/Result";
import { AnswerSheet } from "../models/AnswerSheet";
import { Notification } from "../models/Notification";
import { logger } from "../utils/logger";
import { AIRollNumberDetectionService } from "../services/aiRollNumberDetection";
import createHttpError from "http-errors";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { EnhancedAIService } from "../services/enhancedAIService";
import { PDFGenerationService } from "../services/pdfGenerationService";

// Validation schemas (same as admin)
const CreateQuestionPaperSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  examId: z.string().min(1),
  subjectId: z.union([z.string(), z.object({
    _id: z.string(),
    code: z.string().optional(),
    name: z.string().optional(),
  })]).optional(),
  classId: z.union([z.string(), z.object({
    _id: z.string(),
    name: z.string().optional(),
    displayName: z.string().optional(),
  })]).optional(),
  markDistribution: z.object({
    oneMark: z.number().min(0).max(100),
    twoMark: z.number().min(0).max(100),
    threeMark: z.number().min(0).max(100),
    fiveMark: z.number().min(0).max(100),
    totalMarks: z.number().min(1).max(1000).optional(),
  }),
  bloomsDistribution: z.array(
    z.object({
      level: z.enum([
        "REMEMBER",
        "UNDERSTAND",
        "APPLY",
        "ANALYZE",
        "EVALUATE",
        "CREATE",
      ]),
      percentage: z.number().min(0).max(100),
    })
  ),
  questionTypeDistribution: z.object({
    oneMark: z.array(z.object({
      type: z.enum([
        "CHOOSE_BEST_ANSWER",
        "FILL_BLANKS",
        "ONE_WORD_ANSWER",
        "TRUE_FALSE",
        "CHOOSE_MULTIPLE_ANSWERS",
        "MATCHING_PAIRS",
        "DRAWING_DIAGRAM",
        "MARKING_PARTS",
        "SHORT_ANSWER",
        "LONG_ANSWER",
      ]),
      percentage: z.number().min(0).max(100),
    })).optional(),
    twoMark: z.array(z.object({
      type: z.enum([
        "CHOOSE_BEST_ANSWER",
        "FILL_BLANKS",
        "ONE_WORD_ANSWER",
        "TRUE_FALSE",
        "CHOOSE_MULTIPLE_ANSWERS",
        "MATCHING_PAIRS",
        "DRAWING_DIAGRAM",
        "MARKING_PARTS",
        "SHORT_ANSWER",
        "LONG_ANSWER",
      ]),
      percentage: z.number().min(0).max(100),
    })).optional(),
    threeMark: z.array(z.object({
      type: z.enum([
        "CHOOSE_BEST_ANSWER",
        "FILL_BLANKS",
        "ONE_WORD_ANSWER",
        "TRUE_FALSE",
        "CHOOSE_MULTIPLE_ANSWERS",
        "MATCHING_PAIRS",
        "DRAWING_DIAGRAM",
        "MARKING_PARTS",
        "SHORT_ANSWER",
        "LONG_ANSWER",
      ]),
      percentage: z.number().min(0).max(100),
    })).optional(),
    fiveMark: z.array(z.object({
      type: z.enum([
        "CHOOSE_BEST_ANSWER",
        "FILL_BLANKS",
        "ONE_WORD_ANSWER",
        "TRUE_FALSE",
        "CHOOSE_MULTIPLE_ANSWERS",
        "MATCHING_PAIRS",
        "DRAWING_DIAGRAM",
        "MARKING_PARTS",
        "SHORT_ANSWER",
        "LONG_ANSWER",
      ]),
      percentage: z.number().min(0).max(100),
    })).optional(),
  }),
  aiSettings: z
    .object({
      useSubjectBook: z.boolean().default(false),
      customInstructions: z.string().optional(),
      difficultyLevel: z
        .enum(["EASY", "MODERATE", "TOUGHEST"])
        .default("MODERATE"),
      twistedQuestionsPercentage: z.number().min(0).max(50).default(0),
    })
    .optional(),
  patternId: z.string().optional(),
  syllabusId: z.string().optional(),
});

const UploadAnswerSheetSchema = z.object({
  examId: z.string(),
  studentId: z.string(),
  files: z.array(z.string()), // File paths
});

const EvaluateAnswerSchema = z.object({
  answerSheetId: z.string(),
  manualOverrides: z
    .array(
      z.object({
        questionId: z.string(),
        awardedMarks: z.number(),
        reason: z.string().optional(),
        improvementSuggestions: z.string().optional(),
      })
    )
    .optional(),
});

// Get teacher's assigned classes and subjects
export const getTeacherAccess = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Get teacher's assigned classes and subjects
    const teacher = await Teacher.findOne({ userId: teacherId })
      .populate("classIds", "name displayName level section")
      .populate("subjectIds", "name code shortName category");

    if (!teacher) {
      return res.status(403).json({
        success: false,
        error: "Teacher record not found. Please contact administrator.",
      });
    }

    // Convert to the expected format - show all classes and subjects from the school
    const classAccess = teacher.classIds.map((classId: any) => ({
      classId: classId._id,
      className: classId.name,
      accessLevel: "READ_WRITE",
      canUploadSheets: true,
      canMarkAbsent: true,
      canMarkMissing: true,
      canOverrideAI: false,
    }));

    const subjectAccess = teacher.subjectIds.map((subjectId: any) => ({
      subjectId: subjectId._id,
      subjectName: subjectId.name,
      accessLevel: "READ_WRITE",
      canCreateQuestions: true,
      canUploadSyllabus: true,
    }));

    const globalPermissions = {
      canViewAllClasses: true, // Teachers can now see all school exams
      canViewAllSubjects: true, // Teachers can see all school subjects
      canAccessAnalytics: true,
      canPrintReports: true,
      canSendNotifications: false,
    };

    res.json({
      success: true,
      data: {
        classAccess,
        subjectAccess,
        globalPermissions,
      },
    });
  } catch (error) {
    logger.error("Error getting teacher access:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Create question paper for assigned subjects
export const createTeacherQuestionPaper = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const questionPaperData = CreateQuestionPaperSchema.parse(req.body);

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Get teacher's adminId and verify access
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher not found" });
    }

    // Verify teacher has access to the subject and class
    const hasSubjectAccess = teacher.subjectIds.some(
      (id) => id.toString() === questionPaperData.subjectId
    );
    const hasClassAccess = teacher.classIds.some(
      (id) => id.toString() === questionPaperData.classId
    );

    if (!hasSubjectAccess || !hasClassAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this subject or class",
      });
    }

    // Check if question paper already exists for this exam
    const existingQuestionPaper = await QuestionPaper.findOne({
      examId: questionPaperData.examId,
      isActive: true,
    });
    if (existingQuestionPaper) {
      return res.status(409).json({
        success: false,
        error:
          "A question paper already exists for this exam. Only one question paper per exam is allowed.",
      });
    }

    // Create question paper
    const questionPaper = new QuestionPaper({
      ...questionPaperData,
      adminId: teacher.adminId,
      createdBy: teacherId,
      type: "AI_GENERATED",
      status: "DRAFT",
    });

    await questionPaper.save();

    // Update exam with question paper reference
    await Exam.findByIdAndUpdate(questionPaperData.examId, {
      questionPaperId: questionPaper._id,
    });

    res.status(201).json({
      success: true,
      data: questionPaper,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }
    logger.error("Error creating question paper:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Get question papers for assigned classes and subjects
export const getTeacherQuestionPapers = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherId = (req as any).auth?.sub;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Get teacher's assigned classes and subjects
    const teacher = await Teacher.findOne({ userId: teacherId })
      .populate("classIds", "_id name")
      .populate("subjectIds", "_id name");

    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: "Teacher record not found. Please contact administrator.",
      });
    }

    const teacherClassIds = teacher.classIds.map((c: any) => c._id);
    const teacherSubjectIds = teacher.subjectIds.map((s: any) => s._id);

    // Get query parameters
    const { page = 1, limit = 10, status, examId, subjectId, classId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Build filter - only show question papers for teacher's assigned classes and subjects
    const filter: any = {
      isActive: true,
      adminId: teacher.adminId,
      classId: { $in: teacherClassIds },
      subjectId: { $in: teacherSubjectIds }
    };

    // Additional filters
    if (status) filter.status = status;
    if (examId) filter.examId = examId;
    if (subjectId) {
      // Ensure the requested subject is in teacher's assigned subjects
      if (teacherSubjectIds.some((id: any) => id.toString() === subjectId)) {
        filter.subjectId = subjectId;
      } else {
        return res.status(403).json({
          success: false,
          error: "Access denied to this subject",
        });
      }
    }
    if (classId) {
      // Ensure the requested class is in teacher's assigned classes
      if (teacherClassIds.some((id: any) => id.toString() === classId)) {
        filter.classId = classId;
      } else {
        return res.status(403).json({
          success: false,
          error: "Access denied to this class",
        });
      }
    }

    // Get question papers with populated data
    const questionPapers = await QuestionPaper.find(filter)
      .populate([
        { path: 'examId', select: 'title examType scheduledDate classId subjectIds', populate: [
          { path: 'classId', select: 'name displayName' },
          { path: 'subjectIds', select: 'name code' }
        ] },
        { path: 'subjectId', select: 'name code' },
        { path: 'classId', select: 'name displayName' },
        { path: 'createdBy', select: 'name email' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Further filter by exam's class/subject if needed
    // Only include question papers where the exam's class and subjects match teacher's access
    const filteredQuestionPapers = questionPapers.filter((qp: any) => {
      if (!qp.examId) return false;
      
      const examClassId = qp.examId.classId?._id?.toString() || qp.examId.classId?.toString();
      const examSubjectIds = qp.examId.subjectIds || [];
      const examSubjectIdStrings = examSubjectIds.map((s: any) => s._id?.toString() || s.toString());
      
      // Check if exam's class is in teacher's classes
      const hasClassAccess = teacherClassIds.some((cid: any) => 
        cid.toString() === examClassId
      );
      
      // Check if exam has at least one subject in teacher's subjects
      const hasSubjectAccess = examSubjectIdStrings.some((sid: string) =>
        teacherSubjectIds.some((tsid: any) => tsid.toString() === sid)
      );
      
      return hasClassAccess && hasSubjectAccess;
    });

    // Get total count from filtered results (not from database since we filter by exam data)
    const total = filteredQuestionPapers.length;

    res.json({
      success: true,
      data: filteredQuestionPapers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error("Error getting teacher question papers:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Download question paper PDF (with access verification)
export const downloadTeacherQuestionPaper = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { id } = req.params;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!id) {
      return res.status(400).json({ success: false, error: "Question paper ID is required" });
    }

    // Get teacher's assigned classes and subjects
    const teacher = await Teacher.findOne({ userId: teacherId })
      .populate("classIds", "_id")
      .populate("subjectIds", "_id");

    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: "Teacher record not found. Please contact administrator.",
      });
    }

    const teacherClassIds = teacher.classIds.map((c: any) => c._id.toString());
    const teacherSubjectIds = teacher.subjectIds.map((s: any) => s._id.toString());

    // Get question paper
    const questionPaper = await QuestionPaper.findOne({
      _id: id,
      isActive: true,
      adminId: teacher.adminId,
    })
      .populate('classId', '_id')
      .populate('subjectId', '_id');

    if (!questionPaper) {
      return res.status(404).json({
        success: false,
        error: "Question paper not found",
      });
    }

    // Verify teacher has access to this question paper's class and subject
    const hasClassAccess = teacherClassIds.includes(
      questionPaper.classId?._id?.toString() || questionPaper.classId?.toString()
    );
    const hasSubjectAccess = teacherSubjectIds.includes(
      questionPaper.subjectId?._id?.toString() || questionPaper.subjectId?.toString()
    );

    if (!hasClassAccess || !hasSubjectAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this question paper",
      });
    }

    if (!questionPaper.generatedPdf || !questionPaper.generatedPdf.filePath) {
      return res.status(404).json({
        success: false,
        error: "Question paper PDF not generated yet",
      });
    }

    const filePath = questionPaper.generatedPdf.filePath;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "PDF file not found",
      });
    }

    // Set headers explicitly for inline PDF viewing (prevents blank page on first load)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(questionPaper.generatedPdf.fileName)}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Use sendFile with proper options for better PDF rendering
    res.sendFile(path.resolve(filePath), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(questionPaper.generatedPdf.fileName)}"`
      }
    });

    logger.info(`Question paper downloaded: ${id} by teacher ${teacherId}`);
  } catch (error) {
    logger.error("Error downloading question paper:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Helper function to flatten question type distribution for AI service (same as admin)
function flattenQuestionTypeDistribution(questionTypeDistribution: any): Array<{
  type: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
  percentage: number;
  marks: number;
}> {
  const flattened: Array<{
    type: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
    percentage: number;
    marks: number;
  }> = [];
  
  const markCategories = ['oneMark', 'twoMark', 'threeMark', 'fiveMark'] as const;
  const markValues = { oneMark: 1, twoMark: 2, threeMark: 3, fiveMark: 5 };
  
  for (const mark of markCategories) {
    const distributions = questionTypeDistribution[mark];
    if (distributions && distributions.length > 0) {
      distributions.forEach((dist: any) => {
        flattened.push({
          type: dist.type,
          percentage: dist.percentage,
          marks: markValues[mark]
        });
      });
    }
  }
  
  return flattened;
}

// Generate Complete Question Paper with AI (Teacher version - same as admin)
export const generateCompleteAITeacherQuestionPaper = async (
  req: Request,
  res: Response
) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const questionPaperData = CreateQuestionPaperSchema.parse(req.body);

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Get teacher's adminId and verify access
    const teacher = await Teacher.findOne({ userId: teacherId })
      .populate("classIds", "_id")
      .populate("subjectIds", "_id");

    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: "Teacher record not found. Please contact administrator.",
      });
    }

    const teacherClassIds = teacher.classIds.map((c: any) => c._id.toString());
    const teacherSubjectIds = teacher.subjectIds.map((s: any) => s._id.toString());

    // Validate exam exists and get subject/class IDs from exam
    const exam = await Exam.findOne({
      _id: questionPaperData.examId,
      isActive: true,
    }).populate([
      { path: 'subjectIds', select: 'name code classIds' },
      { path: 'classId', select: 'name displayName' }
    ]);

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found or not accessible",
      });
    }

    // Extract subject and class IDs from exam
    if (!exam.subjectIds || (exam.subjectIds as any[]).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Exam has no subjects assigned",
      });
    }

    const subjectId = (exam.subjectIds[0] as any)?._id?.toString();
    if (!subjectId) {
      return res.status(400).json({
        success: false,
        error: "Invalid subject data in exam",
      });
    }

    const classId = (exam.classId as any)?._id?.toString();
    if (!classId) {
      return res.status(400).json({
        success: false,
        error: "Invalid class data in exam",
      });
    }

    // Verify teacher has access to this subject and class
    const hasSubjectAccess = teacherSubjectIds.includes(subjectId);
    const hasClassAccess = teacherClassIds.includes(classId);

    if (!hasSubjectAccess || !hasClassAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this subject or class",
      });
    }

    // Handle case where frontend sends subjectId and classId as objects
    let finalSubjectId: string = subjectId;
    let finalClassId: string = classId;

    if (questionPaperData.subjectId && typeof questionPaperData.subjectId === 'object') {
      finalSubjectId = (questionPaperData.subjectId as any)._id;
    } else if (questionPaperData.subjectId) {
      finalSubjectId = questionPaperData.subjectId as string;
    }

    if (questionPaperData.classId && typeof questionPaperData.classId === 'object') {
      finalClassId = (questionPaperData.classId as any)._id;
    } else if (questionPaperData.classId) {
      finalClassId = questionPaperData.classId as string;
    }

    // Create question paper
    const questionPaper = await QuestionPaper.create({
      ...questionPaperData,
      subjectId: finalSubjectId,
      classId: finalClassId,
      adminId: teacher.adminId,
      createdBy: teacherId,
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
        const referenceBookPath = subject.referenceBook.filePath;
        if (fs.existsSync(referenceBookPath)) {
          referenceBookContent = `Reference book available: ${subject.referenceBook.originalName} (${subject.referenceBook.fileSize} bytes)`;
          logger.info('Reference book found for AI generation', {
            fileName: subject.referenceBook.fileName,
            originalName: subject.referenceBook.originalName,
            fileSize: subject.referenceBook.fileSize
          });
        }
      } catch (error) {
        logger.warn('Could not read reference book content:', error);
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

    logger.info(`Sample papers found for AI generation: ${samplePapers.length}`);

    // Handle pattern file if provided
    let patternFilePath = null;
    let patternDiagramInfo = null;
    const patternId = (req.body as any).patternId || questionPaperData.patternId;

    if (patternId) {
      const patternPath1 = path.join(process.cwd(), 'public', 'question-patterns', patternId);
      const patternPath2 = path.join(process.cwd(), 'public', 'question-paper-templates', patternId);

      if (fs.existsSync(patternPath1)) {
        patternFilePath = patternPath1;
      } else if (fs.existsSync(patternPath2)) {
        patternFilePath = patternPath2;
      }

      if (patternFilePath) {
        try {
          const { PatternAnalysisService } = await import('../services/patternAnalysisService');
          const analysis = await PatternAnalysisService.analyzePatternFile(patternFilePath);
          patternDiagramInfo = analysis.diagramInfo || null;
        } catch (error) {
          logger.warn('Could not analyze pattern file:', error);
        }
      }
    }

    // Prepare AI request
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
      ...(patternFilePath && { patternFilePath }),
      ...(patternDiagramInfo && { patternDiagramInfo })
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
        adminId: teacher.adminId,
        unit: 'AI Generated',
        bloomsTaxonomyLevel: aiQuestion.bloomsLevel,
        difficulty: aiQuestion.difficulty,
        isTwisted: aiQuestion.isTwisted,
        options: aiQuestion.options || [],
        correctAnswer: aiQuestion.correctAnswer,
        explanation: aiQuestion.explanation || '',
        marks: aiQuestion.marks,
        timeLimit: 1,
        createdBy: teacherId,
        isActive: true,
        tags: aiQuestion.tags || [],
        language: 'ENGLISH'
      });

      await question.save();
      savedQuestions.push(question);
    }

    // Update question paper with question references
    questionPaper.questions = savedQuestions.map(q => q._id);

    // Generate PDF
    const pdfResult = await PDFGenerationService.generateQuestionPaperPDF(
      questionPaper._id.toString(),
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }
    logger.error("Error generating complete AI question paper:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Upload answer sheets
export const uploadAnswerSheets = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const examId = req.params.examId;
    const files = req.files as Express.Multer.File[];

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!files || files.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No files uploaded" });
    }

    // Verify teacher has access to the exam's class
    const exam = await Exam.findById(examId).populate("classId");
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }

    // Verify teacher has access to the exam
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) {
      return res.status(403).json({
        success: false,
        error: "Teacher record not found. Please contact administrator.",
      });
    }

    // Check if teacher has access to the exam's class (optional - since we show all school exams)
    // For now, we'll allow all teachers from the same school to upload to any exam
    // This can be made more restrictive later if needed

    // Process uploaded files with AI roll number detection
    const aiDetectionService = AIRollNumberDetectionService.getInstance();
    const results = [];

    for (const file of files) {
      try {
        logger.info(`Processing file: ${file.originalname} for exam ${examId}`);
        
        // Process with AI roll number detection
        if (!examId || typeof examId !== 'string') {
          throw new Error('Invalid examId');
        }
        const aiResult = await aiDetectionService.processAnswerSheetUpload(
          examId,
          file.buffer,
          file.originalname,
          teacherId
        );

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `answer-sheet-${examId}-${timestamp}-${file.originalname}`;

        // Save file to public/answers directory
        const uploadDir = path.join(process.cwd(), "public", "answers");

        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, file.buffer);

        // Determine final status - FLAGGED if no student matched or low confidence
        let finalStatus = aiResult.status;
        if (!aiResult.studentMatching.matchedStudent) {
          finalStatus = 'FLAGGED';
        } else if (aiResult.rollNumberDetection.confidence < 0.7) {
          finalStatus = 'FLAGGED';
        }

        // Create answer sheet record with AI results
        const answerSheet = new AnswerSheet({
          examId,
          studentId: aiResult.studentMatching.matchedStudent?.id || null, // Will be set if student matched
          uploadedBy: teacherId,
          originalFileName: file.originalname,
          cloudStorageUrl: `/public/answers/${filename}`, // Local file path
          cloudStorageKey: `answer-sheet-${examId}-${timestamp}`, // Unique key
          status: finalStatus,
          scanQuality: aiResult.scanQuality,
          isAligned: aiResult.isAligned,
          rollNumberDetected: aiResult.rollNumberDetection.rollNumber || "",
          rollNumberConfidence: Math.round(aiResult.rollNumberDetection.confidence * 100),
          isMissing: false,
          isAbsent: false,
          uploadedAt: new Date(),
          language: "ENGLISH",
          isActive: true,
          processingStatus: finalStatus === 'FLAGGED' ? 'FLAGGED' : 'COMPLETED',
          aiProcessingResults: {
            rollNumberDetection: aiResult.rollNumberDetection,
            studentMatching: aiResult.studentMatching,
            imageAnalysis: {
              quality: aiResult.scanQuality,
              isAligned: aiResult.isAligned
            },
            issues: aiResult.issues,
            suggestions: aiResult.suggestions,
            processingTime: aiResult.processingTime
          }
        });

        // Add flags for issues
        if (!aiResult.rollNumberDetection.rollNumber || aiResult.rollNumberDetection.confidence < 0.7) {
          answerSheet.flags.push({
            type: 'UNMATCHED_ROLL',
            severity: !aiResult.rollNumberDetection.rollNumber ? 'HIGH' : 'MEDIUM',
            description: !aiResult.rollNumberDetection.rollNumber 
              ? 'Roll number not detected' 
              : `Low confidence in roll number detection (${Math.round(aiResult.rollNumberDetection.confidence * 100)}%)`,
            detectedAt: new Date(),
            resolved: false,
            autoResolved: false
          });
        }

        if (!aiResult.studentMatching.matchedStudent && aiResult.rollNumberDetection.rollNumber) {
          answerSheet.flags.push({
            type: 'UNMATCHED_ROLL',
            severity: 'HIGH',
            description: `Student not found for detected roll number: ${aiResult.rollNumberDetection.rollNumber}`,
            detectedAt: new Date(),
            resolved: false,
            autoResolved: false
          });
        }

        if (aiResult.scanQuality === 'POOR') {
          answerSheet.flags.push({
            type: 'POOR_QUALITY',
            severity: 'HIGH',
            description: `Poor scan quality: ${aiResult.scanQuality}`,
            detectedAt: new Date(),
            resolved: false,
            autoResolved: false
          });
        }

        if (!aiResult.isAligned) {
          answerSheet.flags.push({
            type: 'ALIGNMENT_ISSUE',
            severity: 'MEDIUM',
            description: 'Answer sheet appears to be misaligned',
            detectedAt: new Date(),
            resolved: false,
            autoResolved: false
          });
        }

        await answerSheet.save();

        // Send notification if student was matched
        if (aiResult.studentMatching.matchedStudent) {
          try {
            const notification = new Notification({
              userId: aiResult.studentMatching.matchedStudent.id,
              type: 'ANSWER_SHEET_UPLOADED',
              title: 'Answer Sheet Uploaded',
              message: `Your answer sheet for ${exam.title} has been uploaded and processed successfully.`,
              data: {
                examId: exam._id,
                answerSheetId: answerSheet._id,
                examTitle: exam.title
              }
            });
            await notification.save();
          } catch (notifError) {
            logger.warn('Failed to send notification:', notifError);
          }
        }

        results.push({
          filename: file.originalname,
          originalFileName: file.originalname,
          status: answerSheet.status,
          answerSheetId: answerSheet._id,
          fileSize: file.size,
          rollNumberDetected: aiResult.rollNumberDetection.rollNumber,
          rollNumberConfidence: Math.round(aiResult.rollNumberDetection.confidence * 100),
          scanQuality: aiResult.scanQuality,
          isAligned: aiResult.isAligned,
          matchedStudent: aiResult.studentMatching.matchedStudent,
          issues: aiResult.issues,
          suggestions: aiResult.suggestions,
          processingTime: aiResult.processingTime
        });
        
        logger.info(`Answer sheet processed successfully: ${answerSheet._id}`);
      } catch (fileError) {
        logger.error(`Error processing file ${file.originalname}:`, fileError);
        results.push({
          filename: file.originalname,
          originalFileName: file.originalname,
          status: "ERROR",
          error: `Failed to process file: ${
            fileError instanceof Error ? fileError.message : "Unknown error"
          }`,
        });
      }
    }

    res.json({
      success: true,
      data: {
        message: "Answer sheets uploaded successfully",
        results,
        totalFiles: files.length,
        successfulUploads: results.filter((r) => r.status === "UPLOADED")
          .length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }
    logger.error("Error uploading answer sheets:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Mark student as absent or missing
export const markStudentStatus = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { studentId, examId, status, reason } = req.body;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Verify teacher has access to the exam's class
    const exam = await Exam.findById(examId).populate("classId");
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      "classAccess.classId": exam.classId,
      isActive: true,
    });

    if (!staffAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this exam",
      });
    }

    // TODO: Implement student status marking logic
    // This would include:
    // 1. Mark student as absent/missing
    // 2. Send notification to admin
    // 3. Update exam records

    res.json({
      success: true,
      data: {
        message: `Student marked as ${status}`,
        studentId,
        examId,
        status,
        reason,
      },
    });
  } catch (error) {
    logger.error("Error marking student status:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Evaluate answer sheets
export const evaluateAnswerSheets = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const evaluationData = EvaluateAnswerSchema.parse(req.body);

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // TODO: Implement AI evaluation logic
    // This would include:
    // 1. AI auto-evaluation of answers
    // 2. Manual override capabilities
    // 3. Step-wise marking for math/chemistry
    // 4. Semantic matching for alternative answers
    // 5. Learning from manual corrections

    res.json({
      success: true,
      data: {
        message: "Answer sheets evaluated successfully",
        evaluationId: evaluationData.answerSheetId,
        aiConfidence: 0.92,
        manualOverrides: evaluationData.manualOverrides?.length || 0,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }
    logger.error("Error evaluating answer sheets:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Get results for assigned classes
export const getResults = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { classId, subjectId, examId } = req.query;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Verify teacher has access to the requested data
    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      isActive: true,
    });

    if (!staffAccess) {
      return res.status(403).json({
        success: false,
        error: "No access permissions found",
      });
    }

    // Build query based on teacher's access
    const query: any = {};

    // Filter by teacher's accessible classes
    if (staffAccess.classAccess && staffAccess.classAccess.length > 0) {
      const accessibleClassIds = staffAccess.classAccess.map(
        (ca) => ca.classId
      );
      query.classId = { $in: accessibleClassIds };
    }

    // Filter by teacher's accessible subjects
    if (staffAccess.subjectAccess && staffAccess.subjectAccess.length > 0) {
      const accessibleSubjectIds = staffAccess.subjectAccess.map(
        (sa) => sa.subjectId
      );
      query.subjectId = { $in: accessibleSubjectIds };
    }

    // Apply additional filters
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    if (examId) query.examId = examId;

    // Get results with populated data
    const results = await Result.find(query)
      .populate("examId", "title examType scheduledDate totalMarks")
      .populate("studentId", "name email")
      .populate("classId", "name displayName")
      .populate("subjectId", "name code")
      .sort({ totalMarksObtained: -1 });

    // Calculate statistics
    const totalResults = results.length;
    const classAverage =
      totalResults > 0
        ? results.reduce((sum, r) => sum + r.totalMarksObtained, 0) /
          totalResults
        : 0;
    const subjectAverage =
      totalResults > 0
        ? results.reduce((sum, r) => sum + r.percentage, 0) / totalResults
        : 0;

    // Create rank list
    const rankList = results.map((result, index) => ({
      rank: index + 1,
      studentName: (result.studentId as any)?.name || "Unknown",
      studentId: result.studentId,
      totalMarks: result.totalMarksObtained,
      percentage: result.percentage,
      grade: result.grade,
      examTitle: (result.examId as any)?.title || "Unknown",
    }));

    // Performance metrics
    const performanceMetrics = {
      totalStudents: totalResults,
      averageMarks: Math.round(classAverage * 100) / 100,
      averagePercentage: Math.round(subjectAverage * 100) / 100,
      passedStudents: results.filter((r) => r.percentage >= 40).length,
      failedStudents: results.filter((r) => r.percentage < 40).length,
      absentStudents: results.filter((r) => r.isAbsent).length,
      missingSheets: results.filter((r) => r.isMissingSheet).length,
    };

    res.json({
      success: true,
      data: {
        results: results,
        classAverage: Math.round(classAverage * 100) / 100,
        subjectAverage: Math.round(subjectAverage * 100) / 100,
        rankList: rankList,
        performanceMetrics: performanceMetrics,
      },
    });
  } catch (error) {
    logger.error("Error getting results:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Get performance graphs and analytics
export const getPerformanceGraphs = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { classId, subjectId, examId } = req.query;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Verify teacher has access
    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      isActive: true,
    });

    if (!staffAccess) {
      return res.status(403).json({
        success: false,
        error: "No access permissions found",
      });
    }

    // Build query based on teacher's access
    const query: any = {};

    // Filter by teacher's accessible classes
    if (staffAccess.classAccess && staffAccess.classAccess.length > 0) {
      const accessibleClassIds = staffAccess.classAccess.map(
        (ca) => ca.classId
      );
      query.classId = { $in: accessibleClassIds };
    }

    // Filter by teacher's accessible subjects
    if (staffAccess.subjectAccess && staffAccess.subjectAccess.length > 0) {
      const accessibleSubjectIds = staffAccess.subjectAccess.map(
        (sa) => sa.subjectId
      );
      query.subjectId = { $in: accessibleSubjectIds };
    }

    // Apply additional filters
    if (classId) query.classId = classId;
    if (subjectId) query.subjectId = subjectId;
    if (examId) query.examId = examId;

    // First try to get data from Result model
    let results = await Result.find(query)
      .populate("examId", "title examType scheduledDate")
      .populate("studentId", "name email")
      .populate("classId", "name displayName")
      .populate("subjectId", "name code");

    // Helper function to calculate grade
    const getGradeFromPercentage = (percentage: number): string => {
      if (percentage >= 90) return "A+";
      if (percentage >= 80) return "A";
      if (percentage >= 70) return "B+";
      if (percentage >= 60) return "B";
      if (percentage >= 50) return "C+";
      if (percentage >= 40) return "C";
      return "F";
    };

    // If no results from Result model, try to get from AnswerSheet with AI corrections
    if (results.length === 0) {
      // Build AnswerSheet query based on exam IDs from teacher's accessible exams
      const answerSheetQuery: any = {
        aiCorrectionResults: { $exists: true, $ne: null },
        studentId: { $exists: true, $ne: null },
        status: { $in: ["AI_CORRECTED", "MANUALLY_REVIEWED", "COMPLETED"] }
      };

      // Get exams that match teacher's access
      const examQuery: any = {};
      if (staffAccess.classAccess && staffAccess.classAccess.length > 0) {
        const accessibleClassIds = staffAccess.classAccess.map((ca) => ca.classId);
        examQuery.classId = { $in: accessibleClassIds };
      }
      if (staffAccess.subjectAccess && staffAccess.subjectAccess.length > 0) {
        const accessibleSubjectIds = staffAccess.subjectAccess.map((sa) => sa.subjectId);
        examQuery.subjectIds = { $in: accessibleSubjectIds };
      }

      const accessibleExams = await Exam.find(examQuery)
        .select("_id subjectIds classId")
        .populate("subjectIds", "name")
        .populate("classId", "name displayName");
      
      const examIds = accessibleExams.map((e) => e._id);
      
      if (examIds.length > 0) {
        answerSheetQuery.examId = { $in: examIds };
        if (examId) answerSheetQuery.examId = examId;

        const answerSheets = await AnswerSheet.find(answerSheetQuery)
          .populate("examId", "title examType scheduledDate subjectIds classId")
          .populate("studentId", "name email")
          .populate({
            path: "examId",
            populate: [
              {
                path: "classId",
                select: "name displayName"
              },
              {
                path: "subjectIds",
                select: "name"
              }
            ]
          });

        // Transform AnswerSheet data to match Result structure
        results = answerSheets.map((sheet: any) => {
          const exam = sheet.examId;
          const subjectId = exam?.subjectIds?.[0] || exam?.subjectIds;
          return {
            _id: sheet._id,
            examId: exam,
            studentId: sheet.studentId,
            classId: exam?.classId,
            subjectId: subjectId,
            percentage: sheet.aiCorrectionResults?.percentage || 0,
            totalMarksObtained: sheet.aiCorrectionResults?.obtainedMarks || 0,
            grade: getGradeFromPercentage(sheet.aiCorrectionResults?.percentage || 0),
            isAbsent: sheet.isAbsent || false,
            isMissingSheet: sheet.isMissing || false,
          };
        });
      }
    }

    // Subject-wise performance from transformed results
    const subjectMap = new Map();
    const classMap = new Map();
    const gradeMap = new Map();

    results.forEach((result: any) => {
      const percentage = result.percentage || 0;
      const subjectId = result.subjectId?._id?.toString() || result.subjectId?.toString() || "unknown";
      const className = result.classId?.displayName || result.classId?.name || "Unknown";
      const classId = result.classId?._id?.toString() || result.classId?.toString() || "unknown";
      const subjectName = result.subjectId?.name || "Unknown";
      const grade = result.grade || getGradeFromPercentage(percentage);

      // Subject performance
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subjectId,
          subjectName,
          totalStudents: 0,
          passedStudents: 0,
          totalPercentage: 0,
        });
      }
      const subjectData = subjectMap.get(subjectId);
      subjectData.totalStudents++;
      subjectData.totalPercentage += percentage;
      if (percentage >= 40) subjectData.passedStudents++;

      // Class performance
      if (!classMap.has(classId)) {
        classMap.set(classId, {
          classId,
          className,
          totalStudents: 0,
          passedStudents: 0,
          totalPercentage: 0,
        });
      }
      const classData = classMap.get(classId);
      classData.totalStudents++;
      classData.totalPercentage += percentage;
      if (percentage >= 40) classData.passedStudents++;

      // Grade distribution
      gradeMap.set(grade, (gradeMap.get(grade) || 0) + 1);
    });

    // Convert maps to arrays
    const subjectPerformance = Array.from(subjectMap.values()).map((item) => ({
      _id: item.subjectId,
      subjectName: item.subjectName,
      averagePercentage: item.totalStudents > 0 ? item.totalPercentage / item.totalStudents : 0,
      totalStudents: item.totalStudents,
      passedStudents: item.passedStudents,
    }));

    const classSummary = Array.from(classMap.values()).map((item) => ({
      _id: item.classId,
      className: item.className,
      averagePercentage: item.totalStudents > 0 ? item.totalPercentage / item.totalStudents : 0,
      totalStudents: item.totalStudents,
      passedStudents: item.passedStudents,
    }));

    const gradeDistribution = Array.from(gradeMap.entries()).map(([grade, count]) => ({
      _id: grade,
      count,
    }));

    // Failure analysis
    const failureAnalysis = {
      totalStudents: results.length,
      failedStudents: results.filter((r: any) => (r.percentage || 0) < 40).length,
      absentStudents: results.filter((r: any) => r.isAbsent).length,
      missingSheets: results.filter((r: any) => r.isMissingSheet).length,
      failureRate:
        results.length > 0
          ? (results.filter((r: any) => (r.percentage || 0) < 40).length / results.length) * 100
          : 0,
    };

    res.json({
      success: true,
      data: {
        subjectPerformance: subjectPerformance,
        classSummary: classSummary,
        gradeDistribution: gradeDistribution.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        failureAnalysis: failureAnalysis,
        exportableCharts: [
          { type: "subject-performance", title: "Subject-wise Performance" },
          { type: "class-summary", title: "Class Summary" },
          { type: "grade-distribution", title: "Grade Distribution" },
          { type: "failure-analysis", title: "Failure Analysis" },
        ],
      },
    });
  } catch (error) {
    logger.error("Error getting performance graphs:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Get exams for assigned classes
export const getTeacherExams = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { classId, subjectId, status } = req.query;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Find the teacher record to get their assigned classes and subjects
    const teacher = await Teacher.findOne({ userId: teacherId });

    if (!teacher) {
      return res.status(403).json({
        success: false,
        error: "Teacher record not found. Please contact administrator.",
      });
    }

    // Build query to show only exams for classes the teacher is assigned to
    const query: any = {
      isActive: true,
      adminId: teacher.adminId, // Same school
      classId: { $in: teacher.classIds }, // Only assigned classes
    };

    // Apply additional filters if provided
    if (classId) query.classId = classId;
    if (subjectId) query.subjectIds = { $in: [subjectId] };
    if (status) query.status = status;

    // Get exams with populated data
    const exams = await Exam.find(query)
      .populate("subjectIds", "name code shortName")
      .populate("classId", "name displayName level section")
      .populate("createdBy", "name email")
      .sort({ scheduledDate: -1 });

    res.json({
      success: true,
      data: exams,
    });
  } catch (error) {
    logger.error("Error getting teacher exams:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Get students in assigned classes
export const getAssignedStudents = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { classId, search, page = 1, limit = 50 } = req.query;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Get teacher's assigned classes
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) {
      return res.status(403).json({
        success: false,
        error: "Teacher record not found",
      });
    }

    // Build query for students in assigned classes
    const query: any = {
      classId: { $in: teacher.classIds },
    };

    // Filter by specific class if provided
    if (classId) {
      query.classId = classId;
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { rollNumber: { $regex: search, $options: "i" } },
        { "userId.name": { $regex: search, $options: "i" } },
        { "userId.email": { $regex: search, $options: "i" } },
      ];
    }

    // Get students with pagination
    const skip = (Number(page) - 1) * Number(limit);
    const pipeline: any[] = [
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "class",
        },
      },
      { $unwind: { path: "$class", preserveNullAndEmptyArrays: true } },
      { $sort: { rollNumber: 1 } },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $project: {
          _id: 1,
          rollNumber: 1,
          user: { name: 1, email: 1, isActive: 1 },
          class: { name: 1, displayName: 1, level: 1, section: 1 },
        },
      },
    ];

    const students = await Student.aggregate(pipeline);

    // Get total count for pagination
    const totalCount = await Student.countDocuments(query);

    // Get class information for assigned classes
    const classes = await Class.find({ _id: { $in: teacher.classIds } })
      .select("name displayName level section")
      .sort({ level: 1, section: 1 });

    res.json({
      success: true,
      data: {
        students,
        classes,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / Number(limit)),
          totalCount,
          hasNext: skip + students.length < totalCount,
          hasPrev: Number(page) > 1,
        },
      },
    });
  } catch (error) {
    logger.error("Error getting assigned students:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Download results
export const downloadResults = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { format, classId, subjectId, examId } = req.query;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Verify teacher has access to download results
    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      isActive: true,
    });

    if (!staffAccess?.globalPermissions?.canPrintReports) {
      return res.status(403).json({
        success: false,
        error: "No permission to download results",
      });
    }

    // TODO: Implement results download logic
    // This would include:
    // 1. Generate PDF/Excel reports
    // 2. Individual student reports
    // 3. Bulk class reports
    // 4. Subject-wise reports

    res.json({
      success: true,
      data: {
        downloadUrl: "/downloads/results.pdf",
        format: format || "PDF",
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error("Error downloading results:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Get answer sheets for an exam
export const getAnswerSheets = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { examId } = req.params;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Verify teacher has access to this exam's class
    const exam = await Exam.findById(examId).populate("classId");
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }

    // Verify teacher exists (similar to upload function)
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) {
      return res.status(403).json({
        success: false,
        error: "Teacher record not found. Please contact administrator.",
      });
    }

    // For now, allow all teachers from the same school to access any exam
    // This can be made more restrictive later if needed

    // Get answer sheets for this exam
    const answerSheets = await AnswerSheet.find({ examId, isActive: true })
      .populate("studentId", "name rollNumber email")
      .populate("uploadedBy", "name")
      .sort({ uploadedAt: -1 });

    res.json({
      success: true,
      data: answerSheets,
    });
  } catch (error) {
    logger.error("Error fetching answer sheets:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Get exam results from AI-corrected answer sheets for teacher
export const getTeacherExamResults = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { examId } = req.params;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Get teacher's assigned classes and subjects
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) {
      return res.status(403).json({
        success: false,
        error: "Teacher record not found",
      });
    }

    // Get exam and verify teacher has access to it
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    // Verify teacher has access to this exam's class and subjects
    const hasClassAccess = teacher.classIds.some(
      (id) => id.toString() === exam.classId.toString()
    );
    const hasSubjectAccess = exam.subjectIds.some((subjectId) =>
      teacher.subjectIds.some((id) => id.toString() === subjectId.toString())
    );

    if (!hasClassAccess || !hasSubjectAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this exam's class or subject",
      });
    }

    // Get all answer sheets for this exam that have AI correction results
    const answerSheets = await AnswerSheet.find({
      examId: examId,
      aiCorrectionResults: { $exists: true, $ne: null },
      studentId: { $exists: true, $ne: null }, // Only include matched students
    })
      .populate("studentId", "name email") // studentId references User model
      .sort({ "aiCorrectionResults.obtainedMarks": -1 });

    // Get Student records for all students to get roll numbers
    const { Student } = await import("../models/Student");
    const userIds = answerSheets
      .map((sheet) => (sheet.studentId as any)?._id?.toString())
      .filter((id) => id);
    
    const studentRecords = await Student.find({
      userId: { $in: userIds },
    });
    
    // Create a map of userId -> rollNumber
    const rollNumberMap = new Map<string, string>();
    studentRecords.forEach((student) => {
      rollNumberMap.set(student.userId.toString(), student.rollNumber);
    });

    // Calculate grade based on percentage
    const getGrade = (percentage: number): string => {
      if (percentage >= 90) return "A+";
      if (percentage >= 80) return "A";
      if (percentage >= 70) return "B+";
      if (percentage >= 60) return "B";
      if (percentage >= 50) return "C+";
      if (percentage >= 40) return "C";
      return "F";
    };

    // Transform answer sheets to match frontend format
    const results = answerSheets
      .map((sheet, index) => {
        const aiResults = sheet.aiCorrectionResults;
        if (!aiResults) return null;

        // Get student info - studentId is populated User
        const user = sheet.studentId as any;
        const studentName = user?.name || "Unknown";
        const userId = user?._id?.toString() || "";
        const rollNumber =
          rollNumberMap.get(userId) || sheet.rollNumberDetected || "";

        const percentage = aiResults.percentage || 0;
        const grade = getGrade(percentage);

        return {
          _id: sheet._id.toString(),
          answerSheetId: sheet._id.toString(),
          studentId: {
            _id: userId,
            name: studentName,
            rollNumber: rollNumber,
          },
          examId: examId,
          totalMarks: aiResults.totalMarks || 0,
          obtainedMarks: aiResults.obtainedMarks || 0,
          percentage: percentage,
          grade: grade,
          rank: index + 1,
          status: sheet.status || "AI_CORRECTED",
          aiCorrectionResults: {
            questionWiseResults: aiResults.questionWiseResults || [],
            overallFeedback: aiResults.overallFeedback || "",
            strengths: aiResults.strengths || [],
            weaknesses: aiResults.weaknesses || [],
            suggestions: aiResults.suggestions || [],
          },
          submittedAt: sheet.uploadedAt?.toISOString() || new Date().toISOString(),
          correctedAt: sheet.processedAt?.toISOString() || new Date().toISOString(),
        };
      })
      .filter((result) => result !== null);

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error("Error getting teacher exam results:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// Get class statistics for exam results
export const getTeacherExamStats = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { examId } = req.params;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // Get teacher's assigned classes and subjects
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) {
      return res.status(403).json({
        success: false,
        error: "Teacher record not found",
      });
    }

    // Get exam and verify teacher has access to it
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    // Verify teacher has access
    const hasClassAccess = teacher.classIds.some(
      (id) => id.toString() === exam.classId.toString()
    );
    const hasSubjectAccess = exam.subjectIds.some((subjectId) =>
      teacher.subjectIds.some((id) => id.toString() === subjectId.toString())
    );

    if (!hasClassAccess || !hasSubjectAccess) {
      return res.status(403).json({
        success: false,
        error: "Access denied to this exam",
      });
    }

    // Get answer sheets with AI results
    const answerSheets = await AnswerSheet.find({
      examId: examId,
      aiCorrectionResults: { $exists: true, $ne: null },
      studentId: { $exists: true, $ne: null },
    });

    // Get total students in class (from exam or class enrollment)
    const { Student } = await import("../models/Student");
    const totalStudentsInClass = await Student.countDocuments({
      classId: exam.classId,
    });

    const appearedStudents = answerSheets.length;

    // Calculate statistics
    const marks = answerSheets
      .map((sheet) => sheet.aiCorrectionResults?.obtainedMarks || 0)
      .filter((m) => m > 0);

    const averageMarks =
      marks.length > 0
        ? marks.reduce((sum, m) => sum + m, 0) / marks.length
        : 0;

    const highestMarks = marks.length > 0 ? Math.max(...marks) : 0;
    const lowestMarks = marks.length > 0 ? Math.min(...marks) : 0;

    // Calculate grade distribution
    const getGrade = (percentage: number): string => {
      if (percentage >= 90) return "A";
      if (percentage >= 80) return "B";
      if (percentage >= 70) return "C";
      if (percentage >= 60) return "D";
      return "F";
    };

    const gradeDistribution = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      F: 0,
    };

    answerSheets.forEach((sheet) => {
      const percentage = sheet.aiCorrectionResults?.percentage || 0;
      const grade = getGrade(percentage);
      gradeDistribution[grade as keyof typeof gradeDistribution]++;
    });

    const passPercentage =
      appearedStudents > 0
        ? (gradeDistribution.A +
            gradeDistribution.B +
            gradeDistribution.C +
            gradeDistribution.D) /
          appearedStudents *
          100
        : 0;

    res.json({
      success: true,
      data: {
        totalStudents: totalStudentsInClass,
        appearedStudents: appearedStudents,
        averageMarks: Math.round(averageMarks * 100) / 100,
        highestMarks: highestMarks,
        lowestMarks: lowestMarks,
        passPercentage: Math.round(passPercentage * 100) / 100,
        gradeDistribution: gradeDistribution,
      },
    });
  } catch (error) {
    logger.error("Error getting teacher exam stats:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
