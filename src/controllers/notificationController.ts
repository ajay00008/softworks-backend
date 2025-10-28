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

    const missingStudentIds = studentIds.filter(id => !submittedStudentIds.includes(id));

    if (missingStudentIds.length === 0) {
      return res.json({
        success: true,
        message: 'All students have submitted their answer sheets',
        data: { notifiedCount: 0 }
      });
    }

    // Get student details for notification
    const students = await Student.find({
      _id: { $in: missingStudentIds },
      isActive: true
    }).populate('userId', 'name email');

    // Create notifications for each missing student
    const notifications = students.map(student => ({
      userId: student.userId._id,
      type: 'MISSING_ANSWER_SHEET',
      title: 'Answer Sheet Submission Reminder',
      message: `Dear ${student.userId.name}, please submit your answer sheet for the exam "${exam.title}" before the deadline.`,
      data: {
        examId: exam._id,
        examTitle: exam.title,
        examDate: exam.scheduledDate,
        studentId: student._id,
        studentName: student.userId.name
      },
      priority: 'HIGH',
      isRead: false,
      createdBy: userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    }));

    // Save notifications
    const savedNotifications = await Notification.insertMany(notifications);

    logger.info(`Missing answer sheet notifications sent for exam: ${examId} to ${students.length} students by teacher: ${userId}`);

    res.json({
      success: true,
      message: `Notifications sent to ${students.length} students about missing answer sheets`,
      data: {
        notifiedCount: students.length,
        notifications: savedNotifications.map(n => ({
          id: n._id,
          studentName: students.find(s => s.userId._id.toString() === n.userId.toString())?.userId.name,
          message: n.message
        }))
      }
    });

  } catch (error) {
    logger.error('Error sending missing answer sheet notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
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

    const query: any = { userId, isActive: true };
    
    if (type) {
      query.type = type;
    }
    
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('createdBy', 'name');

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

  } catch (error) {
    logger.error('Error fetching user notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
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

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId, isActive: true },
      { isRead: true, readAt: new Date() },
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

  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark notification as read',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};