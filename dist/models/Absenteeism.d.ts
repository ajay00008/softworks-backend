import mongoose, { Document, Model } from "mongoose";
export type AbsenteeismStatus = "PENDING" | "ACKNOWLEDGED" | "RESOLVED" | "ESCALATED";
export type AbsenteeismType = "ABSENT" | "MISSING_SHEET" | "LATE_SUBMISSION";
export interface IAbsenteeism extends Document {
    examId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    type: AbsenteeismType;
    status: AbsenteeismStatus;
    reportedBy: mongoose.Types.ObjectId;
    reportedAt: Date;
    reason?: string;
    acknowledgedBy?: mongoose.Types.ObjectId;
    acknowledgedAt?: Date;
    adminRemarks?: string;
    resolvedAt?: Date;
    escalatedTo?: mongoose.Types.ObjectId;
    escalatedAt?: Date;
    isActive: boolean;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}
export declare const Absenteeism: Model<IAbsenteeism>;
//# sourceMappingURL=Absenteeism.d.ts.map