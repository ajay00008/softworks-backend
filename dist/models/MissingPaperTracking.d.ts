import mongoose, { Document, Model } from "mongoose";
export type MissingPaperStatus = "PENDING" | "REPORTED" | "ACKNOWLEDGED" | "RESOLVED" | "ESCALATED";
export type MissingPaperType = "ABSENT" | "MISSING_SHEET" | "LATE_SUBMISSION" | "QUALITY_ISSUE" | "ROLL_NUMBER_ISSUE";
export interface IMissingPaperTracking extends Document {
    examId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    classId: mongoose.Types.ObjectId;
    subjectId: mongoose.Types.ObjectId;
    type: MissingPaperType;
    status: MissingPaperStatus;
    reportedBy: mongoose.Types.ObjectId;
    reportedAt: Date;
    reason: string;
    details?: string;
    acknowledgedBy?: mongoose.Types.ObjectId;
    acknowledgedAt?: Date;
    adminRemarks?: string;
    resolvedAt?: Date;
    resolvedBy?: mongoose.Types.ObjectId;
    resolutionNotes?: string;
    escalatedTo?: mongoose.Types.ObjectId;
    escalatedAt?: Date;
    escalationReason?: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    isRedFlag: boolean;
    requiresAcknowledgment: boolean;
    isCompleted: boolean;
    completedAt?: Date;
    completionNotes?: string;
    answerSheetId?: mongoose.Types.ObjectId;
    relatedNotificationIds: mongoose.Types.ObjectId[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const MissingPaperTracking: Model<IMissingPaperTracking>;
//# sourceMappingURL=MissingPaperTracking.d.ts.map