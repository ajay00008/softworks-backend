import mongoose, { Schema, Document, Model } from "mongoose";

export type MissingPaperStatus = "PENDING" | "REPORTED" | "ACKNOWLEDGED" | "RESOLVED" | "ESCALATED";
export type MissingPaperType = "ABSENT" | "MISSING_SHEET" | "LATE_SUBMISSION" | "QUALITY_ISSUE" | "ROLL_NUMBER_ISSUE";

export interface IMissingPaperTracking extends Document {
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  type: MissingPaperType;
  status: MissingPaperStatus;
  reportedBy: mongoose.Types.ObjectId; // Staff member who reported
  reportedAt: Date;
  reason: string;
  details?: string; // Additional details about the issue
  
  // Admin acknowledgment
  acknowledgedBy?: mongoose.Types.ObjectId;
  acknowledgedAt?: Date;
  adminRemarks?: string;
  
  // Resolution
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolutionNotes?: string;
  
  // Escalation
  escalatedTo?: mongoose.Types.ObjectId;
  escalatedAt?: Date;
  escalationReason?: string;
  
  // Priority and flags
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  isRedFlag: boolean; // Shows in red in both admin and staff portals
  requiresAcknowledgment: boolean; // Mandatory field for completion
  
  // Completion tracking
  isCompleted: boolean;
  completedAt?: Date;
  completionNotes?: string;
  
  // Related entities
  answerSheetId?: mongoose.Types.ObjectId; // If answer sheet exists but has issues
  relatedNotificationIds: mongoose.Types.ObjectId[];
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MissingPaperTrackingSchema = new Schema<IMissingPaperTracking>(
  {
    examId: { 
      type: Schema.Types.ObjectId, 
      ref: "Exam", 
      required: true,
      index: true
    },
    studentId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    classId: { 
      type: Schema.Types.ObjectId, 
      ref: "Class", 
      required: true,
      index: true
    },
    subjectId: { 
      type: Schema.Types.ObjectId, 
      ref: "Subject", 
      required: true,
      index: true
    },
    type: { 
      type: String, 
      enum: ["ABSENT", "MISSING_SHEET", "LATE_SUBMISSION", "QUALITY_ISSUE", "ROLL_NUMBER_ISSUE"],
      required: true
    },
    status: { 
      type: String, 
      enum: ["PENDING", "REPORTED", "ACKNOWLEDGED", "RESOLVED", "ESCALATED"],
      default: "PENDING"
    },
    reportedBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    reportedAt: { 
      type: Date, 
      default: Date.now
    },
    reason: { 
      type: String,
      required: true,
      trim: true
    },
    details: { 
      type: String,
      trim: true
    },
    
    // Admin acknowledgment
    acknowledgedBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User"
    },
    acknowledgedAt: { 
      type: Date
    },
    adminRemarks: { 
      type: String,
      trim: true
    },
    
    // Resolution
    resolvedAt: { 
      type: Date
    },
    resolvedBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User"
    },
    resolutionNotes: { 
      type: String,
      trim: true
    },
    
    // Escalation
    escalatedTo: { 
      type: Schema.Types.ObjectId, 
      ref: "User"
    },
    escalatedAt: { 
      type: Date
    },
    escalationReason: { 
      type: String,
      trim: true
    },
    
    // Priority and flags
    priority: { 
      type: String, 
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM"
    },
    isRedFlag: { 
      type: Boolean, 
      default: true // Default to red flag until acknowledged
    },
    requiresAcknowledgment: { 
      type: Boolean, 
      default: true
    },
    
    // Completion tracking
    isCompleted: { 
      type: Boolean, 
      default: false
    },
    completedAt: { 
      type: Date
    },
    completionNotes: { 
      type: String,
      trim: true
    },
    
    // Related entities
    answerSheetId: { 
      type: Schema.Types.ObjectId, 
      ref: "AnswerSheet"
    },
    relatedNotificationIds: [{ 
      type: Schema.Types.ObjectId, 
      ref: "Notification"
    }],
    
    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
MissingPaperTrackingSchema.index({ examId: 1, studentId: 1 });
MissingPaperTrackingSchema.index({ status: 1, priority: 1 });
MissingPaperTrackingSchema.index({ isRedFlag: 1, requiresAcknowledgment: 1 });
MissingPaperTrackingSchema.index({ reportedBy: 1, status: 1 });
MissingPaperTrackingSchema.index({ classId: 1, subjectId: 1, status: 1 });
MissingPaperTrackingSchema.index({ createdAt: -1 });

export const MissingPaperTracking: Model<IMissingPaperTracking> = mongoose.models.MissingPaperTracking || mongoose.model<IMissingPaperTracking>("MissingPaperTracking", MissingPaperTrackingSchema);
