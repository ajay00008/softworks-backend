import { Notification } from '../models/Notification';
import { logger } from '../utils/logger';
export class NotificationService {
    /**
     * Create a notification
     */
    static async createNotification(data) {
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
            logger.info(`Notification created: ${notification._id} for ${data.recipientId}`);
            return notification;
        }
        catch (error) {
            logger.error('Error creating notification:', error);
            throw error;
        }
    }
    /**
     * Create AI correction complete notification
     */
    static async createAICorrectionCompleteNotification(recipientId, answerSheetId, studentName, percentage, confidence) {
        return this.createNotification({
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
    }
    /**
     * Create AI processing started notification
     */
    static async createAIProcessingStartedNotification(recipientId, answerSheetId, studentName) {
        return this.createNotification({
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
    }
    /**
     * Create AI processing failed notification
     */
    static async createAIProcessingFailedNotification(recipientId, answerSheetId, studentName, errorMessage) {
        return this.createNotification({
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
    }
    /**
     * Get notifications for a user
     */
    static async getNotifications(userId, limit = 20, offset = 0) {
        try {
            const notifications = await Notification.find({
                $or: [
                    { recipientId: userId },
                    { recipientId: 'admin' } // Global notifications
                ]
            })
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(offset);
            return notifications;
        }
        catch (error) {
            logger.error('Error fetching notifications:', error);
            throw error;
        }
    }
    /**
     * Mark notification as read
     */
    static async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findByIdAndUpdate(notificationId, {
                status: 'READ',
                readAt: new Date()
            }, { new: true });
            if (!notification) {
                throw new Error('Notification not found');
            }
            logger.info(`Notification marked as read: ${notificationId} by ${userId}`);
            return notification;
        }
        catch (error) {
            logger.error('Error marking notification as read:', error);
            throw error;
        }
    }
    /**
     * Mark all notifications as read for a user
     */
    static async markAllAsRead(userId) {
        try {
            const result = await Notification.updateMany({
                $or: [
                    { recipientId: userId },
                    { recipientId: 'admin' }
                ],
                status: 'UNREAD'
            }, {
                status: 'READ',
                readAt: new Date()
            });
            logger.info(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);
            return result.modifiedCount;
        }
        catch (error) {
            logger.error('Error marking all notifications as read:', error);
            throw error;
        }
    }
    /**
     * Get notification count for a user
     */
    static async getUnreadCount(userId) {
        try {
            const count = await Notification.countDocuments({
                $or: [
                    { recipientId: userId },
                    { recipientId: 'admin' }
                ],
                status: 'UNREAD'
            });
            return count;
        }
        catch (error) {
            logger.error('Error getting unread notification count:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=notificationService.js.map