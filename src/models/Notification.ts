import mongoose, { Schema, Document, Model } from "mongoose";

export type NotificationType = "MISSING_ANSWER_SHEET" | "ABSENT_STUDENT" | "AI_CORRECTION_COMPLETE" | "MANUAL_REVIEW_REQUIRED" | "SYSTEM_ALERT";
export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type NotificationStatus = "UNREAD" | "READ" | "ACKNOWLEDGED" | "DISMISSED";

export interface INotification extends Document {
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  recipientId: mongoose.Types.ObjectId; // User who should receive the notification
  relatedEntityId?: mongoose.Types.ObjectId; // Related exam, student, answer sheet, etc.
  relatedEntityType?: string; // "exam", "student", "answerSheet", etc.
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

const NotificationSchema = new Schema<INotification>(
  {
    type: { 
      type: String, 
      enum: ["MISSING_ANSWER_SHEET", "ABSENT_STUDENT", "AI_CORRECTION_COMPLETE", "MANUAL_REVIEW_REQUIRED", "SYSTEM_ALERT"],
      required: true,
      index: true
    },
    priority: { 
      type: String, 
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
      index: true
    },
    status: { 
      type: String, 
      enum: ["UNREAD", "READ", "ACKNOWLEDGED", "DISMISSED"],
      default: "UNREAD",
      index: true
    },
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    message: { 
      type: String, 
      required: true,
      trim: true
    },
    recipientId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    relatedEntityId: { 
      type: Schema.Types.ObjectId,
      index: true
    },
    relatedEntityType: { 
      type: String,
      trim: true
    },
    metadata: { 
      type: Schema.Types.Mixed,
      default: {}
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    readAt: { 
      type: Date
    },
    acknowledgedAt: { 
      type: Date
    },
    dismissedAt: { 
      type: Date
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
NotificationSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, priority: 1, status: 1 });
NotificationSchema.index({ relatedEntityId: 1, relatedEntityType: 1 });
NotificationSchema.index({ isActive: 1, createdAt: -1 });

export const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
