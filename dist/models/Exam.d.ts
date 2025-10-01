import mongoose, { Document, Model } from "mongoose";
export type ExamStatus = "DRAFT" | "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED";
export type ExamType = "UNIT_TEST" | "MID_TERM" | "FINAL" | "QUIZ" | "ASSIGNMENT" | "PRACTICAL";
export interface IExam extends Document {
    title: string;
    description?: string;
    examType: ExamType;
    subjectId: mongoose.Types.ObjectId;
    classId: mongoose.Types.ObjectId;
    adminId: mongoose.Types.ObjectId;
    totalMarks: number;
    duration: number;
    status: ExamStatus;
    scheduledDate: Date;
    endDate?: Date;
    createdBy: mongoose.Types.ObjectId;
    questions: mongoose.Types.ObjectId[];
    questionDistribution: {
        unit: string;
        bloomsLevel: string;
        difficulty: string;
        percentage: number;
        twistedPercentage?: number;
    }[];
    instructions?: string;
    isActive: boolean;
    allowLateSubmission: boolean;
    lateSubmissionPenalty?: number;
}
export declare const Exam: Model<IExam>;
//# sourceMappingURL=Exam.d.ts.map