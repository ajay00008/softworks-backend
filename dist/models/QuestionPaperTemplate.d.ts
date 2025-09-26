import mongoose, { Document, Model } from "mongoose";
export type QuestionType = "MULTIPLE_CHOICE" | "FILL_BLANKS" | "ONE_WORD_ANSWER" | "TRUE_FALSE" | "MULTIPLE_ANSWERS" | "MATCHING_PAIRS" | "DRAWING_DIAGRAM" | "MARKING_PARTS";
export type BloomsTaxonomyLevel = "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
export type GradeLevel = "PRE_KG" | "LKG" | "UKG" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12";
export interface MarkDistribution {
    marks: number;
    count: number;
    percentage: number;
}
export interface BloomsDistribution {
    level: BloomsTaxonomyLevel;
    percentage: number;
    twistedPercentage?: number;
}
export interface QuestionTypeDistribution {
    type: QuestionType;
    percentage: number;
    marksPerQuestion: number;
}
export interface UnitSelection {
    unitId: string;
    unitName: string;
    pages?: {
        startPage: number;
        endPage: number;
    };
    topics: string[];
}
export interface IQuestionPaperTemplate extends Document {
    name: string;
    description?: string;
    subjectId: mongoose.Types.ObjectId;
    classId: mongoose.Types.ObjectId;
    gradeLevel: GradeLevel;
    totalMarks: number;
    examName: string;
    duration: number;
    markDistribution: MarkDistribution[];
    bloomsDistribution: BloomsDistribution[];
    questionTypeDistribution: QuestionTypeDistribution[];
    unitSelections: UnitSelection[];
    twistedQuestionsPercentage: number;
    gradeSpecificSettings: {
        ageAppropriate: boolean;
        cognitiveLevel: string;
        languageComplexity: string;
        visualAids: boolean;
        interactiveElements: boolean;
    };
    createdBy: mongoose.Types.ObjectId;
    isActive: boolean;
    isPublic: boolean;
    tags: string[];
    usageCount: number;
    lastUsed?: Date;
}
export declare const QuestionPaperTemplate: Model<IQuestionPaperTemplate>;
//# sourceMappingURL=QuestionPaperTemplate.d.ts.map