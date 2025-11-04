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
export declare class NotificationService {
    /**
     * Create a notification
     */
    static createNotification(data: NotificationData): Promise<any>;
    /**
     * Create AI correction complete notification
     * Sends notification to both teacher and their admin
     */
    static createAICorrectionCompleteNotification(recipientId: string, answerSheetId: string, studentName: string, percentage: number, confidence: number): Promise<any>;
    /**
     * Create AI processing started notification
     * Sends notification to both teacher and their admin
     */
    static createAIProcessingStartedNotification(recipientId: string, answerSheetId: string, studentName: string): Promise<any>;
    /**
     * Create AI processing failed notification
     * Sends notification to both teacher and their admin
     */
    static createAIProcessingFailedNotification(recipientId: string, answerSheetId: string, studentName: string, errorMessage: string): Promise<any>;
    /**
     * Get notifications for a user
     */
    static getNotifications(userId: string, limit?: number, offset?: number): Promise<any[]>;
    /**
     * Mark notification as read
     */
    static markAsRead(notificationId: string, userId: string): Promise<any>;
    /**
     * Mark all notifications as read for a user
     */
    static markAllAsRead(userId: string): Promise<number>;
    /**
     * Get notification count for a user
     */
    static getUnreadCount(userId: string): Promise<number>;
}
//# sourceMappingURL=notificationService.d.ts.map