import mongoose, { Document } from 'mongoose';
export interface IQuestionPaperTemplate extends Document {
    title: string;
    description?: string;
    subjectId: mongoose.Types.ObjectId;
    examType: string;
    adminId: mongoose.Types.ObjectId;
    uploadedBy: mongoose.Types.ObjectId;
    templateFile: {
        fileName: string;
        filePath: string;
        fileSize: number;
        uploadedAt: Date;
        downloadUrl: string;
    };
    analysis: {
        totalQuestions: number;
        questionTypes: string[];
        markDistribution: {
            oneMark: number;
            twoMark: number;
            threeMark: number;
            fiveMark: number;
            totalMarks: number;
        };
        difficultyLevels: string[];
        bloomsDistribution: {
            remember: number;
            understand: number;
            apply: number;
            analyze: number;
            evaluate: number;
            create: number;
        };
        timeDistribution: {
            totalTime: number;
            perQuestion: number;
        };
        sections: Array<{
            name: string;
            questions: number;
            marks: number;
        }>;
    };
    aiValidation: {
        isValid: boolean;
        confidence: number;
        detectedSubject?: string;
        detectedExamType?: string;
        validationErrors: string[];
        suggestions: string[];
        validatedAt: Date;
    };
    aiSettings: {
        useTemplate: boolean;
        followPattern: boolean;
        maintainStructure: boolean;
        customInstructions?: string;
    };
    isActive: boolean;
    version: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IQuestionPaperTemplate, {}, {}, {}, mongoose.Document<unknown, {}, IQuestionPaperTemplate, {}, {}> & IQuestionPaperTemplate & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=QuestionPaperTemplate.d.ts.map