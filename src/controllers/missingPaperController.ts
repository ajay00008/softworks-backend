import type { Request, Response } from 'express';
import { MissingPaperTracking } from '../models/MissingPaperTracking';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { Student } from '../models/Student';
import { StaffAccess } from '../models/StaffAccess';
import { Notification } from '../models/Notification';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

// Report missing paper
export const reportMissingPaper = async (req: Request, res: Response) => {
  try {
    const { examId, studentId, type, reason, details, priority = 'MEDIUM' } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get exam details
    const exam = await Exam.findById(examId).populate('classId subjectIds');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Get student details
    const student = await Student.findOne({ userId: studentId });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Check if staff has access to this class
    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this class' });
    }

    // Check if already reported
    const existingReport = await MissingPaperTracking.findOne({
      examId,
      studentId,
      type,
      isActive: true
    });

    if (existingReport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing paper already reported for this student and exam' 
      });
    }

    // Create missing paper tracking record
    const missingPaper = new MissingPaperTracking({
      examId,
      studentId,
      classId: exam.classId,
      subjectId: exam.subjectIds[0], // Assuming single subject for now
      type,
      status: 'REPORTED',
      reportedBy: userId,
      reason,
      details,
      priority,
      isRedFlag: true,
      requiresAcknowledgment: true
    });

    await missingPaper.save();

    // Update answer sheet status if it exists
    const answerSheet = await AnswerSheet.findOne({ examId, studentId });
    if (answerSheet) {
      answerSheet.isMissing = true;
      answerSheet.missingReason = reason;
      answerSheet.status = 'MISSING';
      await answerSheet.save();
      
      missingPaper.answerSheetId = answerSheet._id as any;
      await missingPaper.save();
    }

    // Create notification for admin
    const notification = new Notification({
      type: 'MISSING_PAPER_REPORTED',
      priority: priority === 'URGENT' ? 'HIGH' : 'MEDIUM',
      title: 'Missing Paper Reported',
      message: `Missing paper reported: ${type} - ${reason}`,
      recipientId: 'admin', // This should be the admin user ID
      relatedEntityId: missingPaper._id,
      relatedEntityType: 'missingPaper',
      metadata: {
        examTitle: exam.title,
        studentName: (student.userId as any)?.name || 'Unknown',
        className: (exam.classId as any)?.name || 'Unknown',
        reason: reason,
        reportedBy: userId
      }
    });

    await notification.save();

    // Add notification to missing paper record
    missingPaper.relatedNotificationIds.push(notification._id as any);
    await missingPaper.save();

    logger.info(`Missing paper reported: ${missingPaper._id} for student ${studentId} in exam ${examId}`);

    res.status(201).json({
      success: true,
      data: missingPaper,
      message: 'Missing paper reported successfully'
    });
  } catch (error: unknown) {
    logger.error('Error reporting missing paper:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get missing papers for staff
export const getStaffMissingPapers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.sub;
    const { examId, status, priority, page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get staff's accessible classes
    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      isActive: true
    });

    if (!staffAccess) {
      return res.json({
        success: true,
        data: [],
        message: 'No access permissions found'
      });
    }

    const accessibleClassIds = staffAccess.classAccess.map(ca => ca.classId);

    // Build query
    const query: any = {
      classId: { $in: accessibleClassIds },
      isActive: true
    };

    if (examId) query.examId = examId;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const missingPapers = await MissingPaperTracking.find(query)
      .populate('examId', 'title examType scheduledDate')
      .populate('studentId', 'name email rollNumber')
      .populate('classId', 'name')
      .populate('subjectId', 'name code')
      .populate('reportedBy', 'name email')
      .populate('acknowledgedBy', 'name email')
      .populate('answerSheetId', 'status cloudStorageUrl')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await MissingPaperTracking.countDocuments(query);

    res.json({
      success: true,
      data: missingPapers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: unknown) {
    logger.error('Error fetching staff missing papers:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get missing papers for admin
export const getAdminMissingPapers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.sub;
    const { examId, status, priority, isRedFlag, page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Build query
    const query: any = { isActive: true };

    if (examId) query.examId = examId;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (isRedFlag !== undefined) query.isRedFlag = isRedFlag === 'true';

    const missingPapers = await MissingPaperTracking.find(query)
      .populate('examId', 'title examType scheduledDate')
      .populate('studentId', 'name email rollNumber')
      .populate('classId', 'name')
      .populate('subjectId', 'name code')
      .populate('reportedBy', 'name email')
      .populate('acknowledgedBy', 'name email')
      .populate('answerSheetId', 'status cloudStorageUrl')
      .sort({ 
        isRedFlag: -1, // Red flags first
        priority: -1,  // Then by priority
        createdAt: -1 // Then by date
      })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await MissingPaperTracking.countDocuments(query);

    res.json({
      success: true,
      data: missingPapers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: unknown) {
    logger.error('Error fetching admin missing papers:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Acknowledge missing paper (Admin only)
export const acknowledgeMissingPaper = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adminRemarks, priority } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const missingPaper = await MissingPaperTracking.findById(id);
    if (!missingPaper) {
      return res.status(404).json({ success: false, error: 'Missing paper record not found' });
    }

    if (missingPaper.status !== 'REPORTED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing paper is not in reported status' 
      });
    }

    // Update missing paper record
    missingPaper.status = 'ACKNOWLEDGED';
    missingPaper.acknowledgedBy = userId;
    missingPaper.acknowledgedAt = new Date();
    missingPaper.adminRemarks = adminRemarks;
    missingPaper.isRedFlag = false; // Remove red flag after acknowledgment
    if (priority) missingPaper.priority = priority;

    await missingPaper.save();

    // Update related notifications
    await Notification.updateMany(
      { relatedEntityId: id, status: 'UNREAD' },
      { 
        status: 'ACKNOWLEDGED', 
        acknowledgedAt: new Date(),
        acknowledgedBy: userId
      }
    );

    logger.info(`Missing paper acknowledged: ${id} by ${userId}`);

    res.json({
      success: true,
      data: missingPaper,
      message: 'Missing paper acknowledged successfully'
    });
  } catch (error: unknown) {
    logger.error('Error acknowledging missing paper:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Resolve missing paper
export const resolveMissingPaper = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolutionNotes, completionNotes } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const missingPaper = await MissingPaperTracking.findById(id);
    if (!missingPaper) {
      return res.status(404).json({ success: false, error: 'Missing paper record not found' });
    }

    if (missingPaper.status !== 'ACKNOWLEDGED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing paper must be acknowledged before resolution' 
      });
    }

    // Update missing paper record
    missingPaper.status = 'RESOLVED';
    missingPaper.resolvedAt = new Date();
    missingPaper.resolvedBy = userId;
    missingPaper.resolutionNotes = resolutionNotes;
    missingPaper.isCompleted = true;
    missingPaper.completedAt = new Date();
    missingPaper.completionNotes = completionNotes;
    missingPaper.isRedFlag = false;

    await missingPaper.save();

    // Update related notifications
    await Notification.updateMany(
      { relatedEntityId: id },
      { 
        status: 'RESOLVED', 
        resolvedAt: new Date(),
        resolvedBy: userId
      }
    );

    logger.info(`Missing paper resolved: ${id} by ${userId}`);

    res.json({
      success: true,
      data: missingPaper,
      message: 'Missing paper resolved successfully'
    });
  } catch (error: unknown) {
    logger.error('Error resolving missing paper:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get completion status for exam
export const getExamCompletionStatus = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get exam details
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Get all students in the class
    const students = await Student.find({ classId: exam.classId });

    // Get missing paper reports
    const missingPapers = await MissingPaperTracking.find({
      examId,
      isActive: true
    }).populate('studentId', 'name rollNumber');

    // Get uploaded answer sheets
    const answerSheets = await AnswerSheet.find({
      examId,
      isActive: true
    }).populate('studentId', 'name rollNumber');

    // Calculate completion status
    const completionStatus = {
      totalStudents: students.length,
      uploadedSheets: answerSheets.length,
      missingPapers: missingPapers.length,
      pendingAcknowledgment: missingPapers.filter(mp => mp.status === 'REPORTED').length,
      acknowledged: missingPapers.filter(mp => mp.status === 'ACKNOWLEDGED').length,
      resolved: missingPapers.filter(mp => mp.status === 'RESOLVED').length,
      redFlags: missingPapers.filter(mp => mp.isRedFlag).length,
      isComplete: missingPapers.every(mp => mp.status === 'RESOLVED'),
      students: students.map(student => {
        const answerSheet = answerSheets.find(as => String((as.studentId as any)?._id) === String(student._id));
        const missingPaper = missingPapers.find(mp => String((mp.studentId as any)?._id) === String(student._id));
        
        return {
          studentId: student._id,
          studentName: (student.userId as any)?.name || 'Unknown',
          rollNumber: student.rollNumber,
          hasAnswerSheet: !!answerSheet,
          answerSheetStatus: answerSheet?.status || 'NOT_UPLOADED',
          hasMissingPaper: !!missingPaper,
          missingPaperStatus: missingPaper?.status || null,
          isRedFlag: missingPaper?.isRedFlag || false,
          requiresAction: !answerSheet || (missingPaper && missingPaper.status !== 'RESOLVED')
        };
      })
    };

    res.json({
      success: true,
      data: completionStatus
    });
  } catch (error: unknown) {
    logger.error('Error fetching exam completion status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get red flag summary
export const getRedFlagSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get red flag counts
    const redFlags = await MissingPaperTracking.find({
      isRedFlag: true,
      isActive: true
    }).populate('examId', 'title examType scheduledDate')
      .populate('studentId', 'name rollNumber')
      .populate('classId', 'name')
      .populate('subjectId', 'name code')
      .populate('reportedBy', 'name email')
      .sort({ priority: -1, createdAt: -1 });

    const summary = {
      totalRedFlags: redFlags.length,
      byPriority: {
        URGENT: redFlags.filter(rf => rf.priority === 'URGENT').length,
        HIGH: redFlags.filter(rf => rf.priority === 'HIGH').length,
        MEDIUM: redFlags.filter(rf => rf.priority === 'MEDIUM').length,
        LOW: redFlags.filter(rf => rf.priority === 'LOW').length
      },
      byType: {
        ABSENT: redFlags.filter(rf => rf.type === 'ABSENT').length,
        MISSING_SHEET: redFlags.filter(rf => rf.type === 'MISSING_SHEET').length,
        LATE_SUBMISSION: redFlags.filter(rf => rf.type === 'LATE_SUBMISSION').length,
        QUALITY_ISSUE: redFlags.filter(rf => rf.type === 'QUALITY_ISSUE').length,
        ROLL_NUMBER_ISSUE: redFlags.filter(rf => rf.type === 'ROLL_NUMBER_ISSUE').length
      },
      byStatus: {
        PENDING: redFlags.filter(rf => rf.status === 'PENDING').length,
        REPORTED: redFlags.filter(rf => rf.status === 'REPORTED').length,
        ACKNOWLEDGED: redFlags.filter(rf => rf.status === 'ACKNOWLEDGED').length,
        RESOLVED: redFlags.filter(rf => rf.status === 'RESOLVED').length,
        ESCALATED: redFlags.filter(rf => rf.status === 'ESCALATED').length
      },
      details: redFlags
    };

    res.json({
      success: true,
      data: summary
    });
  } catch (error: unknown) {
    logger.error('Error fetching red flag summary:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
