import type { Request, Response } from 'express';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { StaffAccess } from '../models/StaffAccess';
import { logger } from '../utils/logger';

// Upload answer sheet
export const uploadAnswerSheet = async (req: Request, res: Response) => {
  try {
    const { examId, studentId, originalFileName, cloudStorageUrl, cloudStorageKey, language = 'ENGLISH' } = req.body;
    const uploadedBy = req.user?.id;

    if (!uploadedBy) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
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

    const answerSheet = new AnswerSheet({
      examId,
      studentId,
      uploadedBy,
      originalFileName,
      cloudStorageUrl,
      cloudStorageKey,
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
    const userId = req.user?.id;

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
    const userId = req.user?.id;

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
    const userId = req.user?.id;

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
    const userId = req.user?.id;

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
    const userId = req.user?.id;

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
    const userId = req.user?.id;

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
    const userId = req.user?.id;

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
