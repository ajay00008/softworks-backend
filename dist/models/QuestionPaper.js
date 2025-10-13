import mongoose, { Schema, Document, Model } from "mongoose";
const QuestionPaperSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    examId: {
        type: Schema.Types.ObjectId,
        ref: "Exam",
        required: true,
        index: true
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
    adminId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ["AI_GENERATED", "PDF_UPLOADED", "MANUAL"],
        required: true
    },
    status: {
        type: String,
        enum: ["DRAFT", "GENERATED", "PUBLISHED", "ARCHIVED"],
        default: "DRAFT"
    },
    markDistribution: {
        oneMark: { type: Number, required: true, min: 0, max: 100 },
        twoMark: { type: Number, required: true, min: 0, max: 100 },
        threeMark: { type: Number, required: true, min: 0, max: 100 },
        fiveMark: { type: Number, required: true, min: 0, max: 100 },
        totalMarks: { type: Number, required: true, min: 1, max: 1000 }
    },
    bloomsDistribution: [{
            level: {
                type: String,
                enum: ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"],
                required: true
            },
            percentage: { type: Number, required: true, min: 0, max: 100 }
        }],
    questionTypeDistribution: {
        oneMark: [{
                type: {
                    type: String,
                    enum: ["CHOOSE_BEST_ANSWER", "FILL_BLANKS", "ONE_WORD_ANSWER", "TRUE_FALSE", "CHOOSE_MULTIPLE_ANSWERS", "MATCHING_PAIRS", "DRAWING_DIAGRAM", "MARKING_PARTS", "SHORT_ANSWER", "LONG_ANSWER"],
                    required: true
                },
                percentage: { type: Number, required: true, min: 0, max: 100 }
            }],
        twoMark: [{
                type: {
                    type: String,
                    enum: ["CHOOSE_BEST_ANSWER", "FILL_BLANKS", "ONE_WORD_ANSWER", "TRUE_FALSE", "CHOOSE_MULTIPLE_ANSWERS", "MATCHING_PAIRS", "DRAWING_DIAGRAM", "MARKING_PARTS", "SHORT_ANSWER", "LONG_ANSWER"],
                    required: true
                },
                percentage: { type: Number, required: true, min: 0, max: 100 }
            }],
        threeMark: [{
                type: {
                    type: String,
                    enum: ["CHOOSE_BEST_ANSWER", "FILL_BLANKS", "ONE_WORD_ANSWER", "TRUE_FALSE", "CHOOSE_MULTIPLE_ANSWERS", "MATCHING_PAIRS", "DRAWING_DIAGRAM", "MARKING_PARTS", "SHORT_ANSWER", "LONG_ANSWER"],
                    required: true
                },
                percentage: { type: Number, required: true, min: 0, max: 100 }
            }],
        fiveMark: [{
                type: {
                    type: String,
                    enum: ["CHOOSE_BEST_ANSWER", "FILL_BLANKS", "ONE_WORD_ANSWER", "TRUE_FALSE", "CHOOSE_MULTIPLE_ANSWERS", "MATCHING_PAIRS", "DRAWING_DIAGRAM", "MARKING_PARTS", "SHORT_ANSWER", "LONG_ANSWER"],
                    required: true
                },
                percentage: { type: Number, required: true, min: 0, max: 100 }
            }]
    },
    questions: [{
            type: Schema.Types.ObjectId,
            ref: "Question"
        }],
    generatedPdf: {
        fileName: { type: String, trim: true },
        filePath: { type: String, trim: true },
        fileSize: { type: Number, min: 0 },
        generatedAt: { type: Date, default: Date.now },
        downloadUrl: { type: String, trim: true }
    },
    aiSettings: {
        referenceBookUsed: { type: Boolean, default: false },
        customInstructions: { type: String, trim: true, maxlength: 1000 },
        difficultyLevel: {
            type: String,
            enum: ["EASY", "MODERATE", "TOUGHEST"],
            default: "MODERATE"
        },
        twistedQuestionsPercentage: { type: Number, min: 0, max: 50, default: 0 },
        useSubjectBook: { type: Boolean, default: false }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    generatedAt: { type: Date },
    publishedAt: { type: Date }
}, { timestamps: true });
// Indexes for efficient queries
QuestionPaperSchema.index({ adminId: 1, examId: 1 });
QuestionPaperSchema.index({ adminId: 1, subjectId: 1, classId: 1 });
QuestionPaperSchema.index({ adminId: 1, status: 1 });
QuestionPaperSchema.index({ createdBy: 1, isActive: 1 });
// Validation to ensure total marks from questions match the total marks
QuestionPaperSchema.pre('save', function (next) {
    const totalMarksFromQuestions = (this.markDistribution.oneMark * 1) +
        (this.markDistribution.twoMark * 2) +
        (this.markDistribution.threeMark * 3) +
        (this.markDistribution.fiveMark * 5);
    if (totalMarksFromQuestions > this.markDistribution.totalMarks) {
        return next(new Error('Total marks from questions cannot exceed the total marks'));
    }
    if (this.markDistribution.totalMarks === 100 && totalMarksFromQuestions !== 100) {
        return next(new Error('When total marks is 100, the calculated marks from questions must equal exactly 100'));
    }
    // Validate Blooms taxonomy percentages add up to 100
    const bloomsTotal = this.bloomsDistribution.reduce((sum, dist) => sum + dist.percentage, 0);
    if (Math.abs(bloomsTotal - 100) > 0.01) { // Allow small floating point errors
        return next(new Error('Blooms taxonomy percentages must add up to 100%'));
    }
    // Validate question type percentages add up to 100 for each mark category
    const markCategories = ['oneMark', 'twoMark', 'threeMark', 'fiveMark'];
    for (const mark of markCategories) {
        const distributions = this.questionTypeDistribution[mark];
        if (distributions && distributions.length > 0) {
            const typeTotal = distributions.reduce((sum, dist) => sum + dist.percentage, 0);
            if (Math.abs(typeTotal - 100) > 0.01) { // Allow small floating point errors
                return next(new Error(`Question type percentages for ${mark.replace('Mark', ' Mark')} must add up to 100%. Current total: ${typeTotal}%`));
            }
        }
    }
    next();
});
export const QuestionPaper = mongoose.models.QuestionPaper || mongoose.model("QuestionPaper", QuestionPaperSchema);
//# sourceMappingURL=QuestionPaper.js.map