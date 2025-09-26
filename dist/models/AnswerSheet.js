import mongoose, { Schema, Document, Model } from "mongoose";
const AnswerSheetSchema = new Schema({
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
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    originalFileName: {
        type: String,
        required: true,
        trim: true
    },
    cloudStorageUrl: {
        type: String,
        required: true
    },
    cloudStorageKey: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ["UPLOADED", "PROCESSING", "AI_CORRECTED", "MANUALLY_REVIEWED", "COMPLETED", "MISSING", "ABSENT"],
        default: "UPLOADED"
    },
    scanQuality: {
        type: String,
        enum: ["EXCELLENT", "GOOD", "FAIR", "POOR", "UNREADABLE"],
        default: "GOOD"
    },
    isAligned: {
        type: Boolean,
        default: true
    },
    rollNumberDetected: {
        type: String,
        trim: true
    },
    rollNumberConfidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    aiCorrectionResults: {
        totalMarks: { type: Number, min: 0 },
        answers: [{
                questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
                detectedAnswer: { type: String, required: true },
                isCorrect: { type: Boolean, required: true },
                marksObtained: { type: Number, required: true, min: 0 },
                confidence: { type: Number, required: true, min: 0, max: 100 },
                reasoning: { type: String, required: true },
                corrections: [{ type: String }]
            }],
        strengths: [{ type: String }],
        weakAreas: [{ type: String }],
        unansweredQuestions: [{ type: Schema.Types.ObjectId, ref: "Question" }],
        irrelevantAnswers: [{ type: String }],
        overallFeedback: { type: String }
    },
    manualOverrides: [{
            questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
            correctedAnswer: { type: String, required: true },
            correctedMarks: { type: Number, required: true, min: 0 },
            reason: { type: String, required: true },
            correctedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
            correctedAt: { type: Date, required: true }
        }],
    isMissing: {
        type: Boolean,
        default: false,
        index: true
    },
    missingReason: {
        type: String,
        trim: true
    },
    isAbsent: {
        type: Boolean,
        default: false,
        index: true
    },
    absentReason: {
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
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    processedAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    language: {
        type: String,
        default: "ENGLISH",
        enum: ["ENGLISH", "TAMIL", "HINDI", "MALAYALAM", "TELUGU", "KANNADA", "FRENCH"]
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });
// Indexes for efficient queries
AnswerSheetSchema.index({ examId: 1, studentId: 1 }, { unique: true });
AnswerSheetSchema.index({ status: 1, uploadedAt: 1 });
AnswerSheetSchema.index({ isMissing: 1, isAbsent: 1 });
AnswerSheetSchema.index({ uploadedBy: 1, status: 1 });
AnswerSheetSchema.index({ acknowledgedBy: 1, acknowledgedAt: 1 });
AnswerSheetSchema.index({ cloudStorageKey: 1 });
export const AnswerSheet = mongoose.models.AnswerSheet || mongoose.model("AnswerSheet", AnswerSheetSchema);
//# sourceMappingURL=AnswerSheet.js.map