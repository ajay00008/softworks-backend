import mongoose, { Schema, Document, Model } from "mongoose";
const QuestionPaperTemplateSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
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
    gradeLevel: {
        type: String,
        enum: ["PRE_KG", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
        required: true,
        index: true
    },
    // Basic paper settings
    totalMarks: {
        type: Number,
        required: true,
        min: 1,
        max: 1000
    },
    examName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    duration: {
        type: Number,
        required: true,
        min: 15,
        max: 480 // 8 hours max
    },
    // Mark distribution
    markDistribution: [{
            marks: { type: Number, required: true, min: 1, max: 100 },
            count: { type: Number, required: true, min: 0 },
            percentage: { type: Number, required: true, min: 0, max: 100 }
        }],
    // Bloom's taxonomy distribution
    bloomsDistribution: [{
            level: {
                type: String,
                enum: ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"],
                required: true
            },
            percentage: { type: Number, required: true, min: 0, max: 100 },
            twistedPercentage: { type: Number, min: 0, max: 100 }
        }],
    // Question type distribution
    questionTypeDistribution: [{
            type: {
                type: String,
                enum: ["MULTIPLE_CHOICE", "FILL_BLANKS", "ONE_WORD_ANSWER", "TRUE_FALSE", "MULTIPLE_ANSWERS", "MATCHING_PAIRS", "DRAWING_DIAGRAM", "MARKING_PARTS"],
                required: true
            },
            percentage: { type: Number, required: true, min: 0, max: 100 },
            marksPerQuestion: { type: Number, required: true, min: 1, max: 100 }
        }],
    // Unit and page selection
    unitSelections: [{
            unitId: { type: String, required: true },
            unitName: { type: String, required: true },
            pages: {
                startPage: { type: Number, min: 1 },
                endPage: { type: Number, min: 1 }
            },
            topics: [{ type: String, trim: true }]
        }],
    // Twisted questions settings
    twistedQuestionsPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 50 // Maximum 50% twisted questions
    },
    // Grade-specific settings
    gradeSpecificSettings: {
        ageAppropriate: { type: Boolean, default: true },
        cognitiveLevel: {
            type: String,
            enum: ["PRE_SCHOOL", "PRIMARY", "MIDDLE", "SECONDARY", "SENIOR_SECONDARY"],
            required: true
        },
        languageComplexity: {
            type: String,
            enum: ["VERY_SIMPLE", "SIMPLE", "MODERATE", "COMPLEX", "VERY_COMPLEX"],
            required: true
        },
        visualAids: { type: Boolean, default: false },
        interactiveElements: { type: Boolean, default: false }
    },
    // Template metadata
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
    isPublic: {
        type: Boolean,
        default: false
    },
    tags: [{
            type: String,
            trim: true
        }],
    // Usage statistics
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsed: {
        type: Date
    }
}, { timestamps: true });
// Indexes for efficient queries
QuestionPaperTemplateSchema.index({ subjectId: 1, classId: 1 });
QuestionPaperTemplateSchema.index({ gradeLevel: 1, subjectId: 1 });
QuestionPaperTemplateSchema.index({ createdBy: 1, isActive: 1 });
QuestionPaperTemplateSchema.index({ isPublic: 1, isActive: 1 });
QuestionPaperTemplateSchema.index({ name: 1, createdBy: 1 });
// Compound index for template search
QuestionPaperTemplateSchema.index({
    subjectId: 1,
    classId: 1,
    gradeLevel: 1,
    isActive: 1
});
export const QuestionPaperTemplate = mongoose.models.QuestionPaperTemplate ||
    mongoose.model("QuestionPaperTemplate", QuestionPaperTemplateSchema);
//# sourceMappingURL=QuestionPaperTemplate.js.map