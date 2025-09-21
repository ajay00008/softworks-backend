import type { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { logger } from '../utils/logger';

// Get notifications for current user
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { type, priority, status, page = 1, limit = 10, dateFrom, dateTo } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const query: any = { recipientId: userId, isActive: true };

    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (status) query.status = status;

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    const notifications = await Notification.find(query)
      .populate('relatedEntityId')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    notification.status = 'READ';
    notification.readAt = new Date();

    await notification.save();

    logger.info(`Notification marked as read: ${notificationId} by ${userId}`);

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Acknowledge notification
export const acknowledgeNotification = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    notification.status = 'ACKNOWLEDGED';
    notification.acknowledgedAt = new Date();

    await notification.save();

    logger.info(`Notification acknowledged: ${notificationId} by ${userId}`);

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('Error acknowledging notification:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Dismiss notification
export const dismissNotification = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    notification.status = 'DISMISSED';
    notification.dismissedAt = new Date();

    await notification.save();

    logger.info(`Notification dismissed: ${notificationId} by ${userId}`);

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('Error dismissing notification:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Create notification
export const createNotification = async (req: Request, res: Response) => {
  try {
    const { type, priority, title, message, recipientId, relatedEntityId, relatedEntityType, metadata } = req.body;
    const createdBy = req.user?.id;

    if (!createdBy) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, error: 'Recipient not found' });
    }

    const notification = new Notification({
      type,
      priority,
      title,
      message,
      recipientId,
      relatedEntityId,
      relatedEntityType,
      metadata: metadata || {}
    });

    await notification.save();

    logger.info(`Notification created: ${notification._id} for ${recipientId}`);

    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    logger.error('Error creating notification:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get notification counts
export const getNotificationCounts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const unread = await Notification.countDocuments({
      recipientId: userId,
      status: 'UNREAD',
      isActive: true
    });

    const urgent = await Notification.countDocuments({
      recipientId: userId,
      priority: 'URGENT',
      status: { $in: ['UNREAD', 'READ'] },
      isActive: true
    });

    const total = await Notification.countDocuments({
      recipientId: userId,
      isActive: true
    });

    res.json({
      success: true,
      data: {
        unread,
        urgent,
        total
      }
    });
  } catch (error) {
    logger.error('Error fetching notification counts:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const result = await Notification.updateMany(
      { recipientId: userId, status: 'UNREAD' },
      { status: 'READ', readAt: new Date() }
    );

    logger.info(`All notifications marked as read for user: ${userId}`);

    res.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    notification.isActive = false;
    await notification.save();

    logger.info(`Notification deleted: ${notificationId} by ${userId}`);

    res.json({
      success: true,
      data: { message: 'Notification deleted successfully' }
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get notifications by type
export const getNotificationsByType = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const userId = req.user?.id;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const notifications = await Notification.find({
      recipientId: userId,
      type,
      isActive: true
    })
      .populate('relatedEntityId')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await Notification.countDocuments({
      recipientId: userId,
      type,
      isActive: true
    });

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching notifications by type:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
