import type { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { Exam } from '../models/Exam';
import { Student } from '../models/Student';
import { Teacher } from '../models/Teacher';
import { AnswerSheet } from '../models/AnswerSheet';
import { logger } from '../utils/logger';

// Send notification for missing answer sheets
export const sendMissingAnswerSheetNotification = async (req: Request, res: Response) => {
  try {
    const { examId, studentIds } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!examId || !studentIds || !Array.isArray(studentIds)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Exam ID and student IDs are required' 
      });
    }

    // Verify teacher has access to this exam
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const teacher = await Teacher.findOne({
      userId: userId,
      classIds: exam.classId._id
    });

    if (!teacher) {
      return res.status(403).json({ success: false, error: 'Access denied to this exam' });
    }

    // Get students who haven't submitted answer sheets
    const submittedStudentIds = await AnswerSheet.find({
      examId: examId,
      isActive: true
    }).distinct('studentId');

    // Convert both to strings for proper comparison (ObjectId vs string)
    const submittedStudentIdsStr = submittedStudentIds.map(id => id?.toString()).filter(Boolean);
    const studentIdsStr = studentIds.map(id => id?.toString()).filter(Boolean);
    
    const missingStudentIds = studentIdsStr.filter(id => !submittedStudentIdsStr.includes(id));

    if (missingStudentIds.length === 0) {
      return res.json({
        success: true,
        message: 'All students have submitted their answer sheets',
        data: { notifiedCount: 0 }
      });
    }

    // Get student details for notification
    const students = await Student.find({
      userId: { $in: missingStudentIds },
    }).populate('userId', 'name email');

    // Import NotificationService for socket notifications
    const { NotificationService } = await import('../services/notificationService');

    // Notify only the specific admin about missing answer sheets (with socket notification)
    // This notification goes ONLY to the teacher's admin, not all admins
    let savedNotification = null;
    if (teacher.adminId) {
      try {
        const adminId = teacher.adminId.toString();
        const teacherIdStr = String(teacher._id);
        const examIdStr = String(exam._id);
        console.log('[SOCKET] 📤 Sender: Creating missing answer sheet notification', {
          teacherUserId: userId,
          teacherId: teacherIdStr,
          adminId: adminId,
          examId: examIdStr,
          examTitle: exam.title,
          missingCount: students.length,
          timestamp: new Date().toISOString()
        });

        savedNotification = await NotificationService.createNotification({
          type: 'MISSING_ANSWER_SHEET',
          priority: 'HIGH',
          title: 'Missing Answer Sheets Alert',
          message: `${students.length} student(s) have not submitted answer sheets for "${exam.title}".`,
          recipientId: adminId, // Only this specific admin will receive the notification
          relatedEntityId: examIdStr,
          relatedEntityType: 'exam',
          metadata: {
            examId: examIdStr,
            examTitle: exam.title,
            missingCount: students.length,
            missingStudents: students.map(s => {
              const studentUserId = s.userId as any;
              return {
                studentId: String(s._id),
                studentName: studentUserId?.name || 'Unknown',
                rollNumber: s.rollNumber
              };
            }),
            notifiedBy: userId,
            teacherId: teacherIdStr
          }
        });
        logger.info(`Admin notification sent to ${adminId} (teacher's admin) for ${students.length} missing answer sheets from teacher ${userId}`);
      } catch (adminError) {
        logger.warn('Failed to send admin notification for missing answer sheets:', adminError);
        // Don't fail the whole operation if admin notification fails
      }
    } else {
      logger.warn(`Teacher ${userId} does not have an adminId assigned. Cannot send notification.`);
    }

    logger.info(`Missing answer sheet notification sent for exam: ${examId} to admin by teacher: ${userId}`);

    res.json({
      success: true,
      message: `Admin has been notified about ${students.length} missing answer sheet(s)`,
      data: {
        missingCount: students.length,
        adminNotified: !!teacher.adminId && !!savedNotification,
        missingStudents: students.map(s => {
          const studentUserId = s.userId as any;
          return {
            studentId: String(s._id),
            studentName: studentUserId?.name || 'Unknown',
            rollNumber: s.rollNumber,
            email: studentUserId?.email || ''
          };
        }),
        notificationId: savedNotification?._id?.toString() || null
      }
    });

  } catch (error: unknown) {
    logger.error('Error sending missing answer sheet notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send notifications',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
    });
  }
};

// Get notifications for a user
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.sub;
    const { page = 1, limit = 20, type, isRead } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const query: any = { recipientId: userId, isActive: true }; // Use recipientId, not userId
    
    if (type && typeof type === 'string') {
      query.type = type;
    }
    
    // Handle status filter - convert isRead boolean to status
    if (isRead !== undefined) {
      const isReadValue = isRead === 'true' || (typeof isRead === 'boolean' && isRead === true);
      if (isReadValue) {
        query.status = 'READ';
      } else {
        query.status = 'UNREAD';
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error: unknown) {
    logger.error('Error fetching user notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch notifications',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
    });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!notificationId) {
      return res.status(400).json({ success: false, error: 'Notification ID is required' });
    }

    // Convert string to ObjectId if needed - handle both _id and id formats
    const mongoose = await import('mongoose');
    let notificationObjectId: any;
    
    try {
      // Check if it's a valid ObjectId string
      if (mongoose.Types.ObjectId.isValid(notificationId)) {
        notificationObjectId = new mongoose.Types.ObjectId(notificationId);
      } else {
        // If not a valid ObjectId, try using it as-is (fallback)
        notificationObjectId = notificationId;
      }
    } catch (error: unknown) {
      // Fallback to using the notificationId as-is
      notificationObjectId = notificationId;
    }

    // Try to find and update the notification - supports both _id and id
    // Use $or to try both _id (Mongoose internal) and id (virtual/string format) as fallback
    const query: any = {
      $or: [
        { _id: notificationObjectId },
        { _id: notificationId } // Also try the raw string in case ObjectId conversion failed
      ],
      recipientId: userId,
      isActive: true
    };

    const notification = await Notification.findOneAndUpdate(
      query,
      { status: 'READ', readAt: new Date() }, // Use status field, not isRead
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });

  } catch (error: unknown) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark notification as read',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
    });
  }
};

// Delete notification (hard delete)
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!notificationId) {
      return res.status(400).json({ success: false, error: 'Notification ID is required' });
    }

    // Convert string to ObjectId if needed
    const mongoose = await import('mongoose');
    let notificationObjectId: any;
    
    try {
      if (mongoose.Types.ObjectId.isValid(notificationId)) {
        notificationObjectId = new mongoose.Types.ObjectId(notificationId);
      } else {
        notificationObjectId = notificationId;
      }
    } catch (error: unknown) {
      notificationObjectId = notificationId;
    }

    // Delete notification - only if it belongs to the user
    const notification = await Notification.findOneAndDelete({
      _id: notificationObjectId,
      recipientId: userId
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully',
      data: { id: notificationId }
    });

  } catch (error: unknown) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete notification',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
    });
  }
};

// Clear all notifications for a user (soft delete - set isActive to false for all)
export const clearAllNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Update all active notifications for the user
    const result = await Notification.updateMany(
      {
        recipientId: userId,
        isActive: true
      },
      { 
        isActive: false,
        dismissedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: 'All notifications cleared successfully',
      data: {
        deletedCount: result.modifiedCount
      }
    });

  } catch (error: unknown) {
    logger.error('Error clearing all notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear notifications',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
    });
  }
};