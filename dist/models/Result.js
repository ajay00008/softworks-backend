import mongoose, { Schema, Document, Model } from "mongoose";
const ResultSchema = new Schema({
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
    answers: [{
            questionId: {
                type: Schema.Types.ObjectId,
                ref: "Question",
                required: true
            },
            answer: {
                type: String,
                required: true,
                trim: true
            },
            isCorrect: {
                type: Boolean,
                required: true
            },
            marksObtained: {
                type: Number,
                required: true,
                min: 0
            },
            timeSpent: {
                type: Number,
                min: 0
            }
        }],
    totalMarksObtained: {
        type: Number,
        required: true,
        min: 0
    },
    percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    grade: {
        type: String,
        trim: true,
        uppercase: true
    },
    submissionStatus: {
        type: String,
        enum: ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "LATE_SUBMISSION", "ABSENT", "MISSING_SHEET"],
        default: "NOT_STARTED"
    },
    submittedAt: {
        type: Date
    },
    startedAt: {
        type: Date
    },
    timeSpent: {
        type: Number,
        min: 0
    },
    isAbsent: {
        type: Boolean,
        default: false
    },
    isMissingSheet: {
        type: Boolean,
        default: false
    },
    absentReason: {
        type: String,
        trim: true
    },
    missingSheetReason: {
        type: String,
        trim: true
    },
    markedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    markedAt: {
        type: Date
    },
    remarks: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });
// Compound index to ensure one result per student per exam
ResultSchema.index({ examId: 1, studentId: 1 }, { unique: true });
// Indexes for efficient queries
ResultSchema.index({ examId: 1, submissionStatus: 1 });
ResultSchema.index({ studentId: 1, isActive: 1 });
ResultSchema.index({ isAbsent: 1, isMissingSheet: 1 });
ResultSchema.index({ markedBy: 1, markedAt: 1 });
export const Result = mongoose.models.Result || mongoose.model("Result", ResultSchema);
//# sourceMappingURL=Result.js.map