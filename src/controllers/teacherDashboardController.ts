import type { Request, Response } from 'express';
import { z } from 'zod';
import { Teacher } from '../models/Teacher';
import { StaffAccess } from '../models/StaffAccess';
import { Class } from '../models/Class';
import { Subject } from '../models/Subject';
import { QuestionPaper } from '../models/QuestionPaper';
import { Exam } from '../models/Exam';
import { Student } from '../models/Student';
import { logger } from '../utils/logger';
import createHttpError from 'http-errors';

// Validation schemas
const CreateQuestionPaperSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  examId: z.string(),
  subjectId: z.string(),
  classId: z.string(),
  markDistribution: z.object({
    oneMark: z.number().min(0).max(100),
    twoMark: z.number().min(0).max(100),
    threeMark: z.number().min(0).max(100),
    fiveMark: z.number().min(0).max(100),
    totalMarks: z.number().min(1).max(1000)
  }),
  bloomsDistribution: z.array(z.object({
    level: z.enum(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE']),
    percentage: z.number().min(0).max(100)
  })),
  questionTypeDistribution: z.array(z.object({
    type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
    percentage: z.number().min(0).max(100)
  })),
  aiSettings: z.object({
    useSubjectBook: z.boolean().default(false),
    customInstructions: z.string().optional(),
    difficultyLevel: z.enum(['EASY', 'MODERATE', 'TOUGHEST']).default('MODERATE'),
    twistedQuestionsPercentage: z.number().min(0).max(50).default(0)
  }).optional()
});

const UploadAnswerSheetSchema = z.object({
  examId: z.string(),
  studentId: z.string(),
  files: z.array(z.string()) // File paths
});

const EvaluateAnswerSchema = z.object({
  answerSheetId: z.string(),
  manualOverrides: z.array(z.object({
    questionId: z.string(),
    awardedMarks: z.number(),
    reason: z.string().optional(),
    improvementSuggestions: z.string().optional()
  })).optional()
});

// Get teacher's assigned classes and subjects
export const getTeacherAccess = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    
    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get teacher's access permissions
    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      isActive: true
    }).populate('classAccess.classId', 'name displayName level section')
      .populate('subjectAccess.subjectId', 'name code shortName category');

    if (!staffAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'No access permissions found for this teacher' 
      });
    }

    res.json({
      success: true,
      data: {
        classAccess: staffAccess.classAccess,
        subjectAccess: staffAccess.subjectAccess,
        globalPermissions: staffAccess.globalPermissions
      }
    });
  } catch (error) {
    logger.error('Error getting teacher access:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Create question paper for assigned subjects
export const createTeacherQuestionPaper = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const questionPaperData = CreateQuestionPaperSchema.parse(req.body);

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify teacher has access to the subject and class
    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      'subjectAccess.subjectId': questionPaperData.subjectId,
      'classAccess.classId': questionPaperData.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this subject or class' 
      });
    }

    // Check if teacher can create questions for this subject
    const subjectAccess = staffAccess.subjectAccess.find(
      sa => sa.subjectId.toString() === questionPaperData.subjectId
    );

    if (!subjectAccess?.canCreateQuestions) {
      return res.status(403).json({ 
        success: false, 
        error: 'No permission to create questions for this subject' 
      });
    }

    // Get teacher's adminId
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    // Create question paper
    const questionPaper = new QuestionPaper({
      ...questionPaperData,
      adminId: teacher.adminId,
      createdBy: teacherId,
      type: 'AI_GENERATED',
      status: 'DRAFT'
    });

    await questionPaper.save();

    res.status(201).json({
      success: true,
      data: questionPaper
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    logger.error('Error creating question paper:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Upload answer sheets
export const uploadAnswerSheets = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { examId, studentId, files } = UploadAnswerSheetSchema.parse(req.body);

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify teacher has access to the exam's class
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this exam' 
      });
    }

    // TODO: Implement answer sheet processing logic
    // This would include:
    // 1. File upload and storage
    // 2. AI preprocessing for alignment
    // 3. Student roll number detection
    // 4. Answer sheet validation

    res.json({
      success: true,
      data: {
        message: 'Answer sheets uploaded successfully',
        processedFiles: files.length,
        status: 'PROCESSING'
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    logger.error('Error uploading answer sheets:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Mark student as absent or missing
export const markStudentStatus = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { studentId, examId, status, reason } = req.body;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify teacher has access to the exam's class
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this exam' 
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
        reason
      }
    });
  } catch (error) {
    logger.error('Error marking student status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Evaluate answer sheets
export const evaluateAnswerSheets = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const evaluationData = EvaluateAnswerSchema.parse(req.body);

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
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
        message: 'Answer sheets evaluated successfully',
        evaluationId: evaluationData.answerSheetId,
        aiConfidence: 0.92,
        manualOverrides: evaluationData.manualOverrides?.length || 0
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    logger.error('Error evaluating answer sheets:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get results for assigned classes
export const getResults = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { classId, subjectId, examId } = req.query;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify teacher has access to the requested data
    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ 
        success: false, 
        error: 'No access permissions found' 
      });
    }

    // TODO: Implement results retrieval logic
    // This would include:
    // 1. Individual student results
    // 2. Class and subject averages
    // 3. Rank lists
    // 4. Performance analytics

    res.json({
      success: true,
      data: {
        results: [],
        classAverage: 0,
        subjectAverage: 0,
        rankList: [],
        performanceMetrics: {}
      }
    });
  } catch (error) {
    logger.error('Error getting results:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get performance graphs and analytics
export const getPerformanceGraphs = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { classId, subjectId, examId } = req.query;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify teacher has access to analytics
    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      isActive: true
    });

    if (!staffAccess?.globalPermissions?.canAccessAnalytics) {
      return res.status(403).json({ 
        success: false, 
        error: 'No permission to access analytics' 
      });
    }

    // TODO: Implement performance analytics logic
    // This would include:
    // 1. Subject-wise performance charts
    // 2. Class-wise summary charts
    // 3. Grade distribution analysis
    // 4. Failure rate analysis
    // 5. Exportable charts (PNG/PDF)

    res.json({
      success: true,
      data: {
        subjectPerformance: {},
        classSummary: {},
        gradeDistribution: {},
        failureAnalysis: {},
        exportableCharts: []
      }
    });
  } catch (error) {
    logger.error('Error getting performance graphs:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Download results
export const downloadResults = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;
    const { format, classId, subjectId, examId } = req.query;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify teacher has access to download results
    const staffAccess = await StaffAccess.findOne({
      staffId: teacherId,
      isActive: true
    });

    if (!staffAccess?.globalPermissions?.canPrintReports) {
      return res.status(403).json({ 
        success: false, 
        error: 'No permission to download results' 
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
        downloadUrl: '/downloads/results.pdf',
        format: format || 'PDF',
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error downloading results:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
