import type { Request, Response } from 'express';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { StaffAccess } from '../models/StaffAccess';
import { logger } from '../utils/logger';
import { ImageProcessingService } from '../services/imageProcessing';
import { CloudStorageService } from '../services/cloudStorage';

// Upload answer sheet
export const uploadAnswerSheet = async (req: Request, res: Response) => {
  try {
    const { examId, studentId, language = 'ENGLISH' } = req.body;
    const uploadedBy = (req as any).auth?.sub;
    const file = req.file as Express.Multer.File;

    if (!uploadedBy) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Check if staff has access to this exam's class
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: uploadedBy,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this class' });
    }

    // Check if answer sheet already exists
    const existingSheet = await AnswerSheet.findOne({ examId, studentId });
    if (existingSheet) {
      return res.status(400).json({ success: false, error: 'Answer sheet already exists for this student' });
    }

    // Upload file to cloud storage
    const cloudStorage = new CloudStorageService();
    const uploadResult = await cloudStorage.uploadAnswerSheet(
      file.buffer,
      examId,
      studentId,
      file.originalname,
      file.buffer // Use original buffer for now, can be processed later
    );

    const answerSheet = new AnswerSheet({
      examId,
      studentId,
      uploadedBy,
      originalFileName: file.originalname,
      cloudStorageUrl: uploadResult.original.url,
      cloudStorageKey: uploadResult.original.key,
      language,
      status: 'UPLOADED'
    });

    await answerSheet.save();

    logger.info(`Answer sheet uploaded: ${answerSheet._id} by ${uploadedBy}`);

    res.status(201).json({
      success: true,
      data: answerSheet
    });
  } catch (error) {
    logger.error('Error uploading answer sheet:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get answer sheets for an exam
export const getAnswerSheetsByExam = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const query: any = { examId, isActive: true };
    if (status) {
      query.status = status;
    }

    const answerSheets = await AnswerSheet.find(query)
      .populate('studentId', 'name email')
      .populate('uploadedBy', 'name')
      .populate('examId', 'title examType')
      .sort({ uploadedAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await AnswerSheet.countDocuments(query);

    res.json({
      success: true,
      data: answerSheets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching answer sheets:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Mark answer sheet as missing
export const markAsMissing = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const answerSheet = await AnswerSheet.findById(answerSheetId);
    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    // Check if staff has access
    const exam = await Exam.findById(answerSheet.examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    answerSheet.isMissing = true;
    answerSheet.missingReason = reason;
    answerSheet.status = 'MISSING';

    await answerSheet.save();

    // Create notification for admin
    const notification = new Notification({
      type: 'MISSING_SHEET',
      priority: 'HIGH',
      title: 'Missing Answer Sheet',
      message: `Answer sheet marked as missing - ${reason}`,
      recipientId: 'admin', // This should be the admin user ID
      relatedEntityId: answerSheetId,
      relatedEntityType: 'answerSheet',
      metadata: {
        examTitle: exam.title,
        studentId: answerSheet.studentId,
        reason: reason
      }
    });

    await notification.save();

    logger.info(`Answer sheet marked as missing: ${answerSheetId} by ${userId}`);

    res.json({
      success: true,
      data: answerSheet
    });
  } catch (error) {
    logger.error('Error marking answer sheet as missing:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Mark student as absent
export const markAsAbsent = async (req: Request, res: Response) => {
  try {
    const { examId, studentId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Check if staff has access
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Create or update answer sheet record
    let answerSheet = await AnswerSheet.findOne({ examId, studentId });
    if (!answerSheet) {
      answerSheet = new AnswerSheet({
        examId,
        studentId,
        uploadedBy: userId,
        originalFileName: 'ABSENT',
        cloudStorageUrl: '',
        cloudStorageKey: '',
        status: 'ABSENT'
      });
    }

    answerSheet.isAbsent = true;
    answerSheet.absentReason = reason;
    answerSheet.status = 'ABSENT';

    await answerSheet.save();

    // Create notification for admin
    const notification = new Notification({
      type: 'ABSENT_STUDENT',
      priority: 'MEDIUM',
      title: 'Student Absent',
      message: `Student marked as absent - ${reason}`,
      recipientId: 'admin', // This should be the admin user ID
      relatedEntityId: examId,
      relatedEntityType: 'exam',
      metadata: {
        examTitle: exam.title,
        studentId: studentId,
        reason: reason
      }
    });

    await notification.save();

    logger.info(`Student marked as absent: ${studentId} for exam ${examId} by ${userId}`);

    res.json({
      success: true,
      data: answerSheet
    });
  } catch (error) {
    logger.error('Error marking student as absent:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Acknowledge missing/absent notifications
export const acknowledgeNotification = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const answerSheet = await AnswerSheet.findById(answerSheetId);
    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    answerSheet.acknowledgedBy = userId;
    answerSheet.acknowledgedAt = new Date();

    await answerSheet.save();

    // Update related notifications
    await Notification.updateMany(
      { relatedEntityId: answerSheetId, status: 'UNREAD' },
      { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() }
    );

    logger.info(`Answer sheet notification acknowledged: ${answerSheetId} by ${userId}`);

    res.json({
      success: true,
      data: answerSheet
    });
  } catch (error) {
    logger.error('Error acknowledging notification:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get answer sheet details
export const getAnswerSheetDetails = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const answerSheet = await AnswerSheet.findById(answerSheetId)
      .populate('studentId', 'name email rollNumber')
      .populate('uploadedBy', 'name')
      .populate('examId', 'title examType totalMarks')
      .populate('acknowledgedBy', 'name');

    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    res.json({
      success: true,
      data: answerSheet
    });
  } catch (error) {
    logger.error('Error fetching answer sheet details:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Update AI correction results
export const updateAICorrectionResults = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const { aiCorrectionResults } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const answerSheet = await AnswerSheet.findById(answerSheetId);
    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    answerSheet.aiCorrectionResults = aiCorrectionResults;
    answerSheet.status = 'AI_CORRECTED';
    answerSheet.processedAt = new Date();

    await answerSheet.save();

    // Create notification for staff
    const notification = new Notification({
      type: 'AI_CORRECTION_COMPLETE',
      priority: 'LOW',
      title: 'AI Correction Complete',
      message: `Answer sheet has been processed by AI`,
      recipientId: answerSheet.uploadedBy,
      relatedEntityId: answerSheetId,
      relatedEntityType: 'answerSheet',
      metadata: {
        confidence: aiCorrectionResults.confidence,
        totalMarks: aiCorrectionResults.totalMarks
      }
    });

    await notification.save();

    logger.info(`AI correction results updated: ${answerSheetId}`);

    res.json({
      success: true,
      data: answerSheet
    });
  } catch (error) {
    logger.error('Error updating AI correction results:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Add manual override
export const addManualOverride = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const { questionId, correctedAnswer, correctedMarks, reason } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const answerSheet = await AnswerSheet.findById(answerSheetId);
    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    const manualOverride = {
      questionId,
      correctedAnswer,
      correctedMarks,
      reason,
      correctedBy: userId,
      correctedAt: new Date()
    };

    answerSheet.manualOverrides = answerSheet.manualOverrides || [];
    answerSheet.manualOverrides.push(manualOverride);
    answerSheet.status = 'MANUALLY_REVIEWED';

    await answerSheet.save();

    logger.info(`Manual override added: ${answerSheetId} by ${userId}`);

    res.json({
      success: true,
      data: answerSheet
    });
  } catch (error) {
    logger.error('Error adding manual override:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Batch upload answer sheets with image processing
export const batchUploadAnswerSheets = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const uploadedBy = (req as any).auth?.sub;
    const files = req.files as Express.Multer.File[];

    if (!uploadedBy) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!examId) {
      return res.status(400).json({ success: false, error: 'Exam ID is required' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Check if staff has access to this exam's class
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: uploadedBy,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this class' });
    }

    const cloudStorage = new CloudStorageService();
    const results = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      try {
        // Process image for alignment and roll number detection
        const processingResult = await ImageProcessingService.processAnswerSheet(
          file.buffer,
          file.originalname
        );

        // Upload to cloud storage
        const uploadResult = await cloudStorage.uploadAnswerSheet(
          file.buffer,
          examId,
          'unknown', // Will be updated after roll number detection
          file.originalname,
          processingResult.processedImage || file.buffer
        );

        // Create answer sheet record
        const answerSheet = new AnswerSheet({
          examId,
          studentId: null, // Will be updated when roll number is matched
          uploadedBy,
          originalFileName: file.originalname,
          cloudStorageUrl: uploadResult.original.url,
          cloudStorageKey: uploadResult.original.key,
          status: processingResult.rollNumberDetected ? 'UPLOADED' : 'PROCESSING',
          scanQuality: processingResult.scanQuality,
          isAligned: processingResult.isAligned,
          rollNumberDetected: processingResult.rollNumberDetected,
          rollNumberConfidence: processingResult.rollNumberConfidence,
          language: 'ENGLISH'
        });

        await answerSheet.save();

        results.push({
          answerSheetId: answerSheet._id,
          originalFileName: file.originalname,
          status: answerSheet.status,
          rollNumberDetected: processingResult.rollNumberDetected,
          rollNumberConfidence: processingResult.rollNumberConfidence,
          scanQuality: processingResult.scanQuality,
          isAligned: processingResult.isAligned,
          issues: processingResult.issues,
          suggestions: processingResult.suggestions
        });

        logger.info(`Answer sheet processed: ${answerSheet._id}`);
      } catch (error) {
        const errorMsg = `Failed to process ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        logger.error(errorMsg);
      }
    }

    // Create notification for admin if there are issues
    if (errors.length > 0 || results.some(r => r.rollNumberConfidence < 70)) {
      const notification = new Notification({
        type: 'UPLOAD_ISSUES',
        priority: 'MEDIUM',
        title: 'Answer Sheet Upload Issues',
        message: `${errors.length} files failed to process, ${results.filter(r => r.rollNumberConfidence < 70).length} files have low roll number confidence`,
        recipientId: 'admin', // This should be the admin user ID
        relatedEntityId: examId,
        relatedEntityType: 'exam',
        metadata: {
          examTitle: exam.title,
          totalFiles: files.length,
          successfulUploads: results.length,
          errors: errors.length
        }
      });

      await notification.save();
    }

    res.json({
      success: true,
      message: `Processed ${files.length} files`,
      results,
      errors,
      metadata: {
        examId,
        totalFiles: files.length,
        successfulUploads: results.length,
        failedUploads: errors.length,
        processedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('Error in batch upload:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Process uploaded answer sheet (trigger AI correction)
export const processAnswerSheet = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const answerSheet = await AnswerSheet.findById(answerSheetId)
      .populate('examId')
      .populate('studentId');
    
    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    // Update status to processing
    answerSheet.status = 'PROCESSING';
    await answerSheet.save();

    // Create notification for processing started
    const { NotificationService } = await import('../services/notificationService');
    await NotificationService.createAIProcessingStartedNotification(
      answerSheet.uploadedBy.toString(),
      answerSheetId,
      answerSheet.studentId?.name || 'Unknown Student'
    );

    // Start AI processing asynchronously
    processAnswerSheetWithAI(answerSheetId, answerSheet)
      .catch(async error => {
        logger.error(`AI processing failed for answer sheet ${answerSheetId}:`, error);
        
        // Update status to error
        await AnswerSheet.findByIdAndUpdate(answerSheetId, { 
          status: 'ERROR',
          errorMessage: error.message 
        });

        // Create error notification
        const { NotificationService } = await import('../services/notificationService');
        await NotificationService.createAIProcessingFailedNotification(
          answerSheet.uploadedBy.toString(),
          answerSheetId,
          answerSheet.studentId?.name || 'Unknown Student',
          error.message
        );
      });

    logger.info(`Answer sheet processing started: ${answerSheetId}`);

    res.json({
      success: true,
      message: 'Answer sheet processing started',
      data: {
        answerSheetId,
        status: 'PROCESSING',
        estimatedCompletionTime: '5-10 minutes'
      }
    });
  } catch (error) {
    logger.error('Error processing answer sheet:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Async function to process answer sheet with AI
async function processAnswerSheetWithAI(answerSheetId: string, answerSheet: any) {
  try {
    const { AICorrectionService } = await import('../services/aiCorrectionService');
    
    // Get exam details and question paper
    const exam = await Exam.findById(answerSheet.examId).populate('questionPaperId');
    if (!exam || !exam.questionPaperId) {
      throw new Error('Exam or question paper not found');
    }

    // Prepare question paper data
    const questionPaper = {
      questions: exam.questionPaperId.questions.map((q: any) => ({
        questionNumber: q.questionNumber,
        questionText: q.questionText,
        correctAnswer: q.correctAnswer,
        maxMarks: q.marks,
        questionType: q.questionType
      })),
      totalMarks: exam.totalMarks
    };

    // Prepare AI correction request
    const correctionRequest = {
      answerSheetId,
      examId: answerSheet.examId,
      studentId: answerSheet.studentId,
      questionPaper,
      answerSheetImage: answerSheet.cloudStorageUrl, // Assuming this is a base64 image or URL
      language: answerSheet.language || 'ENGLISH'
    };

    // Process with AI
    const aiResult = await AICorrectionService.processAnswerSheet(correctionRequest);

    // Update answer sheet with AI results
    await AnswerSheet.findByIdAndUpdate(answerSheetId, {
      status: 'AI_CORRECTED',
      aiCorrectionResults: aiResult,
      processedAt: new Date(),
      confidence: aiResult.confidence
    });

    // Create notification for teacher
    const { NotificationService } = await import('../services/notificationService');
    await NotificationService.createAICorrectionCompleteNotification(
      answerSheet.uploadedBy.toString(),
      answerSheetId,
      answerSheet.studentId?.name || 'Unknown Student',
      aiResult.percentage,
      aiResult.confidence
    );

    logger.info(`AI correction completed for answer sheet: ${answerSheetId}`);

  } catch (error) {
    logger.error(`AI processing failed for answer sheet ${answerSheetId}:`, error);
    throw error;
  }
}
