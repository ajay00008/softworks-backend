import mongoose, { Document, Model } from "mongoose";
export type QuestionPaperStatus = "DRAFT" | "GENERATED" | "PUBLISHED" | "ARCHIVED";
export type QuestionPaperType = "AI_GENERATED" | "PDF_UPLOADED" | "MANUAL";
export interface IQuestionPaper extends Document {
    title: string;
    description?: string;
    examId: mongoose.Types.ObjectId;
    subjectId: mongoose.Types.ObjectId;
    classId: mongoose.Types.ObjectId;
    adminId: mongoose.Types.ObjectId;
    type: QuestionPaperType;
    status: QuestionPaperStatus;
    markDistribution: {
        oneMark: number;
        twoMark: number;
        threeMark: number;
        fiveMark: number;
        totalQuestions: number;
        totalMarks: number;
    };
    bloomsDistribution: {
        level: "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
        percentage: number;
    }[];
    questionTypeDistribution: {
        type: "CHOOSE_BEST_ANSWER" | "FILL_BLANKS" | "ONE_WORD_ANSWER" | "TRUE_FALSE" | "CHOOSE_MULTIPLE_ANSWERS" | "MATCHING_PAIRS" | "DRAWING_DIAGRAM" | "MARKING_PARTS" | "SHORT_ANSWER" | "LONG_ANSWER";
        percentage: number;
    }[];
    questions: mongoose.Types.ObjectId[];
    generatedPdf?: {
        fileName: string;
        filePath: string;
        fileSize: number;
        generatedAt: Date;
        downloadUrl: string;
    };
    aiSettings?: {
        referenceBookUsed?: boolean;
        customInstructions?: string;
        difficultyLevel: "EASY" | "MODERATE" | "TOUGHEST";
        twistedQuestionsPercentage: number;
        useSubjectBook: boolean;
    };
    createdBy: mongoose.Types.ObjectId;
    isActive: boolean;
    generatedAt?: Date;
    publishedAt?: Date;
}
export declare const QuestionPaper: Model<IQuestionPaper>;
//# sourceMappingURL=QuestionPaper.d.ts.map