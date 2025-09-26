import mongoose, { Schema, Document, Model } from "mongoose";
const ExamSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    examType: {
        type: String,
        enum: ["UNIT_TEST", "MID_TERM", "FINAL", "QUIZ", "ASSIGNMENT", "PRACTICAL"],
        required: true
    },
    subjectId: {
        type: Schema.Types.ObjectId,
        ref: "Subject",
        required: true,
        index: true
    },
    classId: {
        type: Schema.Types.ObjectId,
        ref: "Class",
        required: true,
        index: true
    },
    totalMarks: {
        type: Number,
        required: true,
        min: 1,
        max: 1000
    },
    duration: {
        type: Number,
        required: true,
        min: 15,
        max: 480 // 8 hours max
    },
    status: {
        type: String,
        enum: ["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"],
        default: "DRAFT"
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    questions: [{
            type: Schema.Types.ObjectId,
            ref: "Question"
        }],
    questionDistribution: [{
            unit: { type: String, required: true },
            bloomsLevel: { type: String, required: true },
            difficulty: { type: String, required: true },
            percentage: { type: Number, required: true, min: 0, max: 100 },
            twistedPercentage: { type: Number, min: 0, max: 100 }
        }],
    instructions: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    allowLateSubmission: {
        type: Boolean,
        default: false
    },
    lateSubmissionPenalty: {
        type: Number,
        min: 0,
        max: 100
    }
}, { timestamps: true });
// Indexes for efficient queries
ExamSchema.index({ subjectId: 1, classId: 1 });
ExamSchema.index({ status: 1, scheduledDate: 1 });
ExamSchema.index({ createdBy: 1, isActive: 1 });
ExamSchema.index({ examType: 1, classId: 1 });
export const Exam = mongoose.models.Exam || mongoose.model("Exam", ExamSchema);
//# sourceMappingURL=Exam.js.map