import mongoose, { Document, Model } from "mongoose";
export type BloomsTaxonomyLevel = "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
export type QuestionDifficulty = "EASY" | "MODERATE" | "TOUGHEST";
export type QuestionType = "CHOOSE_BEST_ANSWER" | "FILL_BLANKS" | "ONE_WORD_ANSWER" | "TRUE_FALSE" | "CHOOSE_MULTIPLE_ANSWERS" | "MATCHING_PAIRS" | "DRAWING_DIAGRAM" | "MARKING_PARTS" | "SHORT_ANSWER" | "LONG_ANSWER";
export interface IQuestion extends Document {
    questionText: string;
    questionType: QuestionType;
    subjectId: mongoose.Types.ObjectId;
    classId: mongoose.Types.ObjectId;
    adminId: mongoose.Types.ObjectId;
    unit: string;
    bloomsTaxonomyLevel: BloomsTaxonomyLevel;
    difficulty: QuestionDifficulty;
    isTwisted: boolean;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
    matchingPairs?: {
        left: string;
        right: string;
    }[];
    multipleCorrectAnswers?: string[];
    drawingInstructions?: string;
    markingInstructions?: string;
    visualAids?: string[];
    interactiveElements?: string[];
    marks: number;
    timeLimit?: number;
    createdBy: mongoose.Types.ObjectId;
    isActive: boolean;
    tags?: string[];
    language: string;
}
export declare const Question: Model<IQuestion>;
//# sourceMappingURL=Question.d.ts.map