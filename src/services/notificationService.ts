import { Notification } from '../models/Notification';
import { logger } from '../utils/logger.js';
import { SocketService } from './socketService.js';
import { User } from '../models/User.js';

export interface NotificationData {
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  message: string;
  recipientId: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  metadata?: any;
}

export class NotificationService {
  /**
   * Create a notification
   */
  static async createNotification(data: NotificationData): Promise<any> {
    try {
      const notification = new Notification({
        type: data.type,
        priority: data.priority,
        title: data.title,
        message: data.message,
        recipientId: data.recipientId,
        relatedEntityId: data.relatedEntityId,
        relatedEntityType: data.relatedEntityType,
        metadata: data.metadata,
        status: 'UNREAD',
        createdAt: new Date()
      });

      await notification.save();
      
      // Send real-time notification via Socket.IO
      try {
        // Check if recipient is an admin - if so, use sendNotificationToAdmin
        // Otherwise, use sendNotificationToUser (for teachers)
        const recipient = await User.findById(data.recipientId);
        const isAdmin = recipient && (recipient.role === 'ADMIN' || recipient.role === 'SUPER_ADMIN');
        
        const notificationPayload = {
          id: String(notification._id),
          type: notification.type,
          priority: notification.priority,
          title: notification.title,
          message: notification.message,
          status: notification.status,
          createdAt: notification.createdAt,
          recipientId: data.recipientId, // Add recipientId to payload
          metadata: notification.metadata
        };

        if (isAdmin) {
          // Send to admin's user room only (NOT admin room to prevent teachers from receiving)
          // Admin-specific notifications should only go to the admin, not their teachers
          await SocketService.sendNotificationToUser(data.recipientId, notificationPayload);
        } else {
          // Send to user room - for teachers or other users
          await SocketService.sendNotificationToUser(data.recipientId, notificationPayload);
        }
      } catch (socketError) {
        logger.warn('Failed to send socket notification:', socketError);
        // Don't fail the notification creation if socket fails
      }
      
      logger.info(`Notification created: ${notification._id} for ${data.recipientId}`);
      return notification;

    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Create AI correction complete notification
   * Sends notification to both teacher and their admin
   */
  static async createAICorrectionCompleteNotification(
    recipientId: string,
    answerSheetId: string,
    studentName: string,
    percentage: number,
    confidence: number
  ): Promise<any> {
    const notification = await this.createNotification({
      type: 'AI_CORRECTION_COMPLETE',
      priority: 'LOW',
      title: 'AI Correction Complete',
      message: `Answer sheet for ${studentName} has been processed by AI. Student scored ${percentage}% (Confidence: ${Math.round(confidence * 100)}%)`,
      recipientId,
      relatedEntityId: answerSheetId,
      relatedEntityType: 'answerSheet',
      metadata: {
        studentName,
        percentage,
        confidence,
        completedAt: new Date().toISOString()
      }
    });

    // Also send notification to admin (via Socket.IO)
    try {
      await SocketService.sendNotificationToTeacherAndAdmin(recipientId, {
        id: String(notification._id),
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        status: notification.status,
        createdAt: notification.createdAt,
        recipientId: recipientId, // Add recipientId to payload
        metadata: notification.metadata
      });
    } catch (socketError) {
      logger.warn('Failed to send socket notification to admin:', socketError);
    }

    return notification;
  }

  /**
   * Create AI processing started notification
   * Sends notification to both teacher and their admin
   */
  static async createAIProcessingStartedNotification(
    recipientId: string,
    answerSheetId: string,
    studentName: string
  ): Promise<any> {
    const notification = await this.createNotification({
      type: 'AI_PROCESSING_STARTED',
      priority: 'LOW',
      title: 'AI Processing Started',
      message: `Answer sheet for ${studentName} is being processed by AI. This may take 5-10 minutes.`,
      recipientId,
      relatedEntityId: answerSheetId,
      relatedEntityType: 'answerSheet',
      metadata: {
        studentName,
        startedAt: new Date().toISOString(),
        estimatedCompletionTime: '5-10 minutes'
      }
    });

    // Also send to admin via Socket.IO
    try {
      await SocketService.sendNotificationToTeacherAndAdmin(recipientId, {
          id: String(notification._id),
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        status: notification.status,
        createdAt: notification.createdAt,
        metadata: notification.metadata
      });
    } catch (socketError) {
      logger.warn('Failed to send socket notification to admin:', socketError);
    }

    return notification;
  }

  /**
   * Create AI processing failed notification
   * Sends notification to both teacher and their admin
   */
  static async createAIProcessingFailedNotification(
    recipientId: string,
    answerSheetId: string,
    studentName: string,
    errorMessage: string
  ): Promise<any> {
    const notification = await this.createNotification({
      type: 'AI_PROCESSING_FAILED',
      priority: 'HIGH',
      title: 'AI Processing Failed',
      message: `AI processing failed for ${studentName}'s answer sheet. Please review manually. Error: ${errorMessage}`,
      recipientId,
      relatedEntityId: answerSheetId,
      relatedEntityType: 'answerSheet',
      metadata: {
        studentName,
        errorMessage,
        failedAt: new Date().toISOString()
      }
    });

    // Also send to admin via Socket.IO
    try {
      await SocketService.sendNotificationToTeacherAndAdmin(recipientId, {
          id: String(notification._id),
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        status: notification.status,
        createdAt: notification.createdAt,
        metadata: notification.metadata
      });
    } catch (socketError) {
      logger.warn('Failed to send socket notification to admin:', socketError);
    }

    return notification;
  }

  /**
   * Get notifications for a user
   */
  static async getNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<any[]> {
    try {
      // Convert userId to ObjectId if it's a string
      const mongoose = await import('mongoose');
      const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;

      const notifications = await Notification.find({
        recipientId: userObjectId,
        isActive: true
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset);

      return notifications;

    } catch (error) {
      logger.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<any> {
    try {
      const notification = await Notification.findByIdAndUpdate(
        notificationId,
        { 
          status: 'READ',
          readAt: new Date()
        },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification not found');
      }

      logger.info(`Notification marked as read: ${notificationId} by ${userId}`);
      return notification;

    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<number> {
    try {
      // Convert userId to ObjectId if it's a string
      const mongoose = await import('mongoose');
      const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;

      const result = await Notification.updateMany(
        {
          recipientId: userObjectId,
          status: 'UNREAD'
        },
        { 
          status: 'READ',
          readAt: new Date()
        }
      );

      logger.info(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);
      return result.modifiedCount;

    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get notification count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      // Convert userId to ObjectId if it's a string
      const mongoose = await import('mongoose');
      const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;

      const count = await Notification.countDocuments({
        recipientId: userObjectId,
        status: 'UNREAD',
        isActive: true
      });

      return count;

    } catch (error) {
      logger.error('Error getting unread notification count:', error);
      throw error;
    }
  }
}
