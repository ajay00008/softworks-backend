import mongoose, { Document, Schema } from 'mongoose';
const QuestionPaperTemplateSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    subjectId: {
        type: Schema.Types.ObjectId,
        ref: "Subject",
        required: true,
        index: true
    },
    adminId: {
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
    templateFile: {
        fileName: { type: String, required: true },
        filePath: { type: String, required: true },
        fileSize: { type: Number, required: true },
        uploadedAt: { type: Date, default: Date.now },
        downloadUrl: { type: String, required: true }
    },
    analysis: {
        totalQuestions: { type: Number, default: 0 },
        questionTypes: [{ type: String }],
        markDistribution: {
            oneMark: { type: Number, default: 0 },
            twoMark: { type: Number, default: 0 },
            threeMark: { type: Number, default: 0 },
            fiveMark: { type: Number, default: 0 },
            totalMarks: { type: Number, default: 0 }
        },
        difficultyLevels: [{ type: String }],
        bloomsDistribution: {
            remember: { type: Number, default: 0 },
            understand: { type: Number, default: 0 },
            apply: { type: Number, default: 0 },
            analyze: { type: Number, default: 0 },
            evaluate: { type: Number, default: 0 },
            create: { type: Number, default: 0 }
        },
        timeDistribution: {
            totalTime: { type: Number, default: 0 },
            perQuestion: { type: Number, default: 0 }
        },
        sections: [{
                name: { type: String, required: true },
                questions: { type: Number, required: true },
                marks: { type: Number, required: true }
            }]
    },
    aiSettings: {
        useTemplate: { type: Boolean, default: true },
        followPattern: { type: Boolean, default: true },
        maintainStructure: { type: Boolean, default: true },
        customInstructions: { type: String }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    version: {
        type: String,
        default: "1.0",
        trim: true
    }
}, { timestamps: true });
// Indexes for efficient queries
QuestionPaperTemplateSchema.index({ subjectId: 1, isActive: 1 });
QuestionPaperTemplateSchema.index({ adminId: 1, isActive: 1 });
QuestionPaperTemplateSchema.index({ uploadedBy: 1, isActive: 1 });
export default mongoose.model('QuestionPaperTemplate', QuestionPaperTemplateSchema);
//# sourceMappingURL=QuestionPaperTemplate.js.map