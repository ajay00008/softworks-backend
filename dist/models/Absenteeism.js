import mongoose, { Schema, Document, Model } from "mongoose";
const AbsenteeismSchema = new Schema({
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
}, { timestamps: true });
// Indexes for efficient queries
AbsenteeismSchema.index({ examId: 1, studentId: 1 });
AbsenteeismSchema.index({ status: 1, priority: 1 });
AbsenteeismSchema.index({ reportedBy: 1, reportedAt: 1 });
AbsenteeismSchema.index({ acknowledgedBy: 1, acknowledgedAt: 1 });
AbsenteeismSchema.index({ type: 1, isActive: 1 });
export const Absenteeism = mongoose.models.Absenteeism || mongoose.model("Absenteeism", AbsenteeismSchema);
//# sourceMappingURL=Absenteeism.js.map