import mongoose, { Schema, Document, Model } from "mongoose";

export type AbsenteeismStatus = "PENDING" | "ACKNOWLEDGED" | "RESOLVED" | "ESCALATED";
export type AbsenteeismType = "ABSENT" | "MISSING_SHEET" | "LATE_SUBMISSION";

export interface IAbsenteeism extends Document {
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  type: AbsenteeismType;
  status: AbsenteeismStatus;
  reportedBy: mongoose.Types.ObjectId; // Teacher who reported
  reportedAt: Date;
  reason?: string;
  acknowledgedBy?: mongoose.Types.ObjectId; // Admin who acknowledged
  acknowledgedAt?: Date;
  adminRemarks?: string;
  resolvedAt?: Date;
  escalatedTo?: mongoose.Types.ObjectId; // If escalated to higher authority
  escalatedAt?: Date;
  isActive: boolean;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

const AbsenteeismSchema = new Schema<IAbsenteeism>(
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
    type: { 
      type: String, 
      enum: ["ABSENT", "MISSING_SHEET", "LATE_SUBMISSION"],
      required: true
    },
    status: { 
      type: String, 
      enum: ["PENDING", "ACKNOWLEDGED", "RESOLVED", "ESCALATED"],
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
      trim: true
    },
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
    resolvedAt: { 
      type: Date
    },
    escalatedTo: { 
      type: Schema.Types.ObjectId, 
      ref: "User"
    },
    escalatedAt: { 
      type: Date
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    priority: { 
      type: String, 
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM"
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
AbsenteeismSchema.index({ examId: 1, studentId: 1 });
AbsenteeismSchema.index({ status: 1, priority: 1 });
AbsenteeismSchema.index({ reportedBy: 1, reportedAt: 1 });
AbsenteeismSchema.index({ acknowledgedBy: 1, acknowledgedAt: 1 });
AbsenteeismSchema.index({ type: 1, isActive: 1 });

export const Absenteeism: Model<IAbsenteeism> = mongoose.models.Absenteeism || mongoose.model<IAbsenteeism>("Absenteeism", AbsenteeismSchema);
