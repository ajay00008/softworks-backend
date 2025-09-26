import mongoose, { Document, Model } from "mongoose";
export type NotificationType = "MISSING_SHEET" | "ABSENT_STUDENT" | "AI_CORRECTION_COMPLETE" | "MANUAL_REVIEW_REQUIRED" | "SYSTEM_ALERT";
export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type NotificationStatus = "UNREAD" | "READ" | "ACKNOWLEDGED" | "DISMISSED";
export interface INotification extends Document {
    type: NotificationType;
    priority: NotificationPriority;
    status: NotificationStatus;
    title: string;
    message: string;
    recipientId: mongoose.Types.ObjectId;
    relatedEntityId?: mongoose.Types.ObjectId;
    relatedEntityType?: string;
    metadata?: {
        examTitle?: string;
        studentName?: string;
        rollNumber?: string;
        className?: string;
        subjectName?: string;
        marksObtained?: number;
        totalMarks?: number;
        percentage?: number;
        [key: string]: any;
    };
    isActive: boolean;
    createdAt: Date;
    readAt?: Date;
    acknowledgedAt?: Date;
    dismissedAt?: Date;
}
export declare const Notification: Model<INotification>;
//# sourceMappingURL=Notification.d.ts.map